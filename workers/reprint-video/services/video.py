import subprocess
import tempfile
import os
import logging
from pathlib import Path
from PIL import Image
import torch
import numpy as np
from config import EXTRACT_FPS

logger = logging.getLogger(__name__)


def _check_gpu_available() -> bool:
    try:
        return torch.cuda.is_available()
    except ImportError:
        return False


def extract_frames(video_path: str) -> tuple[list[Image.Image], float, float]:
    """
    Extract frames using TorchCodec with GPU acceleration.
    Falls back to ffmpeg if TorchCodec fails.
    """
    try:
        from torchcodec.decoders import VideoDecoder, set_cuda_backend

        # Use GPU if available, otherwise CPU
        device = "cuda" if _check_gpu_available() else "cpu"
        logger.info(f"Extracting frames with TorchCodec (device: {device})")

        # Use Beta CUDA backend for faster GPU decoding
        if device == "cuda":
            set_cuda_backend("beta")
            logger.info("Using Beta CUDA backend for TorchCodec")

        decoder = VideoDecoder(video_path, device=device)

        # Get video metadata (TorchCodec 0.9+ API)
        metadata = decoder.metadata
        video_fps = metadata.average_fps
        num_frames = metadata.num_frames
        duration = metadata.duration_seconds

        logger.info(f"Video metadata - fps: {video_fps:.2f}, frames: {num_frames}, duration: {duration:.2f}s")

        # Calculate frame indices to extract based on EXTRACT_FPS
        frame_interval = int(video_fps / EXTRACT_FPS)
        indices = list(range(0, num_frames, frame_interval))

        logger.info(f"Extracting {len(indices)} frames at interval {frame_interval}")

        # Extract frames using get_frames_at (GPU-accelerated batch extraction)
        frame_batch = decoder.get_frames_at(indices=indices)

        # Convert FrameBatch to PIL Images
        frames = []
        # frame_batch.data is tensor of shape [N, C, H, W]
        for i in range(frame_batch.data.shape[0]):
            # Move to CPU and convert to numpy [H, W, C] format
            frame_np = frame_batch.data[i].cpu().permute(1, 2, 0).numpy()
            pil_image = Image.fromarray(frame_np.astype('uint8'), mode='RGB')
            frames.append(pil_image)

        logger.info(f"Extracted {len(frames)} frames from video (duration: {duration:.2f}s, fps: {video_fps:.2f})")

        return frames, duration, EXTRACT_FPS

    except Exception as e:
        logger.warning(f"TorchCodec failed: {e}, falling back to ffmpeg")
        return _extract_frames_ffmpeg(video_path)


def _extract_frames_ffmpeg(video_path: str) -> tuple[list[Image.Image], float, float]:
    """
    Fallback method using ffmpeg for frame extraction.
    Used when torchvision.io.VideoReader is not available or fails.
    """
    temp_dir = tempfile.mkdtemp()
    output_pattern = os.path.join(temp_dir, "frame_%06d.jpg")

    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"fps={EXTRACT_FPS}",
        "-q:v", "2",
        "-threads", "1",
        output_pattern,
        "-y"
    ]

    logger.info(f"Extracting frames with ffmpeg (CPU mode, threads=1)")
    subprocess.run(cmd, capture_output=True, check=True)

    duration = get_video_duration(video_path)

    frame_files = sorted(Path(temp_dir).glob("frame_*.jpg"))
    frames = [Image.open(f).convert("RGB") for f in frame_files]

    for f in frame_files:
        f.unlink()
    Path(temp_dir).rmdir()

    return frames, duration, EXTRACT_FPS


def extract_audio(video_path: str) -> tuple[str | None, float | None]:
    temp_audio = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    temp_audio.close()

    cmd = [
        "ffmpeg", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le",
        "-ar", "44100", "-ac", "1",
        temp_audio.name,
        "-y"
    ]
    result = subprocess.run(cmd, capture_output=True)

    if result.returncode != 0:
        if os.path.exists(temp_audio.name):
            os.unlink(temp_audio.name)
        return None, None

    duration = get_audio_duration(temp_audio.name)
    return temp_audio.name, duration


def get_video_duration(video_path: str) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return float(result.stdout.strip()) if result.stdout.strip() else 0.0


def get_audio_duration(audio_path: str) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        audio_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return float(result.stdout.strip()) if result.stdout.strip() else 0.0
