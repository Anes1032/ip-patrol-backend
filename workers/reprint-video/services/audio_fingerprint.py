import subprocess
import os
import logging

logger = logging.getLogger(__name__)

SECONDS_PER_SAMPLE = 0.1238
SLIDING_WINDOW_STEP_COARSE = 8
SLIDING_WINDOW_STEP_FINE = 1
TOP_CANDIDATES_FOR_FINE_SEARCH = 10


def generate_audio_fingerprint(audio_path: str) -> bytes | None:
    if not audio_path or not os.path.exists(audio_path):
        return None

    cmd = ["fpcalc", "-raw", "-length", "0", audio_path]
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        logger.warning(f"fpcalc failed: {result.stderr}")
        return None

    for line in result.stdout.strip().split("\n"):
        if line.startswith("FINGERPRINT="):
            fp_str = line.replace("FINGERPRINT=", "")
            fp_ints = [int(x) for x in fp_str.split(",") if x]
            return b"".join((i & 0xFFFFFFFF).to_bytes(4, byteorder="little", signed=False) for i in fp_ints)

    return None


def _calculate_similarity_at_offset(query: list[int], base: list[int], offset: int) -> float:
    if offset < 0 or offset >= len(base):
        return 0.0

    compare_len = min(len(query), len(base) - offset)
    if compare_len <= 0:
        return 0.0

    matching_bits = 0
    total_bits = compare_len * 32

    for i in range(compare_len):
        xor = query[i] ^ base[offset + i]
        differing_bits = bin(xor & 0xFFFFFFFF).count("1")
        matching_bits += 32 - differing_bits

    return matching_bits / total_bits


def compare_audio_fingerprints(fp1: bytes, fp2: bytes) -> float:
    if not fp1 or not fp2:
        return 0.0

    query = [int.from_bytes(fp1[i:i+4], byteorder="little", signed=False) for i in range(0, len(fp1), 4)]
    base = [int.from_bytes(fp2[i:i+4], byteorder="little", signed=False) for i in range(0, len(fp2), 4)]

    if len(query) == 0 or len(base) == 0:
        return 0.0

    logger.info(f"Audio FP compare: query_len={len(query)}, base_len={len(base)}")
    logger.info(f"Query duration: {len(query) * SECONDS_PER_SAMPLE:.1f}s, Base duration: {len(base) * SECONDS_PER_SAMPLE:.1f}s")

    max_offset = len(base) - 1
    coarse_results = []

    for offset in range(0, max_offset + 1, SLIDING_WINDOW_STEP_COARSE):
        similarity = _calculate_similarity_at_offset(query, base, offset)
        coarse_results.append((offset, similarity))

    coarse_results.sort(key=lambda x: x[1], reverse=True)
    top_candidates = coarse_results[:TOP_CANDIDATES_FOR_FINE_SEARCH]
    logger.info(f"Coarse search top {TOP_CANDIDATES_FOR_FINE_SEARCH}: {[(o, f'{s:.3f}') for o, s in top_candidates]}")

    best_similarity = 0.0
    best_offset = 0

    for candidate_offset, _ in top_candidates:
        search_start = max(0, candidate_offset - SLIDING_WINDOW_STEP_COARSE)
        search_end = min(max_offset, candidate_offset + SLIDING_WINDOW_STEP_COARSE)

        for offset in range(search_start, search_end + 1, SLIDING_WINDOW_STEP_FINE):
            similarity = _calculate_similarity_at_offset(query, base, offset)
            if similarity > best_similarity:
                best_similarity = similarity
                best_offset = offset

    logger.info(f"Best match: offset={best_offset} ({best_offset * SECONDS_PER_SAMPLE:.1f}s), similarity={best_similarity:.3f}")

    return best_similarity
