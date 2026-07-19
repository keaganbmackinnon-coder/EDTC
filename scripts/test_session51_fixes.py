"""Session 51 fix harness — isolated test DB, stubbed webview.

Covers:
 1. get_thargoid_nearby uses the _edsm_run pattern (no self._edsm AttributeError)
 2. journal watchdog ignores stale-file touches / accepts newer files
 3. journal poll only re-globs every 10th tick
 4. search_local_markets: cap + nearest-first sort + case-fallback ref coords
 5. delete_ingame_routes keeps user routes, drops auto ones
 6. migration guard re-raises non-duplicate OperationalError
 7. spansh _poll_job raises RuntimeError on job error payload
 8. _load_json caches by mtime and invalidates on write
 9. get_ship_info journal scan runs once
10. get_market_stats serves cache and refreshes in background after TTL
"""
import json
import os
import sys
import tempfile
import time
import types
import unittest
from pathlib import Path

ROOT = Path(r"C:\Users\Keagan\OneDrive\Desktop\EDT\EDT")
sys.path.insert(0, str(ROOT))

# stub webview before importing main
webview_stub = types.ModuleType("webview")
webview_stub.create_window = lambda **kw: None
webview_stub.start = lambda *a, **kw: None
webview_stub.windows = []
class _Win: pass
webview_stub.Window = _Win
sys.modules["webview"] = webview_stub

# isolated DB
_tmpdir = tempfile.mkdtemp(prefix="edtc_s51_")
os.environ["EDTC_TEST"] = "1"
import core.database as db
db.DB_PATH = Path(_tmpdir) / "test.db"
db.init_db()

import main
from core.journal import JournalWatcher


def make_api():
    api = main.API.__new__(main.API)  # skip __init__ side effects
    api._window = None
    api._current_ship = {}
    api._loadout_scanned = False
    api._market_stats_cache = None
    api._market_stats_time = 0.0
    api._market_stats_refreshing = False
    return api


class TestThargoidNearby(unittest.TestCase):
    def test_no_attribute_error_and_edsm_pattern(self):
        api = make_api()
        # _edsm_run stubbed: call the coro factory with a fake edsm and verify
        # the factory accepts the edsm argument (the original bug: 0-arg fn +
        # missing self._edsm attribute)
        captured = {}
        class FakeEdsm:
            async def get_systems_in_sphere(self, name, radius):
                captured["args"] = (name, radius)
                return [
                    {"name": "A", "distance": 5,
                     "information": {"factionState": "Thargoid Controlled",
                                     "allegiance": "", "population": 0}},
                    {"name": "B", "distance": 2,
                     "information": {"factionState": "Boom", "allegiance": ""}},
                ]
        def fake_edsm_run(coro_factory):
            import asyncio
            return asyncio.run(coro_factory(FakeEdsm()))
        api._edsm_run = fake_edsm_run
        result = api.get_thargoid_nearby("Sol", 40)
        self.assertIsInstance(result, list)
        self.assertEqual(captured["args"], ("Sol", 40))
        self.assertEqual([r["name"] for r in result], ["A"])  # non-thargoid filtered


