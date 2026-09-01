"""add evidence uploader

Revision ID: 20260726_02
Revises: 20260726_01
Create Date: 2026-07-26 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260726_02"
down_revision = "20260726_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("evidences")}

    if "uploaded_by_user_id" not in columns:
        op.add_column("evidences", sa.Column("uploaded_by_user_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_evidences_uploaded_by_user_id",
            "evidences",
            "users",
            ["uploaded_by_user_id"],
            ["id"],
            ondelete="RESTRICT",
        )

    index_names = {index["name"] for index in sa.inspect(bind).get_indexes("evidences")}
    if "ix_evidences_uploaded_by_user_id" not in index_names:
        op.create_index("ix_evidences_uploaded_by_user_id", "evidences", ["uploaded_by_user_id"])

    # The exact uploader is unknown for existing evidence. Prefer the assigned
    # technician, then the oldest user in the work order's company.
    op.execute(
        """
        UPDATE evidences evidence
        SET uploaded_by_user_id = COALESCE(
            work_order.technician_id,
            (
                SELECT company_user.id
                FROM users company_user
                WHERE company_user.company_id = work_order.company_id
                ORDER BY company_user.id
                LIMIT 1
            )
        )
        FROM work_orders work_order
        WHERE evidence.work_order_id = work_order.id
          AND evidence.uploaded_by_user_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_evidences_uploaded_by_user_id", table_name="evidences")
    op.drop_constraint("fk_evidences_uploaded_by_user_id", "evidences", type_="foreignkey")
    op.drop_column("evidences", "uploaded_by_user_id")
