from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class Peak(BaseModel):
    mz: float
    intensity: float


class SpectrumQuery(BaseModel):
    peaks: list[Peak]
    precursor_mz: Optional[float] = None
    adduct: str = "[M+H]+"
    collision_energy: float = 20.0
    formula: Optional[str] = None
    instrument: Optional[str] = "Orbitrap"
    name: Optional[str] = None
    top_k: int = Field(default=10, ge=1, le=50)
    use_formula: bool = True
    exclude_smiles: Optional[str] = None


class SimulateQuery(BaseModel):
    smiles: str
    adduct: str = "[M+H]+"
    collision_energy: float = 20.0
    n_peaks: int = 40


class FormulaQuery(BaseModel):
    precursor_mz: float
    adduct: str = "[M+H]+"
    ppm: float = 8.0


class CompareQuery(BaseModel):
    smiles_a: str
    smiles_b: str


class DiscoverQuery(BaseModel):
    smiles: str
    goal: str = "medicine"
    limit: int = Field(default=10, ge=1, le=24)


class MirrorQuery(BaseModel):
    peaks_a: list[Peak]
    peaks_b: list[Peak]
    precursor_a: Optional[float] = None
    precursor_b: Optional[float] = None


class AdductQuery(BaseModel):
    precursor_mz: float
    formula: Optional[str] = None
    ppm: float = 12.0
