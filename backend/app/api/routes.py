from __future__ import annotations

import json
from functools import lru_cache

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.app.api.schemas import AdductQuery, CompareQuery, DiscoverQuery, FormulaQuery, MirrorQuery, SimulateQuery, SpectrumQuery
from backend.app.chemistry.adducts import suggest_adducts
from backend.app.chemistry.druglikeness import druglikeness, rank_for_discovery
from backend.app.chemistry.fingerprints import tanimoto_smiles
from backend.app.chemistry.formula import enumerate_formulas, formula_from_smiles
from backend.app.chemistry.isotopes import isotope_pattern
from backend.app.chemistry.mass import ADDUCT_MASSES, neutral_mass_from_precursor
from backend.app.chemistry.smiles import analog_smiles, canonical_smiles, descriptors, inchikey, molecule_svg
from backend.app.config import EVAL_PATH
from backend.app.ml.hybrid_predictor import get_predictor
from backend.app.ml.metrics import exact_match, mces_distance
from backend.app.spectra.parse import parse_any
from backend.app.spectra.quality import assess_spectrum
from backend.app.spectra.similarity import cosine_similarity, modified_cosine
from backend.app.spectra.simulate import simulate_spectrum

router = APIRouter()


@router.get("/ping")
def ping() -> dict:
    return {"status": "ok", "project": "Peakwise"}


@lru_cache(maxsize=1)
def _eval_report() -> dict:
    if EVAL_PATH.exists():
        return json.loads(EVAL_PATH.read_text(encoding="utf-8"))
    return {}


@router.get("/health")
def health() -> dict:
    predictor = get_predictor()
    return {
        "status": "ok",
        "library_size": len(predictor.library),
        "model_loaded": predictor.model is not None,
        "project": "Peakwise",
    }


@router.get("/library")
def library(q: str | None = None, role: str | None = None, split: str | None = None, limit: int = 60) -> dict:
    predictor = get_predictor()
    items = predictor.library
    if q:
        needle = q.lower()
        items = [r for r in items if needle in r["name"].lower() or needle in r["smiles"].lower() or needle in r["formula"].lower()]
    if role:
        items = [r for r in items if r.get("role") == role]
    if split:
        items = [r for r in items if r.get("split") == split]
    # Unique molecules for browsing
    unique = []
    seen = set()
    for rec in items:
        if rec["smiles"] in seen:
            continue
        seen.add(rec["smiles"])
        unique.append(
            {
                "name": rec["name"],
                "smiles": rec["smiles"],
                "formula": rec["formula"],
                "molecule_class": rec.get("molecule_class"),
                "role": rec.get("role"),
                "split": rec.get("split"),
                "is_novel": rec.get("is_novel"),
                "exact_mass": rec.get("exact_mass"),
                "inchikey": rec.get("inchikey"),
                "svg": molecule_svg(rec["smiles"], 220, 150),
            }
        )
        if len(unique) >= limit:
            break
    roles = sorted({r.get("role") for r in predictor.library if r.get("role")})
    classes = sorted({r.get("molecule_class") for r in predictor.library if r.get("molecule_class")})
    return {"count": len(unique), "roles": roles, "classes": classes, "items": unique}


@router.get("/library/{name}")
def library_item(name: str) -> dict:
    predictor = get_predictor()
    spectra = [r for r in predictor.library if r["name"].lower() == name.lower()]
    if not spectra:
        raise HTTPException(404, "Molecule not found")
    rec = spectra[0]
    return {
        "name": rec["name"],
        "smiles": rec["smiles"],
        "formula": rec["formula"],
        "molecule_class": rec.get("molecule_class"),
        "role": rec.get("role"),
        "split": rec.get("split"),
        "svg": molecule_svg(rec["smiles"]),
        "inchikey": rec.get("inchikey") or inchikey(rec["smiles"]),
        "descriptors": descriptors(rec["smiles"]),
        "druglikeness": druglikeness(rec["smiles"]),
        "isotope_pattern": isotope_pattern(rec["formula"]),
        "spectra": [
            {
                "adduct": s["adduct"],
                "collision_energy": s["collision_energy"],
                "instrument": s.get("instrument"),
                "precursor_mz": s["precursor_mz"],
                "peaks": s["peaks"],
                "annotations": s.get("annotations", []),
            }
            for s in spectra
        ],
    }


@router.get("/examples")
def examples() -> list[dict]:
    predictor = get_predictor()
    picked = []
    seen = set()
    for rec in predictor.library:
        if rec["adduct"] != "[M+H]+" or rec["collision_energy"] != 20.0:
            continue
        if rec["name"] in seen:
            continue
        seen.add(rec["name"])
        picked.append(
            {
                "name": rec["name"],
                "smiles": rec["smiles"],
                "formula": rec["formula"],
                "role": rec.get("role"),
                "molecule_class": rec.get("molecule_class"),
                "split": rec.get("split"),
                "precursor_mz": rec["precursor_mz"],
                "adduct": rec["adduct"],
                "collision_energy": rec["collision_energy"],
                "peaks": rec["peaks"],
                "svg": molecule_svg(rec["smiles"], 200, 140),
            }
        )
        if len(picked) >= 18:
            break
    return picked


