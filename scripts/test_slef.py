"""SLEF import/export harness: parse variants, round-trip, slot naming,
engineering export rules, error cases."""
import json
import sys
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
    return api


# Krait Mk II: hardpoints [3,3,3,2,2], utility 4, core [7,6,5,4,7,6,5],
# optional [6,6,5,5,4,3,3,2,1]
LOADOUT = {
    "event": "Loadout", "Ship": "krait_mkii", "ShipName": "Testbed",
    "ShipIdent": "TB-01", "UnladenMass": 540.0,
    "Modules": [
        {"Slot": "Armour", "Item": "krait_mkii_armour_grade3", "On": True, "Priority": 1,
         "Engineering": {"BlueprintName": "Armour_HeavyDuty", "Level": 5, "Quality": 0.97,
                         "Modifiers": [{"Label": "DefenceModifierHealthMultiplier", "Value": 2.5}]}},
        {"Slot": "PowerPlant", "Item": "int_powerplant_size7_class5", "On": True, "Priority": 0},
        {"Slot": "MainEngines", "Item": "int_engine_size6_class5", "On": True, "Priority": 0,
         "Engineering": {"BlueprintName": "Engine_Dirty", "Level": 5, "Quality": 1.0,
                         "ExperimentalEffect": "special_engine_overloaded",
                         "Modifiers": [{"Label": "EngineOptimalMass", "Value": 1440.0},
                                       {"Label": "EngineOptPerformance", "Value": 137.2}]}},
        {"Slot": "FrameShiftDrive", "Item": "int_hyperdrive_size5_class5", "On": True, "Priority": 0},
        {"Slot": "LifeSupport", "Item": "int_lifesupport_size4_class2", "On": True, "Priority": 2},
        {"Slot": "PowerDistributor", "Item": "int_powerdistributor_size7_class5", "On": True, "Priority": 0},
        {"Slot": "Radar", "Item": "int_sensors_size6_class2", "On": True, "Priority": 3},
        {"Slot": "FuelTank", "Item": "int_fueltank_size5_class3", "On": True, "Priority": 1},
        {"Slot": "LargeHardpoint1", "Item": "hpt_beamlaser_gimbal_large", "On": True, "Priority": 0},
        {"Slot": "LargeHardpoint2", "Item": "hpt_multicannon_gimbal_large", "On": True, "Priority": 1},
        {"Slot": "MediumHardpoint1", "Item": "hpt_multicannon_gimbal_medium", "On": False, "Priority": 1},
        {"Slot": "TinyHardpoint1", "Item": "hpt_shieldbooster_size0_class5", "On": True, "Priority": 0},
        {"Slot": "TinyHardpoint2", "Item": "hpt_chafflauncher_tiny", "On": True, "Priority": 2},
        {"Slot": "Slot01_Size6", "Item": "int_shieldgenerator_size6_class5", "On": True, "Priority": 0},
        {"Slot": "Slot02_Size6", "Item": "int_cargorack_size6_class1", "On": True, "Priority": 1},
        {"Slot": "Slot04_Size5", "Item": "int_fuelscoop_size5_class5", "On": True, "Priority": 1},
        # non-fittable journal noise that import must skip
        {"Slot": "ShipCockpit", "Item": "krait_mkii_cockpit", "On": True, "Priority": 1},
        {"Slot": "CargoHatch", "Item": "modularcargobaydoor", "On": True, "Priority": 2},
    ],
}


class TestSlefImport(unittest.TestCase):
    def setUp(self):
        self.api = make_api()

    def test_standard_array(self):
        text = json.dumps([{"header": {"appName": "EDSY", "appVersion": 1},
                            "data": LOADOUT}])
        b = self.api.import_slef(text)
        self.assertNotIn("error", b)
        self.assertEqual(b["ship_id"], "krait_mkii")
        self.assertEqual(b["source"], "slef")
        self.assertEqual(b["bulkhead_index"], 2)
        self.assertIn("(EDSY)", b["name"])
        self.assertEqual(b["slots"]["core:pp"]["symbol"].lower(),
                         "int_powerplant_size7_class5")
        # largest-first hardpoint indexing; the size-2 MC (disabled) is last
        self.assertEqual(b["slots"]["hardpoint:2"]["symbol"].lower(),
                         "hpt_multicannon_gimbal_medium")
        self.assertFalse(b["slots"]["hardpoint:2"]["enabled"])
        # imported engineering keeps exact modifiers
        eng = b["slots"]["core:t"]["engineering"]
        self.assertEqual(eng["blueprint"], "Engine_Dirty")
        self.assertEqual(eng["modifiers"]["EngineOptimalMass"], 1440.0)

    def test_bare_loadout_and_single_object(self):
        self.assertNotIn("error", self.api.import_slef(json.dumps(LOADOUT)))
        self.assertNotIn("error", self.api.import_slef(
            json.dumps({"header": {}, "data": LOADOUT})))

    def test_errors(self):
        self.assertIn("error", self.api.import_slef("not json"))
        self.assertIn("error", self.api.import_slef("{}"))
        self.assertIn("error", self.api.import_slef(json.dumps(
            {"data": {"Ship": "madeupship", "Modules": [
                {"Slot": "PowerPlant", "Item": "int_powerplant_size2_class1"}]}})))


