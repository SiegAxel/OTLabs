import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.hash_utils import hash_password
from app.db.base import Base, Company, User
from app.db.connection import get_db
from app.routes.auth import router as auth_router
from app.services.company_service import bootstrap_companies_and_worker_ranges
from app.services.rbac_service import bootstrap_rbac


@pytest.fixture
def client_and_session(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    bootstrap_rbac(db)
    bootstrap_companies_and_worker_ranges(db)

    async def fake_send_verification_email(*_args, **_kwargs):
        return {"id": "test", "status": "sent"}

    monkeypatch.setattr("app.routes.auth.send_verification_email", fake_send_verification_email)

    app = FastAPI()
    app.include_router(auth_router, prefix="/api/v1/auth")

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)
    yield client, TestingSessionLocal

    db.close()


def test_register_independent_assigns_independent_company(client_and_session):
    client, TestingSessionLocal = client_and_session

    response = client.post(
        "/api/v1/auth/register",
        json={
            "account_type": "independent",
            "email": "indie@example.com",
            "password": "StrongPass1",
            "terms_accepted": True,
            "profile": {
                "full_name": "Maria Lopez",
                "phone": "+56 9 1234 5678",
                "city_commune": "Santiago/Centro",
            },
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "approved"

    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "indie@example.com").first()
    assert user is not None
    assert user.company is not None
    assert user.company.name == "Independiente"
    assert user.account_type == "independent"
    assert user.account_status == "approved"
    db.close()


def test_register_company_sets_pending_approval(client_and_session):
    client, TestingSessionLocal = client_and_session

    response = client.post(
        "/api/v1/auth/register",
        json={
            "account_type": "company",
            "email": "owner@example.com",
            "password": "CompanyPass1",
            "terms_accepted": True,
            "profile": {
                "business_name": "Nueva Empresa SpA",
                "company_tax_id": "99.999.999-9",
                "company_phone": "+56 2 3344 5566",
                "company_email": "contacto@nuevaempresa.example",
                "address": "Providencia 1234",
            },
            "worker_range": "21-50",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending_approval"

    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "owner@example.com").first()
    assert user is not None
    assert user.account_type == "company"
    assert user.account_status == "pending_approval"
    assert user.worker_range is not None
    assert user.worker_range.code == "21-50"
    assert user.company is not None
    assert user.company.name == "Nueva Empresa SpA"
    assert user.primary_role is not None
    assert user.primary_role.name == "Admin"
    db.close()


def test_login_blocked_for_pending_company_account(client_and_session):
    client, TestingSessionLocal = client_and_session

    db = TestingSessionLocal()
    independent_company = db.query(Company).filter(Company.name == "Independiente").first()
    pending_user = User(
        username="pending_user",
        email="pending@example.com",
        hashed_password=hash_password("PendingPass1"),
        is_active=True,
        is_verified=True,
        account_type="company",
        account_status="pending_approval",
        terms_accepted=True,
        company=independent_company,
    )
    db.add(pending_user)
    db.commit()
    db.close()

    response = client.post(
        "/api/v1/auth/login",
        json={"username": "pending@example.com", "password": "PendingPass1"},
    )

    assert response.status_code == 403
    assert "pending administrator approval" in response.json()["detail"]
