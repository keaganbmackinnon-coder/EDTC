"""Exobiology reference data, species prediction, and surface-distance math.

Data source: data/exobiology.json (built from the EDMC-BioScan rulesets, see
scripts/build_exobiology.py). Values are Vista Genomics base prices; First Logged
(first CMDR to log a species) pays 5x.
"""
import json
import math
import re
import sys
from pathlib import Path

BASE_DIR = Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).parent.parent

_DATA: dict | None = None
_GENUS_DIST: dict[str, int] = {}      # genus name (lower) -> clonal colony range (m)
_SPECIES_VALUE: dict[str, int] = {}   # species name (lower) -> Vista base value


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def load_data() -> dict:
    """Load and cache data/exobiology.json plus the lookup maps."""
    global _DATA
    if _DATA is not None:
        return _DATA
    try:
        _DATA = json.loads((BASE_DIR / "data" / "exobiology.json").read_text(encoding="utf-8"))
    except Exception:
        _DATA = {"genera": []}
    for g in _DATA.get("genera", []):
        _GENUS_DIST[g["name"].lower()] = g.get("colony_distance", 0)
        for sp in g.get("species", []):
            _SPECIES_VALUE[sp["name"].lower()] = sp.get("value", 0)
    return _DATA


def genera() -> list:
    return load_data().get("genera", [])


def genus_distance(genus: str) -> int:
    """Clonal colony range in metres for a genus (localised name), 0 if unknown."""
    load_data()
    return _GENUS_DIST.get((genus or "").lower(), 0)


def species_value(species: str) -> int:
    """Vista Genomics base value for a species (localised name), 0 if unknown."""
    load_data()
    return _SPECIES_VALUE.get((species or "").lower(), 0)


# --- Surface distance (clonal colony spacing) ---

def surface_distance(lat1: float, lon1: float, lat2: float, lon2: float, radius_m: float) -> float:
    """Great-circle distance in metres between two lat/lon points on a body of
    the given radius. Elite reports lat/lon in degrees and PlanetRadius in metres."""
    r = radius_m or 0.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


# --- Species prediction from body parameters ---

def _atmosphere_matches(want: list, have: str) -> bool:
    # Scan's AtmosphereType is e.g. "CarbonDioxide", "CarbonDioxideRich", "None".
    hv = _norm(have)
    if not want:
        return True
    for w in want:
        nw = _norm(w)
        if hv == nw or hv.startswith(nw) or nw.startswith(hv):
            return True
    return False


def _volcanism_matches(want, have: str) -> bool:
    hv = (have or "").lower()
    has_volc = bool(hv.strip()) and "no volcanism" not in hv
    if want == "None" or want == ["None"]:
        return not has_volc
    if want == "Any" or want is None:
        return True
    if isinstance(want, str):
        want = [want]
    if not has_volc:
        return False
    return any(kw.lower() in hv for kw in want)


def _ruleset_matches(rs: dict, p: dict) -> bool:
    """One ruleset (a single AND-set of constraints). Star/region/pressure
    constraints are intentionally NOT enforced — we don't always have the parent
    star or galactic region, and over-listing a candidate is better than hiding
    a real one. Gravity/temperature/atmosphere/body-type/volcanism are enough to
    separate most genera."""
    bt = rs.get("body_type")
    if bt and p.get("body_type") and p["body_type"] not in bt:
        return False
    if "atmosphere" in rs and not _atmosphere_matches(rs["atmosphere"], p.get("atmosphere", "")):
        return False
    if "volcanism" in rs and not _volcanism_matches(rs["volcanism"], p.get("volcanism", "")):
        return False
    g = p.get("gravity_g")
    if g is not None:
        if "min_gravity" in rs and g < rs["min_gravity"] - 0.02:
            return False
        if "max_gravity" in rs and g > rs["max_gravity"] + 0.02:
            return False
    t = p.get("temperature")
    if t:
        if "min_temperature" in rs and t < rs["min_temperature"] - 2:
            return False
        if "max_temperature" in rs and t > rs["max_temperature"] + 2:
            return False
    return True


def _species_matches(species: dict, p: dict) -> bool:
    for rs in species.get("conditions", []):
        if _ruleset_matches(rs, p):
            return True
    return not species.get("conditions")  # no rules -> can't rule out


def predict(params: dict, only_genera: list | None = None) -> list:
    """Return candidate species for a body given its scan parameters.

    params: {atmosphere, gravity_g, temperature, volcanism, body_type}
    only_genera: if set (e.g. from a DSS scan's confirmed Genuses), restrict to
                 those genus names; otherwise consider all genera.
    Returns a list of {genus, name, value} sorted by value desc.
    """
    load_data()
    want = {g.lower() for g in only_genera} if only_genera else None
    out = []
    for g in genera():
        if want is not None and g["name"].lower() not in want:
            continue
        for sp in g.get("species", []):
            if _species_matches(sp, params):
                out.append({"genus": g["name"], "name": sp["name"],
                            "value": sp.get("value", 0),
                            "colony_distance": g.get("colony_distance", 0)})
    out.sort(key=lambda s: s["value"], reverse=True)
    return out
