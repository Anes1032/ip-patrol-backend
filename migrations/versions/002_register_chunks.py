"""register chunks support

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("base_videos", sa.Column("total_chunks", sa.Integer()))
    op.add_column("base_videos", sa.Column("completed_chunks", sa.Integer(), server_default="0"))
    op.add_column("base_videos", sa.Column("object_key", sa.String(512)))

    op.create_table(
        "register_chunks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("video_id", sa.UUID(), sa.ForeignKey("base_videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Float(), nullable=False),
        sa.Column("duration", sa.Float(), nullable=False),
        sa.Column("frame_count", sa.Integer()),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.Column("completed_at", sa.TIMESTAMP()),
    )

    op.create_index("idx_register_chunks_video_id", "register_chunks", ["video_id"])
    op.create_index("idx_register_chunks_video_chunk", "register_chunks", ["video_id", "chunk_index"], unique=True)

    op.add_column("frame_fingerprints", sa.Column("chunk_index", sa.Integer()))
    op.add_column("audio_fingerprints", sa.Column("chunk_index", sa.Integer()))
    op.add_column("audio_fingerprints", sa.Column("start_time", sa.Float()))


def downgrade() -> None:
    op.drop_column("audio_fingerprints", "start_time")
    op.drop_column("audio_fingerprints", "chunk_index")
    op.drop_column("frame_fingerprints", "chunk_index")
    op.drop_index("idx_register_chunks_video_chunk")
    op.drop_index("idx_register_chunks_video_id")
    op.drop_table("register_chunks")
    op.drop_column("base_videos", "object_key")
    op.drop_column("base_videos", "completed_chunks")
    op.drop_column("base_videos", "total_chunks")
