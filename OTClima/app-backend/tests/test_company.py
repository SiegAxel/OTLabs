import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.deps import CurrentUser, get_current_user
from app.db.base import Base, Company, Role, User
from app.db.connection import get_db
from app.routes.company import router as company_router
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
    company = Company(
        name="Empresa Demo",
        tax_id="96.333.333-3",
        email="empresa@example.com",
        phone="+56 2 3333 3333",
        address="Direccion inicial",
        is_independent=False,
    )
    user = User(
        username="admin-demo",
        email="admin-demo@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
        company=company,
        primary_role=admin_role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    app = FastAPI()
    monkeypatch.setattr("app.routes.company.LOGO_DIR", tmp_path)
    app.include_router(company_router, prefix="/api/v1")

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=user.username,
        user_id=user.id,
        company_id=user.company_id,
        role="Admin",
        permissions=["auth.me.read", "users.manage"],
    )

    client = TestClient(app)
    yield client, TestingSessionLocal, user

    db.close()


def test_get_company_matches_frontend_shape(client_and_session):
    client, _TestingSessionLocal, _user = client_and_session

    response = client.get("/api/v1/company")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Empresa Demo"
    assert body["rut"] == "96.333.333-3"
    assert body["plan_type"] == "basic"
    assert "logo_path" in body


def test_update_company_profile(client_and_session):
    client, TestingSessionLocal, user = client_and_session

    response = client.put(
        "/api/v1/company",
        json={
            "name": "Empresa Demo Actualizada",
            "rut": "96.333.333-4",
            "phone": "+56 2 4444 4444",
            "email": "nueva@example.com",
            "address": "Nueva direccion",
            "quote_conditions": "Pago a 30 dias",
            "quote_warranty": "Garantia 90 dias",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Empresa Demo Actualizada"
    assert body["rut"] == "96.333.333-4"
    assert body["quote_conditions"] == "Pago a 30 dias"

    db = TestingSessionLocal()
    db_user = db.query(User).filter(User.id == user.id).first()
    assert db_user.company.tax_id == "96.333.333-4"
    db.close()


def test_upload_company_logo(client_and_session):
    client, _TestingSessionLocal, _user = client_and_session

    response = client.post(
        "/api/v1/company/logo",
        files={"file": ("logo.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["logo_path"].startswith("/api/v1/company-logos/company-")

    logo_response = client.get(body["logo_path"])
    assert logo_response.status_code == 200
