"""MS/MS spectrum simulation from SMILES (MassSpecGym challenge 3)."""

from __future__ import annotations

from backend.app.chemistry.fragments import fragment_masses
from backend.app.chemistry.formula import formula_from_smiles, parse_formula
from backend.app.chemistry.mass import monoisotopic_mass, precursor_mz
from backend.app.config import DEFAULT_ADDUCT
from backend.app.spectra.features import normalize_peaks


def simulate_spectrum(
    smiles: str,
    adduct: str = DEFAULT_ADDUCT,
    collision_energy: float = 20.0,
    n_peaks: int = 40,
    noise: float = 0.0,
) -> dict:
    formula = formula_from_smiles(smiles)
    if not formula:
        raise ValueError("Could not parse SMILES")
    mass = monoisotopic_mass(parse_formula(formula))
    premz = precursor_mz(mass, adduct=adduct)
    fragments = fragment_masses(smiles, premz, collision_energy=collision_energy)
    if noise > 0:
        import random

        rng = random.Random(abs(hash(smiles)) % (2**32))
        extra = []
        for _ in range(int(6 * noise)):
            extra.append((premz * rng.uniform(0.2, 0.95), rng.uniform(0.02, 0.08) * noise, "noise"))
        fragments = fragments + extra
    peaks = normalize_peaks([(mz, intensity) for mz, intensity, _ in fragments])[:n_peaks]
    annotations = [{"mz": round(mz, 4), "intensity": round(intensity, 4), "label": label} for mz, intensity, label in fragments[:n_peaks]]
    return {
        "smiles": smiles,
        "formula": formula,
        "exact_mass": round(mass, 5),
        "precursor_mz": round(premz, 5),
        "adduct": adduct,
        "collision_energy": collision_energy,
        "peaks": [{"mz": round(mz, 4), "intensity": round(intensity, 4)} for mz, intensity in peaks],
        "annotations": annotations,
    }
