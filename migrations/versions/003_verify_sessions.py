"""verify sessions support

Revision ID: 003
Revises: 002
Create Date: 2024-01-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "verify_sessions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("base_video_id", sa.UUID(), sa.ForeignKey("base_videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("query_filename", sa.String(255), nullable=False),
        sa.Column("total_chunks", sa.Integer(), nullable=False),
        sa.Column("completed_chunks", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(50), server_default="processing"),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.now()),
    )

    op.create_table(
        "verify_chunks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.UUID(), sa.ForeignKey("verify_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Float(), nullable=False),
        sa.Column("image_similarity", sa.Float()),
        sa.Column("audio_similarity", sa.Float()),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.Column("completed_at", sa.TIMESTAMP()),
    )

    op.create_index("idx_verify_sessions_base_video_id", "verify_sessions", ["base_video_id"])
    op.create_index("idx_verify_chunks_session_id", "verify_chunks", ["session_id"])
    op.create_index("idx_verify_chunks_session_chunk", "verify_chunks", ["session_id", "chunk_index"], unique=True)


def downgrade() -> None:
    op.drop_index("idx_verify_chunks_session_chunk")
    op.drop_index("idx_verify_chunks_session_id")
    op.drop_index("idx_verify_sessions_base_video_id")
    op.drop_table("verify_chunks")
    op.drop_table("verify_sessions")