@router.post("/predict")
def predict(query: SpectrumQuery) -> dict:
    predictor = get_predictor()
    payload = query.model_dump()
    payload["peaks"] = [(p["mz"], p["intensity"]) for p in payload["peaks"]] if False else [{"mz": p.mz, "intensity": p.intensity} for p in query.peaks]
    try:
        result = predictor.predict(payload, top_k=query.top_k, use_formula=query.use_formula)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if query.exclude_smiles:
        result["candidates"] = [c for c in result["candidates"] if c["smiles"] != query.exclude_smiles][: query.top_k]
        if result["candidates"]:
            result["predicted_smiles"] = result["candidates"][0]["smiles"]
            result["predicted_name"] = result["candidates"][0]["name"]
    return result


@router.post("/retrieve")
def retrieve(query: SpectrumQuery) -> dict:
    predictor = get_predictor()
    payload = {
        "peaks": [{"mz": p.mz, "intensity": p.intensity} for p in query.peaks],
        "precursor_mz": query.precursor_mz,
        "adduct": query.adduct,
        "collision_energy": query.collision_energy,
        "formula": query.formula,
    }
    hits = predictor.retrieve(payload, top_k=query.top_k, formula=query.formula, known_only=True)
    return {"candidates": hits}


@router.post("/simulate")
def simulate(query: SimulateQuery) -> dict:
    try:
        result = simulate_spectrum(query.smiles, adduct=query.adduct, collision_energy=query.collision_energy, n_peaks=query.n_peaks)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    result["svg"] = molecule_svg(query.smiles)
    result["descriptors"] = descriptors(query.smiles)
    result["isotope_pattern"] = isotope_pattern(result["formula"])
    return result


@router.post("/formula")
def formula(query: FormulaQuery) -> dict:
    mass = neutral_mass_from_precursor(query.precursor_mz, adduct=query.adduct)
    cands = enumerate_formulas(mass, ppm=query.ppm, limit=20)
    return {
        "neutral_mass": round(mass, 5),
        "candidates": [
            {"formula": c.formula, "mass": round(c.mass, 5), "ppm": round(c.ppm, 3), "dbe": c.dbe, "score": round(c.score, 4)}
            for c in cands
        ],
    }


@router.post("/compare")
def compare(query: CompareQuery) -> dict:
    return {
        "tanimoto": round(tanimoto_smiles(query.smiles_a, query.smiles_b), 4),
        "exact": exact_match(query.smiles_a, query.smiles_b),
        "mces": mces_distance(query.smiles_a, query.smiles_b),
        "svg_a": molecule_svg(query.smiles_a),
        "svg_b": molecule_svg(query.smiles_b),
        "descriptors_a": descriptors(query.smiles_a),
        "descriptors_b": descriptors(query.smiles_b),
        "druglikeness_a": druglikeness(query.smiles_a),
        "druglikeness_b": druglikeness(query.smiles_b),
        "inchikey_a": inchikey(query.smiles_a),
        "inchikey_b": inchikey(query.smiles_b),
    }


@router.post("/discover")
def discover(query: DiscoverQuery) -> dict:
    can = canonical_smiles(query.smiles)
    if not can:
        raise HTTPException(400, "Invalid SMILES")
    goal = query.goal if query.goal in {"medicine", "biomarker"} else "medicine"
    analogs = analog_smiles(can, limit=max(query.limit, 8))
    ranked = rank_for_discovery([can] + analogs, goal=goal)[: query.limit]
    for row in ranked:
        row["svg"] = molecule_svg(row["smiles"], 240, 160)
        row["inchikey"] = inchikey(row["smiles"])
        row["formula"] = formula_from_smiles(row["smiles"])
        row["is_query"] = row["smiles"] == can
    predictor = get_predictor()
    neighbors = []
    seen = set()
    for rec in predictor.library:
        smi = rec["smiles"]
        if smi in seen:
            continue
        seen.add(smi)
        sim = tanimoto_smiles(can, smi)
        if sim < 0.32:
            continue
        neighbors.append(
            {
                "name": rec["name"],
                "smiles": smi,
                "formula": rec["formula"],
                "role": rec.get("role"),
                "molecule_class": rec.get("molecule_class"),
                "tanimoto": round(sim, 4),
                "svg": molecule_svg(smi, 200, 140),
            }
        )
    neighbors.sort(key=lambda item: item["tanimoto"], reverse=True)
    return {
        "query_smiles": can,
        "query_svg": molecule_svg(can),
        "query_formula": formula_from_smiles(can),
        "query_druglikeness": druglikeness(can),
        "query_descriptors": descriptors(can),
        "goal": goal,
        "analogs": ranked,
        "library_neighbors": neighbors[:10],
        "notes": (
            "Analogs are enumerated by small medicinal-chemistry edits. "
            "Medicine score combines a QED-like desirability with Lipinski/Veber. "
            "Biomarker score favours endogenous-like polarity and size."
        ),
    }


