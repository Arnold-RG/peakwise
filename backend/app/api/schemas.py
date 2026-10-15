from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

FORMULA_RE = re.compile(r"^[A-Za-z0-9\[\]]{0,64}$")
SMILES_RE = re.compile(r"^[\w@+\-\[\]\(\)=#$:/\\.%>]+$")
ALLOWED_ADDUCTS = {
    "[M+H]+",
    "[M+Na]+",
    "[M+NH4]+",
    "[M+K]+",
    "[M-H]-",
    "[M+H-H2O]+",
    "[M+2H]2+",
    "[M-H2O+H]+",
}


class Peak(BaseModel):
    mz: float = Field(gt=0, le=100_000)
    intensity: float = Field(ge=0, le=1e12)


class SpectrumQuery(BaseModel):
    peaks: list[Peak] = Field(min_length=1, max_length=5000)
    precursor_mz: Optional[float] = Field(default=None, gt=0, le=100_000)
    adduct: str = Field(default="[M+H]+", max_length=32)
    collision_energy: float = Field(default=20.0, ge=0, le=500)
    formula: Optional[str] = Field(default=None, max_length=64)
    instrument: Optional[str] = Field(default="Orbitrap", max_length=64)
    name: Optional[str] = Field(default=None, max_length=256)
    top_k: int = Field(default=10, ge=1, le=50)
    use_formula: bool = True
    exclude_smiles: Optional[str] = Field(default=None, max_length=512)

    @field_validator("adduct")
    @classmethod
    def check_adduct(cls, value: str) -> str:
        cleaned = value.strip()
        if cleaned not in ALLOWED_ADDUCTS and len(cleaned) > 32:
            raise ValueError("Unsupported adduct")
        return cleaned

    @field_validator("formula")
    @classmethod
    def check_formula(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        if not FORMULA_RE.match(value):
            raise ValueError("Invalid formula characters")
        return value

    @field_validator("exclude_smiles")
    @classmethod
    def check_exclude(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        if len(value) > 512 or not SMILES_RE.match(value):
            raise ValueError("Invalid SMILES")
        return value


class SimulateQuery(BaseModel):
    smiles: str = Field(min_length=1, max_length=512)
    adduct: str = Field(default="[M+H]+", max_length=32)
    collision_energy: float = Field(default=20.0, ge=0, le=500)
    n_peaks: int = Field(default=40, ge=1, le=200)

    @field_validator("smiles")
    @classmethod
    def check_smiles(cls, value: str) -> str:
        if not SMILES_RE.match(value):
            raise ValueError("Invalid SMILES characters")
        return value


class FormulaQuery(BaseModel):
    precursor_mz: float = Field(gt=0, le=100_000)
    adduct: str = Field(default="[M+H]+", max_length=32)
    ppm: float = Field(default=8.0, gt=0, le=100)


class CompareQuery(BaseModel):
    smiles_a: str = Field(min_length=1, max_length=512)
    smiles_b: str = Field(min_length=1, max_length=512)

    @field_validator("smiles_a", "smiles_b")
    @classmethod
    def check_smiles(cls, value: str) -> str:
        if not SMILES_RE.match(value):
            raise ValueError("Invalid SMILES characters")
        return value


class DiscoverQuery(BaseModel):
    smiles: str = Field(min_length=1, max_length=512)
    goal: str = Field(default="medicine", max_length=32)
    limit: int = Field(default=10, ge=1, le=24)

    @field_validator("smiles")
    @classmethod
    def check_smiles(cls, value: str) -> str:
        if not SMILES_RE.match(value):
            raise ValueError("Invalid SMILES characters")
        return value


class MirrorQuery(BaseModel):
    peaks_a: list[Peak] = Field(min_length=1, max_length=5000)
    peaks_b: list[Peak] = Field(min_length=1, max_length=5000)
    precursor_a: Optional[float] = Field(default=None, gt=0, le=100_000)
    precursor_b: Optional[float] = Field(default=None, gt=0, le=100_000)


class AdductQuery(BaseModel):
    precursor_mz: float = Field(gt=0, le=100_000)
    formula: Optional[str] = Field(default=None, max_length=64)
    ppm: float = Field(default=12.0, gt=0, le=100)

    @field_validator("formula")
    @classmethod
    def check_formula(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        if not FORMULA_RE.match(value):
            raise ValueError("Invalid formula characters")
        return value
