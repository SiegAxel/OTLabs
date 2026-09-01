"""add company profile fields

Revision ID: 20260615_02
Revises: 20260615_01
Create Date: 2026-06-15 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260615_02"
down_revision = "20260615_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("companies"):
        return

    company_columns = {column["name"] for column in inspector.get_columns("companies")}
    if "logo_path" not in company_columns:
        op.add_column("companies", sa.Column("logo_path", sa.String(length=500), nullable=True))
    if "plan_type" not in company_columns:
        op.add_column("companies", sa.Column("plan_type", sa.String(length=30), nullable=True))
    if "quote_conditions" not in company_columns:
        op.add_column("companies", sa.Column("quote_conditions", sa.String(), nullable=True))
    if "quote_warranty" not in company_columns:
        op.add_column("companies", sa.Column("quote_warranty", sa.String(), nullable=True))

    op.execute("UPDATE companies SET plan_type = 'basic' WHERE plan_type IS NULL")

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE companies ALTER COLUMN plan_type SET NOT NULL")


def downgrade() -> None:
    op.drop_column("companies", "quote_warranty")
    op.drop_column("companies", "quote_conditions")
    op.drop_column("companies", "plan_type")
    op.drop_column("companies", "logo_path")
