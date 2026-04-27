from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Evidence(Base):
    __tablename__ = "evidences"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id"))

    file_path: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    stage: Mapped[str] = mapped_column(String(20), default="execution")  # diagnosis | execution
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    work_order: Mapped["WorkOrder"] = relationship(back_populates="evidences")  # noqa: F821
