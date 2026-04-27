from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.work_order import WorkOrder
from app.models.quotation import Quotation
from app.models.user import User
from app.schemas.quotation import QuotationCreate, QuotationUpdate, QuotationOut
from app.api.deps import get_current_user
from app.services.pdf_service import generate_quotation_pdf

router = APIRouter(prefix="/work-orders", tags=["quotations"])


def _get_ot(ot_id: int, company_id: int, db: Session) -> WorkOrder:
    ot = db.query(WorkOrder).filter(WorkOrder.id == ot_id, WorkOrder.company_id == company_id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="OT no encontrada")
    return ot


@router.get("/{ot_id}/quotation", response_model=QuotationOut)
def get_quotation(ot_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ot = _get_ot(ot_id, current_user.company_id, db)
    if not ot.quotation:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return ot.quotation


@router.post("/{ot_id}/quotation", response_model=QuotationOut, status_code=201)
def create_quotation(
    ot_id: int,
    body: QuotationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ot = _get_ot(ot_id, current_user.company_id, db)
    if ot.quotation:
        raise HTTPException(status_code=400, detail="Ya existe cotización para esta OT")

    items = [i.model_dump() for i in body.items]
    subtotal = sum(i["qty"] * i["unit_price"] for i in items)
    total = max(subtotal - body.discount, 0)

    q = Quotation(
        work_order_id=ot_id,
        items=items,
        subtotal=subtotal,
        discount=body.discount,
        total=total,
        conditions=body.conditions,
        warranty=body.warranty,
        validity_days=body.validity_days,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@router.put("/{ot_id}/quotation", response_model=QuotationOut)
def update_quotation(
    ot_id: int,
    body: QuotationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ot = _get_ot(ot_id, current_user.company_id, db)
    if not ot.quotation:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    items = [i.model_dump() for i in body.items]
    subtotal = sum(i["qty"] * i["unit_price"] for i in items)
    ot.quotation.items = items
    ot.quotation.subtotal = subtotal
    ot.quotation.discount = body.discount
    ot.quotation.total = max(subtotal - body.discount, 0)
    ot.quotation.conditions = body.conditions
    ot.quotation.warranty = body.warranty
    ot.quotation.validity_days = body.validity_days
    db.commit()
    db.refresh(ot.quotation)
    return ot.quotation


@router.post("/{ot_id}/quotation/send", response_model=QuotationOut)
def mark_sent(ot_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ot = _get_ot(ot_id, current_user.company_id, db)
    if not ot.quotation:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    ot.quotation.sent_at = datetime.now(timezone.utc)
    if ot.can_transition_to("quotation_sent"):
        ot.status = "quotation_sent"
    db.commit()
    db.refresh(ot.quotation)
    return ot.quotation


@router.get("/{ot_id}/quotation/pdf")
def download_pdf(ot_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy.orm import joinedload
    ot = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.client),
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.quotation),
        )
        .filter(WorkOrder.id == ot_id, WorkOrder.company_id == current_user.company_id)
        .first()
    )
    if not ot or not ot.quotation:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    from app.models.company import Company
    company = db.get(Company, current_user.company_id)
    pdf_path = generate_quotation_pdf(ot, company)
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"cotizacion-OT{ot_id}.pdf")
