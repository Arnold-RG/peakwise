"""Adduct suggestion from precursor m/z and an optional formula."""

from __future__ import annotations

from backend.app.chemistry.formula import parse_formula
from backend.app.chemistry.mass import ADDUCT_MASSES, monoisotopic_mass, ppm_error, precursor_mz


def suggest_adducts(precursor_mz_value: float, formula: str | None = None, ppm: float = 12.0) -> list[dict]:
    if not formula:
        return [
            {"adduct": adduct, "theoretical_mz": None, "ppm": None}
            for adduct in ("[M+H]+", "[M+Na]+", "[M+NH4]+", "[M+H-H2O]+", "[M-H]-")
        ]
    mass = monoisotopic_mass(parse_formula(formula))
    hits = []
    for adduct in ADDUCT_MASSES:
        theory = precursor_mz(mass, adduct=adduct)
        err = ppm_error(precursor_mz_value, theory)
        if abs(err) <= ppm:
            hits.append({"adduct": adduct, "theoretical_mz": round(theory, 5), "ppm": round(err, 2)})
    hits.sort(key=lambda item: abs(item["ppm"]))
    return hits
