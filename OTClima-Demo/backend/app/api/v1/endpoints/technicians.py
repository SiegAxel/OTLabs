from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.work_order import WorkOrder
from app.schemas.auth import UserOut, UserCreate
from app.core.security import hash_password
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/technicians", tags=["technicians"])


@router.get("", response_model=list[dict])
def list_technicians(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    users = db.query(User).filter(
        User.company_id == current_user.company_id,
        User.role == "technician",
    ).all()
    result = []
    for u in users:
        active_ots = db.query(WorkOrder).filter(
            WorkOrder.technician_id == u.id,
            WorkOrder.status.notin_(["paid", "rejected"]),
        ).count()
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "is_active": u.is_active,
            "active_ots": active_ots,
        })
    return result


@router.post("", response_model=UserOut, status_code=201)
def create_technician(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email ya registrado")
    user = User(
        company_id=current_user.company_id,
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        role="technician",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/toggle-active", response_model=UserOut)
def toggle_active(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id, User.company_id == current_user.company_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Técnico no encontrado")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user
