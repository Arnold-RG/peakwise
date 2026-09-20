"""Spectrum quality control flags used before identification."""

from __future__ import annotations

from backend.app.spectra.features import normalize_peaks, peak_statistics, spectral_entropy


def assess_spectrum(peaks: list[tuple[float, float]], precursor_mz: float | None = None) -> dict:
    peaks = normalize_peaks(peaks)
    stats = peak_statistics(peaks, precursor_mz)
    flags: list[str] = []
    if len(peaks) < 3:
        flags.append("too-few-peaks")
    if len(peaks) > 180:
        flags.append("very-dense-possibly-uncentroided")
    precursor = precursor_mz or (peaks[-1][0] if peaks else 0.0)
    has_precursor = any(abs(mz - precursor) < 0.05 for mz, _ in peaks) if precursor else False
    if precursor and not has_precursor:
        flags.append("precursor-ion-missing")
    entropy = spectral_entropy(peaks)
    if entropy < 0.4 and len(peaks) >= 3:
        flags.append("low-entropy-almost-one-peak")
    if entropy > 3.8:
        flags.append("high-entropy-noisy")
    if precursor and peaks and peaks[-1][0] > precursor * 1.05:
        flags.append("peaks-above-precursor")
    score = 1.0
    score -= 0.25 * ("too-few-peaks" in flags)
    score -= 0.12 * ("precursor-ion-missing" in flags)
    score -= 0.12 * ("high-entropy-noisy" in flags)
    score -= 0.08 * ("low-entropy-almost-one-peak" in flags)
    score -= 0.08 * ("very-dense-possibly-uncentroided" in flags)
    label = "excellent" if score >= 0.85 else "good" if score >= 0.7 else "fair" if score >= 0.5 else "poor"
    return {
        "score": round(max(score, 0.0), 3),
        "label": label,
        "flags": flags,
        "n_peaks": stats["n_peaks"],
        "entropy": round(stats["entropy"], 4),
        "has_precursor": has_precursor,
        "base_peak_mz": stats["base_peak_mz"],
    }
