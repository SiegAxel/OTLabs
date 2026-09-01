"""add rbac dynamic permissions

Revision ID: 20260517_01
Revises: 
Create Date: 2026-05-17 00:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260517_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_roles_id"), "roles", ["id"], unique=False)
    op.create_index(op.f("ix_roles_name"), "roles", ["name"], unique=True)

    op.create_table(
        "permissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_permissions_code"), "permissions", ["code"], unique=True)
    op.create_index(op.f("ix_permissions_id"), "permissions", ["id"], unique=False)

    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
    )

    op.create_table(
        "user_permissions",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.Column("granted_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["granted_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "permission_id"),
    )

    op.add_column("users", sa.Column("primary_role_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_users_primary_role_id"), "users", ["primary_role_id"], unique=False)
    op.create_foreign_key("fk_users_primary_role_id", "users", "roles", ["primary_role_id"], ["id"])

    op.execute(
        "INSERT INTO roles (name, description) VALUES ('Admin', 'System administrator') ON CONFLICT (name) DO NOTHING"
    )
    op.execute(
        "INSERT INTO roles (name, description) VALUES ('Tecnico', 'Default technical role') ON CONFLICT (name) DO NOTHING"
    )

    permission_seed = [
        ("auth.me.read", "View current authenticated profile"),
        ("tickets.read.assigned", "View assigned tickets"),
        ("tickets.update.assigned", "Update assigned tickets"),
        ("workorders.read.assigned", "View assigned work orders"),
        ("workorders.update.assigned", "Update assigned work orders"),
        ("clients.read.assigned", "View assigned clients"),
        ("inventory.read", "View inventory"),
        ("reports.technical.read", "View technical reports"),
        ("users.manage", "Manage users and direct permissions"),
        ("roles.manage", "Manage role to permission mappings"),
        ("permissions.manage", "Manage permission catalog"),
        ("billing.manage", "Manage billing operations"),
    ]
    for code, description in permission_seed:
        op.execute(
            sa.text(
                """
                INSERT INTO permissions (code, description)
                VALUES (:code, :description)
                ON CONFLICT (code) DO NOTHING
                """
            ).bindparams(code=code, description=description)
        )

    op.execute(
        """
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r
        JOIN permissions p ON p.code IN (
            'auth.me.read',
            'tickets.read.assigned',
            'tickets.update.assigned',
            'workorders.read.assigned',
            'workorders.update.assigned',
            'clients.read.assigned',
            'inventory.read',
            'reports.technical.read'
        )
        WHERE r.name = 'Tecnico'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r
        JOIN permissions p ON 1 = 1
        WHERE r.name = 'Admin'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE users
        SET primary_role_id = (SELECT id FROM roles WHERE name = 'Tecnico')
        WHERE primary_role_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_primary_role_id", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_primary_role_id"), table_name="users")
    op.drop_column("users", "primary_role_id")

    op.drop_table("user_permissions")
    op.drop_table("role_permissions")
    op.drop_index(op.f("ix_permissions_id"), table_name="permissions")
    op.drop_index(op.f("ix_permissions_code"), table_name="permissions")
    op.drop_table("permissions")
    op.drop_index(op.f("ix_roles_name"), table_name="roles")
    op.drop_index(op.f("ix_roles_id"), table_name="roles")
    op.drop_table("roles")
