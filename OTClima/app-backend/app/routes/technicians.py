from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.auth.deps import CurrentUser, get_current_user, require_permissions
from app.auth.workspace import get_company_scope, get_target_company_id
from app.db.base import User
from app.db.connection import get_db
from app.models.schemas import TechnicianCreate, TechnicianResponse, TechnicianUpdate
from app.services.technician_service import (
    create_technician,
    get_technician,
    get_technicians,
    technician_response,
    toggle_technician_active,
    update_technician,
)

router = APIRouter()


@router.get("/", response_model=list[TechnicianResponse])
def list_technicians(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if "technicians.read" not in current_user.permissions and not current_user.is_super_admin:
        if "workorders.create" not in current_user.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        technician = get_technician(db, current_user.user_id, company_id=get_company_scope(current_user, db))
        return [technician_response(technician)] if technician else []

    return [
        technician_response(technician)
        for technician in get_technicians(db, company_id=get_company_scope(current_user, db))
    ]


@router.get("/{technician_id}", response_model=TechnicianResponse)
def get_technician_by_id(
    technician_id: int,
    current_user: CurrentUser = Depends(require_permissions("technicians.read")),
    db: Session = Depends(get_db),
):
    technician = get_technician(db, technician_id, company_id=get_company_scope(current_user, db))
    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")
    return technician_response(technician)


@router.post("/", response_model=TechnicianResponse, status_code=status.HTTP_201_CREATED)
def create_new_technician(
    data: TechnicianCreate,
    current_user: CurrentUser = Depends(require_permissions("technicians.create")),
    db: Session = Depends(get_db),
):
    email = str(data.email).strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    company_id = get_target_company_id(current_user, db, data.company_id)
    technician = create_technician(db, data, company_id=company_id)
    return technician_response(technician)


@router.put("/{technician_id}", response_model=TechnicianResponse)
def update_existing_technician(
    technician_id: int,
    data: TechnicianUpdate,
    current_user: CurrentUser = Depends(require_permissions("technicians.update")),
    db: Session = Depends(get_db),
):
    technician = get_technician(db, technician_id, company_id=get_company_scope(current_user, db))
    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

    if data.email is not None:
        email = str(data.email).strip().lower()
        duplicate = db.query(User).filter(User.email == email, User.id != technician_id).first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )

    return technician_response(update_technician(db, technician, data))


@router.patch("/{technician_id}/toggle-active", response_model=TechnicianResponse)
def toggle_existing_technician_active(
    technician_id: int,
    current_user: CurrentUser = Depends(require_permissions("technicians.update")),
    db: Session = Depends(get_db),
):
    technician = get_technician(db, technician_id, company_id=get_company_scope(current_user, db))
    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")
    return technician_response(toggle_technician_active(db, technician))


@router.delete("/{technician_id}", response_model=TechnicianResponse)
def deactivate_existing_technician(
    technician_id: int,
    current_user: CurrentUser = Depends(require_permissions("technicians.delete")),
    db: Session = Depends(get_db),
):
    technician = get_technician(db, technician_id, company_id=get_company_scope(current_user, db))
    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")
    if technician.is_active:
        technician = update_technician(db, technician, TechnicianUpdate(is_active=False))
    return technician_response(technician)
