import logging
from celery_app import app
from services.video import extract_frames, extract_audio
from services.image_fingerprint import generate_image_fingerprints, compare_image_fingerprints
from services.audio_fingerprint import generate_audio_fingerprint, compare_audio_fingerprints
from services.storage import download_video, cleanup_temp_files
from models.database import (
    get_frame_fingerprints,
    get_audio_fingerprint,
    complete_verify_chunk,
    finalize_verify_session,
    get_base_video_status,
)
from utils.redis_pubsub import publish_status, publish_video_status
from utils.gpu_monitor import log_gpu_memory

logger = logging.getLogger(__name__)


@app.task(bind=True)
def verify_video(
    self,
    object_key: str,
    session_id: str,
    base_video_id: str,
    chunk_index: int,
    chunk_start_time: float,
    total_chunks: int,
) -> dict:
    task_id = self.request.id
    temp_video_path = None

    try:
        publish_status(task_id, {
            "type": "verify_chunk_processing",
            "session_id": session_id,
            "base_video_id": base_video_id,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "status": "processing",
        })

        base_status = get_base_video_status(base_video_id)
        if not base_status or base_status["status"] != "completed":
            logger.warning(f"Base video {base_video_id} not ready, status: {base_status}")

        temp_video_path = download_video(object_key)
        frames, _, fps = extract_frames(temp_video_path)

        logger.info(f"Generating query embeddings for {len(frames)} frames (chunk {chunk_index})")
        log_gpu_memory()

        query_embeddings = generate_image_fingerprints(frames)

        log_gpu_memory()

        base_embeddings = get_frame_fingerprints(base_video_id)
        image_similarity, matched_frames = compare_image_fingerprints(query_embeddings, base_embeddings)

        audio_similarity = None
        audio_path, audio_duration = extract_audio(temp_video_path)
        if audio_path:
            query_fp = generate_audio_fingerprint(audio_path)
            base_fp = get_audio_fingerprint(base_video_id)
            if query_fp and base_fp:
                audio_similarity = compare_audio_fingerprints(query_fp, base_fp)

        progress = complete_verify_chunk(session_id, chunk_index, image_similarity, audio_similarity)

        result = {
            "type": "verify_chunk_complete",
            "session_id": session_id,
            "base_video_id": base_video_id,
            "chunk_index": chunk_index,
            "chunk_start_time": chunk_start_time,
            "total_chunks": total_chunks,
            "completed_chunks": progress["completed_chunks"],
            "image_similarity": image_similarity,
            "audio_similarity": audio_similarity,
            "status": "completed",
        }
        publish_status(task_id, result)
        publish_video_status(base_video_id, result)

        if progress["completed_chunks"] == progress["total_chunks"]:
            finalize_verify.delay(session_id, base_video_id)

        return result

    except Exception as e:
        logger.error(f"Verify chunk {chunk_index} failed: {e}")
        error_result = {
            "type": "verify_chunk_error",
            "session_id": session_id,
            "base_video_id": base_video_id,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "message": str(e),
            "status": "failed",
        }
        publish_status(task_id, error_result)
        publish_video_status(base_video_id, error_result)
        return error_result

    finally:
        cleanup_temp_files(temp_video_path)


@app.task(bind=True)
def finalize_verify(self, session_id: str, base_video_id: str) -> dict:
    task_id = self.request.id

    try:
        logger.info(f"Finalizing verification session {session_id}")

        stats = finalize_verify_session(session_id)

        result = {
            "type": "verify_complete",
            "session_id": session_id,
            "base_video_id": base_video_id,
            "avg_image_similarity": stats["avg_image_similarity"],
            "avg_audio_similarity": stats["avg_audio_similarity"],
            "status": "completed",
        }
        publish_status(task_id, result)
        publish_video_status(base_video_id, result)
        return result

    except Exception as e:
        logger.error(f"Finalize verification failed for session {session_id}: {e}")
        error_result = {
            "type": "verify_error",
            "session_id": session_id,
            "base_video_id": base_video_id,
            "message": str(e),
            "status": "failed",
        }
        publish_status(task_id, error_result)
        publish_video_status(base_video_id, error_result)
        return error_result
