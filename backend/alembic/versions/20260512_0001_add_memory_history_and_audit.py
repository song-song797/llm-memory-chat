"""add memory history and audit

Revision ID: 20260512_0001
Revises: 20260509_0001_add_message_versions
Create Date: 2026-05-12 00:01:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260512_0001"
down_revision: Union[str, None] = "20260509_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create memory_histories table
    op.create_table(
        "memory_histories",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("memory_id", sa.String(length=32), nullable=False),
        sa.Column("parent_history_id", sa.String(length=32), nullable=True),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("scope", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("importance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("change_reason", sa.Text(), nullable=True),
        sa.Column("changed_by_action", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["memory_id"],
            ["memories.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["parent_history_id"],
            ["memory_histories.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_memory_histories_memory_id", "memory_histories", ["memory_id"])
    op.create_index("ix_memory_histories_parent_history_id", "memory_histories", ["parent_history_id"])
    op.create_index("ix_memory_histories_is_current", "memory_histories", ["is_current"])

    # Create memory_audit_logs table
    op.create_table(
        "memory_audit_logs",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("memory_id", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.String(length=32), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("action_type", sa.String(length=20), nullable=False),
        sa.Column("before_state", sa.Text(), nullable=True),
        sa.Column("after_state", sa.Text(), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("request_id", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["memory_id"],
            ["memories.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_memory_audit_logs_memory_id", "memory_audit_logs", ["memory_id"])
    op.create_index("ix_memory_audit_logs_user_id", "memory_audit_logs", ["user_id"])
    op.create_index("ix_memory_audit_logs_action", "memory_audit_logs", ["action"])
    op.create_index("ix_memory_audit_logs_created_at", "memory_audit_logs", ["created_at"])


def downgrade() -> None:
    # Drop memory_audit_logs table
    op.drop_index("ix_memory_audit_logs_created_at", table_name="memory_audit_logs")
    op.drop_index("ix_memory_audit_logs_action", table_name="memory_audit_logs")
    op.drop_index("ix_memory_audit_logs_user_id", table_name="memory_audit_logs")
    op.drop_index("ix_memory_audit_logs_memory_id", table_name="memory_audit_logs")
    op.drop_table("memory_audit_logs")

    # Drop memory_histories table
    op.drop_index("ix_memory_histories_is_current", table_name="memory_histories")
    op.drop_index("ix_memory_histories_parent_history_id", table_name="memory_histories")
    op.drop_index("ix_memory_histories_memory_id", table_name="memory_histories")
    op.drop_table("memory_histories")