"""Build simulated LC-MS/MS library, train fingerprint MLP, write evaluation report."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.chemistry.formula import formula_from_smiles, parse_formula
from backend.app.chemistry.mass import monoisotopic_mass, precursor_mz
from backend.app.chemistry.smiles import canonical_smiles, inchikey, murcko_scaffold
from backend.app.config import EVAL_PATH, LIBRARY_PATH, MODELS_DIR
from backend.app.data.catalog import CATALOG
from backend.app.ml.fingerprint_model import train_fingerprint_model
from backend.app.ml.metrics import exact_match, summarize_de_novo, topk_mces, topk_tanimoto
from backend.app.ml.splits import scaffold_split
from backend.app.spectra.similarity import cosine_similarity
from backend.app.spectra.simulate import simulate_spectrum


def build_records() -> list[dict]:
    records = []
    adducts = ["[M+H]+", "[M+Na]+"]
    energies = [10.0, 20.0, 40.0]
    for mol in CATALOG:
        smi = canonical_smiles(mol["smiles"])
        if not smi:
            print(f"skip invalid SMILES: {mol['name']}")
            continue
        formula = formula_from_smiles(smi) or mol["formula"]
        try:
            mass = monoisotopic_mass(parse_formula(formula))
        except ValueError as exc:
            print(f"skip formula {mol['name']}: {formula!r} ({exc})")
            continue
        key = inchikey(smi)
        for adduct in adducts:
            for ce in energies:
                try:
                    sim = simulate_spectrum(smi, adduct=adduct, collision_energy=ce, n_peaks=35)
                except Exception as exc:
                    print(f"skip spectrum {mol['name']} {adduct} {ce}: {exc}")
                    continue
                records.append(
                    {
                        "name": mol["name"],
                        "smiles": smi,
                        "formula": formula,
                        "inchikey": key,
                        "molecule_class": mol["molecule_class"],
                        "role": mol["role"],
                        "exact_mass": round(mass, 5),
                        "precursor_mz": sim["precursor_mz"],
                        "adduct": adduct,
                        "collision_energy": ce,
                        "instrument": "Orbitrap" if ce >= 20 else "QTOF",
                        "peaks": sim["peaks"],
                        "annotations": sim["annotations"],
                        "scaffold": murcko_scaffold(smi),
                    }
                )
    return records


def evaluate(library: list[dict]) -> dict:
    from backend.app.ml.hybrid_predictor import IonScribePredictor, reload_library

    reload_library()
    predictor = IonScribePredictor()
    test = [r for r in library if r["split"] == "test"]
    # One spectrum per molecule at [M+H]+ / 20 eV to keep eval honest.
    seen = set()
    rows = []
    class_rows: dict[str, list[dict]] = {}
    for rec in test:
        if rec["smiles"] in seen:
            continue
        if rec["adduct"] != "[M+H]+" or rec["collision_energy"] != 20.0:
            continue
        seen.add(rec["smiles"])
        query = {
            "peaks": rec["peaks"],
            "precursor_mz": rec["precursor_mz"],
            "adduct": rec["adduct"],
            "collision_energy": rec["collision_energy"],
        }
        result = predictor.predict(query, top_k=10, use_formula=True)
        preds = [c["smiles"] for c in result["candidates"]]
        row = {
            "name": rec["name"],
            "smiles": rec["smiles"],
            "formula": rec["formula"],
            "molecule_class": rec["molecule_class"],
            "role": rec["role"],
            "top1": int(bool(preds) and exact_match(preds[0], rec["smiles"])),
            "top10": int(any(exact_match(p, rec["smiles"]) for p in preds[:10])),
            "tanimoto1": topk_tanimoto(preds[:1], rec["smiles"]),
            "tanimoto10": topk_tanimoto(preds[:10], rec["smiles"]),
            "mces1": topk_mces(preds[:1], rec["smiles"]),
            "formula_match": int(result.get("best_formula") == rec["formula"]),
            "predicted": preds[0] if preds else None,
            "confidence": result["confidence"],
        }
        rows.append(row)
        class_rows.setdefault(rec["molecule_class"], []).append(row)

    # Baselines on the same queries
    cosine_rows = []
    for rec in test:
        if rec["adduct"] != "[M+H]+" or rec["collision_energy"] != 20.0:
            continue
        ranked = sorted(
            library,
            key=lambda other: cosine_similarity(
                [(p["mz"], p["intensity"]) for p in rec["peaks"]],
                [(p["mz"], p["intensity"]) for p in other["peaks"]],
            ),
            reverse=True,
        )
        # Avoid retrieving the identical spectrum object; still allow same molecule other CE/adduct
        preds = []
        for other in ranked:
            if other is rec:
                continue
            if other["smiles"] in preds:
                continue
            preds.append(other["smiles"])
            if len(preds) >= 10:
                break
        cosine_rows.append(
            {
                "top1": int(bool(preds) and exact_match(preds[0], rec["smiles"])),
                "top10": int(any(exact_match(p, rec["smiles"]) for p in preds[:10])),
                "tanimoto1": topk_tanimoto(preds[:1], rec["smiles"]),
                "tanimoto10": topk_tanimoto(preds[:10], rec["smiles"]),
                "mces1": topk_mces(preds[:1], rec["smiles"]),
                "formula_match": 0,
            }
        )

    by_class = {k: summarize_de_novo(v) for k, v in class_rows.items()}
    report = {
        "hybrid": summarize_de_novo(rows),
        "cosine_retrieval_baseline": summarize_de_novo(cosine_rows),
        "by_class": by_class,
        "examples": rows[:12],
        "n_library_spectra": len(library),
        "n_test_molecules": len(rows),
        "notes": (
            "Scaffold split holds out entire Murcko scaffolds. Cosine baseline can still "
            "match the same molecule at a different collision energy, which is realistic "
            "for spectral library search but optimistic versus MassSpecGym's MCES split."
        ),
    }
    EVAL_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    LIBRARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    records = build_records()
    print(f"built {len(records)} spectra", flush=True)
    records = scaffold_split(records)
    LIBRARY_PATH.write_text(json.dumps(records, indent=2), encoding="utf-8")
    train = [r for r in records if r["split"] == "train"]
    metrics = train_fingerprint_model(train)
    print("library", len(records), "train spectra", len(train))
    print("train metrics", metrics)
    report = evaluate(records)
    print("eval hybrid", report["hybrid"])
    print("eval cosine", report["cosine_retrieval_baseline"])


if __name__ == "__main__":
    main()
