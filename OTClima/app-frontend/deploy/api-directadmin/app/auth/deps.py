from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.auth.jwt_utils import verify_token
from app.db.connection import get_db
from app.db.base import User
from app.services.rbac_service import (
    SUPER_ADMIN_ROLE_NAME,
    get_user_effective_permissions,
    get_user_primary_role_name,
)

security = HTTPBearer()


class CurrentUser:
    def __init__(
        self,
        sub: str,
        user_id: int,
        version: int = 1,
        company_id: int | None = None,
        role: str | None = None,
        permissions: list[str] | None = None,
    ):
        self.sub = sub
        self.user_id = user_id
        self.version = version
        self.company_id = company_id
        self.role = role
        self.permissions = permissions or []

    @property
    def is_super_admin(self) -> bool:
        return self.role == SUPER_ADMIN_ROLE_NAME


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> CurrentUser:
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("user_id")
    sub = payload.get("sub")
    version = payload.get("version", 1)
    
    if user_id is None or sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if version != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalidated. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return CurrentUser(
        sub=sub,
        user_id=user_id,
        version=version,
        company_id=user.company_id,
        role=get_user_primary_role_name(user),
        permissions=get_user_effective_permissions(user),
    )


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> CurrentUser | None:
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None


def require_permissions(*permission_codes: str):
    def dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        missing_permissions = [code for code in permission_codes if code not in current_user.permissions]
        if missing_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Insufficient permissions",
                    "required": list(permission_codes),
                    "missing": missing_permissions,
                },
            )
        return current_user

    return dependency
