"""Cosine and modified-cosine spectral similarity."""

from __future__ import annotations

import numpy as np

from backend.app.spectra.features import bin_spectrum, normalize_peaks


def cosine_similarity(a: list[tuple[float, float]], b: list[tuple[float, float]]) -> float:
    va = bin_spectrum(normalize_peaks(a))
    vb = bin_spectrum(normalize_peaks(b))
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


def peak_match_cosine(
    a: list[tuple[float, float]],
    b: list[tuple[float, float]],
    tolerance: float = 0.2,
) -> float:
    """Greedy peak matching cosine (MatchMS-style, simplified)."""
    a_p = normalize_peaks(a)
    b_p = list(normalize_peaks(b))
    used = set()
    dot = 0.0
    for mz_a, ia in a_p:
        best_j = None
        best_diff = tolerance + 1
        for j, (mz_b, ib) in enumerate(b_p):
            if j in used:
                continue
            diff = abs(mz_a - mz_b)
            if diff <= tolerance and diff < best_diff:
                best_diff = diff
                best_j = j
        if best_j is not None:
            used.add(best_j)
            dot += ia * b_p[best_j][1]
    na = math_norm(a_p)
    nb = math_norm(b_p)
    if na * nb == 0:
        return 0.0
    return float(dot / (na * nb))


def math_norm(peaks: list[tuple[float, float]]) -> float:
    return float(sum(i * i for _, i in peaks) ** 0.5)


def modified_cosine(
    a: list[tuple[float, float]],
    b: list[tuple[float, float]],
    precursor_a: float,
    precursor_b: float,
    tolerance: float = 0.2,
) -> float:
    """Allow matches shifted by precursor mass difference (GNPS analog score)."""
    shift = precursor_a - precursor_b
    shifted_b = [(mz + shift, intensity) for mz, intensity in b]
    direct = peak_match_cosine(a, b, tolerance=tolerance)
    analog = peak_match_cosine(a, shifted_b, tolerance=tolerance)
    return max(direct, analog)
