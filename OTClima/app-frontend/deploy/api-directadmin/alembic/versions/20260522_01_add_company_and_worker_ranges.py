"""add companies and worker ranges for registration wizard

Revision ID: 20260522_01
Revises: 20260517_01
Create Date: 2026-05-22 00:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260522_01"
down_revision = "20260517_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("companies"):
        op.create_table(
            "companies",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("tax_id", sa.String(length=30), nullable=True),
            sa.Column("email", sa.String(length=100), nullable=True),
            sa.Column("phone", sa.String(length=30), nullable=True),
            sa.Column("address", sa.String(length=255), nullable=True),
            sa.Column("is_independent", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if not inspector.has_table("worker_ranges"):
        op.create_table(
            "worker_ranges",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("code", sa.String(length=20), nullable=False),
            sa.Column("label", sa.String(length=50), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    op.execute("CREATE INDEX IF NOT EXISTS ix_companies_id ON companies (id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_companies_name ON companies (name)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_companies_tax_id ON companies (tax_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_worker_ranges_id ON worker_ranges (id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_worker_ranges_code ON worker_ranges (code)")

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "company_id" not in user_columns:
        op.add_column("users", sa.Column("company_id", sa.Integer(), nullable=True))
    if "worker_range_id" not in user_columns:
        op.add_column("users", sa.Column("worker_range_id", sa.Integer(), nullable=True))
    if "account_type" not in user_columns:
        op.add_column("users", sa.Column("account_type", sa.String(length=20), nullable=True))
    if "account_status" not in user_columns:
        op.add_column("users", sa.Column("account_status", sa.String(length=30), nullable=True))
    if "terms_accepted" not in user_columns:
        op.add_column("users", sa.Column("terms_accepted", sa.Boolean(), nullable=True))
    if "full_name" not in user_columns:
        op.add_column("users", sa.Column("full_name", sa.String(length=120), nullable=True))
    if "phone" not in user_columns:
        op.add_column("users", sa.Column("phone", sa.String(length=30), nullable=True))
    if "city_commune" not in user_columns:
        op.add_column("users", sa.Column("city_commune", sa.String(length=120), nullable=True))

    op.execute("CREATE INDEX IF NOT EXISTS ix_users_company_id ON users (company_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_worker_range_id ON users (worker_range_id)")

    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_company_id'
                ) THEN
                    ALTER TABLE users
                    ADD CONSTRAINT fk_users_company_id
                    FOREIGN KEY (company_id) REFERENCES companies(id);
                END IF;
            END
            $$;
            """
        )
    )
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_worker_range_id'
                ) THEN
                    ALTER TABLE users
                    ADD CONSTRAINT fk_users_worker_range_id
                    FOREIGN KEY (worker_range_id) REFERENCES worker_ranges(id);
                END IF;
            END
            $$;
            """
        )
    )

    worker_ranges_seed = ["1-5", "6-20", "21-50", "51-200", "200+"]
    for code in worker_ranges_seed:
        op.execute(
            sa.text(
                """
                INSERT INTO worker_ranges (code, label)
                VALUES (:code, :label)
                ON CONFLICT (code) DO NOTHING
                """
            ).bindparams(code=code, label=code)
        )

    companies_seed = [
        ("Independiente", None, None, None, None, True),
        ("Constructora Andina SpA", "76.123.456-7", "contacto@andina.example", "+56 2 2456 7800", "Av. Apoquindo 4500, Las Condes", False),
        ("Servicios Tecnicos Sur Ltda", "77.987.654-3", "operaciones@sur.example", "+56 41 312 4455", "O'Higgins 120, Concepcion", False),
        ("Montajes Industriales Norte", "78.456.123-9", "admin@norte.example", "+56 55 245 9900", "Ruta 5 Norte Km 1380, Antofagasta", False),
    ]
    for name, tax_id, email, phone, address, is_independent in companies_seed:
        op.execute(
            sa.text(
                """
                INSERT INTO companies (name, tax_id, email, phone, address, is_independent)
                VALUES (:name, :tax_id, :email, :phone, :address, :is_independent)
                ON CONFLICT (name) DO NOTHING
                """
            ).bindparams(
                name=name,
                tax_id=tax_id,
                email=email,
                phone=phone,
                address=address,
                is_independent=is_independent,
            )
        )

    op.execute("UPDATE users SET account_type = 'independent' WHERE account_type IS NULL")
    op.execute("UPDATE users SET account_status = 'approved' WHERE account_status IS NULL")
    op.execute("UPDATE users SET terms_accepted = TRUE WHERE terms_accepted IS NULL")
    op.execute(
        """
        UPDATE users
        SET company_id = (SELECT id FROM companies WHERE name = 'Independiente')
        WHERE company_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_worker_range_id", "users", type_="foreignkey")
    op.drop_constraint("fk_users_company_id", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_worker_range_id"), table_name="users")
    op.drop_index(op.f("ix_users_company_id"), table_name="users")

    op.drop_column("users", "city_commune")
    op.drop_column("users", "phone")
    op.drop_column("users", "full_name")
    op.drop_column("users", "terms_accepted")
    op.drop_column("users", "account_status")
    op.drop_column("users", "account_type")
    op.drop_column("users", "worker_range_id")
    op.drop_column("users", "company_id")

    op.drop_index(op.f("ix_worker_ranges_code"), table_name="worker_ranges")
    op.drop_index(op.f("ix_worker_ranges_id"), table_name="worker_ranges")
    op.drop_table("worker_ranges")

    op.drop_index(op.f("ix_companies_tax_id"), table_name="companies")
    op.drop_index(op.f("ix_companies_name"), table_name="companies")
    op.drop_index(op.f("ix_companies_id"), table_name="companies")
    op.drop_table("companies")
