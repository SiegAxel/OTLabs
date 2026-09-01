from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.deps import CurrentUser
from app.db.base import Client, Payment, Quotation, QuotationItem, Role, User, WorkOrder, WorkOrderStatusHistory
from app.models.schemas import (
    ClientResponse,
    PaymentCreate,
    PaymentResponse,
    QuotationCreate,
    QuotationItemResponse,
    QuotationResponse,
    TechnicianResponse,
    WorkOrderCreate,
    WorkOrderResponse,
    WorkOrderStatusChangedByResponse,
    WorkOrderStatusHistoryResponse,
    WorkOrderUpdate,
)
from app.services.rbac_service import ADMIN_ROLE_NAME, DEFAULT_ROLE_NAME, SUPER_ADMIN_ROLE_NAME


ASSIGNABLE_WORK_ORDER_ROLES = (DEFAULT_ROLE_NAME, ADMIN_ROLE_NAME)


VALID_TRANSITIONS: dict[str, set[str]] = {
    "diagnosis": {"quotation_sent", "rejected"},
    "quotation_sent": {"approved", "rejected"},
    "approved": {"in_execution"},
    "in_execution": {"finished"},
    "finished": {"paid"},
    "paid": set(),
    "rejected": set(),
}


def is_company_admin(current_user: CurrentUser) -> bool:
    return current_user.role in {ADMIN_ROLE_NAME, SUPER_ADMIN_ROLE_NAME}


def user_can_read_work_order(current_user: CurrentUser, work_order: WorkOrder) -> bool:
    if current_user.is_super_admin:
        return True
    if current_user.role == ADMIN_ROLE_NAME and current_user.company_id == work_order.company_id:
        return True
    return work_order.technician_id == current_user.user_id


def user_can_write_work_order(current_user: CurrentUser, work_order: WorkOrder) -> bool:
    if current_user.is_super_admin:
        return True
    if current_user.role == ADMIN_ROLE_NAME and current_user.company_id == work_order.company_id:
        return True
    return work_order.technician_id == current_user.user_id


def work_order_query(db: Session):
    return (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.client),
            joinedload(WorkOrder.technician).joinedload(User.primary_role),
            joinedload(WorkOrder.quotation).joinedload(Quotation.items),
            joinedload(WorkOrder.payment),
            selectinload(WorkOrder.status_history).joinedload(WorkOrderStatusHistory.changed_by),
        )
    )


def scoped_work_orders(db: Session, current_user: CurrentUser, status_filter: str | None = None) -> list[WorkOrder]:
    query = work_order_query(db)

    if not current_user.is_super_admin:
        if current_user.role == ADMIN_ROLE_NAME:
            query = query.filter(WorkOrder.company_id == current_user.company_id)
        else:
            query = query.filter(WorkOrder.technician_id == current_user.user_id)

    if status_filter:
        query = query.filter(WorkOrder.status == status_filter)

    return query.order_by(WorkOrder.created_at.desc(), WorkOrder.id.desc()).all()


def get_scoped_work_order(db: Session, current_user: CurrentUser, work_order_id: int) -> WorkOrder:
    work_order = work_order_query(db).filter(WorkOrder.id == work_order_id).first()
    if work_order is None or not user_can_read_work_order(current_user, work_order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")
    return work_order


def validate_client_in_company(db: Session, client_id: int, company_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id, Client.company_id == company_id).first()
    if client is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Client does not belong to company")
    return client


def validate_technician_in_company(db: Session, technician_id: int | None, company_id: int) -> User | None:
    if technician_id is None:
        return None
    technician = (
        db.query(User)
        .join(Role, User.primary_role_id == Role.id)
        .filter(User.id == technician_id, User.company_id == company_id, Role.name.in_(ASSIGNABLE_WORK_ORDER_ROLES))
        .first()
    )
    if technician is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Technician does not belong to company",
        )
    return technician


