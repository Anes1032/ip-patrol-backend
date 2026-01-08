import uuid
from celery_app import app
from services.video import extract_frames, extract_audio
from services.image_fingerprint import generate_image_fingerprints
from services.audio_fingerprint import generate_audio_fingerprint
from services.storage import download_video, cleanup_temp_files
from models.database import (
    create_base_video,
    update_video_status,
    save_frame_fingerprints,
    save_audio_fingerprint,
)
from utils.redis_pubsub import publish_status


@app.task(bind=True)
def register_video(self, object_key: str, filename: str) -> dict:
    task_id = self.request.id
    video_id = str(uuid.uuid4())
    temp_video_path = None
    temp_dir = None

    try:
        create_base_video(video_id, filename)
        publish_status(task_id, {"type": "processing", "video_id": video_id, "status": "processing"})

        temp_video_path = download_video(object_key)
        frames, duration, fps = extract_frames(temp_video_path)

        frame_embeddings = generate_image_fingerprints(frames)
        save_frame_fingerprints(video_id, frame_embeddings, fps)

        audio_fingerprint, audio_duration = extract_audio(temp_video_path)
        if audio_fingerprint:
            fp_data = generate_audio_fingerprint(audio_fingerprint)
            if fp_data:
                save_audio_fingerprint(video_id, fp_data, audio_duration)

        update_video_status(video_id, "completed", duration, fps, len(frames))

        result = {
            "type": "register_complete",
            "video_id": video_id,
            "frame_count": len(frames),
            "status": "completed",
        }
        publish_status(task_id, result)
        return result

    except Exception as e:
        update_video_status(video_id, "failed")
        error_result = {"type": "error", "video_id": video_id, "message": str(e), "status": "failed"}
        publish_status(task_id, error_result)
        return error_result

    finally:
        cleanup_temp_files(temp_video_path)
