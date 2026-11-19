"""Approximate isotope pattern simulation (first 6 peaks)."""

from __future__ import annotations

from collections import defaultdict

from backend.app.chemistry.formula import parse_formula
from backend.app.chemistry.mass import ISOTOPE_ABUNDANCES, monoisotopic_mass


def isotope_pattern(formula: str, n_peaks: int = 6) -> list[dict]:
    counts = parse_formula(formula)
    mono = monoisotopic_mass(counts)
    distribution: dict[int, float] = {0: 1.0}
    for element, n in counts.items():
        isotopes = ISOTOPE_ABUNDANCES.get(element, [(0, 1.0)])
        for _ in range(n):
            nxt: dict[int, float] = defaultdict(float)
            for offset, abundance in distribution.items():
                for iso_offset, iso_ab in isotopes:
                    nxt[offset + iso_offset] += abundance * iso_ab
            distribution = nxt
    max_ab = max(distribution.values()) or 1.0
    peaks = []
    for offset in range(n_peaks):
        ab = distribution.get(offset, 0.0) / max_ab
        if ab < 0.001 and offset > 0:
            continue
        peaks.append({"mz": round(mono + offset * 1.00335, 5), "intensity": round(ab, 4), "offset": offset})
    return peaks
