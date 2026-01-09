import logging
from celery_app import app
from services.video import extract_frames, extract_audio
from services.image_fingerprint import generate_image_fingerprints
from services.audio_fingerprint import generate_audio_fingerprint, merge_chromaprint_fingerprints
from services.storage import download_video, cleanup_temp_files
from models.database import (
    save_chunk_frame_fingerprints,
    save_chunk_audio_fingerprint,
    complete_register_chunk,
    finalize_base_video,
    update_base_video_fps,
    get_all_audio_fingerprints,
    merge_audio_fingerprints,
    update_video_status,
)
from utils.redis_pubsub import publish_status, publish_video_status
from utils.gpu_monitor import log_gpu_memory

logger = logging.getLogger(__name__)


@app.task(bind=True)
def register_chunk(
    self,
    object_key: str,
    video_id: str,
    chunk_index: int,
    start_time: float,
    total_chunks: int,
) -> dict:
    task_id = self.request.id
    temp_video_path = None

    try:
        publish_status(task_id, {
            "type": "register_chunk_processing",
            "video_id": video_id,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "status": "processing",
        })

        temp_video_path = download_video(object_key)
        frames, duration, fps = extract_frames(temp_video_path)

        update_base_video_fps(video_id, fps)

        logger.info(f"Generating embeddings for {len(frames)} frames (chunk {chunk_index})")
        log_gpu_memory()

        frame_embeddings = generate_image_fingerprints(frames)
        save_chunk_frame_fingerprints(video_id, chunk_index, start_time, frame_embeddings, fps)

        log_gpu_memory()

        audio_path, audio_duration = extract_audio(temp_video_path)
        if audio_path:
            fp_data = generate_audio_fingerprint(audio_path)
            if fp_data:
                save_chunk_audio_fingerprint(video_id, chunk_index, start_time, fp_data, audio_duration)

        progress = complete_register_chunk(video_id, chunk_index, len(frames))

        result = {
            "type": "register_chunk_complete",
            "video_id": video_id,
            "chunk_index": chunk_index,
            "frame_count": len(frames),
            "completed_chunks": progress["completed_chunks"],
            "total_chunks": progress["total_chunks"],
            "status": "completed",
        }
        publish_status(task_id, result)

        if progress["completed_chunks"] == progress["total_chunks"]:
            finalize_register.delay(video_id)

        return result

    except Exception as e:
        logger.error(f"Register chunk {chunk_index} failed: {e}")
        error_result = {
            "type": "register_chunk_error",
            "video_id": video_id,
            "chunk_index": chunk_index,
            "message": str(e),
            "status": "failed",
        }
        publish_status(task_id, error_result)
        return error_result

    finally:
        cleanup_temp_files(temp_video_path)


@app.task(bind=True)
def finalize_register(self, video_id: str) -> dict:
    task_id = self.request.id

    try:
        logger.info(f"Finalizing registration for video {video_id}")

        audio_chunks = get_all_audio_fingerprints(video_id)
        if audio_chunks:
            merged_fp, total_duration = merge_chromaprint_fingerprints(audio_chunks)
            if merged_fp:
                merge_audio_fingerprints(video_id, merged_fp, total_duration)
                logger.info(f"Merged {len(audio_chunks)} audio chunks")

        stats = finalize_base_video(video_id)

        result = {
            "type": "register_complete",
            "video_id": video_id,
            "frame_count": stats["total_frames"],
            "duration": stats["duration"],
            "status": "completed",
        }
        publish_status(task_id, result)
        publish_video_status(video_id, result)
        return result

    except Exception as e:
        logger.error(f"Finalize registration failed for {video_id}: {e}")
        update_video_status(video_id, "failed")
        error_result = {
            "type": "register_error",
            "video_id": video_id,
            "message": str(e),
            "status": "failed",
        }
        publish_status(task_id, error_result)
        publish_video_status(video_id, error_result)
        return error_result
