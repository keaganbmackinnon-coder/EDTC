"""Deferred audit fixes harness (Session 51 items #11 #15 #16 #17).

 1. #17 _conn(): connection is CLOSED after the with-block; commits persist;
    exceptions roll back.
 2. #11 EDDN commodity messages buffer in _mkt_buf and flush as one batch;
    same-station updates collapse to the newest snapshot;
    upsert_market_data (journal Market.json path) still writes immediately.
 3. #16 exo backfill: per-journal cache — unchanged journals are NOT re-read
    (proved by corrupting file content in place with mtime/size preserved),
    changed journals re-parse, deleted journals fall out of the rebuild.
 4. #15 _run_async: one persistent loop reused across calls and threads;
    _shared_api returns the same instance; live Spansh call twice over the
    shared client.
"""
import json
import os
import sqlite3
import sys
import tempfile
import threading
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
_tmpdir = tempfile.mkdtemp(prefix="edtc_deferred_")
import core.database as db
db.DB_PATH = Path(_tmpdir) / "test.db"
db.init_db()

import main


def make_api():
    api = main.API.__new__(main.API)  # skip __init__ side effects
    api._window = None
    api._async_loop = None
    api._async_lock = threading.Lock()
    api._shared_apis = {}
    api._mkt_buf = {}
    api._mkt_last_flush = 0.0
    api._mkt_lock = threading.Lock()
    return api


class TestConnClose(unittest.TestCase):
    def test_closed_after_with(self):
        with db._conn() as c:
            c.execute("SELECT 1")
        with self.assertRaises(sqlite3.ProgrammingError):
            c.execute("SELECT 1")

    def test_commit_persists(self):
        with db._conn() as c:
            c.execute("INSERT OR REPLACE INTO prefs (key, value) VALUES ('t17', 'x')")
        with db._conn() as c:
            r = c.execute("SELECT value FROM prefs WHERE key='t17'").fetchone()
        self.assertEqual(r["value"], "x")

    def test_exception_rolls_back(self):
        try:
            with db._conn() as c:
                c.execute("INSERT OR REPLACE INTO prefs (key, value) VALUES ('t17rb', 'y')")
                raise RuntimeError("boom")
        except RuntimeError:
            pass
        with db._conn() as c:
            r = c.execute("SELECT value FROM prefs WHERE key='t17rb'").fetchone()
        self.assertIsNone(r)


def _commodity_msg(system, station, price, ts="2026-07-19T00:00:00Z"):
    return {
        "$schemaRef": "https://eddn.edcd.io/schemas/commodity/3",
        "message": {
            "systemName": system, "stationName": station, "timestamp": ts,
            "commodities": [{"name": "Gold", "buyPrice": 0, "sellPrice": price,
                             "stock": 0, "demand": 100}],
        },
    }


class TestMarketBatch(unittest.TestCase):
    def _rows(self):
        with db._conn() as c:
            return [dict(r) for r in c.execute(
                "SELECT * FROM markets ORDER BY system, station").fetchall()]

    def setUp(self):
        with db._conn() as c:
            c.execute("DELETE FROM markets")

    def test_buffer_then_flush_dedupes(self):
        api = make_api()
        api._mkt_last_flush = time.time()  # inside the 15 s window: buffer only
        api._handle_eddn_message(_commodity_msg("SysA", "Stn1", 1000))
        api._handle_eddn_message(_commodity_msg("SysA", "Stn1", 2000))  # newer snapshot
        api._handle_eddn_message(_commodity_msg("SysB", "Stn2", 3000))
        self.assertEqual(self._rows(), [])          # nothing written yet
        self.assertEqual(len(api._mkt_buf), 2)      # per-station dedupe

        api._mkt_last_flush = 0.0                   # window expired: next msg flushes
        api._handle_eddn_message(_commodity_msg("SysC", "Stn3", 4000))
        rows = self._rows()
        self.assertEqual(len(rows), 3)
        by_station = {(r["system"], r["station"]): r for r in rows}
        self.assertEqual(by_station[("SysA", "Stn1")]["sell_price"], 2000)
        self.assertEqual(by_station[("SysC", "Stn3")]["sell_price"], 4000)
        self.assertEqual(api._mkt_buf, {})

    def test_journal_market_path_still_immediate(self):
        db.upsert_market_data("SysD", "Stn4", "2026-07-19T00:00:00Z",
                              [{"name": "Gold", "sellPrice": 5000, "demand": 1}])
        rows = self._rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["sell_price"], 5000)


def _jline(**kw):
    return json.dumps(kw)