def create_work_order(db: Session, current_user: CurrentUser, data: WorkOrderCreate) -> WorkOrder:
    if current_user.company_id is None and not current_user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not associated with a company")

    company_id = current_user.company_id
    if company_id is None:
        client = db.query(Client).filter(Client.id == data.client_id).first()
        if client is None or client.company_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid client")
        company_id = client.company_id

    technician_id = data.technician_id
    if not is_company_admin(current_user):
        if technician_id is not None and technician_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Technicians can only assign work orders to themselves",
            )
        technician_id = current_user.user_id

    validate_client_in_company(db, data.client_id, company_id)
    validate_technician_in_company(db, technician_id, company_id)

    work_order = WorkOrder(
        company_id=company_id,
        client_id=data.client_id,
        technician_id=technician_id,
        title=data.title.strip(),
        visit_type=data.visit_type,
        visit_cost=data.visit_cost if data.visit_type != "free" else 0,
        diagnosis_notes=data.diagnosis_notes.strip() if data.diagnosis_notes else None,
        equipment_info=data.equipment_info.strip() if data.equipment_info else None,
    )
    db.add(work_order)
    try:
        db.flush()
        record_status_change(db, work_order, current_user, None, work_order.status)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return get_scoped_work_order(db, current_user, work_order.id)


