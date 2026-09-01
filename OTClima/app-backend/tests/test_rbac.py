import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from app.auth.deps import CurrentUser, require_permissions
from app.db.base import Base, Role, User
from app.services.rbac_service import (
    SUPER_ADMIN_ROLE_NAME,
    add_direct_permission_to_user,
    bootstrap_rbac,
    bootstrap_initial_admin,
    get_user_effective_permissions,
)


def _build_session():
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return TestingSessionLocal()


def test_bootstrap_assigns_default_role_to_existing_users():
    db = _build_session()
    user = User(
        username="tech_user",
        email="tech@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()

    bootstrap_rbac(db)
    db.refresh(user)

    assert user.primary_role is not None
    assert user.primary_role.name == "Tecnico"
    db.close()


def test_effective_permissions_include_role_and_direct_permissions():
    db = _build_session()
    bootstrap_rbac(db)

    tecnico_role = db.query(Role).filter(Role.name == "Tecnico").first()
    assert tecnico_role is not None

    user = User(
        username="tech_user_2",
        email="tech2@example.com",
        hashed_password="hashed",
        is_active=True,
        is_verified=True,
        primary_role=tecnico_role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    add_direct_permission_to_user(db, user, "users.manage")

    effective_permissions = get_user_effective_permissions(user)

    assert "users.manage" in effective_permissions
    assert "tickets.read.assigned" in effective_permissions
    db.close()


def test_require_permissions_blocks_user_without_permission():
    dependency = require_permissions("users.manage")

    admin_user = CurrentUser(sub="admin", user_id=1, permissions=["users.manage"])
    result = dependency(admin_user)
    assert result.user_id == 1

    restricted_user = CurrentUser(sub="tech", user_id=2, permissions=[])
    with pytest.raises(HTTPException) as exc:
        dependency(restricted_user)
    assert exc.value.status_code == 403


def test_bootstrap_initial_admin_creates_admin_user(monkeypatch):
    db = _build_session()
    bootstrap_rbac(db)

    from app.config.settings import settings

    monkeypatch.setattr(settings, "INITIAL_ADMIN_USERNAME", "root_admin")
    monkeypatch.setattr(settings, "INITIAL_ADMIN_EMAIL", "root@example.com")
    monkeypatch.setattr(settings, "INITIAL_ADMIN_PASSWORD", "root-password")

    created = bootstrap_initial_admin(db)
    assert created is True

    admin_user = db.query(User).filter(User.username == "root_admin").first()
    assert admin_user is not None
    assert admin_user.primary_role is not None
    assert admin_user.primary_role.name == SUPER_ADMIN_ROLE_NAME
    assert "users.manage" in get_user_effective_permissions(admin_user)
    db.close()
