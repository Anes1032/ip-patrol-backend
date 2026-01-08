"""initial

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "base_videos",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("duration_seconds", sa.Float()),
        sa.Column("fps_extracted", sa.Float()),
        sa.Column("frame_count", sa.Integer()),
        sa.Column("status", sa.String(50), server_default="processing"),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.now()),
    )

    op.create_table(
        "frame_fingerprints",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("video_id", sa.UUID(), sa.ForeignKey("base_videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("frame_index", sa.Integer(), nullable=False),
        sa.Column("timestamp_seconds", sa.Float(), nullable=False),
        sa.Column("embedding", Vector(2048), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.now()),
    )

    op.create_table(
        "audio_fingerprints",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("video_id", sa.UUID(), sa.ForeignKey("base_videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fingerprint", sa.LargeBinary(), nullable=False),
        sa.Column("duration_seconds", sa.Float()),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.now()),
    )

    op.create_table(
        "verification_results",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("base_video_id", sa.UUID(), sa.ForeignKey("base_videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("query_filename", sa.String(255), nullable=False),
        sa.Column("image_similarity", sa.Float()),
        sa.Column("audio_similarity", sa.Float()),
        sa.Column("matched_frames", sa.JSON()),
        sa.Column("status", sa.String(50), server_default="processing"),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.func.now()),
    )

    op.create_index("idx_frame_fingerprints_video_id", "frame_fingerprints", ["video_id"])
    op.create_index("idx_audio_fingerprints_video_id", "audio_fingerprints", ["video_id"])
    op.create_index("idx_verification_results_base_video_id", "verification_results", ["base_video_id"])


def downgrade() -> None:
    op.drop_table("verification_results")
    op.drop_table("audio_fingerprints")
    op.drop_table("frame_fingerprints")
    op.drop_table("base_videos")
