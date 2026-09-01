"""add work order status history

Revision ID: 20260726_01
Revises: 20260615_03
Create Date: 2026-07-26 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260726_01"
down_revision = "20260615_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("work_order_status_history"):
        op.create_table(
            "work_order_status_history",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("work_order_id", sa.Integer(), nullable=False),
            sa.Column("from_status", sa.String(length=30), nullable=True),
            sa.Column("to_status", sa.String(length=30), nullable=False),
            sa.Column("changed_by_user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["changed_by_user_id"], ["users.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
        )

    existing_indexes = {
        index["name"]
        for index in sa.inspect(bind).get_indexes("work_order_status_history")
    }
    for index_name, column_name in (
        ("ix_work_order_status_history_work_order_id", "work_order_id"),
        ("ix_work_order_status_history_created_at", "created_at"),
        ("ix_work_order_status_history_changed_by_user_id", "changed_by_user_id"),
    ):
        if index_name not in existing_indexes:
            op.create_index(index_name, "work_order_status_history", [column_name])

    # Existing rows have no reliable actor. Use their assigned technician when
    # available, otherwise the oldest user from the same company.
    op.execute(
        """
        INSERT INTO work_order_status_history
            (work_order_id, from_status, to_status, changed_by_user_id, created_at)
        SELECT
            wo.id,
            NULL,
            wo.status,
            COALESCE(
                wo.technician_id,
                (
                    SELECT u.id
                    FROM users u
                    WHERE u.company_id = wo.company_id
                    ORDER BY u.id
                    LIMIT 1
                )
            ),
            COALESCE(wo.created_at, CURRENT_TIMESTAMP)
        FROM work_orders wo
        WHERE NOT EXISTS (
            SELECT 1
            FROM work_order_status_history history
            WHERE history.work_order_id = wo.id
        )
        AND
        COALESCE(
            wo.technician_id,
            (
                SELECT u.id
                FROM users u
                WHERE u.company_id = wo.company_id
                ORDER BY u.id
                LIMIT 1
            )
        ) IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_work_order_status_history_changed_by_user_id", table_name="work_order_status_history")
    op.drop_index("ix_work_order_status_history_created_at", table_name="work_order_status_history")
    op.drop_index("ix_work_order_status_history_work_order_id", table_name="work_order_status_history")
    op.drop_table("work_order_status_history")
