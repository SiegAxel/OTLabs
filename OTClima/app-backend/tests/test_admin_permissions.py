import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.deps import CurrentUser, get_current_user
from app.db.base import Base, Company, Role, User
from app.db.connection import get_db
from app.routes.admin import router as admin_router
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
        company=company_a,
        primary_role=tecnico_role,
    )
    other_tecnico_user = User(
        username="other-tech",
        email="other-tech@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
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
    app.include_router(admin_router, prefix="/api/v1/admin")

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)
    yield client, admin_user, tecnico_user, other_tecnico_user, app

    db.close()


def test_admin_routes_forbid_user_without_permission(client_and_session):
    client, _admin_user, tecnico_user, _other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=tecnico_user.username,
        user_id=tecnico_user.id,
        company_id=tecnico_user.company_id,
        role="Tecnico",
        permissions=["auth.me.read"],
    )

    response = client.get("/api/v1/admin/users")
    assert response.status_code == 403


def test_admin_can_assign_direct_permission(client_and_session):
    client, admin_user, tecnico_user, _other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="Admin",
        permissions=["users.manage", "roles.manage", "permissions.manage"],
    )

    response = client.post(
        f"/api/v1/admin/users/{tecnico_user.id}/permissions",
        json={"permission_code": "users.manage"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "users.manage" in body["direct_permissions"]
    assert "users.manage" in body["permissions"]


def test_admin_can_change_primary_role(client_and_session):
    client, admin_user, tecnico_user, _other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="Admin",
        permissions=["users.manage", "roles.manage", "permissions.manage"],
    )

    response = client.patch(
        f"/api/v1/admin/users/{tecnico_user.id}/role",
        json={"role_name": "Admin"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["primary_role"] == "Admin"


def test_company_admin_lists_only_own_company_users(client_and_session):
    client, admin_user, _tecnico_user, _other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="Admin",
        permissions=["users.manage"],
    )

    response = client.get("/api/v1/admin/users")

    assert response.status_code == 200
    assert {user["email"] for user in response.json()} == {"admin@example.com", "tech@example.com"}


def test_company_admin_cannot_manage_other_company_user(client_and_session):
    client, admin_user, _tecnico_user, other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="Admin",
        permissions=["users.manage"],
    )

    response = client.post(
        f"/api/v1/admin/users/{other_tecnico_user.id}/permissions",
        json={"permission_code": "users.manage"},
    )

    assert response.status_code == 404


def test_company_admin_cannot_assign_super_admin_role(client_and_session):
    client, admin_user, tecnico_user, _other_tecnico_user, app = client_and_session

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=admin_user.username,
        user_id=admin_user.id,
        company_id=admin_user.company_id,
        role="Admin",
        permissions=["users.manage"],
    )

    response = client.patch(
        f"/api/v1/admin/users/{tecnico_user.id}/role",
        json={"role_name": "SuperAdmin"},
    )

    assert response.status_code == 403
