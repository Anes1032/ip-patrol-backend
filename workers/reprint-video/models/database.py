import json
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool
from sqlalchemy.orm import sessionmaker
from pgvector.sqlalchemy import Vector
from config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(bind=engine)


def create_base_video(video_id: str, filename: str) -> None:
    with SessionLocal() as session:
        session.execute(
            text("INSERT INTO base_videos (id, filename, status) VALUES (:id, :filename, 'processing')"),
            {"id": video_id, "filename": filename},
        )
        session.commit()


def update_video_status(
    video_id: str,
    status: str,
    duration: float | None = None,
    fps: float | None = None,
    frame_count: int | None = None,
) -> None:
    with SessionLocal() as session:
        session.execute(
            text("""
                UPDATE base_videos
                SET status = :status, duration_seconds = :duration, fps_extracted = :fps, frame_count = :frame_count
                WHERE id = :id
            """),
            {"id": video_id, "status": status, "duration": duration, "fps": fps, "frame_count": frame_count},
        )
        session.commit()


def save_frame_fingerprints(video_id: str, embeddings: list[dict], fps: float) -> None:
    with SessionLocal() as session:
        for emb in embeddings:
            timestamp = emb["frame_index"] / fps if fps > 0 else 0
            session.execute(
                text("""
                    INSERT INTO frame_fingerprints (video_id, frame_index, timestamp_seconds, embedding)
                    VALUES (:video_id, :frame_index, :timestamp, :embedding)
                """),
                {
                    "video_id": video_id,
                    "frame_index": emb["frame_index"],
                    "timestamp": timestamp,
                    "embedding": str(emb["embedding"]),
                },
            )
        session.commit()


def save_audio_fingerprint(video_id: str, fingerprint: bytes, duration: float | None) -> None:
    with SessionLocal() as session:
        session.execute(
            text("""
                INSERT INTO audio_fingerprints (video_id, fingerprint, duration_seconds)
                VALUES (:video_id, :fingerprint, :duration)
            """),
            {"video_id": video_id, "fingerprint": fingerprint, "duration": duration},
        )
        session.commit()


def get_frame_fingerprints(video_id: str) -> list[dict]:
    with SessionLocal() as session:
        result = session.execute(
            text("SELECT frame_index, embedding FROM frame_fingerprints WHERE video_id = :video_id ORDER BY frame_index"),
            {"video_id": video_id},
        )
        rows = result.fetchall()
        return [{"frame_index": row[0], "embedding": _parse_vector(row[1])} for row in rows]


def get_audio_fingerprint(video_id: str) -> bytes | None:
    with SessionLocal() as session:
        result = session.execute(
            text("SELECT fingerprint FROM audio_fingerprints WHERE video_id = :video_id LIMIT 1"),
            {"video_id": video_id},
        )
        row = result.fetchone()
        return bytes(row[0]) if row else None


def create_verification_result(result_id: str, base_video_id: str, filename: str) -> None:
    with SessionLocal() as session:
        session.execute(
            text("""
                INSERT INTO verification_results (id, base_video_id, query_filename, status)
                VALUES (:id, :base_video_id, :filename, 'processing')
            """),
            {"id": result_id, "base_video_id": base_video_id, "filename": filename},
        )
        session.commit()


def update_verification_result(
    result_id: str,
    image_similarity: float | None,
    audio_similarity: float | None,
    matched_frames: list[dict] | None,
    status: str,
) -> None:
    with SessionLocal() as session:
        session.execute(
            text("""
                UPDATE verification_results
                SET image_similarity = :image_sim, audio_similarity = :audio_sim,
                    matched_frames = :matched, status = :status
                WHERE id = :id
            """),
            {
                "id": result_id,
                "image_sim": image_similarity,
                "audio_sim": audio_similarity,
                "matched": json.dumps(matched_frames) if matched_frames else None,
                "status": status,
            },
        )
        session.commit()


def _parse_vector(value) -> list[float]:
    if isinstance(value, str):
        value = value.strip("[]")
        return [float(x) for x in value.split(",")]
    if isinstance(value, (list, tuple)):
        return list(value)
    return list(value)
