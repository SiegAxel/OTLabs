import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.deps import CurrentUser, get_current_user
from app.db.base import Base, Client, Company, Role, User
from app.db.connection import get_db
from app.routes.clients import router as clients_router
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
    company_a = Company(name="Empresa A", tax_id="1", is_independent=False)
    company_b = Company(name="Empresa B", tax_id="2", is_independent=False)
    db.add(company_a)
    db.add(company_b)
    db.flush()

    admin_user = User(
        username="admin-a",
        email="admin-a@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
        company=company_a,
        primary_role=admin_role,
    )
    other_admin_user = User(
        username="admin-b",
        email="admin-b@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
        company=company_b,
        primary_role=admin_role,
    )
    client_a = Client(nombre="Cliente A", rut="11.111.111-1", company=company_a)
    client_b = Client(nombre="Cliente B", rut="22.222.222-2", company=company_b)
    db.add(admin_user)
    db.add(other_admin_user)
    db.add(client_a)
    db.add(client_b)
    db.commit()
    db.refresh(admin_user)
    db.refresh(other_admin_user)
    db.refresh(client_a)
    db.refresh(client_b)

    app = FastAPI()
    app.include_router(clients_router, prefix="/api/v1/clients")

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)
    yield client, TestingSessionLocal, admin_user, other_admin_user, client_a, client_b, app

    db.close()


def test_company_admin_lists_only_own_clients(client_and_session):
    client, _TestingSessionLocal, admin_user, _other_admin_user, _client_a, _client_b, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="Admin",
        permissions=["clients.read"],
    )

    response = client.get("/api/v1/clients/")

    assert response.status_code == 200
    assert [item["nombre"] for item in response.json()] == ["Cliente A"]


def test_company_admin_cannot_read_other_company_client(client_and_session):
    client, _TestingSessionLocal, admin_user, _other_admin_user, _client_a, client_b, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="Admin",
        permissions=["clients.read"],
    )

    response = client.get(f"/api/v1/clients/{client_b.id}")

    assert response.status_code == 404


def test_duplicate_client_rut_is_scoped_by_company(client_and_session):
    client, _TestingSessionLocal, _admin_user, other_admin_user, client_a, _client_b, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=other_admin_user.username,
        user_id=other_admin_user.id,
        company_id=other_admin_user.company_id,
        role="Admin",
        permissions=["clients.create"],
    )

    response = client.post(
        "/api/v1/clients/",
        json={"nombre": "Cliente B con mismo RUT", "rut": client_a.rut},
    )

    assert response.status_code == 201
    assert response.json()["company_id"] == other_admin_user.company_id


def test_super_admin_with_company_can_create_client_without_company_id(client_and_session):
    client, _TestingSessionLocal, admin_user, _other_admin_user, _client_a, _client_b, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="SuperAdmin",
        permissions=["clients.create"],
    )

    response = client.post(
        "/api/v1/clients/",
        json={"nombre": "Cliente SuperAdmin", "rut": "33.333.333-3"},
    )

    assert response.status_code == 201
    assert response.json()["company_id"] == admin_user.company_id
