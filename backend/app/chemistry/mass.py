"""Exact masses, adducts, and monoisotopic calculations."""

from __future__ import annotations

from backend.app.config import ADDUCT_MASSES, DEFAULT_ADDUCT

# IUPAC monoisotopic masses (most abundant isotope)
ATOMIC_MASSES: dict[str, float] = {
    "H": 1.00782503224,
    "C": 12.0,
    "N": 14.00307400443,
    "O": 15.99491461957,
    "F": 18.99840316273,
    "Na": 22.9897692820,
    "Si": 27.97692653465,
    "P": 30.97376199842,
    "S": 31.9720711744,
    "Cl": 34.968852682,
    "K": 38.9637064864,
    "Br": 78.9183376,
    "I": 126.9044719,
}

ISOTOPE_ABUNDANCES: dict[str, list[tuple[int, float]]] = {
    "H": [(0, 0.999885), (1, 0.000115)],
    "C": [(0, 0.9893), (1, 0.0107)],
    "N": [(0, 0.99636), (1, 0.00364)],
    "O": [(0, 0.99757), (1, 0.00038), (2, 0.00205)],
    "S": [(0, 0.9499), (1, 0.0075), (2, 0.0425)],
    "Cl": [(0, 0.7576), (2, 0.2424)],
    "Br": [(0, 0.5069), (2, 0.4931)],
    "P": [(0, 1.0)],
    "F": [(0, 1.0)],
    "I": [(0, 1.0)],
    "Na": [(0, 1.0)],
    "K": [(0, 0.932581), (1, 0.000117), (2, 0.067302)],
}


def monoisotopic_mass(counts: dict[str, int]) -> float:
    mass = 0.0
    for element, n in counts.items():
        if n and element not in ATOMIC_MASSES:
            raise ValueError(f"Unsupported element: {element}")
        mass += ATOMIC_MASSES.get(element, 0.0) * n
    return mass


def precursor_mz(neutral_mass: float, adduct: str = DEFAULT_ADDUCT, charge: int = 1) -> float:
    adduct_mass = ADDUCT_MASSES.get(adduct)
    if adduct_mass is None:
        raise ValueError(f"Unknown adduct: {adduct}")
    z = max(abs(charge), 1)
    if adduct == "[M+2H]2+":
        return (neutral_mass + 2 * ADDUCT_MASSES["[M+H]+"]) / 2.0
    return (neutral_mass + adduct_mass) / z


def neutral_mass_from_precursor(precursor: float, adduct: str = DEFAULT_ADDUCT, charge: int = 1) -> float:
    adduct_mass = ADDUCT_MASSES.get(adduct)
    if adduct_mass is None:
        raise ValueError(f"Unknown adduct: {adduct}")
    z = max(abs(charge), 1)
    if adduct == "[M+2H]2+":
        return precursor * 2.0 - 2 * ADDUCT_MASSES["[M+H]+"]
    return precursor * z - adduct_mass


def ppm_error(observed: float, theoretical: float) -> float:
    if theoretical == 0:
        return float("inf")
    return (observed - theoretical) / theoretical * 1e6
