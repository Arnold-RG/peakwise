"""Parsers for MGF, MSP, and simple peak lists."""

from __future__ import annotations

import json
import re
from typing import Any


def parse_peak_text(text: str) -> list[tuple[float, float]]:
    peaks: list[tuple[float, float]] = []
    for raw in text.replace(";", "\n").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or ":" in line and not line[0].isdigit():
            continue
        parts = re.split(r"[\s,]+", line)
        if len(parts) < 2:
            continue
        try:
            peaks.append((float(parts[0]), float(parts[1])))
        except ValueError:
            continue
    return peaks


def parse_mgf(text: str) -> list[dict[str, Any]]:
    spectra: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    peaks: list[tuple[float, float]] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.upper() == "BEGIN IONS":
            current = {}
            peaks = []
            continue
        if line.upper() == "END IONS":
            if current is not None:
                current["peaks"] = peaks
                spectra.append(current)
            current = None
            peaks = []
            continue
        if current is None:
            continue
        if "=" in line and not line[0].isdigit():
            key, value = line.split("=", 1)
            key_u = key.strip().upper()
            current[key_u] = value.strip()
            if key_u in {"PEPMASS", "PRECURSOR_MZ"}:
                current["precursor_mz"] = float(value.split()[0])
            if key_u in {"ADDUCT", "ION"}:
                current["adduct"] = value.strip()
            if key_u in {"SMILES"}:
                current["smiles"] = value.strip()
            if key_u in {"FORMULA"}:
                current["formula"] = value.strip()
            if key_u in {"NAME", "TITLE"}:
                current["name"] = value.strip()
            if key_u in {"COLLISION_ENERGY", "CE"}:
                try:
                    current["collision_energy"] = float(re.findall(r"[\d.]+", value)[0])
                except Exception:
                    pass
            continue
        parts = re.split(r"[\s,]+", line)
        if len(parts) >= 2:
            try:
                peaks.append((float(parts[0]), float(parts[1])))
            except ValueError:
                continue
    return spectra


def parse_msp(text: str) -> list[dict[str, Any]]:
    spectra: list[dict[str, Any]] = []
    current: dict[str, Any] = {}
    peaks: list[tuple[float, float]] = []
    in_peaks = False
    num_peaks = 0

    def flush():
        nonlocal current, peaks, in_peaks, num_peaks
        if current or peaks:
            current["peaks"] = peaks
            spectra.append(current)
        current, peaks, in_peaks, num_peaks = {}, [], False, 0

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            if in_peaks and peaks:
                flush()
            continue
        if ":" in line and not in_peaks:
            key, value = line.split(":", 1)
            key_u = key.strip().upper()
            value = value.strip()
            current[key_u] = value
            if key_u == "NAME":
                current["name"] = value
            elif key_u in {"PRECURSORMZ", "PRECURSOR_MZ"}:
                current["precursor_mz"] = float(value.split()[0])
            elif key_u in {"PRECURSORTYPE", "ADDUCT"}:
                current["adduct"] = value
            elif key_u == "FORMULA":
                current["formula"] = value
            elif key_u == "SMILES":
                current["smiles"] = value
            elif key_u in {"COLLISIONENERGY", "COLLISION_ENERGY"}:
                try:
                    current["collision_energy"] = float(re.findall(r"[\d.]+", value)[0])
                except Exception:
                    pass
            elif key_u == "NUM PEAKS":
                num_peaks = int(value)
                in_peaks = True
            continue
        if in_peaks:
            parts = re.split(r"[\s,]+", line)
            if len(parts) >= 2:
                try:
                    peaks.append((float(parts[0]), float(parts[1])))
                except ValueError:
                    continue
            if num_peaks and len(peaks) >= num_peaks:
                flush()
    if peaks:
        flush()
    return spectra


def parse_any(filename: str, text: str) -> list[dict[str, Any]]:
    lower = filename.lower()
    if lower.endswith(".mgf"):
        return parse_mgf(text)
    if lower.endswith(".msp"):
        return parse_msp(text)
    if lower.endswith(".json"):
        data = json.loads(text)
        return data if isinstance(data, list) else [data]
    peaks = parse_peak_text(text)
    return [{"peaks": peaks, "name": filename}]
