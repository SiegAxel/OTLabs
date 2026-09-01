from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session, joinedload

from app.auth.deps import CurrentUser, get_current_user
from app.db.base import Evidence
from app.db.connection import get_db
from app.models.schemas import (
    EvidenceResponse,
    EvidenceUploadedByResponse,
    PaymentCreate,
    PaymentResponse,
    QuotationCreate,
    QuotationResponse,
    WorkOrderCreate,
    WorkOrderResponse,
    WorkOrderTransitionRequest,
    WorkOrderUpdate,
)
from app.services.work_order_service import (
    get_scoped_work_order,
    mark_quotation_sent,
    quotation_response,
    register_payment,
    scoped_work_orders,
    transition_work_order,
    upsert_quotation,
    update_work_order,
    user_can_write_work_order,
    work_order_response,
    create_work_order,
)
from app.services.pdf_service import build_quotation_pdf


router = APIRouter()

EVIDENCE_DIR = Path(__file__).resolve().parents[1] / "static" / "evidences"
MAX_EVIDENCE_SIZE = 8 * 1024 * 1024
ALLOWED_EVIDENCE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _ensure_permission(current_user: CurrentUser, *permissions: str) -> None:
    if current_user.is_super_admin:
        return
    if any(permission in current_user.permissions for permission in permissions):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def _evidence_public_path(filename: str) -> str:
    return f"/api/v1/work-orders/evidences/{filename}"


def _evidence_response(evidence: Evidence) -> EvidenceResponse:
    uploader = None
    if evidence.uploaded_by is not None:
        uploader = EvidenceUploadedByResponse(
            id=evidence.uploaded_by.id,
            name=evidence.uploaded_by.full_name or evidence.uploaded_by.username,
            email=evidence.uploaded_by.email,
        )
    return EvidenceResponse(
        id=evidence.id,
        description=evidence.description,
        stage=evidence.stage,
        uploaded_at=evidence.uploaded_at,
        url=evidence.url,
        uploaded_by=uploader,
    )


@router.get("/evidences/{filename}")
def get_evidence_file(filename: str):
    if "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")
    path = EVIDENCE_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")
    return FileResponse(path)


@router.get("/", response_model=list[WorkOrderResponse])
def list_work_orders(
    status: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "workorders.read", "workorders.read.assigned")
    return [work_order_response(work_order) for work_order in scoped_work_orders(db, current_user, status)]


