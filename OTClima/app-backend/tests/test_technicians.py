import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.deps import CurrentUser, get_current_user
from app.auth.hash_utils import verify_password
from app.db.base import Base, Company, Role, User
from app.db.connection import get_db
from app.routes.technicians import router as technicians_router
from app.services.rbac_service import bootstrap_rbac


@pytest.fixture
def client_and_session():
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
    tecnico_role = db.query(Role).filter(Role.name == "Tecnico").first()
    company_a = Company(name="Empresa A", tax_id="1", is_independent=False)
    company_b = Company(name="Empresa B", tax_id="2", is_independent=False)
    db.add(company_a)
    db.add(company_b)
    db.flush()

    admin_user = User(
        username="admin",
        email="admin@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
        company=company_a,
        primary_role=admin_role,
    )
    tecnico_user = User(
        username="tech",
        email="tech@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
        full_name="Tecnico Base",
        company=company_a,
        primary_role=tecnico_role,
    )
    other_tecnico_user = User(
        username="other-tech",
        email="other-tech@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
        full_name="Tecnico Otra Empresa",
        company=company_b,
        primary_role=tecnico_role,
    )
    db.add(admin_user)
    db.add(tecnico_user)
    db.add(other_tecnico_user)
    db.commit()
    db.refresh(admin_user)
    db.refresh(tecnico_user)

    app = FastAPI()
    app.include_router(technicians_router, prefix="/api/v1/technicians")

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)
    yield client, TestingSessionLocal, admin_user, tecnico_user, other_tecnico_user, app

    db.close()


def test_admin_can_create_login_enabled_technician(client_and_session):
    client, TestingSessionLocal, admin_user, _tecnico_user, _other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="Admin",
        permissions=[
            "technicians.create",
            "technicians.read",
            "technicians.update",
            "technicians.delete",
        ],
    )

    response = client.post(
        "/api/v1/technicians/",
        json={
            "name": "Ana Tecnica",
            "email": "ana.tech@example.com",
            "password": "secret123",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Ana Tecnica"
    assert body["email"] == "ana.tech@example.com"
    assert body["role"] == "technician"
    assert body["is_active"] is True
    assert body["active_ots"] == 0
    assert body["company_id"] == admin_user.company_id

    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "ana.tech@example.com").first()
    assert user is not None
    assert user.primary_role is not None
    assert user.primary_role.name == "Tecnico"
    assert user.is_verified is True
    assert user.account_status == "approved"
    assert verify_password("secret123", user.hashed_password)
    db.close()


def test_admin_can_list_and_toggle_technicians(client_and_session):
    client, _TestingSessionLocal, admin_user, tecnico_user, _other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="Admin",
        permissions=["technicians.read", "technicians.update"],
    )

    list_response = client.get("/api/v1/technicians/")
    assert list_response.status_code == 200
    assert {item["email"] for item in list_response.json()} == {"admin@example.com", "tech@example.com"}

    toggle_response = client.patch(f"/api/v1/technicians/{tecnico_user.id}/toggle-active")
    assert toggle_response.status_code == 200
    assert toggle_response.json()["is_active"] is False


def test_admin_cannot_toggle_technician_from_other_company(client_and_session):
    client, _TestingSessionLocal, admin_user, _tecnico_user, other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="Admin",
        permissions=["technicians.read", "technicians.update"],
    )

    response = client.patch(f"/api/v1/technicians/{other_tecnico_user.id}/toggle-active")
    assert response.status_code == 404


def test_technician_with_workorder_create_lists_only_self_as_assignable(client_and_session):
    client, _TestingSessionLocal, _admin_user, tecnico_user, _other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=tecnico_user.username,
        user_id=tecnico_user.id,
        company_id=tecnico_user.company_id,
        role="Tecnico",
        permissions=["workorders.create"],
    )

    response = client.get("/api/v1/technicians/")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [tecnico_user.id]


def test_technician_routes_forbid_user_without_permission(client_and_session):
    client, _TestingSessionLocal, _admin_user, tecnico_user, _other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=tecnico_user.username,
        user_id=tecnico_user.id,
        company_id=tecnico_user.company_id,
        role="Tecnico",
        permissions=["auth.me.read"],
    )

    response = client.get("/api/v1/technicians/")
    assert response.status_code == 403
