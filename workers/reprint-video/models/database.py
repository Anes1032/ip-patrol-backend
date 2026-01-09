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


def create_base_video_chunked(
    video_id: str, filename: str, object_key: str, total_chunks: int
) -> None:
    with SessionLocal() as session:
        session.execute(
            text("""
                INSERT INTO base_videos (id, filename, object_key, total_chunks, completed_chunks, status)
                VALUES (:id, :filename, :object_key, :total_chunks, 0, 'processing')
            """),
            {"id": video_id, "filename": filename, "object_key": object_key, "total_chunks": total_chunks},
        )
        session.commit()


def create_register_chunk(
    video_id: str, chunk_index: int, start_time: float, duration: float
) -> None:
    with SessionLocal() as session:
        session.execute(
            text("""
                INSERT INTO register_chunks (video_id, chunk_index, start_time, duration, status)
                VALUES (:video_id, :chunk_index, :start_time, :duration, 'pending')
            """),
            {"video_id": video_id, "chunk_index": chunk_index, "start_time": start_time, "duration": duration},
        )
        session.commit()


def save_chunk_frame_fingerprints(
    video_id: str, chunk_index: int, start_time: float, embeddings: list[dict], fps: float
) -> None:
    with SessionLocal() as session:
        for emb in embeddings:
            timestamp = start_time + (emb["frame_index"] / fps if fps > 0 else 0)
            global_frame_index = int(start_time * fps) + emb["frame_index"]
            session.execute(
                text("""
                    INSERT INTO frame_fingerprints (video_id, frame_index, timestamp_seconds, embedding, chunk_index)
                    VALUES (:video_id, :frame_index, :timestamp, :embedding, :chunk_index)
                """),
                {
                    "video_id": video_id,
                    "frame_index": global_frame_index,
                    "timestamp": timestamp,
                    "embedding": str(emb["embedding"]),
                    "chunk_index": chunk_index,
                },
            )
        session.commit()


def save_chunk_audio_fingerprint(
    video_id: str, chunk_index: int, start_time: float, fingerprint: bytes, duration: float | None
) -> None:
    with SessionLocal() as session:
        session.execute(
            text("""
                INSERT INTO audio_fingerprints (video_id, fingerprint, duration_seconds, chunk_index, start_time)
                VALUES (:video_id, :fingerprint, :duration, :chunk_index, :start_time)
            """),
            {
                "video_id": video_id,
                "fingerprint": fingerprint,
                "duration": duration,
                "chunk_index": chunk_index,
                "start_time": start_time,
            },
        )
        session.commit()


def complete_register_chunk(video_id: str, chunk_index: int, frame_count: int) -> dict:
    with SessionLocal() as session:
        session.execute(
            text("""
                UPDATE register_chunks
                SET status = 'completed', frame_count = :frame_count, completed_at = NOW()
                WHERE video_id = :video_id AND chunk_index = :chunk_index
            """),
            {"video_id": video_id, "chunk_index": chunk_index, "frame_count": frame_count},
        )

        session.execute(
            text("""
                UPDATE base_videos
                SET completed_chunks = completed_chunks + 1
                WHERE id = :video_id
            """),
            {"video_id": video_id},
        )
        session.commit()

        result = session.execute(
            text("SELECT total_chunks, completed_chunks FROM base_videos WHERE id = :video_id"),
            {"video_id": video_id},
        )
        row = result.fetchone()
        return {"total_chunks": row[0], "completed_chunks": row[1]}


def finalize_base_video(video_id: str) -> dict:
    with SessionLocal() as session:
        result = session.execute(
            text("""
                SELECT SUM(frame_count), SUM(duration)
                FROM register_chunks WHERE video_id = :video_id
            """),
            {"video_id": video_id},
        )
        row = result.fetchone()
        total_frames = row[0] or 0
        total_duration = row[1] or 0

        fps_result = session.execute(
            text("SELECT fps_extracted FROM base_videos WHERE id = :video_id"),
            {"video_id": video_id},
        )
        fps_row = fps_result.fetchone()
        fps = fps_row[0] if fps_row and fps_row[0] else 1.0

        session.execute(
            text("""
                UPDATE base_videos
                SET status = 'completed', duration_seconds = :duration, frame_count = :frame_count
                WHERE id = :video_id
            """),
            {"video_id": video_id, "duration": total_duration, "frame_count": total_frames},
        )
        session.commit()

        return {"total_frames": total_frames, "duration": total_duration, "fps": fps}


