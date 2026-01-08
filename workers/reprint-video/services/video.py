import subprocess
import tempfile
import os
from pathlib import Path
from PIL import Image
from config import EXTRACT_FPS


def extract_frames(video_path: str) -> tuple[list[Image.Image], float, float]:
    temp_dir = tempfile.mkdtemp()
    output_pattern = os.path.join(temp_dir, "frame_%06d.jpg")

    cmd = [
        "ffmpeg", "-i", video_path,
        "-vf", f"fps={EXTRACT_FPS}",
        "-q:v", "2",
        output_pattern,
        "-y"
    ]
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
