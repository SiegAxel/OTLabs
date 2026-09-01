import re
from sqlalchemy.orm import Session
from app.auth.hash_utils import hash_password
from app.db.base import Role, User
from app.models.schemas import TechnicianCreate, TechnicianResponse, TechnicianUpdate
from app.services.rbac_service import ADMIN_ROLE_NAME, DEFAULT_ROLE_NAME


ASSIGNABLE_TECHNICIAN_ROLES = (DEFAULT_ROLE_NAME, ADMIN_ROLE_NAME)


def _generate_unique_username(db: Session, email: str) -> str:
    base = email.split("@")[0].strip().lower()
    base = re.sub(r"[^a-z0-9._-]", "", base)
    base = base or "tecnico"

    candidate = base
    suffix = 1
    while db.query(User).filter(User.username == candidate).first() is not None:
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate


def _get_technician_role(db: Session) -> Role:
    role = db.query(Role).filter(Role.name == DEFAULT_ROLE_NAME).first()
    if role is None:
        role = Role(name=DEFAULT_ROLE_NAME, description="Default technical role")
        db.add(role)
        db.flush()
    return role


def get_technician(db: Session, technician_id: int, company_id: int | None = None) -> User | None:
    query = (
        db.query(User)
        .join(Role, User.primary_role_id == Role.id)
        .filter(User.id == technician_id, Role.name.in_(ASSIGNABLE_TECHNICIAN_ROLES))
    )
    if company_id is not None:
        query = query.filter(User.company_id == company_id)
    return query.first()


def get_technicians(db: Session, company_id: int | None = None) -> list[User]:
    query = (
        db.query(User)
        .join(Role, User.primary_role_id == Role.id)
        .filter(Role.name.in_(ASSIGNABLE_TECHNICIAN_ROLES))
    )
    if company_id is not None:
        query = query.filter(User.company_id == company_id)
    return query.order_by(User.full_name.asc().nullslast(), User.username.asc()).all()


def create_technician(db: Session, data: TechnicianCreate, company_id: int | None = None) -> User:
    role = _get_technician_role(db)
    email = str(data.email).strip().lower()
    name = data.name.strip()

    technician = User(
        username=_generate_unique_username(db, email),
        email=email,
        hashed_password=hash_password(data.password),
        is_active=True,
        is_verified=True,
        account_type="independent",
        account_status="approved",
        terms_accepted=True,
        full_name=name,
        phone=data.phone.strip() if data.phone else None,
        company_id=company_id,
        primary_role=role,
    )
    db.add(technician)
    db.commit()
    db.refresh(technician)
    return technician


def update_technician(db: Session, technician: User, data: TechnicianUpdate) -> User:
    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        technician.full_name = update_data["name"].strip() if update_data["name"] else None
    if "email" in update_data and update_data["email"] is not None:
        technician.email = str(update_data["email"]).strip().lower()
    if "password" in update_data and update_data["password"]:
        technician.hashed_password = hash_password(update_data["password"])
        technician.token_version += 1
    if "phone" in update_data:
        technician.phone = update_data["phone"].strip() if update_data["phone"] else None
    if "is_active" in update_data and update_data["is_active"] is not None:
        technician.is_active = update_data["is_active"]
        technician.token_version += 1

    db.commit()
    db.refresh(technician)
    return technician


def toggle_technician_active(db: Session, technician: User) -> User:
    technician.is_active = not technician.is_active
    technician.token_version += 1
    db.commit()
    db.refresh(technician)
    return technician


def technician_response(technician: User, active_ots: int = 0) -> TechnicianResponse:
    return TechnicianResponse(
        id=technician.id,
        company_id=technician.company_id,
        name=technician.full_name or technician.username,
        email=technician.email,
        phone=technician.phone,
        is_active=technician.is_active,
        active_ots=active_ots,
        created_at=technician.created_at,
        updated_at=technician.updated_at,
    )
