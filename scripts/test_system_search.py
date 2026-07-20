"""Live harness for search_star_systems (Spansh systems/search)."""
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


class TestSystemSearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = make_api()

    def test_basic_distance_sort(self):
        r = self.api.search_star_systems({"reference": "Sol", "max_distance": 20})
        self.assertNotIn("error", r)
        self.assertGreater(r["count"], 50)
        self.assertEqual(r["results"][0]["name"], "Sol")
        row = r["results"][0]
        for key in ("distance", "main_star", "allegiance", "government", "security",
                    "economy", "population", "body_count", "power", "updated"):
            self.assertIn(key, row)
        self.assertEqual(row["allegiance"], "Federation")
        self.assertTrue(row["main_star"].startswith("G"))
        self.assertTrue(row["permit"])  # Sol is permit-locked

    def test_filters_narrow(self):
        base = self.api.search_star_systems({"reference": "Sol", "max_distance": 60})
        emp = self.api.search_star_systems({"reference": "Sol", "max_distance": 60,
                                            "allegiances": ["Empire"]})
        self.assertLess(emp["count"], base["count"])
        self.assertTrue(all(x["allegiance"] == "Empire" for x in emp["results"]))

    def test_population_preset(self):
        r = self.api.search_star_systems({"reference": "Sol", "max_distance": 60,
                                          "min_population": 1_000_000_000,
                                          "sort_by": "population", "sort_dir": "desc"})
        self.assertGreater(r["count"], 0)
        self.assertTrue(all(x["population"] >= 1_000_000_000 for x in r["results"]))
        pops = [x["population"] for x in r["results"]]
        self.assertEqual(pops, sorted(pops, reverse=True))

    def test_main_star_nested_filter(self):
        r = self.api.search_star_systems({"reference": "Sol", "max_distance": 20,
                                          "main_star_subtypes": ["Neutron Star"]})
        self.assertNotIn("error", r)
        self.assertEqual(r["count"], 0)  # no neutron primaries within 20 ly of Sol
        r2 = self.api.search_star_systems({
            "reference": "Sol", "max_distance": 20,
            "main_star_subtypes": ["G (White-Yellow) Star",
                                   "G (White-Yellow super giant) Star"]})
        control = self.api.search_star_systems({"reference": "Sol", "max_distance": 20})
        self.assertGreater(r2["count"], 0)
        self.assertLess(r2["count"], control["count"])  # filter actually narrows
        names = {x["name"] for x in r2["results"]}
        self.assertIn("Sol", names)
        self.assertIn("Alpha Centauri", names)
        # NOTE: multi-star systems match on ANY main star of the class, so the
        # displayed (arrival) star can differ — most but not all rows are G
        g = sum(1 for x in r2["results"] if x["main_star"].startswith("G"))
        self.assertGreaterEqual(g / len(r2["results"]), 0.8)

    def test_case_insensitive_reference_selfheals(self):
        r = self.api.search_star_systems({"reference": "sol", "max_distance": 10})
        self.assertNotIn("error", r)
        self.assertEqual(r["reference"], "sol")  # echoed as typed
        self.assertEqual(r["results"][0]["name"], "Sol")

    def test_wildcard_name(self):
        r = self.api.search_star_systems({"reference": "Sol",
                                          "name": "Taurus Dark Region*"})
        self.assertGreater(r["count"], 1000)
        self.assertTrue(all(x["name"].startswith("Taurus Dark Region")
                            for x in r["results"]))

    def test_pagination(self):
        p0 = self.api.search_star_systems({"reference": "Sol", "max_distance": 30,
                                           "size": 10, "page": 0})
        p1 = self.api.search_star_systems({"reference": "Sol", "max_distance": 30,
                                           "size": 10, "page": 1})
        self.assertEqual(len(p0["results"]), 10)
        names0 = {x["name"] for x in p0["results"]}
        names1 = {x["name"] for x in p1["results"]}
        self.assertFalse(names0 & names1)

    def test_no_reference_error(self):
        r = self.api.search_star_systems({})
        self.assertIn("error", r)


if __name__ == "__main__":
    unittest.main(verbosity=2)