class TestExoBackfillCache(unittest.TestCase):
    def setUp(self):
        self.jdir = Path(tempfile.mkdtemp(prefix="edtc_journals_"))
        import core.journal as journal_mod
        self._orig_jp = journal_mod.journal_path
        journal_mod.journal_path = lambda: self.jdir
        with db._conn() as c:
            c.execute("DELETE FROM exo_scans")
            c.execute("DELETE FROM exo_journal_cache")

    def tearDown(self):
        import core.journal as journal_mod
        journal_mod.journal_path = self._orig_jp

    def _write(self, name, lines, mtime):
        p = self.jdir / name
        p.write_text("\n".join(lines), encoding="utf-8")
        os.utime(p, (mtime, mtime))
        return p

    def _completed(self):
        with db._conn() as c:
            return [dict(r) for r in c.execute(
                "SELECT * FROM exo_scans WHERE completed=1 ORDER BY updated").fetchall()]

    def test_cache_roundtrip_change_and_delete(self):
        j1 = self._write("Journal.2026-01-01T000000.01.log", [
            _jline(timestamp="2026-01-01T00:00:00Z", event="FSDJump", StarSystem="Alpha"),
            _jline(timestamp="2026-01-01T00:01:00Z", event="Scan", StarSystem="Alpha",
                   BodyID=7, BodyName="Alpha 7 a"),
            _jline(timestamp="2026-01-01T00:02:00Z", event="ScanOrganic",
                   ScanType="Analyse", Body=7, Species="TestSpecies",
                   Genus="TestGenus", WasLogged=False),
        ], mtime=1000)
        j2 = self._write("Journal.2026-01-02T000000.01.log", [
            _jline(timestamp="2026-01-02T00:00:00Z", event="SellOrganicData",
                   BioData=[{"Species": "TestSpecies"}]),
        ], mtime=2000)

        api = make_api()
        api._backfill_exo_history()
        rows = self._completed()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["species"], "TestSpecies")
        self.assertEqual(rows[0]["body_name"], "Alpha 7 a")
        self.assertEqual(rows[0]["sold"], 1)
        with db._conn() as c:
            n = c.execute("SELECT COUNT(*) AS n FROM exo_journal_cache").fetchone()["n"]
        self.assertEqual(n, 2)

        # Corrupt j1's CONTENT but keep mtime+size — cached parse must be used
        st = j1.stat()
        j1.write_text("X" * st.st_size, encoding="utf-8")
        os.utime(j1, (st.st_mtime, st.st_mtime))
        api._backfill_exo_history()
        rows = self._completed()
        self.assertEqual(len(rows), 1, "cached events not used — file was re-read")
        self.assertEqual(rows[0]["sold"], 1)

        # Append a second scan to j2 (mtime/size change) — only j2 re-parses
        self._write("Journal.2026-01-02T000000.01.log", [
            _jline(timestamp="2026-01-02T00:00:00Z", event="SellOrganicData",
                   BioData=[{"Species": "TestSpecies"}]),
            _jline(timestamp="2026-01-02T00:05:00Z", event="FSDJump", StarSystem="Beta"),
            _jline(timestamp="2026-01-02T00:06:00Z", event="ScanOrganic",
                   ScanType="Analyse", Body=3, Species="OtherSpecies",
                   Genus="OtherGenus", WasLogged=True),
        ], mtime=3000)
        api._backfill_exo_history()
        rows = self._completed()
        self.assertEqual(len(rows), 2)
        self.assertEqual({r["species"] for r in rows},
                         {"TestSpecies", "OtherSpecies"})

        # Delete j2 — its sale + second scan must fall out of the rebuild
        j2.unlink()
        api._backfill_exo_history()
        rows = self._completed()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["species"], "TestSpecies")
        self.assertEqual(rows[0]["sold"], 0, "j2's sale should be gone")
        with db._conn() as c:
            n = c.execute("SELECT COUNT(*) AS n FROM exo_journal_cache").fetchone()["n"]
        self.assertEqual(n, 1)


class TestRunAsync(unittest.TestCase):
    def test_loop_reused_and_threadsafe(self):
        api = make_api()

        async def coro(x):
            return x * 2

        self.assertEqual(api._run_async(coro(21)), 42)
        loop1 = api._async_loop
        self.assertTrue(loop1.is_running())
        self.assertEqual(api._run_async(coro(4)), 8)
        self.assertIs(api._async_loop, loop1)

        results = []
        def worker(v):
            results.append(api._run_async(coro(v)))
        threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        self.assertEqual(sorted(results), [0, 2, 4, 6, 8])
        self.assertIs(api._async_loop, loop1)

    def test_shared_api_singleton(self):
        api = make_api()
        from api.spansh import SpanshAPI
        from api.edsm import EdsmAPI
        s1 = api._shared_api(SpanshAPI)
        s2 = api._shared_api(SpanshAPI)
        e1 = api._shared_api(EdsmAPI)
        self.assertIs(s1, s2)
        self.assertIsNot(s1, e1)

    def test_live_spansh_shared_client(self):
        api = make_api()
        from api.spansh import SpanshAPI
        spansh = api._shared_api(SpanshAPI)
        r1 = api._run_async(spansh.resolve_system_name("kuk"))
        self.assertEqual(r1, "Kuk")
        # second call over the SAME client/connection pool
        r2 = api._run_async(spansh.resolve_system_name("sol"))
        self.assertEqual(r2, "Sol")
        self.assertIsNotNone(spansh._client)
        self.assertFalse(spansh._client.is_closed)


if __name__ == "__main__":
    unittest.main(verbosity=2)