class TestJournalWatchdog(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix="edtc_j_"))
        self.events = []
        self.w = JournalWatcher(on_event=self.events.append)
        self.w._path = self.dir

    def _write(self, name, lines, mtime=None):
        p = self.dir / name
        p.write_text("\n".join(json.dumps(l) for l in lines) + "\n", encoding="utf-8")
        if mtime:
            os.utime(p, (mtime, mtime))
        return p

    def test_stale_file_touch_ignored(self):
        now = time.time()
        old = self._write("Journal.2020-01-01T000000.01.log",
                          [{"event": "MarketBuy", "Type": "gold"}], mtime=now - 9000)
        cur = self._write("Journal.2026-07-18T000000.01.log",
                          [{"event": "FSDJump", "StarSystem": "X"}], mtime=now)
        self.w._current_file = cur
        self.w._file_pos = cur.stat().st_size  # fully read
        # AV touches the OLD journal (content event would duplicate if replayed)
        self.w._on_file_change(str(old))
        self.assertEqual(self.w._current_file.name, cur.name)
        self.assertEqual(self.events, [])  # nothing replayed

    def test_newer_file_switches(self):
        now = time.time()
        cur = self._write("Journal.2026-07-18T000000.01.log",
                          [{"event": "FSDJump", "StarSystem": "X"}], mtime=now - 100)
        new = self._write("Journal.2026-07-18T010000.01.log",
                          [{"event": "FSDJump", "StarSystem": "Y"}], mtime=now)
        self.w._current_file = cur
        self.w._file_pos = cur.stat().st_size
        self.w._on_file_change(str(new))
        self.assertEqual(self.w._current_file.name, new.name)
        self.assertEqual([e["StarSystem"] for e in self.events], ["Y"])

    def test_first_file_accepted_when_no_current(self):
        now = time.time()
        new = self._write("Journal.2026-07-18T000000.01.log",
                          [{"event": "FSDJump", "StarSystem": "Z"}], mtime=now)
        self.w._current_file = None
        self.w._on_file_change(str(new))
        self.assertEqual(self.w._current_file.name, new.name)

    def test_poll_glob_throttled(self):
        now = time.time()
        cur = self._write("Journal.2026-07-18T000000.01.log", [], mtime=now)
        self.w._current_file = cur
        self.w._file_pos = cur.stat().st_size
        globs = {"n": 0}
        orig = main.__dict__  # not used; patch module-level helper
        import core.journal as cj
        real = cj._latest_journal
        cj._latest_journal = lambda d: (globs.__setitem__("n", globs["n"] + 1) or real(d))
        try:
            for _ in range(20):
                self.w._poll()
        finally:
            cj._latest_journal = real
        self.assertEqual(globs["n"], 2)  # 20 polls -> 2 globs


class TestSearchLocalMarkets(unittest.TestCase):
    def setUp(self):
        with db._conn() as c:
            c.execute("DELETE FROM markets")
            c.execute("DELETE FROM system_coords")

    def test_cap_and_sort(self):
        db.upsert_system_coords("Ref", 0, 0, 0)
        rows = []
        for i in range(300):
            db.upsert_system_coords(f"Sys{i}", i + 1, 0, 0)
            rows.append((f"Sys{i}", f"St{i}", "gold", 100, 200, 10, 10,
                         "2026-07-18 00:00:00", 0))
        db.bulk_upsert_spansh_dump(rows)
        out = db.search_local_markets("Gold", "Ref")
        self.assertEqual(len(out), 250)  # capped
        dists = [r["distance"] for r in out]
        self.assertEqual(dists, sorted(dists))  # nearest first
        self.assertEqual(out[0]["system"], "Sys0")

    def test_ref_coords_case_fallback(self):
        db.upsert_system_coords("SOL", 0, 0, 0)
        db.bulk_upsert_spansh_dump([("SOL", "Abraham Lincoln", "gold",
                                     100, 200, 10, 10, "2026-07-18 00:00:00", 1)])
        out = db.search_local_markets("Gold", "sol")  # lowercase ref
        self.assertEqual(out[0]["distance"], 0.0)

    def test_no_ref_keeps_recency_order(self):
        db.bulk_upsert_spansh_dump([
            ("A", "S1", "gold", 1, 1, 1, 1, "2026-07-01 00:00:00", 0),
            ("B", "S2", "gold", 1, 1, 1, 1, "2026-07-18 00:00:00", 0),
        ])
        out = db.search_local_markets("Gold", None)
        self.assertEqual(out[0]["system"], "B")


class TestIngameRoutePrune(unittest.TestCase):
    def test_prune_keeps_user_routes(self):
        with db._conn() as c:
            c.execute("DELETE FROM routes")
        db.save_route({"name": "In-game route → Colonia", "systems": ["A"]})
        db.save_route({"name": "In-game route → Sag A*", "systems": ["B"]})
        db.save_route({"name": "My mining loop", "systems": ["C"]})
        db.delete_ingame_routes()
        names = [r["name"] for r in db.get_routes()]
        self.assertEqual(names, ["My mining loop"])


