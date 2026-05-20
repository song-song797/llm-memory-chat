"""create api_debug_history table

Revision ID: 20260520_0001
Revises: 20260513_0001_add_memory_embeddings
Create Date: 2026-05-20

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260520_0001"
down_revision: str | None = "20260513_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "api_debug_history",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("messages", sa.Text, nullable=False),
        sa.Column("max_tokens", sa.Integer, nullable=False, server_default="1024"),
        sa.Column("stream", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("include_usage", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("thinking_enabled", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("reasoning_level", sa.String(20), nullable=True),
        sa.Column("response_status", sa.Integer, nullable=False, server_default="0"),
        sa.Column("response_time_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("prompt_tokens", sa.Integer, nullable=True),
        sa.Column("completion_tokens", sa.Integer, nullable=True),
        sa.Column("total_tokens", sa.Integer, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade():
    op.drop_table("api_debug_history")