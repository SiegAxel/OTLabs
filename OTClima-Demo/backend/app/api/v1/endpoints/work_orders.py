from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.work_order import WorkOrder
from app.models.user import User
from app.schemas.work_order import WorkOrderCreate, WorkOrderUpdate, WorkOrderOut, WorkOrderTransition
from app.api.deps import get_current_user

router = APIRouter(prefix="/work-orders", tags=["work-orders"])


def _ot_query(db: Session, company_id: int):
    return (
        db.query(WorkOrder)
        .options(joinedload(WorkOrder.client), joinedload(WorkOrder.technician))
        .filter(WorkOrder.company_id == company_id)
    )


@router.get("", response_model=list[WorkOrderOut])
def list_work_orders(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = _ot_query(db, current_user.company_id)
    if current_user.role == "technician":
        q = q.filter(WorkOrder.technician_id == current_user.id)
    if status:
        q = q.filter(WorkOrder.status == status)
    return q.order_by(WorkOrder.created_at.desc()).all()


@router.post("", response_model=WorkOrderOut, status_code=201)
def create_work_order(
    body: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ot = WorkOrder(**body.model_dump(), company_id=current_user.company_id)
    db.add(ot)
    db.commit()
    db.refresh(ot)
    return _ot_query(db, current_user.company_id).filter(WorkOrder.id == ot.id).first()


@router.get("/{ot_id}", response_model=WorkOrderOut)
def get_work_order(ot_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ot = _ot_query(db, current_user.company_id).filter(WorkOrder.id == ot_id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    return ot


@router.put("/{ot_id}", response_model=WorkOrderOut)
def update_work_order(
    ot_id: int,
    body: WorkOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ot = db.query(WorkOrder).filter(WorkOrder.id == ot_id, WorkOrder.company_id == current_user.company_id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(ot, k, v)
    db.commit()
    return _ot_query(db, current_user.company_id).filter(WorkOrder.id == ot_id).first()


@router.post("/{ot_id}/transition", response_model=WorkOrderOut)
def transition_status(
    ot_id: int,
    body: WorkOrderTransition,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ot = db.query(WorkOrder).filter(WorkOrder.id == ot_id, WorkOrder.company_id == current_user.company_id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    if not ot.can_transition_to(body.new_status):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede pasar de '{ot.status}' a '{body.new_status}'",
        )
    ot.status = body.new_status
    db.commit()
    return _ot_query(db, current_user.company_id).filter(WorkOrder.id == ot_id).first()


@router.delete("/{ot_id}", status_code=204)
def delete_work_order(ot_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ot = db.query(WorkOrder).filter(WorkOrder.id == ot_id, WorkOrder.company_id == current_user.company_id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    db.delete(ot)
    db.commit()
