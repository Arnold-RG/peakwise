"""Spectrum binning, peak statistics, and vector features."""

from __future__ import annotations

import math

import numpy as np

from backend.app.config import MZ_BIN_WIDTH, MZ_MAX


def normalize_peaks(peaks: list[tuple[float, float]]) -> list[tuple[float, float]]:
    cleaned = [(float(mz), float(intensity)) for mz, intensity in peaks if mz > 0 and intensity > 0]
    if not cleaned:
        return []
    max_i = max(intensity for _, intensity in cleaned)
    return sorted([(mz, intensity / max_i) for mz, intensity in cleaned], key=lambda x: x[0])


def spectral_entropy(peaks: list[tuple[float, float]]) -> float:
    intensities = np.array([i for _, i in peaks], dtype=float)
    total = intensities.sum()
    if total <= 0:
        return 0.0
    p = intensities / total
    p = p[p > 0]
    return float(-(p * np.log(p)).sum())


def bin_spectrum(peaks: list[tuple[float, float]], bin_width: float = MZ_BIN_WIDTH, mz_max: float = MZ_MAX) -> np.ndarray:
    n_bins = int(mz_max / bin_width)
    vector = np.zeros(n_bins, dtype=np.float32)
    for mz, intensity in peaks:
        if mz >= mz_max or mz < 0:
            continue
        idx = int(mz / bin_width)
        vector[idx] = max(vector[idx], intensity)
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    return vector


def peak_statistics(peaks: list[tuple[float, float]], precursor_mz: float | None = None) -> dict:
    if not peaks:
        return {
            "n_peaks": 0,
            "explained_by_precursor": 0.0,
            "mean_mz": 0.0,
            "max_mz": 0.0,
            "entropy": 0.0,
            "base_peak_mz": 0.0,
            "frac_above_half_precursor": 0.0,
        }
    mzs = np.array([p[0] for p in peaks])
    ints = np.array([p[1] for p in peaks])
    base = mzs[int(np.argmax(ints))]
    precursor = precursor_mz or float(mzs.max())
    return {
        "n_peaks": int(len(peaks)),
        "explained_by_precursor": float(ints[np.abs(mzs - precursor) < 0.05].sum()) if precursor else 0.0,
        "mean_mz": float(np.average(mzs, weights=ints)),
        "max_mz": float(mzs.max()),
        "entropy": spectral_entropy(peaks),
        "base_peak_mz": float(base),
        "frac_above_half_precursor": float(ints[mzs > precursor * 0.5].sum() / max(ints.sum(), 1e-9)),
    }


def feature_vector(
    peaks: list[tuple[float, float]],
    precursor_mz: float,
    collision_energy: float = 20.0,
    adduct_index: float = 0.0,
) -> np.ndarray:
    peaks = normalize_peaks(peaks)
    binned = bin_spectrum(peaks)
    stats = peak_statistics(peaks, precursor_mz)
    extra = np.array(
        [
            precursor_mz / MZ_MAX,
            collision_energy / 80.0,
            adduct_index / 6.0,
            stats["n_peaks"] / 80.0,
            stats["entropy"] / 4.0,
            stats["base_peak_mz"] / MZ_MAX,
            stats["frac_above_half_precursor"],
            stats["mean_mz"] / MZ_MAX,
        ],
        dtype=np.float32,
    )
    return np.concatenate([binned, extra])


def top_peaks(peaks: list[tuple[float, float]], k: int = 20) -> list[dict]:
    ranked = sorted(normalize_peaks(peaks), key=lambda x: -x[1])[:k]
    return [{"mz": round(mz, 4), "intensity": round(intensity, 4)} for mz, intensity in ranked]
