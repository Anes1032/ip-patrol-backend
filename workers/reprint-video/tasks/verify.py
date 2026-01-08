import uuid
from celery_app import app
from services.video import extract_frames, extract_audio
from services.image_fingerprint import generate_image_fingerprints, compare_image_fingerprints
from services.audio_fingerprint import generate_audio_fingerprint, compare_audio_fingerprints
from services.storage import download_video, cleanup_temp_files
from models.database import (
    create_verification_result,
    update_verification_result,
    get_frame_fingerprints,
    get_audio_fingerprint,
)
from utils.redis_pubsub import publish_status


@app.task(bind=True)
def verify_video(
    self,
    object_key: str,
    filename: str,
    base_video_id: str,
    chunk_index: int = 0,
    chunk_start_time: float = 0.0,
    total_chunks: int = 1,
) -> dict:
    task_id = self.request.id
    result_id = str(uuid.uuid4())
    temp_video_path = None

    try:
        create_verification_result(result_id, base_video_id, filename)
        publish_status(task_id, {
            "type": "processing",
            "result_id": result_id,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "status": "processing",
        })

        temp_video_path = download_video(object_key)
        frames, _, fps = extract_frames(temp_video_path)
        query_embeddings = generate_image_fingerprints(frames)

        base_embeddings = get_frame_fingerprints(base_video_id)
        image_similarity, matched_frames = compare_image_fingerprints(query_embeddings, base_embeddings)

        audio_similarity = None
        audio_path, audio_duration = extract_audio(temp_video_path)
        if audio_path:
            query_fp = generate_audio_fingerprint(audio_path)
            base_fp = get_audio_fingerprint(base_video_id)
            if query_fp and base_fp:
                audio_similarity = compare_audio_fingerprints(query_fp, base_fp)

        update_verification_result(result_id, image_similarity, audio_similarity, matched_frames, "completed")

        result = {
            "type": "verify_complete",
            "result_id": result_id,
            "base_video_id": base_video_id,
            "chunk_index": chunk_index,
            "chunk_start_time": chunk_start_time,
            "total_chunks": total_chunks,
            "image_similarity": image_similarity,
            "audio_similarity": audio_similarity,
            "status": "completed",
        }
        publish_status(task_id, result)
        return result

    except Exception as e:
        update_verification_result(result_id, None, None, None, "failed")
        error_result = {
            "type": "error",
            "result_id": result_id,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "message": str(e),
            "status": "failed",
        }
        publish_status(task_id, error_result)
        return error_result

    finally:
        cleanup_temp_files(temp_video_path)
