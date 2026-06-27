import json
import os
import time
from pathlib import Path
from typing import Callable

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

WATCHED_EVENTS = {
    "FSDJump", "Location", "Scan", "ScanBarCode", "CargoTransfer",
    "Docked", "Undocked", "ShipTargeted", "FSSDiscoveryScan",
    "SAAScanComplete", "SellExplorationData", "MultiSellExplorationData",
    "ScanOrganic", "SellOrganicData", "MarketBuy", "MarketSell",
    "MiningRefined", "MaterialCollected", "MaterialDiscarded",
    "EngineerProgress", "LoadGame", "Commander", "Fileheader",
    "ColonisationContribution", "ColonisationConstructionDepot",
    "ColonisationConstructionProgress",
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
    journals = sorted(directory.glob("Journal.*.log"), reverse=True)
    return journals[0] if journals else None


class JournalWatcher:
    def __init__(self, on_event: Callable[[dict], None]):
        self._on_event = on_event
        self._path = journal_path()
        self._current_file: Path | None = None
        self._file_pos = 0
        self._observer = Observer()

    def run(self):
        if not self._path.exists():
            return

        self._current_file = _latest_journal(self._path)
        if self._current_file:
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
