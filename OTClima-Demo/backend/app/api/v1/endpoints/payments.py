from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.work_order import WorkOrder
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/work-orders", tags=["payments"])


@router.post("/{ot_id}/payment", response_model=PaymentOut, status_code=201)
def register_payment(
    ot_id: int,
    body: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ot = db.query(WorkOrder).filter(WorkOrder.id == ot_id, WorkOrder.company_id == current_user.company_id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    if ot.payment:
        raise HTTPException(status_code=400, detail="Esta OT ya tiene pago registrado")
    payment = Payment(work_order_id=ot_id, **body.model_dump())
    db.add(payment)
    if ot.can_transition_to("paid"):
        ot.status = "paid"
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{ot_id}/payment", response_model=PaymentOut)
def get_payment(ot_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ot = db.query(WorkOrder).filter(WorkOrder.id == ot_id, WorkOrder.company_id == current_user.company_id).first()
    if not ot or not ot.payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return ot.payment
