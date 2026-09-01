from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import CurrentUser
from app.db.base import User


def get_company_scope(current_user: CurrentUser, db: Session) -> int | None:
    if current_user.is_super_admin:
        return None
    if current_user.company_id is not None:
        return current_user.company_id

    user = db.query(User).filter(User.id == current_user.user_id).first()
    if user is not None and user.company_id is not None:
        return user.company_id

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User is not associated with a company workspace",
    )


def get_required_company_scope(current_user: CurrentUser, db: Session) -> int:
    scope = get_company_scope(current_user, db)
    if scope is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="company_id is required for company-scoped data",
        )
    return scope


def get_target_company_id(
    current_user: CurrentUser,
    db: Session,
    requested_company_id: int | None = None,
) -> int:
    if current_user.is_super_admin:
        if requested_company_id is not None:
            return requested_company_id
        if current_user.company_id is not None:
            return current_user.company_id
        user = db.query(User).filter(User.id == current_user.user_id).first()
        if user is not None and user.company_id is not None:
            return user.company_id
        if requested_company_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="company_id is required when a SuperAdmin creates company-scoped data",
            )

    if requested_company_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create data for another company workspace",
        )

    return get_required_company_scope(current_user, db)
