"""
Build the all-time galaxy discovery-density grid from EDSM's full
systemsWithCoordinates dump (~3.6 GB download, ~150M systems).

Streams the dump without writing it to disk, bins every system into the same
300-ly grid used by core.database (COVERAGE_CELL_LY), and writes a compact
data/galaxy_density_alltime.json.gz that the app imports into the 'alltime'
coverage layer at startup.

Re-run this whenever a fresh snapshot is wanted (the dump refreshes nightly,
but all-time coverage changes slowly — months between refreshes is fine).

Usage:  python scripts/build_density.py [local_dump.json.gz]
        (with no argument, streams the dump directly from EDSM)
"""
import gzip
import io
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core.database import COVERAGE_CELL_LY  # noqa: E402

DUMP_URL = "https://www.edsm.net/dump/systemsWithCoordinates.json.gz"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "galaxy_density_alltime.json.gz"

COORD_RE = re.compile(r'"coords"\s*:\s*\{\s*"x"\s*:\s*(-?[\d.eE+]+)\s*,\s*"y"\s*:\s*-?[\d.eE+]+\s*,\s*"z"\s*:\s*(-?[\d.eE+]+)')


def main():
    cells: dict[tuple, int] = {}
    n = 0
    misses = 0
    t0 = time.time()

    if len(sys.argv) > 1:
        source = gzip.open(sys.argv[1], "rb")
    else:
        req = urllib.request.Request(DUMP_URL, headers={"User-Agent": "EDTC-density-build"})
        source = gzip.GzipFile(fileobj=urllib.request.urlopen(req, timeout=300))
    with source as gz:
        stream = io.TextIOWrapper(gz, encoding="utf-8", errors="replace")
        for line in stream:
            m = COORD_RE.search(line)
            if not m:
                if line.lstrip().startswith("{"):
                    misses += 1
                continue
            x = float(m.group(1))
            z = float(m.group(2))
            cell = (int(x // COVERAGE_CELL_LY), int(z // COVERAGE_CELL_LY))
            cells[cell] = cells.get(cell, 0) + 1
            n += 1
            if n % 5_000_000 == 0:
                print(f"  {n/1e6:.0f}M systems, {len(cells)} cells, {time.time()-t0:.0f}s elapsed", flush=True)

    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": DUMP_URL,
        "cell_ly": COVERAGE_CELL_LY,
        "systems": n,
        "cells": [[gx, gz, c] for (gx, gz), c in cells.items()],
    }
    OUT_PATH.parent.mkdir(exist_ok=True)
    with gzip.open(OUT_PATH, "wt", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))

    size_mb = OUT_PATH.stat().st_size / 1e6
    print(f"done: {n} systems ({misses} unparsed) -> {len(cells)} cells, "
          f"{OUT_PATH.name} {size_mb:.1f} MB, {time.time()-t0:.0f}s total")


if __name__ == "__main__":
    main()
