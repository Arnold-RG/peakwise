from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"
MODELS_DIR = ROOT / "models"

LIBRARY_PATH = DATA_DIR / "library.json"
CATALOG_PATH = DATA_DIR / "catalog.json"
EVAL_PATH = DATA_DIR / "eval_report.json"
MODEL_PATH = MODELS_DIR / "fingerprint_mlp.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "preprocessor.joblib"

PROTON = 1.007276466812
ELECTRON = 0.000548579909
NEUTRON = 1.00866491595

ADDUCT_MASSES = {
    "[M+H]+": 1.007276,
    "[M+Na]+": 22.989218,
    "[M+K]+": 38.963158,
    "[M+NH4]+": 18.033823,
    "[M-H]-": -1.007276,
    "[M+H-H2O]+": -17.00274,
    "[M+2H]2+": 1.007276,
}

DEFAULT_ADDUCT = "[M+H]+"
MZ_BIN_WIDTH = 5.0
MZ_MAX = 800.0
FP_N_BITS = 256
FP_RADIUS = 2
RANDOM_STATE = 42
TRAIN_FRACTION = 0.7
VAL_FRACTION = 0.15
