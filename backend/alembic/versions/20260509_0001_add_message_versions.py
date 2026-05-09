"""add message versions

Revision ID: 20260509_0001
Revises: 20260428_0006_add_memory_document_generation_status
Create Date: 2026-05-09 00:01:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260509_0001"
down_revision: Union[str, None] = "20260428_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add parent_message_id column for linking assistant messages to user messages
    op.add_column(
        "messages",
        sa.Column(
            "parent_message_id",
            sa.String(length=32),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_messages_parent_message_id",
        "messages",
        "messages",
        ["parent_message_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_messages_parent_message_id",
        "messages",
        ["parent_message_id"],
    )

    # Add version_number column for tracking message versions
    op.add_column(
        "messages",
        sa.Column(
            "version_number",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )

    # Add is_current column for marking the active version
    op.add_column(
        "messages",
        sa.Column(
            "is_current",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
    )
    op.create_index(
        "ix_messages_is_current",
        "messages",
        ["is_current"],
    )


def downgrade() -> None:
    op.drop_index("ix_messages_is_current", table_name="messages")
    op.drop_column("messages", "is_current")
    op.drop_column("messages", "version_number")
    op.drop_index("ix_messages_parent_message_id", table_name="messages")
    op.drop_constraint("fk_messages_parent_message_id", "messages", type_="foreignkey")
    op.drop_column("messages", "parent_message_id")