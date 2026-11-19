"""Rule-based CID fragmentation and peak-to-subformula annotation."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from rdkit import Chem, RDLogger
from rdkit.Chem import rdMolDescriptors

RDLogger.DisableLog("rdApp.error")

from backend.app.chemistry.formula import parse_formula, formula_from_counts
from backend.app.chemistry.mass import ATOMIC_MASSES, monoisotopic_mass

NEUTRAL_LOSSES = [
    ("H2O", {"H": 2, "O": 1}, ["[OH]", "[C](=O)O", "O"]),
    ("NH3", {"N": 1, "H": 3}, ["[NH2]", "[NH3+]"]),
    ("CO", {"C": 1, "O": 1}, ["[C]=O", "c1ccccc1"]),
    ("CO2", {"C": 1, "O": 2}, ["[C](=O)O"]),
    ("CH2O", {"C": 1, "H": 2, "O": 1}, ["C=O", "CO"]),
    ("C2H4", {"C": 2, "H": 4}, ["CC"]),
    ("HF", {"H": 1, "F": 1}, ["F"]),
    ("HCl", {"H": 1, "Cl": 1}, ["Cl"]),
    ("HCN", {"H": 1, "C": 1, "N": 1}, ["C#N", "n"]),
    ("SO2", {"S": 1, "O": 2}, ["S(=O)(=O)"]),
    ("CH3OH", {"C": 1, "H": 4, "O": 1}, ["OC", "CO"]),
    ("C2H2O", {"C": 2, "H": 2, "O": 1}, ["CC(=O)"]),
    ("HPO3", {"H": 1, "P": 1, "O": 3}, ["P(=O)(O)"]),
]

DIAGNOSTIC_IONS = [
    (77.0386, "phenyl", "c1ccccc1"),
    (91.0542, "tropylium", "Cc1ccccc1"),
    (105.0335, "benzoyl", "O=Cc1ccccc1"),
    (120.0808, "immonium-Phe", "NCCc1ccccc1"),
    (86.0964, "immonium-Leu/Ile", "NCC(C)C"),
    (70.0651, "immonium-Pro", "N1CCCC1"),
    (136.0618, "adenine", "n1cnc2c(ncnc12)"),
    (112.0505, "cytosine", "n1ccc(N)nc1=O"),
]


@dataclass
class AnnotatedPeak:
    mz: float
    intensity: float
    formula: str | None
    annotation: str
    error_ppm: float | None


def _has_smarts(mol, smarts: str) -> bool:
    if any(ch.isdigit() for ch in smarts) and smarts.count("1") == 1:
        return False
    try:
        query = Chem.MolFromSmarts(smarts)
    except Exception:
        return False
    if query is None:
        return False
    return mol.HasSubstructMatch(query)


@lru_cache(maxsize=2048)
def likely_losses(smiles: str) -> list[tuple[str, dict[str, int]]]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return NEUTRAL_LOSSES[:4]
    losses = []
    for name, counts, smarts_list in NEUTRAL_LOSSES:
        if any(_has_smarts(mol, s) or s in smiles for s in smarts_list):
            losses.append((name, counts))
    if not losses:
        losses = [("H2O", {"H": 2, "O": 1}), ("CO", {"C": 1, "O": 1})]
    return losses


def fragment_masses(smiles: str, precursor_mz: float, collision_energy: float = 20.0) -> list[tuple[float, float, str]]:
    """Return (mz, relative_intensity, annotation) peaks for a simulated CID spectrum."""
    mol = Chem.MolFromSmiles(smiles)
    peaks: list[tuple[float, float, str]] = [(precursor_mz, 1.0, "precursor")]
    if mol is None:
        return peaks

    formula = rdMolDescriptors.CalcMolFormula(mol)
    counts = parse_formula(formula)
    energy_scale = min(max(collision_energy / 30.0, 0.35), 1.6)

    for name, loss_counts in likely_losses(smiles):
        remaining = {k: counts.get(k, 0) - v for k, v in {**counts, **loss_counts}.items()}
        if any(v < 0 for v in remaining.values()):
            continue
        loss_mass = monoisotopic_mass(loss_counts)
        mz = precursor_mz - loss_mass
        if mz < 40:
            continue
        intensity = max(0.12, 0.72 / (1.0 + 0.04 * loss_mass)) * energy_scale
        peaks.append((mz, min(intensity, 0.95), f"-{name}"))

    # Bond-break fragments: remove one non-ring atom environment roughly via RWMol copies.
    for atom in mol.GetAtoms():
        if atom.GetDegree() != 1:
            continue
        neighbor = atom.GetNeighbors()[0]
        if neighbor.GetSymbol() == "H":
            continue
        mass = ATOMIC_MASSES.get(atom.GetSymbol(), 0.0)
        hydrogens = atom.GetTotalNumHs()
        mass += hydrogens * ATOMIC_MASSES["H"]
        mz = precursor_mz - mass
        if 50 < mz < precursor_mz - 12:
            peaks.append((mz, 0.18 * energy_scale, f"loss-{atom.GetSymbol()}"))

    smiles_l = smiles.lower()
    for mz, name, motif in DIAGNOSTIC_IONS:
        if motif.lower() in smiles_l or (mol is not None and _has_smarts(mol, motif if "[" in motif or "#" in motif else motif)):
            if mz < precursor_mz:
                peaks.append((mz, 0.35 + 0.1 * energy_scale, name))

    # Ring-intact aromatic series
    if mol.GetRingInfo().NumRings() > 0:
        for offset, label, inten in [
            (65.0386, "C5H5", 0.16),
            (51.0229, "C4H3", 0.09),
            (39.0229, "C3H3", 0.08),
        ]:
            if offset < precursor_mz:
                peaks.append((offset, inten * energy_scale, label))

    # Collapse near-duplicate m/z
    collapsed: dict[int, tuple[float, float, str]] = {}
    for mz, inten, label in peaks:
        key = int(round(mz * 100))
        if key not in collapsed or inten > collapsed[key][1]:
            collapsed[key] = (mz, inten, label)
    items = list(collapsed.values())
    max_i = max(i for _, i, _ in items) or 1.0
    return [(mz, inten / max_i, label) for mz, inten, label in sorted(items, key=lambda x: -x[1])]


def annotate_peaks(
    peaks: list[tuple[float, float]],
    formula: str | None,
    precursor_mz: float,
    ppm: float = 12.0,
) -> list[AnnotatedPeak]:
    annotations: list[AnnotatedPeak] = []
    counts = parse_formula(formula) if formula else {}
    loss_bank = [(name, c) for name, c, _ in NEUTRAL_LOSSES]
    for mz, intensity in peaks:
        best: AnnotatedPeak | None = None
        if abs(mz - precursor_mz) / precursor_mz * 1e6 < ppm:
            best = AnnotatedPeak(mz, intensity, formula, "precursor", abs(mz - precursor_mz) / precursor_mz * 1e6)
        elif counts:
            for name, loss in loss_bank:
                remaining = {el: counts.get(el, 0) - n for el, n in {**counts, **loss}.items()}
                if any(v < 0 for v in remaining.values()):
                    continue
                theory = precursor_mz - monoisotopic_mass(loss)
                err = (mz - theory) / theory * 1e6 if theory else 999
                if abs(err) <= ppm:
                    cand = AnnotatedPeak(mz, intensity, formula_from_counts({k: v for k, v in remaining.items() if v > 0}), f"-{name}", err)
                    if best is None or abs(cand.error_ppm or 999) < abs(best.error_ppm or 999):
                        best = cand
        if best is None:
            best = AnnotatedPeak(mz, intensity, None, "unassigned", None)
        annotations.append(best)
    return annotations
