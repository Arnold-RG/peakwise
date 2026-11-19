"""Drug-likeness, metabolite-likeness, and simple medicinal-chemistry flags."""

from __future__ import annotations

from functools import lru_cache

from rdkit import Chem
from rdkit.Chem import rdMolDescriptors

from backend.app.chemistry.smiles import descriptors

PAINS_SMARTS = [
    "c1ccccc1N=Nc2ccccc2",  # azo
    "[OH]c1ccc(O)cc1",  # catechol-ish
    "O=C(C=C)C",  # enone
    "N=[N+]=[N-]",  # azide
    "[N+](=O)[O-]",  # nitro
]

LIPID_SMARTS = ["C(=O)OCCCCCC", "CCCCCCCC"]
SUGAR_SMARTS = ["OC1OC(CO)C(O)C(O)C1O", "C1OC(O)C(O)C(O)C1O"]


def _has(mol, smarts: str) -> bool:
    try:
        q = Chem.MolFromSmarts(smarts)
    except Exception:
        return False
    return q is not None and mol.HasSubstructMatch(q)


def lipinski(desc: dict) -> dict:
    mw = desc.get("molwt", 0)
    logp = desc.get("logp", 0)
    hbd = desc.get("n_hbd", 0)
    hba = desc.get("n_hba", 0)
    violations = int(mw > 500) + int(logp > 5) + int(hbd > 5) + int(hba > 10)
    return {
        "mw_ok": mw <= 500,
        "logp_ok": logp <= 5,
        "hbd_ok": hbd <= 5,
        "hba_ok": hba <= 10,
        "violations": violations,
        "pass": violations <= 1,
    }


def veber(desc: dict) -> dict:
    rot = desc.get("n_rotatable", 0)
    tpsa = desc.get("tpsa", 0)
    return {"rotors_ok": rot <= 10, "tpsa_ok": tpsa <= 140, "pass": rot <= 10 and tpsa <= 140}


def qed_lite(desc: dict) -> float:
    """Cheap 0-1 desirability score inspired by QED (not the full weighted QED)."""
    mw = desc.get("molwt", 300)
    logp = desc.get("logp", 2)
    tpsa = desc.get("tpsa", 70)
    hbd = desc.get("n_hbd", 2)
    rot = desc.get("n_rotatable", 4)
    mw_s = max(0.0, 1.0 - abs(mw - 320) / 280)
    logp_s = max(0.0, 1.0 - abs(logp - 2.3) / 4.0)
    tpsa_s = max(0.0, 1.0 - abs(tpsa - 75) / 90)
    hbd_s = max(0.0, 1.0 - abs(hbd - 1.5) / 4.0)
    rot_s = max(0.0, 1.0 - abs(rot - 4) / 8.0)
    return round(0.25 * mw_s + 0.25 * logp_s + 0.2 * tpsa_s + 0.15 * hbd_s + 0.15 * rot_s, 4)


@lru_cache(maxsize=4096)
def druglikeness(smiles: str) -> dict:
    mol = Chem.MolFromSmiles(smiles)
    desc = descriptors(smiles)
    if mol is None or not desc:
        return {"valid": False}
    lip = lipinski(desc)
    vb = veber(desc)
    qed = qed_lite(desc)
    pains = [s for s in PAINS_SMARTS if _has(mol, s)]
    lipid_like = any(_has(mol, s) for s in LIPID_SMARTS) and desc.get("molwt", 0) > 250
    sugar_like = any(_has(mol, s) for s in SUGAR_SMARTS) or (desc.get("n_hbd", 0) >= 4 and desc.get("n_hba", 0) >= 5)
    n = mol.GetNumHeavyAtoms()
    n_n = sum(1 for a in mol.GetAtoms() if a.GetSymbol() == "N")
    n_o = sum(1 for a in mol.GetAtoms() if a.GetSymbol() == "O")
    metabolite_like = 80 <= desc.get("molwt", 0) <= 500 and desc.get("n_rings", 0) <= 4 and (n_n + n_o) >= 2
    medicine_score = round(
        0.45 * qed + 0.25 * float(lip["pass"]) + 0.15 * float(vb["pass"]) + 0.15 * (1.0 if not pains else 0.4),
        4,
    )
    biomarker_score = round(
        0.4 * float(metabolite_like) + 0.25 * float(80 <= desc.get("molwt", 0) <= 400) + 0.2 * min(n_o / max(n, 1) * 4, 1)
        + 0.15 * (1.0 if desc.get("n_aromatic_rings", 0) <= 2 else 0.4),
        4,
    )
    return {
        "valid": True,
        "lipinski": lip,
        "veber": vb,
        "qed_lite": qed,
        "pains_alerts": len(pains),
        "lipid_like": lipid_like,
        "sugar_like": sugar_like,
        "metabolite_like": metabolite_like,
        "lipinski_pass": lip["pass"],
        "medicine_score": medicine_score,
        "biomarker_score": biomarker_score,
        "n_heavy": n,
        "formula_atoms": rdMolDescriptors.CalcMolFormula(mol),
    }


def rank_for_discovery(smiles_list: list[str], goal: str = "medicine") -> list[dict]:
    rows = []
    for smi in smiles_list:
        dl = druglikeness(smi)
        if not dl.get("valid"):
            continue
        score = dl["medicine_score"] if goal == "medicine" else dl["biomarker_score"]
        rows.append({"smiles": smi, "score": score, "druglikeness": dl, "descriptors": descriptors(smi)})
    rows.sort(key=lambda r: r["score"], reverse=True)
    return rows