@router.post("/", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
def create_new_work_order(
    data: WorkOrderCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "workorders.create")
    return work_order_response(create_work_order(db, current_user, data))


@router.get("/{work_order_id}", response_model=WorkOrderResponse)
def get_work_order(
    work_order_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "workorders.read", "workorders.read.assigned")
    return work_order_response(get_scoped_work_order(db, current_user, work_order_id))


@router.put("/{work_order_id}", response_model=WorkOrderResponse)
def update_existing_work_order(
    work_order_id: int,
    data: WorkOrderUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "workorders.update", "workorders.update.assigned")
    work_order = get_scoped_work_order(db, current_user, work_order_id)
    return work_order_response(update_work_order(db, current_user, work_order, data))


@router.patch("/{work_order_id}/transition", response_model=WorkOrderResponse)
def transition_existing_work_order(
    work_order_id: int,
    data: WorkOrderTransitionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "workorders.update", "workorders.update.assigned")
    work_order = get_scoped_work_order(db, current_user, work_order_id)
    return work_order_response(transition_work_order(db, current_user, work_order, data.status))


@router.delete("/{work_order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_work_order(
    work_order_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "workorders.delete")
    work_order = get_scoped_work_order(db, current_user, work_order_id)
    if not user_can_write_work_order(current_user, work_order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")
    db.delete(work_order)
    db.commit()


@router.get("/{work_order_id}/quotation", response_model=QuotationResponse)
def get_work_order_quotation(
    work_order_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "workorders.read", "workorders.read.assigned")
    work_order = get_scoped_work_order(db, current_user, work_order_id)
    if work_order.quotation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")
    return quotation_response(work_order.quotation)


@router.post("/{work_order_id}/quotation", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
def create_work_order_quotation(
    work_order_id: int,
    data: QuotationCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "quotations.manage")
    work_order = get_scoped_work_order(db, current_user, work_order_id)
    return quotation_response(upsert_quotation(db, current_user, work_order, data))


@router.put("/{work_order_id}/quotation", response_model=QuotationResponse)
def update_work_order_quotation(
    work_order_id: int,
    data: QuotationCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "quotations.manage")
    work_order = get_scoped_work_order(db, current_user, work_order_id)
    return quotation_response(upsert_quotation(db, current_user, work_order, data))


@router.post("/{work_order_id}/quotation/send", response_model=WorkOrderResponse)
def send_work_order_quotation(
    work_order_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "quotations.manage")
    work_order = get_scoped_work_order(db, current_user, work_order_id)
    return work_order_response(mark_quotation_sent(db, current_user, work_order))


@router.get("/{work_order_id}/evidences", response_model=list[EvidenceResponse])
def list_work_order_evidences(
    work_order_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "workorders.read", "workorders.read.assigned")
    get_scoped_work_order(db, current_user, work_order_id)
    evidences = (
        db.query(Evidence)
        .options(joinedload(Evidence.uploaded_by))
        .filter(Evidence.work_order_id == work_order_id)
        .order_by(Evidence.uploaded_at, Evidence.id)
        .all()
    )
    return [_evidence_response(evidence) for evidence in evidences]


@router.post("/{work_order_id}/evidences", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
async def upload_work_order_evidence(
    work_order_id: int,
    file: UploadFile = File(...),
    description: str = Form(default=""),
    stage: str | None = Form(default=None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "evidences.manage", "workorders.update.assigned")
    work_order = get_scoped_work_order(db, current_user, work_order_id)
    if not user_can_write_work_order(current_user, work_order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    content_type = file.content_type or ""
    extension = ALLOWED_EVIDENCE_TYPES.get(content_type)
    if extension is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Evidence must be an image")

    content = await file.read()
    if len(content) > MAX_EVIDENCE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Evidence must be 8MB or smaller")

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"work-order-{work_order.id}-{uuid4().hex}{extension}"
    path = EVIDENCE_DIR / filename
    path.write_bytes(content)

    evidence = Evidence(
        work_order_id=work_order.id,
        description=description.strip() or None,
        stage=work_order.status,
        url=_evidence_public_path(filename),
        file_path=str(path),
        uploaded_by_user_id=current_user.user_id,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return _evidence_response(evidence)


@router.delete("/evidences/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_order_evidence(
    evidence_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "evidences.manage", "workorders.update.assigned")
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if evidence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")

    work_order = get_scoped_work_order(db, current_user, evidence.work_order_id)
    if not user_can_write_work_order(current_user, work_order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")

    if evidence.file_path:
        path = Path(evidence.file_path)
        if path.exists() and path.is_file():
            path.unlink()

    db.delete(evidence)
    db.commit()


@router.post("/{work_order_id}/payment", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def register_work_order_payment(
    work_order_id: int,
    data: PaymentCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "payments.manage")
    work_order = get_scoped_work_order(db, current_user, work_order_id)
    return PaymentResponse.model_validate(register_payment(db, current_user, work_order, data))


@router.get("/{work_order_id}/pdf")
def get_work_order_pdf(
    work_order_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_permission(current_user, "workorders.read", "workorders.read.assigned")
    work_order = get_scoped_work_order(db, current_user, work_order_id)
    if work_order.quotation is not None:
        pdf_bytes = build_quotation_pdf(work_order)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="cotizacion-OT-{work_order.id:04d}.pdf"'},
        )
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")


@router.get("/{work_order_id}/quotation/pdf")
def get_work_order_quotation_pdf(
    work_order_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_work_order_pdf(
        work_order_id=work_order_id,
        current_user=current_user,
        db=db,
    )
