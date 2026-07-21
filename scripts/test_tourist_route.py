"""Live harness for plan_tourist_route (Spansh /tourist/route)."""
import sys
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

import main


def make_api():
    api = main.API.__new__(main.API)
    api._window = None
    api._current_system = ""
    api._async_loop = None
    api._async_lock = threading.Lock()
    api._shared_apis = {}
    return api


class TestTouristRoute(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = make_api()

    def test_single_destination_loop(self):
        # Spansh's system_jumps includes the origin itself as row 0 (leg
        # distance/jumps 0) — kept as a "depart" marker for a clean table:
        # [Sol depart, Colonia, Sol return].
        r = self.api.plan_tourist_route("Sol", ["Colonia"], 40)
        self.assertNotIn("error", r)
        self.assertEqual(r["origin"], "Sol")
        self.assertEqual(len(r["stops"]), 3)
        self.assertEqual(r["stops"][0]["system"], "Sol")
        self.assertEqual(r["stops"][0]["leg_distance"], 0)
        self.assertEqual(r["stops"][1]["system"], "Colonia")
        self.assertEqual(r["stops"][2]["system"], "Sol")
        self.assertAlmostEqual(r["stops"][1]["leg_distance"], 22000.5, delta=1)
        self.assertEqual(r["total_distance"], r["stops"][-1]["total_distance"])

    def test_multi_destination_optimises_order_and_loops(self):
        r = self.api.plan_tourist_route(
            "Sol", ["Colonia", "Sagittarius A*", "Beagle Point"], 40)
        self.assertNotIn("error", r)
        systems = [s["system"] for s in r["stops"]]
        self.assertEqual(len(systems), 5)  # depart Sol + 3 attractions + return Sol
        self.assertEqual(systems[0], "Sol")
        self.assertEqual(systems[-1], "Sol")
        self.assertEqual(set(systems[1:-1]), {"Colonia", "Sagittarius A*", "Beagle Point"})
        # totals accumulate leg-by-leg, not duplicate the raw (per-leg,
        # non-cumulative) Spansh values
        running = 0.0
        for s in r["stops"]:
            running += s["leg_distance"]
            self.assertAlmostEqual(s["total_distance"], round(running, 1), delta=0.2)
        self.assertAlmostEqual(r["total_distance"], round(running, 1), delta=0.2)

    def test_case_insensitive_origin(self):
        r = self.api.plan_tourist_route("sol", ["Colonia"], 40)
        self.assertNotIn("error", r)
        self.assertEqual(len(r["stops"]), 3)

    def test_unknown_destination_error(self):
        r = self.api.plan_tourist_route("Sol", ["NotARealSystemXYZ123"], 40)
        self.assertIn("error", r)
        self.assertIn("NotARealSystemXYZ123", r["error"])
        self.assertEqual(r["stops"], [])

    def test_missing_inputs_error_without_network(self):
        self.assertIn("error", self.api.plan_tourist_route("", ["Colonia"], 40))
        self.assertIn("error", self.api.plan_tourist_route("Sol", [], 40))
        self.assertIn("error", self.api.plan_tourist_route("Sol", ["  "], 40))


if __name__ == "__main__":
    unittest.main(verbosity=2)
