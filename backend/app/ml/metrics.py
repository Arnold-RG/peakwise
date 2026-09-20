"""MassSpecGym-aligned metrics: exact match, Tanimoto, hit-rate, cosine, MCES proxy."""

from __future__ import annotations

from rdkit import Chem
from rdkit.Chem import rdFMCS

from backend.app.chemistry.fingerprints import tanimoto_smiles
from backend.app.chemistry.smiles import canonical_smiles, inchikey


def exact_match(pred: str, truth: str) -> bool:
    a = canonical_smiles(pred)
    b = canonical_smiles(truth)
    if not a or not b:
        return False
    return a == b or inchikey(a) == inchikey(b)


def topk_accuracy(preds: list[str], truth: str) -> bool:
    return any(exact_match(p, truth) for p in preds)


def topk_tanimoto(preds: list[str], truth: str) -> float:
    if not preds:
        return 0.0
    return max(tanimoto_smiles(p, truth) for p in preds)


def mces_distance(pred: str, truth: str) -> float:
    """Bond-edit proxy using RDKit MCS (smaller is better; 0 = identical)."""
    mol_a = Chem.MolFromSmiles(pred)
    mol_b = Chem.MolFromSmiles(truth)
    if mol_a is None or mol_b is None:
        return 99.0
    if Chem.MolToSmiles(mol_a, canonical=True) == Chem.MolToSmiles(mol_b, canonical=True):
        return 0.0
    result = rdFMCS.FindMCS(
        [mol_a, mol_b],
        timeout=2,
        completeRingsOnly=True,
        bondCompare=rdFMCS.BondCompare.CompareOrder,
    )
    if result.canceled or result.numBonds == 0:
        return float(mol_a.GetNumBonds() + mol_b.GetNumBonds())
    return float(mol_a.GetNumBonds() + mol_b.GetNumBonds() - 2 * result.numBonds)


def topk_mces(preds: list[str], truth: str) -> float:
    if not preds:
        return 99.0
    return min(mces_distance(p, truth) for p in preds)


def hit_rate_at_k(ranked: list[str], truth: str, k: int) -> bool:
    return topk_accuracy(ranked[:k], truth)


def summarize_de_novo(rows: list[dict]) -> dict:
    n = max(len(rows), 1)
    return {
        "n": len(rows),
        "top1_accuracy": round(sum(r["top1"] for r in rows) / n, 4),
        "top10_accuracy": round(sum(r["top10"] for r in rows) / n, 4),
        "top1_tanimoto": round(sum(r["tanimoto1"] for r in rows) / n, 4),
        "top10_tanimoto": round(sum(r["tanimoto10"] for r in rows) / n, 4),
        "top1_mces": round(sum(r["mces1"] for r in rows) / n, 4),
        "formula_accuracy": round(sum(r.get("formula_match", 0) for r in rows) / n, 4),
    }
