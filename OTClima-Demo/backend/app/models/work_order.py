from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

OT_STATES = [
    "diagnosis",
    "quotation_sent",
    "approved",
    "in_execution",
    "finished",
    "paid",
    "rejected",
]

VALID_TRANSITIONS: dict[str, list[str]] = {
    "diagnosis": ["quotation_sent", "rejected"],
    "quotation_sent": ["approved", "rejected"],
    "approved": ["in_execution"],
    "in_execution": ["finished"],
    "finished": ["paid"],
    "paid": [],
    "rejected": [],
}


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    technician_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), default="diagnosis")

    visit_type: Mapped[str] = mapped_column(String(30), default="free")
    visit_cost: Mapped[float] = mapped_column(Float, default=0.0)

    diagnosis_notes: Mapped[str | None] = mapped_column(Text)
    equipment_info: Mapped[str | None] = mapped_column(String(255))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    company: Mapped["Company"] = relationship(back_populates="work_orders")  # noqa: F821
    client: Mapped["Client"] = relationship(back_populates="work_orders")  # noqa: F821
    technician: Mapped["User | None"] = relationship(back_populates="assigned_orders")  # noqa: F821
    quotation: Mapped["Quotation | None"] = relationship(back_populates="work_order", uselist=False)  # noqa: F821
    payment: Mapped["Payment | None"] = relationship(back_populates="work_order", uselist=False)  # noqa: F821
    evidences: Mapped[list["Evidence"]] = relationship(back_populates="work_order")  # noqa: F821

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in VALID_TRANSITIONS.get(self.status, [])
