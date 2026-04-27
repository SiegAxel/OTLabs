from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id"), unique=True)

    amount: Mapped[float] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String(40), default="transfer")
    notes: Mapped[str | None] = mapped_column(Text)
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    work_order: Mapped["WorkOrder"] = relationship(back_populates="payment")  # noqa: F821
