import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.deps import CurrentUser, get_current_user
from app.db.base import Base, Client as ClientModel, Company, Role, User, WorkOrder, WorkOrderStatusHistory
from app.db.connection import get_db
from app.routes.work_orders import router as work_orders_router
from app.services.rbac_service import bootstrap_rbac


@pytest.fixture
def client_and_session(tmp_path, monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    bootstrap_rbac(db)

    admin_role = db.query(Role).filter(Role.name == "Admin").first()
    tech_role = db.query(Role).filter(Role.name == "Tecnico").first()
    company_a = Company(name="Empresa A", tax_id="1", is_independent=False)
    company_b = Company(name="Empresa B", tax_id="2", is_independent=False)
    db.add(company_a)
    db.add(company_b)
    db.flush()

    admin = User(
        username="admin-a",
        email="admin-a@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
        company=company_a,
        primary_role=admin_role,
    )
    tech = User(
        username="tech-a",
        email="tech-a@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
        full_name="Tecnico A",
        company=company_a,
        primary_role=tech_role,
    )
    other_admin = User(
        username="admin-b",
        email="admin-b@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
        company=company_b,
        primary_role=admin_role,
    )
    client_a = ClientModel(nombre="Cliente A", rut="11.111.111-1", company=company_a)
    client_b = ClientModel(nombre="Cliente B", rut="22.222.222-2", company=company_b)
    db.add_all([admin, tech, other_admin, client_a, client_b])
    db.commit()
    for row in [admin, tech, other_admin, client_a, client_b]:
        db.refresh(row)

    app = FastAPI()
    monkeypatch.setattr("app.routes.work_orders.EVIDENCE_DIR", tmp_path)
    app.include_router(work_orders_router, prefix="/api/v1/work-orders")

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    test_client = TestClient(app)
    yield test_client, TestingSessionLocal, app, admin, tech, other_admin, client_a, client_b

    db.close()


def as_user(app: FastAPI, user: User, permissions: list[str], role: str = "Admin") -> None:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=user.username,
        user_id=user.id,
        company_id=user.company_id,
        role=role,
        permissions=permissions,
    )


def create_ot(client: TestClient, client_id: int, technician_id: int | None = None):
    return client.post(
        "/api/v1/work-orders/",
        json={
            "title": "Mantencion equipo split",
            "client_id": client_id,
            "technician_id": technician_id,
            "equipment_info": "Split 18.000 BTU",
            "visit_type": "charged",
            "visit_cost": 25000,
            "diagnosis_notes": "Equipo no enfria",
        },
    )


def test_admin_can_create_and_read_work_order_with_nested_data(client_and_session):
    client, _Session, app, admin, tech, _other_admin, client_a, _client_b = client_and_session
    as_user(app, admin, ["workorders.create", "workorders.read"], role="Admin")

    response = create_ot(client, client_a.id, tech.id)

    assert response.status_code == 201
    body = response.json()
    assert body["company_id"] == admin.company_id
    assert body["client"]["nombre"] == "Cliente A"
    assert body["technician"]["name"] == "Tecnico A"
    assert body["status"] == "diagnosis"
    assert body["status_history"][0]["from_status"] is None
    assert body["status_history"][0]["to_status"] == "diagnosis"
    assert body["status_history"][0]["changed_by"] == {
        "id": admin.id,
        "name": admin.username,
        "email": admin.email,
    }
    assert body["status_history"][0]["created_at"].endswith("Z")

    list_response = client.get("/api/v1/work-orders/")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_transition_and_rejection_append_chronological_history(client_and_session):
    client, _Session, app, admin, tech, _other_admin, client_a, _client_b = client_and_session
    as_user(app, admin, ["workorders.create", "workorders.read", "workorders.update"], role="Admin")
    work_order = create_ot(client, client_a.id, tech.id).json()

    response = client.patch(
        f"/api/v1/work-orders/{work_order['id']}/transition",
        json={"status": "rejected"},
    )

    assert response.status_code == 200
    history = response.json()["status_history"]
    assert [(row["from_status"], row["to_status"]) for row in history] == [
        (None, "diagnosis"),
        ("diagnosis", "rejected"),
    ]
    assert history[-1]["changed_by"]["id"] == admin.id


def test_status_history_is_not_visible_across_companies(client_and_session):
    client, _Session, app, admin, tech, other_admin, client_a, _client_b = client_and_session
    as_user(app, admin, ["workorders.create", "workorders.read"], role="Admin")
    work_order = create_ot(client, client_a.id, tech.id).json()

    as_user(app, other_admin, ["workorders.read"], role="Admin")
    response = client.get(f"/api/v1/work-orders/{work_order['id']}")

    assert response.status_code == 404


