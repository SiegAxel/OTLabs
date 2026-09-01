from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.work_order import WorkOrder
from app.models.payment import Payment
from app.models.client import Client
from app.models.user import User
from app.schemas.report import DashboardSummary, OTStatusCount, MonthlyRevenue
from app.api.deps import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cid = current_user.company_id
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    active_statuses = ["diagnosis", "quotation_sent", "approved", "in_execution", "finished"]
    active_ots = db.query(WorkOrder).filter(
        WorkOrder.company_id == cid,
        WorkOrder.status.in_(active_statuses),
    ).count()

    pending_quotations = db.query(WorkOrder).filter(
        WorkOrder.company_id == cid,
        WorkOrder.status == "quotation_sent",
    ).count()

    monthly_revenue = (
        db.query(func.sum(Payment.amount))
        .join(WorkOrder)
        .filter(WorkOrder.company_id == cid, Payment.paid_at >= month_start)
        .scalar()
    ) or 0.0

    total_closed = db.query(WorkOrder).filter(
        WorkOrder.company_id == cid,
        WorkOrder.status.in_(["paid", "rejected"]),
    ).count()
    total_paid = db.query(WorkOrder).filter(
        WorkOrder.company_id == cid,
        WorkOrder.status == "paid",
    ).count()
    approval_rate = (total_paid / total_closed * 100) if total_closed > 0 else 0.0

    status_counts = (
        db.query(WorkOrder.status, func.count(WorkOrder.id))
        .filter(WorkOrder.company_id == cid)
        .group_by(WorkOrder.status)
        .all()
    )
    ot_by_status = [OTStatusCount(status=s, count=c) for s, c in status_counts]

    monthly_chart = []
    for i in range(5, -1, -1):
        m_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        m_end = (m_start.replace(month=m_start.month % 12 + 1) if m_start.month < 12
                 else m_start.replace(year=m_start.year + 1, month=1))
        rev = (
            db.query(func.sum(Payment.amount))
            .join(WorkOrder)
            .filter(
                WorkOrder.company_id == cid,
                Payment.paid_at >= m_start,
                Payment.paid_at < m_end,
            )
            .scalar()
        ) or 0.0
        monthly_chart.append(MonthlyRevenue(
            month=m_start.strftime("%b %Y"),
            total=rev,
        ))

    recent = (
        db.query(WorkOrder)
        .filter(WorkOrder.company_id == cid)
        .order_by(WorkOrder.created_at.desc())
        .limit(5)
        .all()
    )
    recent_ots = [
        {"id": o.id, "title": o.title, "status": o.status, "created_at": o.created_at.isoformat()}
        for o in recent
    ]

    return DashboardSummary(
        active_ots=active_ots,
        pending_quotations=pending_quotations,
        monthly_revenue=monthly_revenue,
        approval_rate=round(approval_rate, 1),
        ot_by_status=ot_by_status,
        monthly_revenue_chart=monthly_chart,
        recent_ots=recent_ots,
    )


@router.get("/ots-export")
def export_ots(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ots = (
        db.query(WorkOrder)
        .filter(WorkOrder.company_id == current_user.company_id)
        .order_by(WorkOrder.created_at.desc())
        .all()
    )
    rows = []
    for o in ots:
        rows.append({
            "id": o.id,
            "title": o.title,
            "status": o.status,
            "client": o.client.name if o.client else "",
            "technician": o.technician.name if o.technician else "",
            "visit_type": o.visit_type,
            "visit_cost": o.visit_cost,
            "total": o.quotation.total if o.quotation else 0,
            "paid_amount": o.payment.amount if o.payment else 0,
            "created_at": o.created_at.isoformat(),
        })
    return rows
