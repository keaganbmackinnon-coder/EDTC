"""NavRoute fix harness: bare journal marker -> route read from NavRoute.json;
startup replay resurrects last-wins NavRoute/NavRouteClear."""
import json
import os
import sys
import tempfile
import threading
import types
import unittest
from pathlib import Path

ROOT = Path(r"C:\Users\Keagan\OneDrive\Desktop\EDT\EDT")
sys.path.insert(0, str(ROOT))

webview_stub = types.ModuleType("webview")
webview_stub.create_window = lambda **kw: None
webview_stub.start = lambda *a, **kw: None
webview_stub.windows = []
sys.modules["webview"] = webview_stub

_tmpdir = tempfile.mkdtemp(prefix="edtc_nav_")
import core.database as db
db.DB_PATH = Path(_tmpdir) / "test.db"
db.init_db()

import main
import core.journal as journal_mod


class FakeOverlays:
    def __init__(self):
        self.emitted = []
    def emit_to_overlay(self, name, etype, payload):
        self.emitted.append((name, etype, payload))
    def is_user_enabled(self, name):
        return False


def make_api():
    api = main.API.__new__(main.API)
    api._window = None
    api._current_system = "Sol"
    api._active_route = None
    api._last_fsd_target = None
    api._last_jump_info = None
    api._overlay_manager = FakeOverlays()
    api._emitted = []
    api._emit = lambda t, p: api._emitted.append((t, p))
    return api


ROUTE = [
    {"StarSystem": "Sol", "StarPos": [0, 0, 0], "StarClass": "G"},
    {"StarSystem": "Barnard's Star", "StarPos": [-3.03125, 1.375, 4.9375], "StarClass": "M"},
    {"StarSystem": "Wolf 359", "StarPos": [3.875, 6.46875, -1.90625], "StarClass": "M"},
]


class TestNavRouteJson(unittest.TestCase):
    def setUp(self):
        self.jdir = Path(tempfile.mkdtemp(prefix="edtc_navj_"))
        self._orig = journal_mod.journal_path
        journal_mod.journal_path = lambda: self.jdir
        with db._conn() as c:
            c.execute("DELETE FROM routes")

    def tearDown(self):
        journal_mod.journal_path = self._orig

    def test_bare_marker_reads_navroute_json(self):
        (self.jdir / "NavRoute.json").write_text(
            json.dumps({"event": "NavRoute", "Route": ROUTE}), encoding="utf-8")
        api = make_api()
        api._handle_nav_route({"timestamp": "t", "event": "NavRoute"})  # no Route key
        self.assertIsNotNone(api._active_route)
        self.assertEqual(api._active_route["systems"],
                         ["Sol", "Barnard's Star", "Wolf 359"])
        self.assertEqual(api._active_route["star_classes"], ["G", "M", "M"])
        self.assertEqual(api._active_route["active"], 1)
        # pushed to the overlay + UI
        types_ = [t for (_, t, _p) in api._overlay_manager.emitted]
        self.assertIn("route_update", types_)
        # persisted as the active route
        self.assertIsNotNone(db.get_active_route())

    def test_inline_route_still_works(self):
        api = make_api()
        api._handle_nav_route({"event": "NavRoute", "Route": ROUTE})
        self.assertEqual(len(api._active_route["systems"]), 3)

    def test_missing_file_is_noop(self):
        api = make_api()
        api._handle_nav_route({"event": "NavRoute"})
        self.assertIsNone(api._active_route)


class TestStartupReplayNav(unittest.TestCase):
    def setUp(self):
        self.jdir = Path(tempfile.mkdtemp(prefix="edtc_navr_"))
        self._orig = journal_mod.journal_path
        journal_mod.journal_path = lambda: self.jdir
        with db._conn() as c:
            c.execute("DELETE FROM routes")

    def tearDown(self):
        journal_mod.journal_path = self._orig

    def _watcher(self, events):
        lines = [json.dumps(e) for e in events]
        jfile = self.jdir / "Journal.2026-07-19T000000.01.log"
        jfile.write_text("\n".join(lines), encoding="utf-8")
        w = journal_mod.JournalWatcher.__new__(journal_mod.JournalWatcher)
        w._path = self.jdir
        w._current_file = jfile
        w._lock = threading.Lock()
        self.dispatched = []
        w._on_event = lambda e: self.dispatched.append(e)
        return w

    def test_last_navroute_wins(self):
        w = self._watcher([
            {"timestamp": "1", "event": "Location", "StarSystem": "Sol"},
            {"timestamp": "2", "event": "NavRoute"},
            {"timestamp": "3", "event": "NavRouteClear"},
            {"timestamp": "4", "event": "NavRoute"},
        ])
        w._replay_startup()
        nav = [e["event"] for e in self.dispatched
               if e["event"] in ("NavRoute", "NavRouteClear")]
        self.assertEqual(nav, ["NavRoute"])
        # nav event dispatched after Location
        kinds = [e["event"] for e in self.dispatched]
        self.assertLess(kinds.index("Location"), kinds.index("NavRoute"))

    def test_clear_wins_when_last(self):
        w = self._watcher([
            {"timestamp": "1", "event": "NavRoute"},
            {"timestamp": "2", "event": "NavRouteClear"},
        ])
        w._replay_startup()
        nav = [e["event"] for e in self.dispatched
               if e["event"] in ("NavRoute", "NavRouteClear")]
        self.assertEqual(nav, ["NavRouteClear"])

    def test_no_nav_events_dispatches_none(self):
        w = self._watcher([
            {"timestamp": "1", "event": "Location", "StarSystem": "Sol"},
        ])
        w._replay_startup()
        nav = [e for e in self.dispatched
               if e["event"] in ("NavRoute", "NavRouteClear")]
        self.assertEqual(nav, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