def update_work_order(db: Session, current_user: CurrentUser, work_order: WorkOrder, data: WorkOrderUpdate) -> WorkOrder:
    if not user_can_write_work_order(current_user, work_order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    update_data = data.model_dump(exclude_unset=True)
    if "client_id" in update_data and update_data["client_id"] is not None:
        validate_client_in_company(db, update_data["client_id"], work_order.company_id)
        work_order.client_id = update_data["client_id"]
    if "technician_id" in update_data:
        validate_technician_in_company(db, update_data["technician_id"], work_order.company_id)
        work_order.technician_id = update_data["technician_id"]
    if "title" in update_data and update_data["title"] is not None:
        work_order.title = update_data["title"].strip()
    previous_status = work_order.status
    if "status" in update_data and update_data["status"] is not None:
        set_work_order_status(db, work_order, current_user, update_data["status"])
    if "visit_type" in update_data and update_data["visit_type"] is not None:
        work_order.visit_type = update_data["visit_type"]
        if work_order.visit_type == "free":
            work_order.visit_cost = 0
    if "visit_cost" in update_data and update_data["visit_cost"] is not None:
        work_order.visit_cost = update_data["visit_cost"] if work_order.visit_type != "free" else 0
    if "diagnosis_notes" in update_data:
        value = update_data["diagnosis_notes"]
        work_order.diagnosis_notes = value.strip() if value else None
    if "equipment_info" in update_data:
        value = update_data["equipment_info"]
        work_order.equipment_info = value.strip() if value else None

    try:
        db.commit()
    except Exception:
        db.rollback()
        work_order.status = previous_status
        raise
    return get_scoped_work_order(db, current_user, work_order.id)


def record_status_change(
    db: Session,
    work_order: WorkOrder,
    current_user: CurrentUser,
    from_status: str | None,
    to_status: str,
) -> WorkOrderStatusHistory | None:
    if from_status == to_status:
        return None
    history = WorkOrderStatusHistory(
        work_order_id=work_order.id,
        from_status=from_status,
        to_status=to_status,
        changed_by_user_id=current_user.user_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(history)
    return history


def set_work_order_status(
    db: Session,
    work_order: WorkOrder,
    current_user: CurrentUser,
    new_status: str,
) -> bool:
    previous_status = work_order.status
    if previous_status == new_status:
        return False
    work_order.status = new_status
    record_status_change(db, work_order, current_user, previous_status, new_status)
    return True


def transition_work_order(db: Session, current_user: CurrentUser, work_order: WorkOrder, new_status: str) -> WorkOrder:
    if new_status not in VALID_TRANSITIONS.get(work_order.status, set()):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status transition")
    previous_status = work_order.status
    set_work_order_status(db, work_order, current_user, new_status)
    try:
        db.commit()
    except Exception:
        db.rollback()
        work_order.status = previous_status
        raise
    return get_scoped_work_order(db, current_user, work_order.id)


def upsert_quotation(db: Session, current_user: CurrentUser, work_order: WorkOrder, data: QuotationCreate) -> Quotation:
    if not user_can_write_work_order(current_user, work_order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")
    if work_order.status == "approved":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Approved quotations cannot be modified")
    if not data.items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Quotation must contain items")

    quotation = work_order.quotation
    if quotation is None:
        quotation = Quotation(work_order=work_order)
        db.add(quotation)

    quotation.items.clear()
    subtotal = 0
    for item_data in data.items:
        qty = max(float(item_data.qty), 0)
        unit_price = max(int(item_data.unit_price), 0)
        subtotal += int(round(qty * unit_price))
        quotation.items.append(
            QuotationItem(
                description=item_data.description.strip(),
                qty=qty,
                unit_price=unit_price,
            )
        )

    discount = max(int(data.discount or 0), 0)
    quotation.subtotal = subtotal
    quotation.discount = discount
    quotation.total = max(subtotal - discount, 0)
    quotation.conditions = data.conditions.strip() if data.conditions else None
    quotation.warranty = data.warranty.strip() if data.warranty else None
    quotation.validity_days = max(int(data.validity_days or 15), 1)

    db.commit()
    db.refresh(quotation)
    return quotation


def mark_quotation_sent(db: Session, current_user: CurrentUser, work_order: WorkOrder) -> WorkOrder:
    if work_order.quotation is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Quotation does not exist")
    work_order.quotation.sent_at = datetime.now(timezone.utc)
    previous_status = work_order.status
    if work_order.status == "diagnosis":
        set_work_order_status(db, work_order, current_user, "quotation_sent")
    try:
        db.commit()
    except Exception:
        db.rollback()
        work_order.status = previous_status
        raise
    return get_scoped_work_order(db, current_user, work_order.id)


def register_payment(db: Session, current_user: CurrentUser, work_order: WorkOrder, data: PaymentCreate) -> Payment:
    if not user_can_write_work_order(current_user, work_order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")

    payment = work_order.payment
    if payment is None:
        payment = Payment(work_order=work_order)
        db.add(payment)

    payment.amount = max(int(data.amount), 0)
    payment.method = data.method.strip()
    payment.notes = data.notes.strip() if data.notes else None
    payment.paid_at = datetime.now(timezone.utc)
    previous_status = work_order.status
    set_work_order_status(db, work_order, current_user, "paid")
    try:
        db.commit()
    except Exception:
        db.rollback()
        work_order.status = previous_status
        raise
    db.refresh(payment)
    return payment


def work_order_response(work_order: WorkOrder) -> WorkOrderResponse:
    technician = None
    if work_order.technician is not None:
        technician = TechnicianResponse(
            id=work_order.technician.id,
            company_id=work_order.technician.company_id,
            name=work_order.technician.full_name or work_order.technician.username,
            email=work_order.technician.email,
            phone=work_order.technician.phone,
            is_active=work_order.technician.is_active,
            active_ots=0,
            created_at=work_order.technician.created_at,
            updated_at=work_order.technician.updated_at,
        )

    quotation = quotation_response(work_order.quotation) if work_order.quotation is not None else None
    payment = PaymentResponse.model_validate(work_order.payment) if work_order.payment is not None else None

    return WorkOrderResponse(
        id=work_order.id,
        company_id=work_order.company_id,
        client_id=work_order.client_id,
        technician_id=work_order.technician_id,
        title=work_order.title,
        status=work_order.status,
        visit_type=work_order.visit_type,
        visit_cost=work_order.visit_cost,
        diagnosis_notes=work_order.diagnosis_notes,
        equipment_info=work_order.equipment_info,
        created_at=work_order.created_at,
        updated_at=work_order.updated_at,
        client=ClientResponse.model_validate(work_order.client) if work_order.client is not None else None,
        technician=technician,
        quotation=quotation,
        payment=payment,
        status_history=[
            WorkOrderStatusHistoryResponse(
                id=movement.id,
                from_status=movement.from_status,
                to_status=movement.to_status,
                created_at=_as_utc(movement.created_at),
                changed_by=WorkOrderStatusChangedByResponse(
                    id=movement.changed_by.id,
                    name=movement.changed_by.full_name or movement.changed_by.username,
                    email=movement.changed_by.email,
                ),
            )
            for movement in work_order.status_history
        ],
    )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def quotation_response(quotation: Quotation) -> QuotationResponse:
    return QuotationResponse(
        id=quotation.id,
        work_order_id=quotation.work_order_id,
        items=[
            QuotationItemResponse(
                id=item.id,
                description=item.description,
                qty=item.qty,
                unit_price=item.unit_price,
            )
            for item in quotation.items
        ],
        subtotal=quotation.subtotal,
        discount=quotation.discount,
        total=quotation.total,
        conditions=quotation.conditions,
        warranty=quotation.warranty,
        validity_days=quotation.validity_days,
        sent_at=quotation.sent_at,
        created_at=quotation.created_at,
    )
