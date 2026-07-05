import json
import os
import time
from pathlib import Path
from typing import Callable

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

WATCHED_EVENTS = {
    "FSDJump", "Location", "Scan", "CargoTransfer",
    "Docked", "Undocked", "ShipTargeted", "FSSDiscoveryScan",
    "SAAScanComplete", "SellExplorationData", "MultiSellExplorationData",
    "ScanOrganic", "SellOrganicData", "MarketBuy", "MarketSell",
    "MiningRefined", "MaterialCollected", "MaterialDiscarded", "Materials",
    "EngineerProgress", "LoadGame", "Commander", "Fileheader",
    "ColonisationContribution", "ColonisationConstructionDepot",
    "ColonisationConstructionProgress",
    "CarrierStats", "CarrierJump", "CarrierJumpRequest",
    "CarrierJumpCancelled", "CarrierBuy", "CarrierDepositFuel",
    "MaterialTrade", "EngineerCraft", "Synthesis",
    "Rank", "Progress", "Statistics", "Reputation",
    "Powerplay", "NavRoute", "NavRouteClear", "Loadout",
    "Market", "Cargo", "FSDTarget", "CarrierLocation",
}


def journal_path() -> Path:
    if os.name == "nt":
        base = Path(os.environ.get("USERPROFILE", "~")) / "Saved Games" / "Frontier Developments" / "Elite Dangerous"
    elif os.uname().sysname == "Darwin":
        base = Path.home() / "Library" / "Application Support" / "Frontier Developments" / "Elite Dangerous"
    else:
        base = Path.home() / ".local" / "share" / "Frontier Developments" / "Elite Dangerous"
    return base


def _latest_journal(directory: Path) -> Path | None:
    journals = sorted(directory.glob("Journal.*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
    return journals[0] if journals else None


class JournalWatcher:
    def __init__(self, on_event: Callable[[dict], None]):
        self._on_event = on_event
        self._path = journal_path()
        self._current_file: Path | None = None
        self._file_pos = 0
        self._observer = Observer()

    def _replay_startup(self):
        """Scan the latest journal from the start to seed initial state (system, cmdr, etc.)."""
        if not self._current_file:
            return
        STARTUP_EVENTS = {"Location", "FSDJump", "LoadGame", "Commander",
                          "Rank", "Progress", "Statistics", "Powerplay", "Loadout",
                          "Materials", "ColonisationConstructionDepot"}
        # Material deltas after the login 'Materials' snapshot must be re-applied
        # so counts stay exact when EDTC is launched mid-session.
        MATERIAL_DELTAS = {"MaterialCollected", "MaterialDiscarded", "MaterialTrade",
                           "EngineerCraft", "Synthesis"}
        # Docked/Undocked can't go in STARTUP_EVENTS: `seen` keeps only the last
        # event per kind and replays in first-seen order, which loses whether
        # the final dock or undock came last. Track the last dock-AFFECTING
        # event separately and resolve the true end state after the replay —
        # without this, relaunching EDTC while docked at a station visited
        # after login left _current_station stale/empty (no station market,
        # no buyable-here highlight).
        DOCK_EVENTS = {"Location", "Docked", "Undocked", "FSDJump"}
        dock_state = None
        seen = {}
        material_deltas = []
        try:
            with open(self._current_file, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        event = json.loads(line)
                        kind = event.get("event")
                        if kind in DOCK_EVENTS:
                            dock_state = event
                        if kind in STARTUP_EVENTS:
                            seen[kind] = event
                            if kind == "Materials":
                                material_deltas = []  # snapshot resets the baseline
                        elif kind in MATERIAL_DELTAS:
                            material_deltas.append(event)
                    except json.JSONDecodeError:
                        pass
        except OSError:
            return
        for event in seen.values():
            self._on_event(event)
        # Without a snapshot to reset from, re-applying deltas would double-count.
        if "Materials" in seen:
            for event in material_deltas:
                self._on_event(event)
        if dock_state:
            kind = dock_state.get("event")
            if kind == "Docked":
                self._on_event(dock_state)
            elif kind != "Location":
                # last dock-affecting event was Undocked/FSDJump — clear any
                # stale station the replayed login Location may have set
                self._on_event({"event": "Undocked"})

    def run(self):
        if not self._path.exists():
            return

        self._current_file = _latest_journal(self._path)
        if self._current_file:
            self._replay_startup()
            self._file_pos = self._current_file.stat().st_size

        handler = _JournalHandler(self)
        self._observer.schedule(handler, str(self._path), recursive=False)
        self._observer.start()

        try:
            while self._observer.is_alive():
                time.sleep(1)
        finally:
            self._observer.stop()
            self._observer.join()

    def _read_new_lines(self):
        if not self._current_file or not self._current_file.exists():
            return

        with open(self._current_file, "r", encoding="utf-8", errors="replace") as f:
            f.seek(self._file_pos)
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                    if event.get("event") in WATCHED_EVENTS:
                        self._on_event(event)
                except json.JSONDecodeError:
                    pass
            self._file_pos = f.tell()

    def _on_file_change(self, path: str):
        changed = Path(path)
        if changed.suffix == ".log" and "Journal." in changed.name:
            if self._current_file != changed:
                self._current_file = changed
                self._file_pos = 0
            self._read_new_lines()


class _JournalHandler(FileSystemEventHandler):
    def __init__(self, watcher: JournalWatcher):
        self._watcher = watcher

    def on_modified(self, event):
        if not event.is_directory:
            self._watcher._on_file_change(event.src_path)

    def on_created(self, event):
        if not event.is_directory:
            self._watcher._on_file_change(event.src_path)
