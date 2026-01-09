import torch
import logging

logger = logging.getLogger(__name__)


def log_gpu_memory():
    if not torch.cuda.is_available():
        return

    allocated = torch.cuda.memory_allocated() / 1024**3
    reserved = torch.cuda.memory_reserved() / 1024**3
    max_allocated = torch.cuda.max_memory_allocated() / 1024**3

    logger.info(
        f"GPU Memory - Allocated: {allocated:.2f}GB, "
        f"Reserved: {reserved:.2f}GB, "
        f"Peak: {max_allocated:.2f}GB"
    )


def get_gpu_info() -> dict:
    if not torch.cuda.is_available():
        return {"available": False}

    return {
        "available": True,
        "device_name": torch.cuda.get_device_name(0),
        "device_count": torch.cuda.device_count(),
        "memory_total": torch.cuda.get_device_properties(0).total_memory / 1024**3,
        "memory_allocated": torch.cuda.memory_allocated() / 1024**3,
        "memory_reserved": torch.cuda.memory_reserved() / 1024**3,
        "compute_capability": f"{torch.cuda.get_device_capability()[0]}.{torch.cuda.get_device_capability()[1]}",
    }
