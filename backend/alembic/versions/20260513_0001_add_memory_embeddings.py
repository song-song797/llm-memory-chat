"""add memory embeddings

Revision ID: 20260513_0001
Revises: 20260512_0001_add_memory_history_and_audit
Create Date: 2026-05-13 00:01:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260513_0001"
down_revision: Union[str, None] = "20260512_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create memory_embeddings table first (without pgvector dependency)
    op.create_table(
        "memory_embeddings",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("memory_id", sa.String(length=32), nullable=False),
        sa.Column("embedding", sa.Text(), nullable=True),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["memory_id"],
            ["memories.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_memory_embeddings_memory_id", "memory_embeddings", ["memory_id"])


def downgrade() -> None:
    # Drop memory_embeddings table
    op.drop_index("ix_memory_embeddings_memory_id", table_name="memory_embeddings")
    op.drop_table("memory_embeddings")