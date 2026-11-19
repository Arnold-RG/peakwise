import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.chemistry.formula import parse_formula, formula_from_counts, seven_golden_rules
from backend.app.chemistry.mass import monoisotopic_mass, precursor_mz, ppm_error
from backend.app.spectra.features import normalize_peaks, bin_spectrum
from backend.app.spectra.parse import parse_mgf, parse_peak_text
from backend.app.spectra.similarity import cosine_similarity


def test_caffeine_mass():
    counts = parse_formula("C8H10N4O2")
    mass = monoisotopic_mass(counts)
    assert abs(mass - 194.0804) < 0.001
    mz = precursor_mz(mass, "[M+H]+")
    assert abs(mz - 195.0877) < 0.002
    assert abs(ppm_error(mz, 195.0877)) < 5


def test_formula_roundtrip():
    counts = parse_formula("C10H13N5O4")
    assert formula_from_counts(counts) == "C10H13N5O4"
    assert seven_golden_rules(counts)


def test_charged_formulas():
    assert parse_formula("C7H16NO2+") == {"C": 7, "H": 16, "N": 1, "O": 2}
    assert parse_formula("[C7H16NO2]+") == {"C": 7, "H": 16, "N": 1, "O": 2}
    assert parse_formula("C6H5O-") == {"C": 6, "H": 5, "O": 1}
    assert parse_formula("C7H16NO2+2") == {"C": 7, "H": 16, "N": 1, "O": 2}


def test_druglikeness_caffeine():
    from backend.app.chemistry.druglikeness import druglikeness

    dl = druglikeness("Cn1cnc2c1c(=O)n(C)c(=O)n2C")
    assert dl["valid"]
    assert dl["lipinski_pass"]
    assert 0 < dl["medicine_score"] <= 1


def test_normalize_and_cosine():
    a = normalize_peaks([(100, 50), (150, 100), (80, 10)])
    assert a[0][0] == 80
    assert max(i for _, i in a) == 1.0
    sim = cosine_similarity(a, a)
    assert sim > 0.99
    vec = bin_spectrum(a)
    assert vec.sum() > 0


def test_mgf_and_peak_text():
    mgf = """
BEGIN IONS
TITLE=Caffeine
PEPMASS=195.0877
ADDUCT=[M+H]+
138.0664 800
195.0877 1000
END IONS
"""
    spectra = parse_mgf(mgf)
    assert len(spectra) == 1
    assert spectra[0]["precursor_mz"] == 195.0877
    assert len(spectra[0]["peaks"]) == 2
    peaks = parse_peak_text("100 10\n200,20")
    assert peaks == [(100.0, 10.0), (200.0, 20.0)]
