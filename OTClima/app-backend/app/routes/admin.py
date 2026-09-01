from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.auth.deps import CurrentUser, require_permissions
from app.auth.workspace import get_company_scope
from app.db.base import Permission, Role, User
from app.db.connection import get_db
from app.models.schemas import (
    AddUserPermissionRequest,
    PermissionResponse,
    RoleResponse,
    SetUserRoleRequest,
    UserPermissionsResponse,
)
from app.services.rbac_service import (
    SUPER_ADMIN_ROLE_NAME,
    add_direct_permission_to_user,
    get_user_effective_permissions,
    get_user_primary_role_name,
    remove_direct_permission_from_user,
)

router = APIRouter()


def _user_permissions_response(user: User) -> UserPermissionsResponse:
    return UserPermissionsResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        company_id=user.company_id,
        company=user.company.name if user.company is not None else None,
        is_active=user.is_active,
        is_verified=user.is_verified,
        primary_role=get_user_primary_role_name(user),
        direct_permissions=sorted([permission.code for permission in user.direct_permissions]),
        permissions=get_user_effective_permissions(user),
    )


def _get_user_in_scope(db: Session, user_id: int, company_id: int | None) -> User | None:
    query = db.query(User).filter(User.id == user_id)
    if company_id is not None:
        query = query.filter(User.company_id == company_id)
    return query.first()


@router.get("/users", response_model=list[UserPermissionsResponse])
def list_users(
    current_user: CurrentUser = Depends(require_permissions("users.manage")),
    db: Session = Depends(get_db),
):
    company_scope = get_company_scope(current_user, db)
    query = db.query(User)
    if company_scope is not None:
        query = query.filter(User.company_id == company_scope)
    users = query.order_by(User.id.asc()).all()
    return [_user_permissions_response(user) for user in users]


@router.patch("/users/{user_id}/role", response_model=UserPermissionsResponse)
def set_user_role(
    user_id: int,
    request: SetUserRoleRequest,
    current_user: CurrentUser = Depends(require_permissions("users.manage")),
    db: Session = Depends(get_db),
):
    company_scope = get_company_scope(current_user, db)
    user = _get_user_in_scope(db, user_id, company_scope)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    role = db.query(Role).filter(Role.name == request.role_name).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.name == SUPER_ADMIN_ROLE_NAME and not current_user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot assign SuperAdmin role")

    user.primary_role = role
    db.commit()
    db.refresh(user)
    return _user_permissions_response(user)


@router.post("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
def add_user_permission(
    user_id: int,
    request: AddUserPermissionRequest,
    current_user: CurrentUser = Depends(require_permissions("users.manage")),
    db: Session = Depends(get_db),
):
    user = _get_user_in_scope(db, user_id, get_company_scope(current_user, db))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    try:
        add_direct_permission_to_user(db, user, request.permission_code)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")

    return _user_permissions_response(user)


@router.delete("/users/{user_id}/permissions/{permission_code}", response_model=UserPermissionsResponse)
def remove_user_permission(
    user_id: int,
    permission_code: str,
    current_user: CurrentUser = Depends(require_permissions("users.manage")),
    db: Session = Depends(get_db),
):
    user = _get_user_in_scope(db, user_id, get_company_scope(current_user, db))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    removed = remove_direct_permission_from_user(db, user, permission_code)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Direct permission not found")

    return _user_permissions_response(user)


@router.get("/roles", response_model=list[RoleResponse])
def list_roles(
    current_user: CurrentUser = Depends(require_permissions("roles.manage")),
    db: Session = Depends(get_db),
):
    query = db.query(Role)
    if not current_user.is_super_admin:
        query = query.filter(Role.name != SUPER_ADMIN_ROLE_NAME)
    roles = query.order_by(Role.name.asc()).all()
    return [
        RoleResponse(
            name=role.name,
            description=role.description,
            permissions=sorted([permission.code for permission in role.permissions]),
        )
        for role in roles
    ]


@router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(
    _: CurrentUser = Depends(require_permissions("permissions.manage")),
    db: Session = Depends(get_db),
):
    permissions = db.query(Permission).order_by(Permission.code.asc()).all()
    return [PermissionResponse(code=permission.code, description=permission.description) for permission in permissions]
