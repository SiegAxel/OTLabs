"""add work orders

Revision ID: 20260615_03
Revises: 20260615_02
Create Date: 2026-06-15 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260615_03"
down_revision = "20260615_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("work_orders"):
        op.create_table(
            "work_orders",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("company_id", sa.Integer(), nullable=False),
            sa.Column("client_id", sa.Integer(), nullable=False),
            sa.Column("technician_id", sa.Integer(), nullable=True),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="diagnosis"),
            sa.Column("visit_type", sa.String(length=30), nullable=False, server_default="free"),
            sa.Column("visit_cost", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("diagnosis_notes", sa.String(), nullable=True),
            sa.Column("equipment_info", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
            sa.ForeignKeyConstraint(["technician_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    if not inspector.has_table("quotations"):
        op.create_table(
            "quotations",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("work_order_id", sa.Integer(), nullable=False),
            sa.Column("subtotal", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("discount", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("conditions", sa.String(), nullable=True),
            sa.Column("warranty", sa.String(), nullable=True),
            sa.Column("validity_days", sa.Integer(), nullable=False, server_default="15"),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("work_order_id"),
        )

    if not inspector.has_table("quotation_items"):
        op.create_table(
            "quotation_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("quotation_id", sa.Integer(), nullable=False),
            sa.Column("description", sa.String(length=255), nullable=False),
            sa.Column("qty", sa.Float(), nullable=False, server_default="1"),
            sa.Column("unit_price", sa.Integer(), nullable=False, server_default="0"),
            sa.ForeignKeyConstraint(["quotation_id"], ["quotations.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not inspector.has_table("payments"):
        op.create_table(
            "payments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("work_order_id", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=False),
            sa.Column("method", sa.String(length=50), nullable=False),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("paid_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("work_order_id"),
        )

    if not inspector.has_table("evidences"):
        op.create_table(
            "evidences",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("work_order_id", sa.Integer(), nullable=False),
            sa.Column("description", sa.String(length=255), nullable=True),
            sa.Column("stage", sa.String(length=50), nullable=False, server_default="execution"),
            sa.Column("url", sa.String(length=500), nullable=False),
            sa.Column("file_path", sa.String(length=500), nullable=True),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    for table, columns in {
        "work_orders": ["id", "company_id", "client_id", "technician_id", "status"],
        "quotations": ["id", "work_order_id"],
        "quotation_items": ["id", "quotation_id"],
        "payments": ["id", "work_order_id"],
        "evidences": ["id", "work_order_id"],
    }.items():
        for column in columns:
            op.execute(f"CREATE INDEX IF NOT EXISTS ix_{table}_{column} ON {table} ({column})")


def downgrade() -> None:
    op.drop_table("evidences")
    op.drop_table("payments")
    op.drop_table("quotation_items")
    op.drop_table("quotations")
    op.drop_table("work_orders")
