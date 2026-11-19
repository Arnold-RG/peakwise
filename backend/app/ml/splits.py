"""Leakage-aware splits: group by Murcko scaffold, then hold out novel scaffolds."""

from __future__ import annotations

from collections import defaultdict

import numpy as np

from backend.app.chemistry.smiles import murcko_scaffold
from backend.app.config import RANDOM_STATE, TRAIN_FRACTION, VAL_FRACTION


def scaffold_split(records: list[dict], seed: int = RANDOM_STATE) -> list[dict]:
    """Assign each unique molecule a train/val/test fold by Murcko scaffold.

    Spectra of the same molecule always stay together. Test scaffolds are
    unseen in train — a lighter stand-in for MassSpecGym's MCES>=10 split.
    """
    by_mol: dict[str, list[int]] = defaultdict(list)
    scaffolds: dict[str, str] = {}
    for idx, rec in enumerate(records):
        smi = rec["smiles"]
        by_mol[smi].append(idx)
        if smi not in scaffolds:
            scaffolds[smi] = murcko_scaffold(smi) or f"none-{smi}"

    groups: dict[str, list[str]] = defaultdict(list)
    for smi, scaffold in scaffolds.items():
        groups[scaffold].append(smi)

    rng = np.random.default_rng(seed)
    keys = list(groups.keys())
    rng.shuffle(keys)

    n_mol = len(scaffolds)
    n_train = int(n_mol * TRAIN_FRACTION)
    n_val = int(n_mol * VAL_FRACTION)
    assigned = {}
    count = 0
    for key in keys:
        mols = groups[key]
        if count < n_train:
            fold = "train"
        elif count < n_train + n_val:
            fold = "val"
        else:
            fold = "test"
        for smi in mols:
            assigned[smi] = fold
        count += len(mols)

    out = []
    for rec in records:
        item = dict(rec)
        item["split"] = assigned.get(rec["smiles"], "train")
        item["scaffold"] = scaffolds.get(rec["smiles"])
        item["is_novel"] = item["split"] == "test"
        out.append(item)
    return out
