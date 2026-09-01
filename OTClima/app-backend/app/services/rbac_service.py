from sqlalchemy.orm import Session
from app.db.base import Permission, Role, User
from app.auth.hash_utils import hash_password
from app.config.settings import settings


DEFAULT_ROLE_NAME = "Tecnico"
ADMIN_ROLE_NAME = "Admin"
SUPER_ADMIN_ROLE_NAME = "SuperAdmin"


DEFAULT_PERMISSIONS = {
    "auth.me.read": "View current authenticated profile",
    "tickets.read.assigned": "View assigned tickets",
    "tickets.update.assigned": "Update assigned tickets",
    "workorders.read.assigned": "View assigned work orders",
    "workorders.update.assigned": "Update assigned work orders",
    "clients.read.assigned": "View assigned clients",
    "inventory.read": "View inventory",
    "reports.technical.read": "View technical reports",
    "users.manage": "Manage users and direct permissions",
    "roles.manage": "Manage role to permission mappings",
    "permissions.manage": "Manage permission catalog",
    "billing.manage": "Manage billing operations",
    "clients.create": "Create clients",
    "clients.read": "View all clients",
    "clients.update": "Update clients",
    "clients.delete": "Delete clients",
    "technicians.create": "Create technician users",
    "technicians.read": "View technician users",
    "technicians.update": "Update technician users",
    "technicians.delete": "Deactivate technician users",
    "workorders.create": "Create work orders",
    "workorders.read": "View company work orders",
    "workorders.update": "Update company work orders",
    "workorders.delete": "Delete company work orders",
    "quotations.manage": "Create and update quotations",
    "evidences.manage": "Upload and delete work order evidence",
    "payments.manage": "Register work order payments",
}


ROLE_DEFAULTS = {
    SUPER_ADMIN_ROLE_NAME: list(DEFAULT_PERMISSIONS.keys()),
    ADMIN_ROLE_NAME: list(DEFAULT_PERMISSIONS.keys()),
    "Tecnico": [
        "auth.me.read",
        "tickets.read.assigned",
        "tickets.update.assigned",
        "workorders.create",
        "workorders.read.assigned",
        "workorders.update.assigned",
        "quotations.manage",
        "evidences.manage",
        "clients.read.assigned",
        "clients.create",
        "clients.read",
        "clients.update",
        "clients.delete",
        "inventory.read",
        "reports.technical.read",
    ],
}


def get_or_create_role(db: Session, role_name: str, description: str | None = None) -> Role:
    role = db.query(Role).filter(Role.name == role_name).first()
    if role is not None:
        return role

    role = Role(name=role_name, description=description)
    db.add(role)
    db.flush()
    return role


def get_or_create_permission(db: Session, code: str, description: str | None = None) -> Permission:
    permission = db.query(Permission).filter(Permission.code == code).first()
    if permission is not None:
        return permission

    permission = Permission(code=code, description=description)
    db.add(permission)
    db.flush()
    return permission


def bootstrap_rbac(db: Session) -> None:
    for code, description in DEFAULT_PERMISSIONS.items():
        get_or_create_permission(db, code, description)

    super_admin = get_or_create_role(db, SUPER_ADMIN_ROLE_NAME, "Platform administrator")
    admin = get_or_create_role(db, ADMIN_ROLE_NAME, "Company administrator")
    tecnico = get_or_create_role(db, DEFAULT_ROLE_NAME, "Default technical role")

    role_by_name = {
        SUPER_ADMIN_ROLE_NAME: super_admin,
        ADMIN_ROLE_NAME: admin,
        DEFAULT_ROLE_NAME: tecnico,
    }

    for role_name, permission_codes in ROLE_DEFAULTS.items():
        role = role_by_name[role_name]
        current_codes = {permission.code for permission in role.permissions}
        for code in permission_codes:
            if code in current_codes:
                continue
            permission = db.query(Permission).filter(Permission.code == code).first()
            if permission is not None:
                role.permissions.append(permission)

    default_role = db.query(Role).filter(Role.name == DEFAULT_ROLE_NAME).first()
    if default_role is not None:
        db.query(User).filter(User.primary_role_id.is_(None)).update(
            {User.primary_role_id: default_role.id}, synchronize_session=False
        )

    db.commit()


def bootstrap_initial_admin(db: Session) -> bool:
    username = settings.INITIAL_ADMIN_USERNAME.strip()
    email = settings.INITIAL_ADMIN_EMAIL.strip().lower()
    password = settings.INITIAL_ADMIN_PASSWORD

    if not username or not email or not password:
        return False

    admin_role = db.query(Role).filter(Role.name == SUPER_ADMIN_ROLE_NAME).first()
    if admin_role is None:
        admin_role = get_or_create_role(db, SUPER_ADMIN_ROLE_NAME, "Platform administrator")
        db.commit()

    user = db.query(User).filter((User.username == username) | (User.email == email)).first()
    if user is not None:
        db.query(User).filter(User.id == user.id).update(
            {
                User.primary_role_id: admin_role.id,
                User.is_active: True,
                User.is_verified: True,
                User.account_type: "independent",
                User.account_status: "approved",
                User.terms_accepted: True,
            },
            synchronize_session=False,
        )
        db.commit()
        return True

    admin_user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        is_active=True,
        is_verified=True,
        account_type="independent",
        account_status="approved",
        terms_accepted=True,
        primary_role=admin_role,
    )
    db.add(admin_user)
    db.commit()
    return True


def ensure_user_default_role(db: Session, user: User) -> None:
    if user.primary_role_id is not None or user.primary_role is not None:
        return

    role = db.query(Role).filter(Role.name == DEFAULT_ROLE_NAME).first()
    if role is None:
        role = get_or_create_role(db, DEFAULT_ROLE_NAME, "Default technical role")
    user.primary_role = role


def get_user_effective_permissions(user: User) -> list[str]:
    role_permissions = set()
    if user.primary_role is not None:
        role_permissions = {permission.code for permission in user.primary_role.permissions}
    direct_permissions = {permission.code for permission in user.direct_permissions}
    return sorted(role_permissions | direct_permissions)


def get_user_primary_role_name(user: User) -> str | None:
    if user.primary_role is None:
        return None
    return user.primary_role.name


def add_direct_permission_to_user(db: Session, user: User, permission_code: str) -> Permission:
    permission = db.query(Permission).filter(Permission.code == permission_code).first()
    if permission is None:
        raise ValueError("Permission not found")

    existing = {perm.code for perm in user.direct_permissions}
    if permission.code not in existing:
        user.direct_permissions.append(permission)
    db.commit()
    db.refresh(user)
    return permission


def remove_direct_permission_from_user(db: Session, user: User, permission_code: str) -> bool:
    for permission in list(user.direct_permissions):
        if permission.code == permission_code:
            user.direct_permissions.remove(permission)
            db.commit()
            db.refresh(user)
            return True
    return False
