"""Multi-output MLP that maps a spectrum feature vector to a Morgan fingerprint."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from backend.app.chemistry.fingerprints import morgan_array, tanimoto_arrays
from backend.app.config import MODEL_PATH, PREPROCESSOR_PATH, RANDOM_STATE
from backend.app.spectra.features import feature_vector


ADDUCT_INDEX = {
    "[M+H]+": 0,
    "[M+Na]+": 1,
    "[M+NH4]+": 2,
    "[M+K]+": 3,
    "[M-H]-": 4,
    "[M+H-H2O]+": 5,
}


def _adduct_index(adduct: str) -> float:
    return float(ADDUCT_INDEX.get(adduct, 0))


def spectrum_features(record: dict) -> np.ndarray:
    peaks = [(p["mz"], p["intensity"]) for p in record["peaks"]]
    return feature_vector(
        peaks,
        precursor_mz=record["precursor_mz"],
        collision_energy=float(record.get("collision_energy", 20)),
        adduct_index=_adduct_index(record.get("adduct", "[M+H]+")),
    )


def build_xy(records: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    xs, ys = [], []
    for rec in records:
        fp = morgan_array(rec["smiles"])
        if fp is None:
            continue
        xs.append(spectrum_features(rec))
        ys.append(fp)
    return np.vstack(xs), np.vstack(ys)


def make_model() -> Pipeline:
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "mlp",
                MLPRegressor(
                    hidden_layer_sizes=(256, 128),
                    activation="relu",
                    alpha=1e-3,
                    learning_rate_init=1e-3,
                    max_iter=400,
                    random_state=RANDOM_STATE,
                    early_stopping=True,
                    validation_fraction=0.15,
                ),
            ),
        ]
    )


def train_fingerprint_model(train_records: list[dict], model_path: Path = MODEL_PATH) -> dict:
    x, y = build_xy(train_records)
    model = make_model()
    model.fit(x, y)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    pred = model.predict(x)
    tanimotos = [tanimoto_arrays(y[i], pred[i]) for i in range(len(y))]
    metrics = {
        "n_train_spectra": int(len(train_records)),
        "train_fp_tanimoto": round(float(np.mean(tanimotos)), 4),
        "n_features": int(x.shape[1]),
        "n_bits": int(y.shape[1]),
    }
    (model_path.parent / "train_metrics.json").write_text(json.dumps(metrics, indent=2))
    joblib.dump({"n_features": x.shape[1]}, PREPROCESSOR_PATH)
    return metrics


def load_model(model_path: Path = MODEL_PATH):
    if not model_path.exists():
        return None
    return joblib.load(model_path)


def predict_fingerprint(model, record: dict) -> np.ndarray:
    x = spectrum_features(record).reshape(1, -1)
    pred = model.predict(x)[0]
    return np.clip(pred, 0.0, 1.0).astype(np.float32)