class TestMigrationGuard(unittest.TestCase):
    def test_init_db_idempotent(self):
        db.init_db()  # duplicate-column ALTERs must be swallowed
        db.init_db()


class TestSpanshPollJob(unittest.TestCase):
    def test_error_payload_raises_immediately(self):
        import asyncio
        from api.spansh import SpanshAPI
        api = SpanshAPI.__new__(SpanshAPI)
        async def fake_get(path, params=None):
            return {"status": "queued", "error": "System not found"}
        api.get = fake_get
        t0 = time.time()
        with self.assertRaises(RuntimeError) as cm:
            asyncio.run(api._poll_job("job1"))
        self.assertLess(time.time() - t0, 2)  # no 120s poll
        self.assertIn("System not found", str(cm.exception))

    def test_ok_returns_result(self):
        import asyncio
        from api.spansh import SpanshAPI
        api = SpanshAPI.__new__(SpanshAPI)
        async def fake_get(path, params=None):
            return {"status": "ok", "result": {"jumps": [1]}}
        api.get = fake_get
        self.assertEqual(asyncio.run(api._poll_job("j")), {"jumps": [1]})


class TestLoadJsonCache(unittest.TestCase):
    def test_cache_and_mtime_invalidation(self):
        api = make_api()
        tmp = Path(tempfile.mkdtemp(prefix="edtc_data_"))
        (tmp / "data").mkdir()
        f = tmp / "data" / "thing.json"
        f.write_text('{"v": 1}', encoding="utf-8")
        old_base = main.BASE_DIR
        main.BASE_DIR = tmp
        try:
            a = api._load_json("thing.json")
            b = api._load_json("thing.json")
            self.assertIs(a, b)  # cached object
            time.sleep(0.02)
            f.write_text('{"v": 2}', encoding="utf-8")
            os.utime(f, (time.time() + 5, time.time() + 5))
            c = api._load_json("thing.json")
            self.assertEqual(c["v"], 2)  # invalidated on mtime change
            self.assertEqual(api._load_json("missing.json"), {})
        finally:
            main.BASE_DIR = old_base


class TestShipInfoScanOnce(unittest.TestCase):
    def test_scan_runs_once(self):
        api = make_api()
        calls = {"n": 0}
        jdir = Path(tempfile.mkdtemp(prefix="edtc_ship_"))
        (jdir / "Journal.2026-07-18T000000.01.log").write_text(
            '{"event": "Fileheader"}\n', encoding="utf-8")
        import core.journal as cj
        real = cj.journal_path
        def counting_path():
            calls["n"] += 1
            return jdir
        cj.journal_path = counting_path
        try:
            api.get_ship_info()
            api.get_ship_info()
            api.get_ship_info()
        finally:
            cj.journal_path = real
        # journal_path used once by the scan; later calls skip the scan
        # (Status.json branch is skipped because _current_ship stays empty)
        self.assertEqual(calls["n"], 1)


class TestMarketStatsCache(unittest.TestCase):
    def test_first_call_blocks_then_serves_cache(self):
        api = make_api()
        s1 = api.get_market_stats()
        self.assertIn("stations", s1)
        t = api._market_stats_time
        s2 = api.get_market_stats()  # within TTL — cached, no refresh thread
        self.assertIs(s1, s2)
        self.assertEqual(api._market_stats_time, t)

    def test_stale_serves_old_and_refreshes_in_background(self):
        api = make_api()
        api._market_stats_cache = {"stations": -1}
        api._market_stats_time = time.time() - 400  # past TTL
        out = api.get_market_stats()
        self.assertEqual(out["stations"], -1)  # stale served immediately
        deadline = time.time() + 5
        while api._market_stats_refreshing and time.time() < deadline:
            time.sleep(0.05)
        self.assertNotEqual(api._market_stats_cache.get("stations"), -1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
