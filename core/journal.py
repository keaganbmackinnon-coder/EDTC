import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Callable

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

WATCHED_EVENTS = {
    "FSDJump", "Location", "Scan", "CargoTransfer",
    "Docked", "Undocked", "ShipTargeted", "FSSDiscoveryScan",
    "SAAScanComplete", "SellExplorationData", "MultiSellExplorationData",
    "ScanOrganic", "SellOrganicData", "SAASignalsFound", "FSSBodySignals",
    "FactionKillBond", "MarketBuy", "MarketSell",
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
    "ProspectedAsteroid", "AsteroidCracked", "PowerplayMerits",
    "ApproachBody", "Touchdown", "Liftoff", "LeaveBody", "StartJump",
    "DockingGranted", "Died",
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
        # Serialises file-position access between the watchdog callback thread
        # and the polling loop so appended lines are never read/emitted twice.
        self._lock = threading.Lock()
        self._running = False

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
        # Same last-one-wins problem for the plotted route: whether the session
        # ended with a route depends on which of NavRoute/NavRouteClear came
        # last. The NavRoute handler reads the actual route from NavRoute.json.
        nav_state = None
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
                        if kind in ("NavRoute", "NavRouteClear"):
                            nav_state = event
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
            self._dispatch(event)
        # Without a snapshot to reset from, re-applying deltas would double-count.
        if "Materials" in seen:
            for event in material_deltas:
                self._dispatch(event)
        if dock_state:
            kind = dock_state.get("event")
            if kind == "Docked":
                self._dispatch(dock_state)
            elif kind != "Location":
                # last dock-affecting event was Undocked/FSDJump — clear any
                # stale station the replayed login Location may have set
                self._dispatch({"event": "Undocked"})
        if nav_state:
            # After Location/FSDJump so route_update carries the right system.
            # NavRoute resurrects the plotted route (even one plotted while
            # EDTC was closed); NavRouteClear tears down a stale DB route.
            self._dispatch(nav_state)

    def _dispatch(self, event: dict):
        """Hand one event to the app. One bad handler (DB lock, network,
        anything) must never take down the feed or stall the file position."""
        try:
            self._on_event(event)
        except Exception:
            logging.exception(f"journal handler failed for {event.get('event')} — skipping")

    def run(self):
        if not self._path.exists():
            return

        self._current_file = _latest_journal(self._path)
        if self._current_file:
            # A handler raising during replay (e.g. a DB busy-timeout while
            # another thread holds the write lock at startup) must not kill
            # this thread — the poll loop below is the app's only journal
            # feed, and dying here silently freezes every tracker.
            try:
                self._replay_startup()
            except Exception:
                logging.exception("journal startup replay failed — continuing to live tail")
            try:
                self._file_pos = self._current_file.stat().st_size
            except OSError:
                self._file_pos = 0

        handler = _JournalHandler(self)
        try:
            self._observer.schedule(handler, str(self._path), recursive=False)
            self._observer.start()
        except Exception:
            # Watchdog can fail to start; the polling loop below is the
            # authoritative reader either way, so keep going.
            logging.exception("journal observer failed to start — polling only")

        # Poll independently of watchdog. Elite appends to the journal without
        # reliably triggering Windows directory-change notifications, and it
        # rotates to a brand-new Journal.*.log whenever the game (re)starts —
        # so relying on watchdog alone silently freezes the feed if EDTC was
        # launched before the game's session file existed. The poll both picks
        # up a newer journal (rotation) and drains appended lines every second,
        # and it does NOT depend on the observer staying alive.
        self._running = True
        logging.info(
            f"journal watcher: live tail started on "
            f"{self._current_file.name if self._current_file else '(no journal yet)'} pos={self._file_pos}"
        )
        try:
            while self._running:
                time.sleep(1.0)
                try:
                    self._poll()
                except Exception:
                    logging.exception("journal poll error")
        finally:
            try:
                self._observer.stop()
                self._observer.join()
            except Exception:
                pass

    def stop(self):
        self._running = False

    def _poll(self):
        """Switch to a newer journal on rotation, then drain appended lines."""
        with self._lock:
            # Globbing + statting 200+ journal files every second is wasteful —
            # watchdog's on_created switches to a new journal instantly, so the
            # glob is only a fallback and can run every 10th poll (~10s).
            self._poll_count = getattr(self, "_poll_count", 0) + 1
            if self._poll_count >= 10 or self._current_file is None:
                self._poll_count = 0
                latest = _latest_journal(self._path)
                if latest and (self._current_file is None
                               or latest.name != self._current_file.name):
                    logging.info(f"journal rotation: switching to {latest.name}")
                    self._current_file = latest
                    self._file_pos = 0
            self._read_new_lines_locked()

    def _read_new_lines_locked(self):
        # Caller must hold self._lock.
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
                except json.JSONDecodeError:
                    continue
                if event.get("event") in WATCHED_EVENTS:
                    self._dispatch(event)
            self._file_pos = f.tell()

    def _on_file_change(self, path: str):
        changed = Path(path)
        if changed.suffix == ".log" and "Journal." in changed.name:
            with self._lock:
                if (self._current_file is None
                        or self._current_file.name != changed.name):
                    # Only switch to a NEWER journal. Anything can touch an old
                    # journal file (antivirus, backup tools) — switching to it
                    # would reset the read position and replay its whole history
                    # into the live handlers (duplicate trade log entries,
                    # double-counted materials/kills).
                    if self._current_file is not None:
                        try:
                            if changed.stat().st_mtime <= self._current_file.stat().st_mtime:
                                return
                        except OSError:
                            return
                    logging.info(f"journal watchdog: switching to {changed.name}")
                    self._current_file = changed
                    self._file_pos = 0
                self._read_new_lines_locked()


class _JournalHandler(FileSystemEventHandler):
    def __init__(self, watcher: JournalWatcher):
        self._watcher = watcher

    def on_modified(self, event):
        if not event.is_directory:
            self._watcher._on_file_change(event.src_path)

    def on_created(self, event):
        if not event.is_directory:
            self._watcher._on_file_change(event.src_path)
