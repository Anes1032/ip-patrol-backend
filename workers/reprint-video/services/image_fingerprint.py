import torch
import torch.nn as nn
from torchvision import models, transforms
from torchvision.models._api import WeightsEnum
from torch.hub import load_state_dict_from_url
from PIL import Image
import numpy as np


def _patched_load_state_dict(self, *args, **kwargs):
    kwargs["progress"] = False
    return load_state_dict_from_url(self.url, *args, **kwargs)


WeightsEnum.get_state_dict = _patched_load_state_dict


class ResNet50Extractor:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
        self.model = nn.Sequential(*list(self.model.children())[:-1])
        self.model.eval()
        self.model.to(self.device)

        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    def extract(self, images: list[Image.Image]) -> np.ndarray:
        if not images:
            return np.array([])

        batch = torch.stack([self.transform(img) for img in images])
        batch = batch.to(self.device)

        with torch.no_grad():
            features = self.model(batch)
            features = features.squeeze(-1).squeeze(-1)

        return features.cpu().numpy()


_extractor = None


def get_extractor() -> ResNet50Extractor:
    global _extractor
    if _extractor is None:
        _extractor = ResNet50Extractor()
    return _extractor


def generate_image_fingerprints(frames: list[Image.Image], batch_size: int = 32) -> list[dict]:
    if not frames:
        return []

    extractor = get_extractor()
    embeddings = []

    for i in range(0, len(frames), batch_size):
        batch = frames[i:i + batch_size]
        batch_embeddings = extractor.extract(batch)
        for j, emb in enumerate(batch_embeddings):
            embeddings.append({
                "frame_index": i + j,
                "embedding": emb.tolist(),
            })

    return embeddings


def compare_image_fingerprints(
    query_embeddings: list[dict],
    base_embeddings: list[dict],
) -> tuple[float, list[dict]]:
    if not query_embeddings or not base_embeddings:
        return 0.0, []

    query_matrix = np.array([e["embedding"] for e in query_embeddings])
    base_matrix = np.array([e["embedding"] for e in base_embeddings])

    query_norm = query_matrix / np.linalg.norm(query_matrix, axis=1, keepdims=True)
    base_norm = base_matrix / np.linalg.norm(base_matrix, axis=1, keepdims=True)

    similarities = np.dot(query_norm, base_norm.T)

    matched_frames = []
    total_similarity = 0.0

    for i, row in enumerate(similarities):
        best_match_idx = np.argmax(row)
        best_similarity = row[best_match_idx]
        total_similarity += best_similarity
        matched_frames.append({
            "query_frame": query_embeddings[i]["frame_index"],
            "base_frame": base_embeddings[best_match_idx]["frame_index"],
            "similarity": float(best_similarity),
        })

    avg_similarity = total_similarity / len(query_embeddings)
    return float(avg_similarity), matched_frames
