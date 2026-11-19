"""Molecular formula parsing, enumeration, and ranking from exact mass."""

from __future__ import annotations

import re
from dataclasses import dataclass

from backend.app.chemistry.mass import monoisotopic_mass, ppm_error

FORMULA_TOKEN = re.compile(r"([A-Z][a-z]?)(\d*)")
CHARGE_TAIL = re.compile(r"[+\-±⁺⁻]+\d*$")


def neutralize_formula(formula: str) -> str:
    """Drop charge marks RDKit adds (C7H16NO2+, [C7H16NO2]+, C6H5O-)."""
    text = (formula or "").replace(" ", "").replace("[", "").replace("]", "")
    return CHARGE_TAIL.sub("", text)


def parse_formula(formula: str) -> dict[str, int]:
    formula = neutralize_formula(formula)
    if not formula:
        return {}
    counts: dict[str, int] = {}
    idx = 0
    while idx < len(formula):
        match = FORMULA_TOKEN.match(formula, idx)
        if not match:
            raise ValueError(f"Invalid formula near '{formula[idx:]}'")
        element, number = match.groups()
        counts[element] = counts.get(element, 0) + (int(number) if number else 1)
        idx = match.end()
    return counts


def formula_from_counts(counts: dict[str, int]) -> str:
    order = ["C", "H", "N", "O", "P", "S", "F", "Cl", "Br", "I", "Na", "K"]
    parts: list[str] = []
    for element in order:
        n = counts.get(element, 0)
        if n == 1:
            parts.append(element)
        elif n > 1:
            parts.append(f"{element}{n}")
    for element, n in sorted(counts.items()):
        if element not in order and n:
            parts.append(element if n == 1 else f"{element}{n}")
    return "".join(parts)


def double_bond_equivalents(counts: dict[str, int]) -> float:
    c = counts.get("C", 0)
    h = counts.get("H", 0)
    n = counts.get("N", 0)
    x = counts.get("F", 0) + counts.get("Cl", 0) + counts.get("Br", 0) + counts.get("I", 0)
    p = counts.get("P", 0)
    return c - (h + x) / 2 + (n + p) / 2 + 1


def seven_golden_rules(counts: dict[str, int]) -> bool:
    c = counts.get("C", 0)
    h = counts.get("H", 0)
    n = counts.get("N", 0)
    o = counts.get("O", 0)
    p = counts.get("P", 0)
    s = counts.get("S", 0)
    if c <= 0:
        return False
    if not (0.2 <= h / max(c, 1) <= 3.2):
        return False
    if n / max(c, 1) > 1.3 or o / max(c, 1) > 1.2:
        return False
    if p / max(c, 1) > 0.3 or s / max(c, 1) > 0.8:
        return False
    dbe = double_bond_equivalents(counts)
    if dbe < -0.5 or dbe > 40:
        return False
    return True


@dataclass
class FormulaCandidate:
    formula: str
    counts: dict[str, int]
    mass: float
    ppm: float
    dbe: float
    score: float


def enumerate_formulas(
    exact_mass: float,
    ppm: float = 8.0,
    max_c: int = 40,
    max_n: int = 8,
    max_o: int = 12,
    max_p: int = 2,
    max_s: int = 3,
    max_f: int = 0,
    max_cl: int = 0,
    limit: int = 25,
) -> list[FormulaCandidate]:
    """Enumerate CHNOPS(+F/Cl) formulae within a ppm window of an exact mass."""
    candidates: list[FormulaCandidate] = []
    min_c = max(1, int((exact_mass - 40) / 14))
    c_hi = min(max_c, int(exact_mass / 12) + 1)
    for c in range(max(1, min_c - 2), c_hi + 1):
        for n in range(0, min(max_n, c + 2) + 1):
            for o in range(0, min(max_o, c + 4) + 1):
                for p in range(0, max_p + 1):
                    for s in range(0, max_s + 1):
                        for f in range(0, max_f + 1):
                            for cl in range(0, max_cl + 1):
                                core = {
                                    "C": c,
                                    "N": n,
                                    "O": o,
                                    "P": p,
                                    "S": s,
                                    "F": f,
                                    "Cl": cl,
                                }
                                core_mass = monoisotopic_mass(core)
                                remaining = exact_mass - core_mass
                                if remaining < 0.2 or remaining > 80:
                                    continue
                                h = int(round(remaining / 1.007825))
                                if h < 0 or h > c * 3 + n + 4:
                                    continue
                                counts = {**core, "H": h}
                                if not seven_golden_rules(counts):
                                    continue
                                mass = monoisotopic_mass(counts)
                                err = ppm_error(exact_mass, mass)
                                if abs(err) > ppm:
                                    continue
                                dbe = double_bond_equivalents(counts)
                                dbe_pen = abs(dbe - round(dbe))
                                hetero = n + o + p + s + f + cl
                                score = 1.0 / (1.0 + abs(err)) - 0.04 * dbe_pen - 0.002 * hetero
                                candidates.append(
                                    FormulaCandidate(
                                        formula=formula_from_counts(counts),
                                        counts=counts,
                                        mass=mass,
                                        ppm=err,
                                        dbe=dbe,
                                        score=score,
                                    )
                                )
    candidates.sort(key=lambda item: item.score, reverse=True)
    # Deduplicate formulae
    seen: set[str] = set()
    unique: list[FormulaCandidate] = []
    for item in candidates:
        if item.formula in seen:
            continue
        seen.add(item.formula)
        unique.append(item)
        if len(unique) >= limit:
            break
    return unique


def formula_from_smiles(smiles: str) -> str | None:
    try:
        from rdkit import Chem
        from rdkit.Chem.rdMolDescriptors import CalcMolFormula

        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None
        return neutralize_formula(CalcMolFormula(mol))
    except Exception:
        return None
