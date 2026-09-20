"""Morgan fingerprints and Tanimoto similarity."""

from __future__ import annotations

import numpy as np
from rdkit import Chem, DataStructs, RDLogger
from rdkit.Chem import AllChem

RDLogger.DisableLog("rdApp.*")

from backend.app.config import FP_N_BITS, FP_RADIUS


def morgan_bitvect(smiles: str, n_bits: int = FP_N_BITS, radius: int = FP_RADIUS):
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    return AllChem.GetMorganFingerprintAsBitVect(mol, radius, nBits=n_bits)


def morgan_array(smiles: str, n_bits: int = FP_N_BITS, radius: int = FP_RADIUS) -> np.ndarray | None:
    bv = morgan_bitvect(smiles, n_bits=n_bits, radius=radius)
    if bv is None:
        return None
    array = np.zeros((n_bits,), dtype=np.float32)
    DataStructs.ConvertToNumpyArray(bv, array)
    return array


def tanimoto_smiles(a: str, b: str) -> float:
    fa = morgan_bitvect(a)
    fb = morgan_bitvect(b)
    if fa is None or fb is None:
        return 0.0
    return float(DataStructs.TanimotoSimilarity(fa, fb))


def tanimoto_arrays(a: np.ndarray, b: np.ndarray) -> float:
    a_bits = a > 0.5
    b_bits = b > 0.5
    inter = np.logical_and(a_bits, b_bits).sum()
    union = np.logical_or(a_bits, b_bits).sum()
    if union == 0:
        return 0.0
    return float(inter / union)


def cosine_arrays(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)
