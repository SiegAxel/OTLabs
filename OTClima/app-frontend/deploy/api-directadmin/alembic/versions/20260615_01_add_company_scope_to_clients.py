"""add company scope to clients

Revision ID: 20260615_01
Revises: 20260613_01
Create Date: 2026-06-15 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260615_01"
down_revision = "20260613_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("clients"):
        return

    client_columns = {column["name"] for column in inspector.get_columns("clients")}
    if "company_id" not in client_columns:
        op.add_column("clients", sa.Column("company_id", sa.Integer(), nullable=True))

    op.execute("CREATE INDEX IF NOT EXISTS ix_clients_company_id ON clients (company_id)")

    op.execute(
        """
        UPDATE clients
        SET company_id = (SELECT id FROM companies WHERE name = 'Independiente')
        WHERE company_id IS NULL
        """
    )

    dialect_name = bind.dialect.name
    if dialect_name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_clients_rut")
        op.execute("CREATE INDEX IF NOT EXISTS ix_clients_rut ON clients (rut)")
        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_clients_company_id'
                    ) THEN
                        ALTER TABLE clients
                        ADD CONSTRAINT fk_clients_company_id
                        FOREIGN KEY (company_id) REFERENCES companies(id);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'uq_clients_company_rut'
                    ) THEN
                        ALTER TABLE clients
                        ADD CONSTRAINT uq_clients_company_rut UNIQUE (company_id, rut);
                    END IF;
                END
                $$;
                """
            )
        )
    else:
        op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_company_rut ON clients (company_id, rut)")


def downgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    if dialect_name == "postgresql":
        op.execute("ALTER TABLE clients DROP CONSTRAINT IF EXISTS uq_clients_company_rut")
        op.execute("ALTER TABLE clients DROP CONSTRAINT IF EXISTS fk_clients_company_id")
    else:
        op.execute("DROP INDEX IF EXISTS uq_clients_company_rut")

    op.drop_index(op.f("ix_clients_company_id"), table_name="clients")
    op.drop_column("clients", "company_id")