class TestSlefExport(unittest.TestCase):
    def setUp(self):
        self.api = make_api()
        self.build = self.api.import_slef(json.dumps(LOADOUT))
        self.assertNotIn("error", self.build)

    def test_export_shape_and_roundtrip(self):
        r = self.api.export_slef(self.build)
        self.assertNotIn("error", r)
        doc = json.loads(r["slef"])
        self.assertIsInstance(doc, list)
        self.assertEqual(doc[0]["header"]["appName"], "EDTC")
        data = doc[0]["data"]
        self.assertEqual(data["Ship"], "krait_mkii")
        self.assertEqual(data["ShipName"], "Testbed")
        self.assertEqual(data["UnladenMass"], 540.0)

        by_slot = {m["Slot"]: m for m in data["Modules"]}
        self.assertEqual(by_slot["Armour"]["Item"], "krait_mkii_armour_grade3")
        self.assertEqual(by_slot["Armour"]["Engineering"]["BlueprintName"],
                         "Armour_HeavyDuty")
        self.assertEqual(by_slot["PowerPlant"]["Item"], "int_powerplant_size7_class5")
        self.assertEqual(by_slot["LargeHardpoint1"]["Item"], "hpt_beamlaser_gimbal_large")
        # EDTC indexes hardpoints largest-slot-first, so the 3rd weapon (a
        # medium MC) exports into the 3rd large slot — legal, not the
        # original journal slot (slot assignment isn't preserved, sizes are)
        self.assertEqual(by_slot["LargeHardpoint3"]["Item"], "hpt_multicannon_gimbal_medium")
        self.assertFalse(by_slot["LargeHardpoint3"]["On"])
        self.assertEqual(by_slot["TinyHardpoint2"]["Item"], "hpt_chafflauncher_tiny")
        # optionals keep size-derived journal names
        self.assertEqual(by_slot["Slot01_Size6"]["Item"], "int_shieldgenerator_size6_class5")
        self.assertEqual(by_slot["Slot03_Size5"]["Item"], "int_fuelscoop_size5_class5")
        # engineering round-trips with modifiers + experimental
        eng = by_slot["MainEngines"]["Engineering"]
        self.assertEqual(eng["ExperimentalEffect"], "special_engine_overloaded")
        self.assertEqual({m["Label"]: m["Value"] for m in eng["Modifiers"]}
                         ["EngineOptPerformance"], 137.2)

        # full circle: EDTC's own export imports back to the same fit
        b2 = self.api.import_slef(r["slef"])
        self.assertNotIn("error", b2)
        sym = lambda b, k: (b["slots"].get(k) or {}).get("symbol", "").lower()
        for key in self.build["slots"]:
            self.assertEqual(sym(self.build, key), sym(b2, key), key)
        self.assertEqual(b2["bulkhead_index"], 2)

    def test_planned_engineering_dropped(self):
        self.build["slots"]["core:pp"]["engineering"] = {
            "blueprint": "powerplant_overcharged", "grade": 3, "modifiers": {}}
        r = self.api.export_slef(self.build)
        doc = json.loads(r["slef"])
        pp = next(m for m in doc[0]["data"]["Modules"] if m["Slot"] == "PowerPlant")
        self.assertNotIn("Engineering", pp)
        self.assertEqual(r["planned_dropped"], 1)

    def test_no_build_error(self):
        self.assertIn("error", self.api.export_slef(None))
        self.assertIn("error", self.api.export_slef({"ship_id": "x", "slots": {}}))


if __name__ == "__main__":
    unittest.main(verbosity=2)