def test_status_change_rolls_back_when_history_insert_fails(client_and_session, monkeypatch):
    client, Session, app, admin, tech, _other_admin, client_a, _client_b = client_and_session
    as_user(app, admin, ["workorders.create", "workorders.read", "workorders.update"], role="Admin")
    work_order = create_ot(client, client_a.id, tech.id).json()

    def fail_history(*_args, **_kwargs):
        raise RuntimeError("history insert failed")

    monkeypatch.setattr("app.services.work_order_service.record_status_change", fail_history)
    with pytest.raises(RuntimeError, match="history insert failed"):
        client.patch(
            f"/api/v1/work-orders/{work_order['id']}/transition",
            json={"status": "rejected"},
        )

    db = Session()
    try:
        stored = db.query(WorkOrder).filter(WorkOrder.id == work_order["id"]).one()
        history = (
            db.query(WorkOrderStatusHistory)
            .filter(WorkOrderStatusHistory.work_order_id == work_order["id"])
            .all()
        )
        assert stored.status == "diagnosis"
        assert len(history) == 1
    finally:
        db.close()


def test_admin_can_be_assigned_to_work_order(client_and_session):
    client, _Session, app, admin, _tech, _other_admin, client_a, _client_b = client_and_session
    as_user(app, admin, ["workorders.create", "workorders.read"], role="Admin")

    response = create_ot(client, client_a.id, admin.id)

    assert response.status_code == 201
    body = response.json()
    assert body["technician_id"] == admin.id
    assert body["technician"]["email"] == admin.email


def test_work_order_rejects_client_from_other_company(client_and_session):
    client, _Session, app, admin, _tech, _other_admin, _client_a, client_b = client_and_session
    as_user(app, admin, ["workorders.create"], role="Admin")

    response = create_ot(client, client_b.id)

    assert response.status_code == 422


def test_technician_lists_only_assigned_work_orders(client_and_session):
    client, _Session, app, admin, tech, _other_admin, client_a, _client_b = client_and_session
    as_user(app, admin, ["workorders.create", "workorders.read"], role="Admin")
    assigned = create_ot(client, client_a.id, tech.id).json()
    create_ot(client, client_a.id, None)

    as_user(app, tech, ["workorders.read.assigned", "workorders.update.assigned"], role="Tecnico")
    response = client.get("/api/v1/work-orders/")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [assigned["id"]]


def test_technician_can_create_work_order_assigned_to_self(client_and_session):
    client, _Session, app, _admin, tech, _other_admin, client_a, _client_b = client_and_session
    as_user(app, tech, ["workorders.create", "workorders.read.assigned"], role="Tecnico")

    response = create_ot(client, client_a.id, None)

    assert response.status_code == 201
    body = response.json()
    assert body["technician_id"] == tech.id
    assert body["technician"]["email"] == tech.email


def test_technician_cannot_create_work_order_assigned_to_another_user(client_and_session):
    client, _Session, app, admin, tech, _other_admin, client_a, _client_b = client_and_session
    as_user(app, tech, ["workorders.create", "workorders.read.assigned"], role="Tecnico")

    response = create_ot(client, client_a.id, admin.id)

    assert response.status_code == 403


