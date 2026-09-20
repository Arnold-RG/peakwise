"""Hybrid spectrum-to-SMILES predictor: retrieval + fingerprint MLP + formula filter."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np

from backend.app.chemistry.adducts import suggest_adducts
from backend.app.chemistry.druglikeness import druglikeness
from backend.app.chemistry.fingerprints import cosine_arrays, morgan_array, tanimoto_smiles
from backend.app.chemistry.formula import enumerate_formulas, formula_from_smiles
from backend.app.chemistry.fragments import annotate_peaks
from backend.app.chemistry.isotopes import isotope_pattern
from backend.app.chemistry.mass import neutral_mass_from_precursor, ppm_error
from backend.app.chemistry.smiles import analog_smiles, canonical_smiles, descriptors, inchikey, molecule_svg
from backend.app.config import DEFAULT_ADDUCT, LIBRARY_PATH
from backend.app.ml.fingerprint_model import load_model, predict_fingerprint, spectrum_features
from backend.app.spectra.features import normalize_peaks, peak_statistics, top_peaks
from backend.app.spectra.quality import assess_spectrum
from backend.app.spectra.similarity import cosine_similarity, modified_cosine


def _peaks(record: dict) -> list[tuple[float, float]]:
    return [(float(p["mz"]), float(p["intensity"])) for p in record.get("peaks", [])]


@lru_cache(maxsize=1)
def load_library(path: str | None = None) -> list[dict]:
    library_path = Path(path) if path else LIBRARY_PATH
    if not library_path.exists():
        return []
    return json.loads(library_path.read_text(encoding="utf-8"))


def reload_library() -> None:
    load_library.cache_clear()


class IonScribePredictor:
    def __init__(self) -> None:
        self.library = load_library()
        self.model = load_model()
        self._fp_cache: dict[str, np.ndarray] = {}
        for rec in self.library:
            smi = rec["smiles"]
            if smi not in self._fp_cache:
                fp = morgan_array(smi)
                if fp is not None:
                    self._fp_cache[smi] = fp

    def _fingerprint_for(self, smiles: str) -> np.ndarray | None:
        if smiles in self._fp_cache:
            return self._fp_cache[smiles]
        fp = morgan_array(smiles)
        if fp is not None:
            self._fp_cache[smiles] = fp
        return fp

    def retrieve(
        self,
        query: dict,
        top_k: int = 10,
        formula: str | None = None,
        known_only: bool = False,
    ) -> list[dict]:
        q_peaks = normalize_peaks(_peaks(query))
        precursor = float(query.get("precursor_mz") or (q_peaks[-1][0] if q_peaks else 0))
        pred_fp = None
        if self.model is not None:
            pred_fp = predict_fingerprint(self.model, {**query, "peaks": [{"mz": m, "intensity": i} for m, i in q_peaks], "precursor_mz": precursor})

        scored = []
        for rec in self.library:
            if formula and rec.get("formula") != formula:
                continue
            spec_cos = cosine_similarity(q_peaks, _peaks(rec))
            mod_cos = modified_cosine(q_peaks, _peaks(rec), precursor, rec["precursor_mz"])
            fp_score = 0.0
            if pred_fp is not None:
                lib_fp = self._fingerprint_for(rec["smiles"])
                if lib_fp is not None:
                    fp_score = cosine_arrays(pred_fp, lib_fp)
            mass_pen = min(abs(precursor - rec["precursor_mz"]) / max(precursor, 1.0), 0.25)
            hybrid = 0.45 * spec_cos + 0.25 * mod_cos + 0.30 * fp_score - 0.35 * mass_pen
            scored.append(
                {
                    "name": rec["name"],
                    "smiles": rec["smiles"],
                    "formula": rec["formula"],
                    "molecule_class": rec.get("molecule_class"),
                    "role": rec.get("role"),
                    "split": rec.get("split"),
                    "is_novel": rec.get("is_novel", False),
                    "precursor_mz": rec["precursor_mz"],
                    "adduct": rec.get("adduct"),
                    "collision_energy": rec.get("collision_energy"),
                    "spectral_cosine": round(spec_cos, 4),
                    "modified_cosine": round(mod_cos, 4),
                    "fingerprint_score": round(float(fp_score), 4),
                    "hybrid_score": round(float(hybrid), 4),
                    "ppm_precursor": round(ppm_error(precursor, rec["precursor_mz"]), 2),
                    "library_peaks": rec.get("peaks", [])[:48],
                    "inchikey": rec.get("inchikey"),
                    "source": "library",
                }
            )
        scored.sort(key=lambda x: x["hybrid_score"], reverse=True)

        if known_only:
            return [_enrich_candidate(item) for item in scored[:top_k]]

        extras: list[dict] = []
        for hit in scored[:3]:
            for analog in analog_smiles(hit["smiles"], limit=3):
                if analog in self._fp_cache:
                    continue
                fp = self._fingerprint_for(analog)
                fp_score = cosine_arrays(pred_fp, fp) if pred_fp is not None and fp is not None else 0.2
                can = canonical_smiles(analog)
                extras.append(
                    {
                        "name": f"analog of {hit['name']}",
                        "smiles": can or analog,
                        "formula": formula_from_smiles(analog),
                        "molecule_class": hit.get("molecule_class"),
                        "role": "de-novo-analog",
                        "split": "generated",
                        "is_novel": True,
                        "precursor_mz": precursor,
                        "adduct": query.get("adduct", DEFAULT_ADDUCT),
                        "collision_energy": query.get("collision_energy"),
                        "spectral_cosine": round(hit["spectral_cosine"] * 0.7, 4),
                        "modified_cosine": round(hit["modified_cosine"] * 0.7, 4),
                        "fingerprint_score": round(float(fp_score), 4),
                        "hybrid_score": round(float(0.55 * fp_score + 0.2 * hit["hybrid_score"]), 4),
                        "ppm_precursor": None,
                        "svg": molecule_svg(analog),
                        "descriptors": descriptors(analog),
                        "druglikeness": druglikeness(analog),
                        "inchikey": inchikey(analog),
                        "library_peaks": [],
                        "source": "de-novo",
                    }
                )
        merged = scored + extras
        merged.sort(key=lambda x: x["hybrid_score"], reverse=True)
        # Unique by canonical SMILES
        seen: set[str] = set()
        unique = []
        for item in merged:
            key = item["smiles"]
            if key in seen:
                continue
            seen.add(key)
            unique.append(_enrich_candidate(item))
            if len(unique) >= top_k:
                break
        return unique

    def predict(self, query: dict, top_k: int = 10, use_formula: bool = True) -> dict:
        peaks = normalize_peaks(_peaks(query))
        if not peaks:
            raise ValueError("No peaks provided")
        precursor = float(query.get("precursor_mz") or peaks[-1][0])
        adduct = query.get("adduct") or DEFAULT_ADDUCT
        collision_energy = float(query.get("collision_energy") or 20)
        given_formula = query.get("formula") or None
        neutral = neutral_mass_from_precursor(precursor, adduct=adduct)

        formula_candidates = []
        if use_formula:
            if given_formula:
                formula_candidates = [{"formula": given_formula, "ppm": 0.0, "score": 1.0, "dbe": None, "mass": neutral}]
            else:
                formula_candidates = [
                    {
                        "formula": c.formula,
                        "ppm": round(c.ppm, 3),
                        "score": round(c.score, 4),
                        "dbe": c.dbe,
                        "mass": round(c.mass, 5),
                    }
                    for c in enumerate_formulas(neutral, ppm=12.0, limit=8)
                ]

        best_formula = given_formula or (formula_candidates[0]["formula"] if formula_candidates else None)
        ranked = self.retrieve(query, top_k=top_k, formula=None)
        if best_formula:
            formula_ranked = self.retrieve(query, top_k=top_k, formula=best_formula)
            if formula_ranked:
                # Boost formula-consistent hits without hiding other good analogs.
                boosted = {item["smiles"]: item for item in ranked}
                for item in formula_ranked:
                    item = dict(item)
                    item["hybrid_score"] = round(item["hybrid_score"] + 0.08, 4)
                    item["formula_consistent"] = True
                    boosted[item["smiles"]] = item
                ranked = sorted(boosted.values(), key=lambda x: x["hybrid_score"], reverse=True)[:top_k]

        top = ranked[0] if ranked else None
        gap = 0.0
        if len(ranked) >= 2:
            gap = ranked[0]["hybrid_score"] - ranked[1]["hybrid_score"]
        confidence = 0.0
        if top:
            confidence = float(
                np.clip(0.35 * top["spectral_cosine"] + 0.35 * top["fingerprint_score"] + 0.3 * (gap / 0.15), 0, 1)
            )

        annotations = annotate_peaks(peaks[:40], best_formula or (top["formula"] if top else None), precursor)
        stats = peak_statistics(peaks, precursor)
        quality = assess_spectrum(peaks, precursor)
        predicted_smiles = top["smiles"] if top else None
        suggested = suggest_adducts(precursor, best_formula)

        return {
            "predicted_smiles": predicted_smiles,
            "predicted_name": top["name"] if top else None,
            "confidence": round(confidence, 4),
            "confidence_label": _confidence_label(confidence),
            "precursor_mz": round(precursor, 5),
            "neutral_mass": round(neutral, 5),
            "adduct": adduct,
            "collision_energy": collision_energy,
            "formula_candidates": formula_candidates,
            "best_formula": best_formula,
            "suggested_adducts": suggested,
            "candidates": ranked,
            "rationale": _explain(top, ranked, best_formula, quality, confidence),
            "spectrum_quality": quality,
            "peak_annotations": [
                {
                    "mz": round(a.mz, 4),
                    "intensity": round(a.intensity, 4),
                    "formula": a.formula,
                    "annotation": a.annotation,
                    "error_ppm": None if a.error_ppm is None else round(a.error_ppm, 2),
                }
                for a in annotations
            ],
            "spectrum_stats": stats,
            "top_peaks": top_peaks(peaks),
            "isotope_pattern": isotope_pattern(best_formula) if best_formula else [],
            "query_svg": molecule_svg(predicted_smiles) if predicted_smiles else None,
            "known_vs_novel": "known" if top and not top.get("is_novel") and top.get("source") == "library" else "novel-or-analog",
            "model_loaded": self.model is not None,
            "library_size": len(self.library),
        }


def _enrich_candidate(item: dict) -> dict:
    smi = item["smiles"]
    item.setdefault("svg", molecule_svg(smi))
    item.setdefault("descriptors", descriptors(smi))
    item.setdefault("druglikeness", druglikeness(smi))
    item.setdefault("inchikey", inchikey(smi))
    return item


def _confidence_label(score: float) -> str:
    if score >= 0.72:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def _explain(top: dict | None, ranked: list[dict], best_formula: str | None, quality: dict, confidence: float) -> list[str]:
    notes: list[str] = []
    if quality.get("flags"):
        notes.append("Spectrum QC: " + ", ".join(quality["flags"]))
    else:
        notes.append(f"Spectrum quality is {quality.get('label', 'unknown')} (entropy {quality.get('entropy')}).")
    if not top:
        notes.append("No library or analog hit exceeded the ranking threshold.")
        return notes
    notes.append(f"Top structure is {top['name']} (hybrid {top['hybrid_score']:.3f}, confidence {_confidence_label(confidence)}).")
    notes.append(
        f"Evidence: spectral cosine {top['spectral_cosine']:.3f}, modified cosine {top['modified_cosine']:.3f}, "
        f"fingerprint {top['fingerprint_score']:.3f}."
    )
    if top.get("ppm_precursor") is not None:
        notes.append(f"Precursor mass error vs library is {top['ppm_precursor']:.1f} ppm.")
    if best_formula:
        if top.get("formula") == best_formula or top.get("formula_consistent"):
            notes.append(f"Candidate formula {top.get('formula')} agrees with the enumerated formula {best_formula}.")
        else:
            notes.append(f"Enumerated formula {best_formula} differs from the hit formula {top.get('formula')}.")
    if top.get("source") == "de-novo":
        notes.append("This is a generated analog, not an observed library spectrum — a novel-molecule hypothesis.")
    dl = top.get("druglikeness") or {}
    if dl.get("lipinski_pass"):
        notes.append("Passes Lipinski rule-of-five (oral drug-like physicochemical space).")
    if dl.get("metabolite_like"):
        notes.append("Physicochemical profile is consistent with endogenous metabolites / biomarkers.")
    if len(ranked) >= 2:
        gap = ranked[0]["hybrid_score"] - ranked[1]["hybrid_score"]
        if gap < 0.03:
            notes.append("The top-2 scores are close; inspect the next candidates before trusting a single SMILES.")
    return notes


_PREDICTOR: IonScribePredictor | None = None


def get_predictor() -> IonScribePredictor:
    global _PREDICTOR
    if _PREDICTOR is None:
        _PREDICTOR = IonScribePredictor()
    return _PREDICTOR
