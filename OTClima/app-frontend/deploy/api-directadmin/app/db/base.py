from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base

Base = declarative_base()


role_permissions_table = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


user_permissions_table = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    Column("granted_by", Integer, ForeignKey("users.id"), nullable=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    users = relationship("User", back_populates="primary_role")
    permissions = relationship(
        "Permission",
        secondary=role_permissions_table,
        back_populates="roles",
    )


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    roles = relationship(
        "Role",
        secondary=role_permissions_table,
        back_populates="permissions",
    )
    users = relationship(
        "User",
        secondary=user_permissions_table,
        back_populates="direct_permissions",
        foreign_keys=[user_permissions_table.c.permission_id, user_permissions_table.c.user_id],
    )


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, index=True, nullable=False)
    tax_id = Column(String(30), unique=True, index=True, nullable=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    address = Column(String(255), nullable=True)
    logo_path = Column(String(500), nullable=True)
    plan_type = Column(String(30), default="basic", nullable=False)
    quote_conditions = Column(Text, nullable=True)
    quote_warranty = Column(Text, nullable=True)
    is_independent = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="company")
    clients = relationship("Client", back_populates="company")


class WorkerRange(Base):
    __tablename__ = "worker_ranges"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    label = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="worker_range")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    verification_code = Column(String(10), nullable=True)
    verification_expires_at = Column(DateTime(timezone=True), nullable=True)
    token_version = Column(Integer, default=1)
    primary_role_id = Column(Integer, ForeignKey("roles.id"), nullable=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    worker_range_id = Column(Integer, ForeignKey("worker_ranges.id"), nullable=True, index=True)
    account_type = Column(String(20), default="independent", nullable=False)
    account_status = Column(String(30), default="approved", nullable=False)
    terms_accepted = Column(Boolean, default=False, nullable=False)
    full_name = Column(String(120), nullable=True)
    phone = Column(String(30), nullable=True)
    city_commune = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    primary_role = relationship("Role", back_populates="users")
    company = relationship("Company", back_populates="users")
    worker_range = relationship("WorkerRange", back_populates="users")
    direct_permissions = relationship(
        "Permission",
        secondary=user_permissions_table,
        back_populates="users",
        foreign_keys=[user_permissions_table.c.user_id, user_permissions_table.c.permission_id],
    )


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint("company_id", "rut", name="uq_clients_company_rut"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    nombre = Column(String(150), nullable=False, index=True)
    rut = Column(String(20), index=True, nullable=False)
    telefono = Column(String(30), nullable=True)
    email = Column(String(100), nullable=True)
    direccion = Column(String(255), nullable=True)
    notas = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("Company", back_populates="clients")


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    status = Column(String(30), default="diagnosis", nullable=False, index=True)
    visit_type = Column(String(30), default="free", nullable=False)
    visit_cost = Column(Integer, default=0, nullable=False)
    diagnosis_notes = Column(Text, nullable=True)
    equipment_info = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("Company")
    client = relationship("Client")
    technician = relationship("User")
    quotation = relationship("Quotation", back_populates="work_order", uselist=False, cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="work_order", uselist=False, cascade="all, delete-orphan")
    evidences = relationship("Evidence", back_populates="work_order", cascade="all, delete-orphan")
    status_history = relationship(
        "WorkOrderStatusHistory",
        back_populates="work_order",
        cascade="all, delete-orphan",
        order_by="WorkOrderStatusHistory.created_at, WorkOrderStatusHistory.id",
    )


class WorkOrderStatusHistory(Base):
    __tablename__ = "work_order_status_history"
    __table_args__ = (
        Index("ix_work_order_status_history_work_order_id", "work_order_id"),
        Index("ix_work_order_status_history_created_at", "created_at"),
        Index("ix_work_order_status_history_changed_by_user_id", "changed_by_user_id"),
    )

    id = Column(Integer, primary_key=True)
    work_order_id = Column(
        Integer,
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_status = Column(String(30), nullable=True)
    to_status = Column(String(30), nullable=False)
    changed_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    work_order = relationship("WorkOrder", back_populates="status_history")
    changed_by = relationship("User")


class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    subtotal = Column(Integer, default=0, nullable=False)
    discount = Column(Integer, default=0, nullable=False)
    total = Column(Integer, default=0, nullable=False)
    conditions = Column(Text, nullable=True)
    warranty = Column(Text, nullable=True)
    validity_days = Column(Integer, default=15, nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    work_order = relationship("WorkOrder", back_populates="quotation")
    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")


class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id = Column(Integer, primary_key=True, index=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    qty = Column(Float, default=1, nullable=False)
    unit_price = Column(Integer, default=0, nullable=False)

    quotation = relationship("Quotation", back_populates="items")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    method = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    paid_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    work_order = relationship("WorkOrder", back_populates="payment")


class Evidence(Base):
    __tablename__ = "evidences"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(255), nullable=True)
    stage = Column(String(50), default="execution", nullable=False)
    url = Column(String(500), nullable=False)
    file_path = Column(String(500), nullable=True)
    uploaded_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    work_order = relationship("WorkOrder", back_populates="evidences")
    uploaded_by = relationship("User")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(500), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="refresh_tokens")    