def update_base_video_fps(video_id: str, fps: float) -> None:
    with SessionLocal() as session:
        session.execute(
            text("UPDATE base_videos SET fps_extracted = :fps WHERE id = :video_id AND fps_extracted IS NULL"),
            {"video_id": video_id, "fps": fps},
        )
        session.commit()


def get_all_audio_fingerprints(video_id: str) -> list[dict]:
    with SessionLocal() as session:
        result = session.execute(
            text("""
                SELECT chunk_index, start_time, fingerprint, duration_seconds
                FROM audio_fingerprints
                WHERE video_id = :video_id
                ORDER BY start_time
            """),
            {"video_id": video_id},
        )
        rows = result.fetchall()
        return [
            {
                "chunk_index": row[0],
                "start_time": row[1],
                "fingerprint": bytes(row[2]),
                "duration": row[3],
            }
            for row in rows
        ]


def merge_audio_fingerprints(video_id: str, merged_fingerprint: bytes, total_duration: float) -> None:
    with SessionLocal() as session:
        session.execute(
            text("DELETE FROM audio_fingerprints WHERE video_id = :video_id"),
            {"video_id": video_id},
        )
        session.execute(
            text("""
                INSERT INTO audio_fingerprints (video_id, fingerprint, duration_seconds)
                VALUES (:video_id, :fingerprint, :duration)
            """),
            {"video_id": video_id, "fingerprint": merged_fingerprint, "duration": total_duration},
        )
        session.commit()


def create_verify_session(
    session_id: str, base_video_id: str, query_filename: str, total_chunks: int
) -> None:
    with SessionLocal() as session:
        session.execute(
            text("""
                INSERT INTO verify_sessions (id, base_video_id, query_filename, total_chunks, completed_chunks, status)
                VALUES (:id, :base_video_id, :query_filename, :total_chunks, 0, 'processing')
            """),
            {
                "id": session_id,
                "base_video_id": base_video_id,
                "query_filename": query_filename,
                "total_chunks": total_chunks,
            },
        )
        session.commit()


def create_verify_chunk(session_id: str, chunk_index: int, start_time: float) -> None:
    with SessionLocal() as session:
        session.execute(
            text("""
                INSERT INTO verify_chunks (session_id, chunk_index, start_time, status)
                VALUES (:session_id, :chunk_index, :start_time, 'pending')
            """),
            {"session_id": session_id, "chunk_index": chunk_index, "start_time": start_time},
        )
        session.commit()


def complete_verify_chunk(
    session_id: str,
    chunk_index: int,
    image_similarity: float | None,
    audio_similarity: float | None,
) -> dict:
    with SessionLocal() as session:
        session.execute(
            text("""
                UPDATE verify_chunks
                SET status = 'completed', image_similarity = :image_sim,
                    audio_similarity = :audio_sim, completed_at = NOW()
                WHERE session_id = :session_id AND chunk_index = :chunk_index
            """),
            {
                "session_id": session_id,
                "chunk_index": chunk_index,
                "image_sim": image_similarity,
                "audio_sim": audio_similarity,
            },
        )

        session.execute(
            text("""
                UPDATE verify_sessions
                SET completed_chunks = completed_chunks + 1
                WHERE id = :session_id
            """),
            {"session_id": session_id},
        )
        session.commit()

        result = session.execute(
            text("SELECT total_chunks, completed_chunks FROM verify_sessions WHERE id = :session_id"),
            {"session_id": session_id},
        )
        row = result.fetchone()
        return {"total_chunks": row[0], "completed_chunks": row[1]}


def finalize_verify_session(session_id: str) -> dict:
    with SessionLocal() as session:
        result = session.execute(
            text("""
                SELECT AVG(image_similarity), AVG(audio_similarity)
                FROM verify_chunks WHERE session_id = :session_id
            """),
            {"session_id": session_id},
        )
        row = result.fetchone()
        avg_image_sim = row[0]
        avg_audio_sim = row[1]

        session.execute(
            text("UPDATE verify_sessions SET status = 'completed' WHERE id = :session_id"),
            {"session_id": session_id},
        )
        session.commit()

        return {"avg_image_similarity": avg_image_sim, "avg_audio_similarity": avg_audio_sim}


def get_base_video_status(video_id: str) -> dict | None:
    with SessionLocal() as session:
        result = session.execute(
            text("SELECT status, completed_chunks, total_chunks FROM base_videos WHERE id = :video_id"),
            {"video_id": video_id},
        )
        row = result.fetchone()
        if not row:
            return None
        return {"status": row[0], "completed_chunks": row[1] or 0, "total_chunks": row[2] or 1}
