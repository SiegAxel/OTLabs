from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    rut: Mapped[str | None] = mapped_column(String(20))
    logo_path: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(120))
    address: Mapped[str | None] = mapped_column(Text)
    plan_type: Mapped[str] = mapped_column(String(20), default="pro")
    quote_conditions: Mapped[str | None] = mapped_column(Text)
    quote_warranty: Mapped[str | None] = mapped_column(Text)

    users: Mapped[list["User"]] = relationship(back_populates="company")  # noqa: F821
    clients: Mapped[list["Client"]] = relationship(back_populates="company")  # noqa: F821
    work_orders: Mapped[list["WorkOrder"]] = relationship(back_populates="company")  # noqa: F821