@router.post("/mirror")
def mirror(query: MirrorQuery) -> dict:
    a = [(p.mz, p.intensity) for p in query.peaks_a]
    b = [(p.mz, p.intensity) for p in query.peaks_b]
    pre_a = query.precursor_a or (a[-1][0] if a else 0.0)
    pre_b = query.precursor_b or (b[-1][0] if b else 0.0)
    return {
        "cosine": round(cosine_similarity(a, b), 4),
        "modified_cosine": round(modified_cosine(a, b, pre_a, pre_b), 4),
        "quality_a": assess_spectrum(a, pre_a),
        "quality_b": assess_spectrum(b, pre_b),
    }


@router.post("/adducts")
def adducts(query: AdductQuery) -> dict:
    return {
        "precursor_mz": query.precursor_mz,
        "known_adducts": list(ADDUCT_MASSES.keys()),
        "matches": suggest_adducts(query.precursor_mz, query.formula, ppm=query.ppm),
    }


@router.post("/quality")
def quality(query: SpectrumQuery) -> dict:
    peaks = [(p.mz, p.intensity) for p in query.peaks]
    return assess_spectrum(peaks, query.precursor_mz)


@router.post("/batch")
async def batch(file: UploadFile = File(...)) -> dict:
    text = (await file.read()).decode("utf-8", errors="replace")
    spectra = parse_any(file.filename or "query.mgf", text)
    predictor = get_predictor()
    outputs = []
    for spec in spectra[:40]:
        peaks = spec.get("peaks") or []
        if not peaks:
            continue
        query = {
            "peaks": [{"mz": mz, "intensity": intensity} for mz, intensity in peaks],
            "precursor_mz": spec.get("precursor_mz"),
            "adduct": spec.get("adduct") or "[M+H]+",
            "collision_energy": spec.get("collision_energy") or 20,
            "formula": spec.get("formula"),
            "name": spec.get("name"),
        }
        try:
            result = predictor.predict(query, top_k=5, use_formula=True)
        except Exception as exc:
            outputs.append({"name": spec.get("name"), "error": str(exc)})
            continue
        outputs.append(
            {
                "name": spec.get("name") or spec.get("TITLE") or f"spectrum-{len(outputs)+1}",
                "predicted_smiles": result["predicted_smiles"],
                "predicted_name": result["predicted_name"],
                "confidence": result["confidence"],
                "best_formula": result["best_formula"],
                "precursor_mz": result["precursor_mz"],
                "candidates": result["candidates"][:5],
            }
        )
    return {"n": len(outputs), "results": outputs}


@router.get("/metrics")
def metrics() -> dict:
    report = _eval_report()
    if not report:
        raise HTTPException(404, "Train the library first: python scripts/build_library.py")
    return report


@router.get("/stats")
def stats() -> dict:
    predictor = get_predictor()
    roles: dict[str, int] = {}
    classes: dict[str, int] = {}
    splits: dict[str, int] = {}
    mols = set()
    for rec in predictor.library:
        mols.add(rec["smiles"])
        roles[rec.get("role", "unknown")] = roles.get(rec.get("role", "unknown"), 0) + (0 if rec["smiles"] in mols else 0)
        classes[rec.get("molecule_class", "unknown")] = classes.get(rec.get("molecule_class", "unknown"), 0) + 1
        splits[rec.get("split", "unknown")] = splits.get(rec.get("split", "unknown"), 0) + 1
    role_mols: dict[str, set] = {}
    class_mols: dict[str, set] = {}
    split_mols: dict[str, set] = {}
    for rec in predictor.library:
        role_mols.setdefault(rec.get("role", "unknown"), set()).add(rec["smiles"])
        class_mols.setdefault(rec.get("molecule_class", "unknown"), set()).add(rec["smiles"])
        split_mols.setdefault(rec.get("split", "unknown"), set()).add(rec["smiles"])
    return {
        "n_spectra": len(predictor.library),
        "n_molecules": len(mols),
        "model_loaded": predictor.model is not None,
        "roles": {k: len(v) for k, v in role_mols.items()},
        "classes": {k: len(v) for k, v in class_mols.items()},
        "splits": {k: len(v) for k, v in split_mols.items()},
    }
