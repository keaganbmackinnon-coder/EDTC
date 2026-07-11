"""Regenerate data/exobiology.json from the EDMC-BioScan rulesets.

Source: https://github.com/Silarn/EDMC-BioScan (per-genus condition rulesets with
Vista Genomics values). Clonal colony ranges are community-standard per-genus
constants (the game reveals them on a species' First Logged sale).

Run:  python scripts/build_exobiology.py
"""
import json
import re
import urllib.request
from pathlib import Path
from typing import Mapping  # rulesets annotate with this

RAW = "https://raw.githubusercontent.com/Silarn/EDMC-BioScan/master/src/bio_scan/bio_data"
GENERA_FILES = [
    "aleoida", "anemone", "bacterium", "brain_tree", "cactoida", "clypeus",
    "concha", "electricae", "fonticulua", "frutexa", "fumerola", "fungoida",
    "osseus", "recepta", "shard", "stratum", "tubers", "tubus", "tussock",
]
OUT = Path(__file__).resolve().parent.parent / "data" / "exobiology.json"

# Genus display name -> clonal colony range (metres between colonies).
GENUS_DISTANCE = {
    "Aleoida": 150, "Amphora Plant": 100, "Anemone": 100, "Bark Mound": 100,
    "Bacterium": 500, "Brain Tree": 100, "Cactoida": 300, "Clypeus": 150,
    "Concha": 150, "Crystalline Shard": 100, "Electricae": 1000,
    "Fonticulua": 500, "Frutexa": 150, "Fumerola": 100, "Fungoida": 300,
    "Osseus": 800, "Recepta": 150, "Sinuous Tubers": 100, "Stratum": 500,
    "Tubus": 800, "Tussock": 200, "Radicoida": 100,
}
GENERA = sorted(GENUS_DISTANCE, key=len, reverse=True)

CONDITION_KEYS = [
    "atmosphere", "atmosphere_component", "min_gravity", "max_gravity",
    "min_temperature", "max_temperature", "min_pressure", "max_pressure",
    "body_type", "bodies", "star", "parent_star", "volcanism", "regions",
    "nebula", "system", "distance", "tuber", "guardian",
]


def _fetch(path: str) -> str:
    req = urllib.request.Request(f"{RAW}/{path}", headers={"User-Agent": "EDTC-build"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def _exec_catalog(src: str) -> dict:
    ns = {"Mapping": Mapping}
    # drop the import lines, keep the `catalog = {...}` body
    body = src.split("from typing")[-1].split("\n", 1)[1]
    exec(body, ns)
    return ns["catalog"]


def genus_of(name: str) -> str | None:
    for g in GENERA:
        if (name == g or name == g + "s" or name.startswith(g + " ")
                or name.endswith(" " + g) or name.endswith(" " + g + "s")):
            return g
    return None


def main():
    catalog = {}
    for f in GENERA_FILES:
        catalog.update(_exec_catalog(_fetch(f"rulesets/{f}.py")))
    # Bark Mound / Amphora Plant / Radicoida are defined inline in species.py
    sp = _fetch("species.py")
    block = sp.split("_mound_amphora", 1)[1].split("= {", 1)[1]
    block = block[: block.index("\n}\n")]
    ns = {"Mapping": Mapping}
    exec("_m = {" + block + "\n}", ns)
    catalog.update(ns["_m"])

    genera = {}
    for species_map in catalog.values():
        for data in species_map.values():
            name = data.get("name")
            g = genus_of(name or "")
            if not name or g is None:
                continue
            value = data.get("value", 0)
            if value == 16777215:  # BioScan "unknown" sentinel (Concha Biconcavis)
                value = 19010800
            gid = re.sub(r"[^a-z0-9]+", "_", g.lower()).strip("_")
            entry = genera.setdefault(g, {"id": gid, "name": g,
                                          "colony_distance": GENUS_DISTANCE[g], "species": []})
            entry["species"].append({
                "name": name, "value": value,
                "conditions": [{k: rs[k] for k in CONDITION_KEYS if k in rs}
                               for rs in data.get("rulesets", [])],
            })

    out_genera = []
    for g in sorted(genera):
        e = genera[g]
        e["species"].sort(key=lambda s: s["name"])
        vals = [s["value"] for s in e["species"] if s["value"]]
        e["min_value"], e["max_value"] = (min(vals), max(vals)) if vals else (0, 0)
        out_genera.append(e)

    OUT.write_text(json.dumps({
        "_source": "EDMC-BioScan rulesets (github.com/Silarn/EDMC-BioScan) + community clonal colony ranges",
        "_note": "Vista Genomics base values. First Logged (first CMDR to log a species) pays 5x.",
        "genera": out_genera,
    }, indent=2), encoding="utf-8")
    total = sum(len(g["species"]) for g in out_genera)
    print(f"wrote {OUT} — {len(out_genera)} genera, {total} species")


if __name__ == "__main__":
    main()