def test_quotation_evidence_and_payment_flow(client_and_session):
    client, _Session, app, admin, tech, _other_admin, client_a, _client_b = client_and_session
    as_user(
        app,
        admin,
        ["workorders.create", "workorders.read", "workorders.update", "quotations.manage", "evidences.manage", "payments.manage"],
        role="Admin",
    )
    work_order = create_ot(client, client_a.id, tech.id).json()

    quotation_response = client.post(
        f"/api/v1/work-orders/{work_order['id']}/quotation",
        json={
            "items": [
                {"description": "Mano de obra", "qty": 1, "unit_price": 50000},
                {"description": "Repuesto", "qty": 2, "unit_price": 15000},
            ],
            "discount": 5000,
            "conditions": "Pago contado",
            "warranty": "90 dias",
            "validity_days": 10,
        },
    )
    assert quotation_response.status_code == 201
    quotation = quotation_response.json()
    assert quotation["subtotal"] == 80000
    assert quotation["total"] == 75000
    assert len(quotation["items"]) == 2

    evidence_response = client.post(
        f"/api/v1/work-orders/{work_order['id']}/evidences",
        data={"description": "Foto equipo", "stage": "in_execution"},
        files={"file": ("evidence.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )
    assert evidence_response.status_code == 201
    evidence = evidence_response.json()
    assert evidence["url"].startswith("/api/v1/work-orders/evidences/")
    assert evidence["stage"] == "diagnosis"
    assert evidence["uploaded_by"] == {
        "id": admin.id,
        "name": admin.username,
        "email": admin.email,
    }

    evidence_list = client.get(f"/api/v1/work-orders/{work_order['id']}/evidences")
    assert evidence_list.status_code == 200
    assert evidence_list.json()[0]["stage"] == "diagnosis"
    assert evidence_list.json()[0]["uploaded_by"]["id"] == admin.id

    payment_response = client.post(
        f"/api/v1/work-orders/{work_order['id']}/payment",
        json={"amount": 75000, "method": "transferencia"},
    )
    assert payment_response.status_code == 201
    assert payment_response.json()["amount"] == 75000

    detail = client.get(f"/api/v1/work-orders/{work_order['id']}").json()
    assert detail["payment"]["amount"] == 75000
    assert detail["status"] == "paid"
    assert [(row["from_status"], row["to_status"]) for row in detail["status_history"]] == [
        (None, "diagnosis"),
        ("diagnosis", "paid"),
    ]


def test_approved_work_order_quotation_cannot_be_modified(client_and_session):
    client, _Session, app, admin, tech, _other_admin, client_a, _client_b = client_and_session
    as_user(
        app,
        admin,
        ["workorders.create", "workorders.read", "workorders.update", "quotations.manage"],
        role="Admin",
    )
    work_order = create_ot(client, client_a.id, tech.id).json()
    quotation_response = client.post(
        f"/api/v1/work-orders/{work_order['id']}/quotation",
        json={
            "items": [{"description": "Mano de obra", "qty": 1, "unit_price": 50000}],
            "discount": 0,
            "conditions": "Pago contado",
            "warranty": "90 dias",
            "validity_days": 10,
        },
    )
    assert quotation_response.status_code == 201
    assert quotation_response.json()["total"] == 50000

    send_response = client.post(f"/api/v1/work-orders/{work_order['id']}/quotation/send")
    assert send_response.status_code == 200
    assert send_response.json()["status_history"][-1]["to_status"] == "quotation_sent"

    approve_response = client.patch(
        f"/api/v1/work-orders/{work_order['id']}/transition",
        json={"status": "approved"},
    )
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"
    assert approve_response.json()["status_history"][-1]["from_status"] == "quotation_sent"

    update_response = client.put(
        f"/api/v1/work-orders/{work_order['id']}/quotation",
        json={
            "items": [{"description": "Repuesto", "qty": 1, "unit_price": 100000}],
            "discount": 0,
            "conditions": "Pago transferencia",
            "warranty": "180 dias",
            "validity_days": 15,
        },
    )
    assert update_response.status_code == 422
    assert update_response.json()["detail"] == "Approved quotations cannot be modified"

    quotation = client.get(f"/api/v1/work-orders/{work_order['id']}/quotation").json()
    assert quotation["total"] == 50000
    assert quotation["items"][0]["description"] == "Mano de obra"
    assert quotation["warranty"] == "90 dias"


def test_quotation_pdf_is_generated_with_pdf_content_type(client_and_session):
    client, _Session, app, admin, tech, _other_admin, client_a, _client_b = client_and_session
    as_user(
        app,
        admin,
        ["workorders.create", "workorders.read", "quotations.manage"],
        role="Admin",
    )
    work_order = create_ot(client, client_a.id, tech.id).json()
    client.post(
        f"/api/v1/work-orders/{work_order['id']}/quotation",
        json={
            "items": [{"description": "Mantencion preventiva", "qty": 1, "unit_price": 65000}],
            "discount": 0,
            "conditions": "Pago contra entrega",
            "warranty": "Garantia 30 dias",
            "validity_days": 15,
        },
    )

    response = client.get(f"/api/v1/work-orders/{work_order['id']}/quotation/pdf")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert b"%%EOF" in response.content


def test_quotation_pdf_preserves_accents_and_long_item_descriptions(client_and_session):
    client, _Session, app, admin, tech, _other_admin, client_a, _client_b = client_and_session
    as_user(
        app,
        admin,
        ["workorders.create", "workorders.read", "quotations.manage"],
        role="Admin",
    )
    work_order = create_ot(client, client_a.id, tech.id).json()
    client.post(
        f"/api/v1/work-orders/{work_order['id']}/quotation",
        json={
            "items": [
                {
                    "description": "Instalación y mantención correctiva de equipo con revisión de presión y configuración",
                    "qty": 1,
                    "unit_price": 125000,
                }
            ],
            "discount": 0,
            "conditions": "Cotización válida según aprobación del cliente",
            "warranty": "Garantía técnica por instalación",
            "validity_days": 15,
        },
    )

    response = client.get(f"/api/v1/work-orders/{work_order['id']}/quotation/pdf")

    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
    assert b"Descripci\\363n" in response.content
    assert b"COTIZACI\\323N" in response.content
    assert b"Cotizaci\\363n" in response.content
    assert b"Instalaci\\363n" in response.content
