"""add clients table for client dimension

Revision ID: 20260613_01
Revises: 20260522_01
Create Date: 2026-06-13 00:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260613_01"
down_revision = "20260522_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("clients"):
        op.create_table(
            "clients",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("nombre", sa.String(length=150), nullable=False),
            sa.Column("rut", sa.String(length=20), nullable=False),
            sa.Column("telefono", sa.String(length=30), nullable=True),
            sa.Column("email", sa.String(length=100), nullable=True),
            sa.Column("direccion", sa.String(length=255), nullable=True),
            sa.Column("notas", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.text("now()"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    op.execute("CREATE INDEX IF NOT EXISTS ix_clients_id ON clients (id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_clients_rut ON clients (rut)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_clients_nombre ON clients (nombre)")


def downgrade() -> None:
    op.drop_index(op.f("ix_clients_nombre"), table_name="clients")
    op.drop_index(op.f("ix_clients_rut"), table_name="clients")
    op.drop_index(op.f("ix_clients_id"), table_name="clients")
    op.drop_table("clients")
