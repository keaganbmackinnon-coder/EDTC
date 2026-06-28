import json
import logging
import sys
import threading
import traceback
from pathlib import Path

import webview

logging.basicConfig(
    filename=Path.home() / "edtc_debug.log",
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(message)s",
)

def _log_exception(exc_type, exc_value, exc_tb):
    logging.critical("Uncaught exception", exc_info=(exc_type, exc_value, exc_tb))
    sys.__excepthook__(exc_type, exc_value, exc_tb)

sys.excepthook = _log_exception

from core.database import init_db
from core.journal import JournalWatcher
from core.overlay import OverlayManager
from core.tray import TrayIcon

BASE_DIR = Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist" / "index.html"
DEV_URL = "http://localhost:5173"

DEV_MODE = "--dev" in sys.argv

# Approximate scan values by planet class (first-discovery estimates in Cr)
_SCAN_VALUES = {
    "Earthlike body": 1_500_000,
    "Ammonia world": 700_000,
    "Water world": 450_000,
    "Metal rich body": 50_000,
    "High metal content body": 25_000,
    "Rocky ice body": 1_200,
    "Icy body": 1_000,
    "Rocky body": 1_000,
    "Sudarsky class i gas giant": 8_000,
    "Sudarsky class ii gas giant": 12_000,
    "Sudarsky class iii gas giant": 8_000,
    "Sudarsky class iv gas giant": 10_000,
    "Sudarsky class v gas giant": 10_000,
    "Gas giant with water based life": 45_000,
    "Gas giant with ammonia based life": 50_000,
    "Helium rich gas giant": 8_000,
    "Helium gas giant": 8_000,
}


def _estimate_scan_value(event: dict) -> int:
    if event.get("StarType"):
        return 0
    planet_class = event.get("PlanetClass", "").lower()
    base = next(
        (v for k, v in _SCAN_VALUES.items() if k.lower() == planet_class),
        1_000,
    )
    if event.get("TerraformState") == "Terraformable":
        base = max(base, 200_000)
    return base


class API:
    """All public methods here are callable from the frontend via window.pywebview.api"""

    def __init__(self):
        self._window = None
        self._overlay_manager = OverlayManager(
            dev_mode=DEV_MODE,
            dist_path=FRONTEND_DIST,
        )
        self._load_overlay_opacities()
        self._active_route: dict | None = None
        self._current_system: str = ""
        # exo state: (system, body, species) -> scan_count
        self._exo_state: dict[tuple, int] = {}
        self._fss_bodies: list[dict] = []
        # auto-jump state
        self._current_station: str = ""
        self._auto_jump_active: bool = False
        self._auto_jump_key: str = "j"
        self._auto_jump_delay: int = 10
        self._auto_jump_timer: threading.Timer | None = None

    def set_window(self, window):
        self._window = window
        # Load active route from DB on startup
        from core.database import get_active_route
        self._active_route = get_active_route()

    def _emit(self, event_type: str, payload: dict):
        if self._window:
            self._window.evaluate_js(
                f"window.__edtc?.onEvent({json.dumps({'type': event_type, 'payload': payload})})"
            )

    # --- Journal ---

    def on_journal_event(self, event: dict):
        self._emit("journal", event)
        event_name = event.get("event", "")

        if event_name in ("ScanBarCode", "ShipTargeted"):
            self._handle_cmdr_event(event)
        elif event_name == "FSDJump":
            self._handle_fsd_jump(event)
        elif event_name == "Location":
            self._current_system = event.get("StarSystem", "")
            self._fss_bodies = []
            self._emit("system_changed", {"system": self._current_system})
        elif event_name == "FSSDiscoveryScan":
            self._handle_fss_discovery(event)
        elif event_name == "Scan":
            self._handle_scan(event)
        elif event_name == "ScanOrganic":
            self._handle_scan_organic(event)
        elif event_name == "ColonisationContribution":
            self._handle_construction_contribution(event)
        elif event_name == "ColonisationConstructionDepot":
            self._handle_construction_depot(event)
        elif event_name == "CargoTransfer":
            self._handle_cargo_transfer(event)
        elif event_name == "CarrierStats":
            self._handle_carrier_stats(event)
        elif event_name == "CarrierJump":
            self._handle_carrier_jump(event)
        elif event_name == "CarrierJumpRequest":
            self._handle_carrier_jump_request(event)
        elif event_name == "CarrierJumpCancelled":
            self._handle_carrier_jump_cancelled(event)
        elif event_name == "CarrierDepositFuel":
            self._handle_carrier_deposit_fuel(event)
        elif event_name == "CarrierBuy":
            self._handle_carrier_buy(event)
        elif event_name == "MaterialCollected":
            self._handle_material_collected(event)
        elif event_name == "MaterialDiscarded":
            self._handle_material_discarded(event)
        elif event_name == "MaterialTrade":
            self._handle_material_trade(event)
        elif event_name == "EngineerCraft":
            self._handle_engineer_craft(event)
        elif event_name == "Synthesis":
            self._handle_synthesis_used(event)
        elif event_name == "EngineerProgress":
            self._handle_engineer_progress(event)
        elif event_name == "Commander":
            self._handle_commander(event)
        elif event_name == "LoadGame":
            self._handle_load_game(event)
        elif event_name == "Rank":
            self._handle_rank(event)
        elif event_name == "Progress":
            self._handle_progress(event)
        elif event_name == "Statistics":
            self._handle_statistics(event)
        elif event_name == "Docked":
            self._current_station = event.get("StationName", "")
            self._current_system = event.get("StarSystem", self._current_system)
        elif event_name == "MarketBuy":
            self._handle_market_buy(event)
        elif event_name == "MarketSell":
            self._handle_market_sell(event)
        elif event_name == "Powerplay":
            self._handle_powerplay(event)

    def get_journal_path(self) -> str:
        from core.journal import journal_path
        return str(journal_path())

    def _handle_cmdr_event(self, event: dict):
        cmdr = (
            event.get("PilotName_Localised")
            or event.get("PilotName")
            or event.get("TargetPilotName_Localised")
            or event.get("TargetPilotName")
            or ""
        )
        if not cmdr:
            return

        ship = (
            event.get("Ship_Localised")
            or event.get("Ship")
            or event.get("TargetShip_Localised")
            or event.get("TargetShip")
            or ""
        )

        from core.database import get_watchlist
        watchlist = {r["cmdr"].upper() for r in get_watchlist()}
        on_watchlist = bool(watchlist) and cmdr.upper() in watchlist

        # Always ping — watchlist filter can be toggled from UI pref
        ping_all = not watchlist
        if ping_all or on_watchlist:
            from core.audio import play_ping
            from core.database import get_pref
            play_ping(get_pref("ping_sound_path"))

        payload = {
            "cmdr": cmdr,
            "ship": ship,
            "on_watchlist": on_watchlist,
            "event": event.get("event"),
        }
        self._overlay_manager.show("cmdr_ping")
        self._overlay_manager.emit_to_overlay("cmdr_ping", "cmdr_detected", payload)
        self._overlay_manager.hide_after("cmdr_ping", 8)

    def _handle_fsd_jump(self, event: dict):
        system = event.get("StarSystem", "")
        self._current_system = system
        self._fss_bodies = []
        self._emit("system_changed", {"system": system})

        # Advance active route
        if self._active_route:
            systems = self._active_route.get("systems", [])
            try:
                idx = next(i for i, s in enumerate(systems) if s.lower() == system.lower())
                self._active_route["current"] = idx
                from core.database import save_route
                save_route(self._active_route)
            except StopIteration:
                pass

            self._overlay_manager.emit_to_overlay("route", "route_update", {
                "route": self._active_route,
                "current_system": system,
            })

        # System preview
        preview_payload = {
            "system": system,
            "star_class": event.get("StarClass", ""),
            "allegiance": event.get("SystemAllegiance", ""),
            "security": event.get("SystemSecurity_Localised", ""),
            "economy": event.get("SystemEconomy_Localised", ""),
            "population": event.get("Population", 0),
            "body_count": None,
        }
        self._overlay_manager.show("system_preview")
        self._overlay_manager.emit_to_overlay("system_preview", "system_jumped", preview_payload)
        self._overlay_manager.hide_after("system_preview", 15)

        if self._auto_jump_active:
            self._schedule_next_jump()

    def _schedule_next_jump(self):
        if self._auto_jump_timer:
            self._auto_jump_timer.cancel()
            self._auto_jump_timer = None

        if not self._active_route:
            self.stop_auto_jump()
            return

        systems = self._active_route.get("systems", [])
        current = self._active_route.get("current", 0)
        if current >= len(systems) - 1:
            self.stop_auto_jump()
            self._emit("auto_jump_complete", {})
            return

        next_system = systems[current + 1] if current + 1 < len(systems) else ""
        self._emit("auto_jump_countdown", {
            "seconds": self._auto_jump_delay,
            "next_system": next_system,
            "current": current,
            "total": len(systems),
        })

        def _fire():
            if not self._auto_jump_active:
                return
            try:
                import keyboard as kb
                kb.send(self._auto_jump_key)
                self._emit("auto_jump_fired", {"key": self._auto_jump_key, "next_system": next_system})
            except Exception as e:
                self._emit("auto_jump_error", {"error": str(e)})

        self._auto_jump_timer = threading.Timer(self._auto_jump_delay, _fire)
        self._auto_jump_timer.daemon = True
        self._auto_jump_timer.start()

    def _handle_fss_discovery(self, event: dict):
        payload = {
            "system": event.get("SystemName", self._current_system),
            "body_count": event.get("BodyCount", 0),
            "non_body_count": event.get("NonBodyCount", 0),
            "progress": event.get("Progress", 0),
        }
        self._overlay_manager.emit_to_overlay("system_preview", "fss_discovery", payload)

    def _handle_scan(self, event: dict):
        if event.get("StarType"):
            return
        body_name = event.get("BodyName", "")
        planet_class = event.get("PlanetClass_Localised") or event.get("PlanetClass", "")
        value = _estimate_scan_value(event)
        terraformable = event.get("TerraformState") == "Terraformable"

        body = {
            "body": body_name,
            "class": planet_class,
            "value": value,
            "terraformable": terraformable,
        }
        self._fss_bodies.append(body)

        self._overlay_manager.emit_to_overlay("fss", "body_scanned", {
            "body": body,
            "all_bodies": self._fss_bodies,
        })
        self._emit("scan_update", {"body": body, "all_bodies": self._fss_bodies})

    def _handle_scan_organic(self, event: dict):
        scan_type = event.get("ScanType", "")
        species = event.get("Species_Localised") or event.get("Species", "")
        genus = event.get("Genus_Localised") or event.get("Genus", "")
        body_id = str(event.get("Body", ""))
        system = self._current_system

        key = (system, body_id, species)
        current_count = self._exo_state.get(key, 0)

        if scan_type == "Analysed":
            current_count = min(current_count + 1, 3)
        elif scan_type == "StartScan" and current_count == 0:
            current_count = 0  # just tracking that a scan started

        self._exo_state[key] = current_count

        from core.database import upsert_exo_scan
        upsert_exo_scan(system, body_id, species, genus, current_count)

        payload = {
            "system": system,
            "body": body_id,
            "species": species,
            "genus": genus,
            "scan_count": current_count,
            "completed": current_count >= 3,
            "scan_type": scan_type,
        }
        self._emit("exo_scan", payload)
        self._overlay_manager.show("exo_tracker")
        self._overlay_manager.emit_to_overlay("exo_tracker", "exo_scan", payload)

    def _handle_construction_contribution(self, event: dict):
        contributions = event.get("Contributions", [])
        if not contributions:
            return
        from core.database import record_construction_contribution
        updated = record_construction_contribution(self._current_system, contributions)
        if updated:
            for proj in updated:
                self._overlay_manager.emit_to_overlay("construction", "construction_update", proj)
                self._emit("construction_update", proj)

    def _handle_construction_depot(self, event: dict):
        # ColonisationConstructionDepot fires when docking at a construction site
        # It may contain ResourcesRequired field with needed commodities
        resources = event.get("ResourcesRequired", [])
        if resources:
            self._emit("construction_depot", {
                "system": self._current_system,
                "resources": resources,
            })

    def _handle_cargo_transfer(self, event: dict):
        transfers = event.get("Transfers", [])
        if not transfers:
            return
        from core.database import update_fc_cargo_transfer
        updated = update_fc_cargo_transfer(transfers)
        self._emit("fc_cargo_update", {"cargo": updated})

    def _handle_carrier_stats(self, event: dict):
        from core.database import upsert_carrier
        carrier = upsert_carrier(event)
        self._emit("carrier_update", {"carrier": carrier})

    def _handle_carrier_jump(self, event: dict):
        from core.database import upsert_carrier
        carrier = upsert_carrier({
            "CarrierID": event.get("CarrierID"),
            "location": event.get("StarSystem", ""),
            "pending_jump": "",
        })
        self._emit("carrier_update", {"carrier": carrier})

    def _handle_carrier_jump_request(self, event: dict):
        from core.database import upsert_carrier
        carrier = upsert_carrier({
            "CarrierID": event.get("CarrierID"),
            "pending_jump": event.get("SystemName", ""),
        })
        self._emit("carrier_update", {"carrier": carrier})

    def _handle_carrier_jump_cancelled(self, event: dict):
        from core.database import upsert_carrier
        carrier = upsert_carrier({
            "CarrierID": event.get("CarrierID"),
            "pending_jump": "",
        })
        self._emit("carrier_update", {"carrier": carrier})

    def _handle_carrier_deposit_fuel(self, event: dict):
        from core.database import upsert_carrier
        carrier = upsert_carrier({
            "CarrierID": event.get("CarrierID"),
            "FuelLevel": event.get("Total", 0),
        })
        self._emit("carrier_update", {"carrier": carrier})

    def _handle_carrier_buy(self, event: dict):
        from core.database import upsert_carrier
        carrier = upsert_carrier({
            "CarrierID": event.get("CarrierID") or event.get("BoughtAtMarket"),
            "Callsign": event.get("Callsign", ""),
            "location": event.get("Location", ""),
        })
        self._emit("carrier_update", {"carrier": carrier})

    def _handle_material_collected(self, event: dict):
        from core.database import upsert_material
        name = event.get("Name_Localised") or event.get("Name", "")
        cat = event.get("Category", "")
        count = int(event.get("Count", 1))
        if name:
            upsert_material(name, cat, count)
            self._emit("material_update", {"name": name, "category": cat, "delta": count})

    def _handle_material_discarded(self, event: dict):
        from core.database import upsert_material
        name = event.get("Name_Localised") or event.get("Name", "")
        cat = event.get("Category", "")
        count = int(event.get("Count", 1))
        if name:
            upsert_material(name, cat, -count)
            self._emit("material_update", {"name": name, "category": cat, "delta": -count})

    def _handle_material_trade(self, event: dict):
        from core.database import upsert_material
        paid = event.get("Paid", {})
        received = event.get("Received", {})
        if paid:
            name = paid.get("Material_Localised") or paid.get("Material", "")
            cat = paid.get("Category", "")
            qty = int(paid.get("Quantity", 0))
            if name:
                upsert_material(name, cat, -qty)
        if received:
            name = received.get("Material_Localised") or received.get("Material", "")
            cat = received.get("Category", "")
            qty = int(received.get("Quantity", 0))
            if name:
                upsert_material(name, cat, qty)
        self._emit("materials_changed", {})

    def _handle_engineer_craft(self, event: dict):
        from core.database import upsert_material
        for ing in event.get("Ingredients", []):
            name = ing.get("Name_Localised") or ing.get("Name", "")
            count = int(ing.get("Count", 1))
            if name:
                upsert_material(name, "", -count)
        self._emit("materials_changed", {})

    def _handle_synthesis_used(self, event: dict):
        from core.database import upsert_material
        for mat in event.get("Materials", []):
            name = mat.get("Name_Localised") or mat.get("Name", "")
            count = int(mat.get("Count", 1))
            if name:
                upsert_material(name, "", -count)
        self._emit("materials_changed", {})

    def _handle_engineer_progress(self, event: dict):
        from core.database import upsert_engineer_progress
        if "Engineer" in event and "Engineers" not in event:
            upsert_engineer_progress(
                event.get("Engineer", ""),
                event.get("Progress", ""),
                event.get("Rank", 0),
            )
        for eng in event.get("Engineers", []):
            upsert_engineer_progress(
                eng.get("Engineer", ""),
                eng.get("Progress", ""),
                eng.get("Rank", 0),
            )
        self._emit("engineer_progress_update", {})

    def _handle_market_buy(self, event: dict):
        commodity = event.get("Type_Localised") or event.get("Type", "")
        quantity = int(event.get("Count", 0))
        price = int(event.get("BuyPrice", 0))
        total = int(event.get("TotalCost", price * quantity))
        from core.database import add_trade_entry
        entry = add_trade_entry("buy", commodity, quantity, price, total, 0,
                                self._current_station, self._current_system)
        self._emit("trade_log_update", {"entry": entry})

    def _handle_market_sell(self, event: dict):
        commodity = event.get("Type_Localised") or event.get("Type", "")
        quantity = int(event.get("Count", 0))
        price = int(event.get("SellPrice", 0))
        total = int(event.get("TotalSale", price * quantity))
        profit = int(event.get("Profit", 0))
        from core.database import add_trade_entry
        entry = add_trade_entry("sell", commodity, quantity, price, total, profit,
                                self._current_station, self._current_system)
        self._emit("trade_log_update", {"entry": entry})

    def _handle_commander(self, event: dict):
        from core.database import set_cmdr_stat
        name = event.get("Name", "")
        if name:
            set_cmdr_stat("name", name)
        self._emit("cmdr_stats_update", {})

    def _handle_load_game(self, event: dict):
        from core.database import set_cmdr_stat
        if event.get("Credits") is not None:
            set_cmdr_stat("credits", event["Credits"])
        if event.get("Ship"):
            set_cmdr_stat("ship", event.get("Ship_Localised") or event["Ship"])
        if event.get("ShipIdent"):
            set_cmdr_stat("ship_ident", event["ShipIdent"])
        if event.get("ShipName"):
            set_cmdr_stat("ship_name", event["ShipName"])
        if event.get("GameMode"):
            set_cmdr_stat("gamemode", event["GameMode"])
        if event.get("FuelLevel") is not None:
            set_cmdr_stat("fuel_level", event["FuelLevel"])
        if event.get("FuelCapacity") is not None:
            set_cmdr_stat("fuel_capacity", event["FuelCapacity"])
        self._emit("cmdr_stats_update", {})

    def _handle_rank(self, event: dict):
        from core.database import set_cmdr_stat
        ranks = {k: v for k, v in event.items() if k != "event" and k != "timestamp"}
        if ranks:
            set_cmdr_stat("ranks", ranks)
        self._emit("cmdr_stats_update", {})

    def _handle_progress(self, event: dict):
        from core.database import set_cmdr_stat
        progress = {k: v for k, v in event.items() if k != "event" and k != "timestamp"}
        if progress:
            set_cmdr_stat("rank_progress", progress)
        self._emit("cmdr_stats_update", {})

    def _handle_statistics(self, event: dict):
        from core.database import set_cmdr_stat
        stats = {k: v for k, v in event.items() if k not in ("event", "timestamp")}
        if stats:
            set_cmdr_stat("statistics", stats)
        self._emit("cmdr_stats_update", {})

    def _handle_powerplay(self, event: dict):
        from core.database import set_pref
        set_pref("pp_power",   event.get("Power", ""))
        set_pref("pp_rank",    event.get("Rank", 0))
        set_pref("pp_merits",  event.get("Merits", 0))
        set_pref("pp_votes",   event.get("Votes", 0))
        set_pref("pp_updated", event.get("timestamp", ""))
        self._emit("powerplay_update", {
            "power":   event.get("Power", ""),
            "rank":    event.get("Rank", 0),
            "merits":  event.get("Merits", 0),
            "votes":   event.get("Votes", 0),
            "updated": event.get("timestamp", ""),
        })

    # --- Builds ---

    def get_builds(self) -> list:
        from core.database import get_builds
        return get_builds()

    def save_build(self, build: dict) -> dict:
        from core.database import save_build
        return save_build(build)

    def delete_build(self, build_id: int) -> bool:
        from core.database import delete_build
        return delete_build(build_id)

    # --- Routes ---

    def get_routes(self) -> list:
        from core.database import get_routes
        return get_routes()

    def save_route(self, route: dict) -> dict:
        from core.database import save_route
        return save_route(route)

    def set_active_route(self, route_id: int) -> bool:
        from core.database import set_active_route, get_active_route
        set_active_route(route_id)
        self._active_route = get_active_route()
        if self._active_route:
            self._overlay_manager.show("route")
            self._overlay_manager.emit_to_overlay("route", "route_update", {
                "route": self._active_route,
                "current_system": self._current_system,
            })
        return True

    def get_active_route(self) -> dict | None:
        return self._active_route

    def advance_route(self) -> dict | None:
        if not self._active_route:
            return None
        systems = self._active_route.get("systems", [])
        current = self._active_route.get("current", 0)
        new_idx = min(current + 1, len(systems) - 1)
        self._active_route["current"] = new_idx
        from core.database import save_route
        save_route(self._active_route)
        self._overlay_manager.emit_to_overlay("route", "route_update", {
            "route": self._active_route,
            "current_system": self._current_system,
        })
        return self._active_route

    def copy_next_destination(self) -> bool:
        if not self._active_route:
            return False
        systems = self._active_route.get("systems", [])
        current = self._active_route.get("current", 0)
        next_idx = current + 1
        if next_idx >= len(systems):
            return False
        try:
            import pyperclip
            pyperclip.copy(systems[next_idx])
            return True
        except Exception:
            return False

    # --- Prefs ---

    def get_pref(self, key: str, default=None):
        from core.database import get_pref
        return get_pref(key, default)

    def set_pref(self, key: str, value) -> bool:
        from core.database import set_pref
        return set_pref(key, value)

    # --- Overlays ---

    def _load_overlay_opacities(self):
        from core.database import get_pref
        names = ["cmdr_ping", "route", "fss", "system_preview", "exo_tracker", "construction"]
        for name in names:
            val = get_pref(f"overlay_opacity_{name}", 1.0)
            try:
                self._overlay_manager.load_opacity(name, float(val))
            except Exception:
                pass

    def show_overlay(self, name: str):
        self._overlay_manager.show(name)

    def hide_overlay(self, name: str):
        self._overlay_manager.hide(name)

    def toggle_overlay(self, name: str):
        self._overlay_manager.toggle(name)

    def get_overlay_states(self) -> dict:
        from core.database import get_pref
        names = ["cmdr_ping", "route", "fss", "system_preview", "exo_tracker", "construction"]
        return {
            name: {
                "shown": self._overlay_manager.is_shown(name),
                "opacity": float(get_pref(f"overlay_opacity_{name}", 1.0)),
            }
            for name in names
        }

    def set_overlay_opacity(self, name: str, value: float) -> None:
        from core.database import set_pref
        self._overlay_manager.set_opacity(name, value)
        set_pref(f"overlay_opacity_{name}", value)

    # --- Watchlist ---

    def get_watchlist(self) -> list:
        from core.database import get_watchlist
        return get_watchlist()

    def add_to_watchlist(self, cmdr: str, note: str = "") -> dict:
        from core.database import add_to_watchlist
        return add_to_watchlist(cmdr, note)

    def remove_from_watchlist(self, cmdr: str) -> bool:
        from core.database import remove_from_watchlist
        return remove_from_watchlist(cmdr)

    # --- Exobiology ---

    def get_exo_scans(self, system: str | None = None) -> list:
        from core.database import get_exo_scans
        return get_exo_scans(system)

    def clear_exo_scans(self, system: str) -> bool:
        from core.database import clear_exo_scans_for_system
        return clear_exo_scans_for_system(system)

    # --- Construction ---

    def get_construction_projects(self, active_only: bool = True) -> list:
        from core.database import get_construction_projects
        return get_construction_projects(active_only)

    def save_construction_project(self, project: dict) -> dict:
        from core.database import save_construction_project
        saved = save_construction_project(project)
        self._overlay_manager.emit_to_overlay("construction", "construction_update", saved)
        return saved

    def delete_construction_project(self, project_id: int) -> bool:
        from core.database import delete_construction_project
        return delete_construction_project(project_id)

    # --- FC Cargo ---

    def get_fc_cargo(self) -> list:
        from core.database import get_fc_cargo
        return get_fc_cargo()

    def set_fc_cargo(self, items: list) -> list:
        from core.database import set_fc_cargo_items
        updated = set_fc_cargo_items(items)
        self._emit("fc_cargo_update", {"cargo": updated})
        return updated

    def clear_fc_cargo(self) -> bool:
        from core.database import set_fc_cargo_items
        set_fc_cargo_items([])
        self._emit("fc_cargo_update", {"cargo": []})
        return True

    # --- Fleet Carriers ---

    def get_carriers(self) -> list:
        from core.database import get_carriers
        return get_carriers()

    def plan_fc_route(self, origin: str, destination: str) -> dict:
        import asyncio
        from api.spansh import SpanshAPI
        async def _run():
            spansh = SpanshAPI()
            try:
                jumps = await spansh.fleet_carrier_route(origin, destination)
                total_dist = sum(j.get("distance_jumped", j.get("distance", 0)) for j in jumps)
                return {
                    "jumps": jumps,
                    "total_jumps": len(jumps),
                    "total_distance": round(total_dist, 1),
                }
            finally:
                await spansh.close()
        try:
            return asyncio.run(_run())
        except Exception as e:
            return {"error": str(e), "jumps": [], "total_jumps": 0, "total_distance": 0}

    # --- Auto-Jump ---

    def start_auto_jump(self, key: str = "j", delay: int = 10) -> dict:
        self._auto_jump_active = True
        self._auto_jump_key = key
        self._auto_jump_delay = max(3, int(delay))
        status = {"active": True, "key": key, "delay": self._auto_jump_delay}
        self._emit("auto_jump_status", status)
        return status

    def stop_auto_jump(self) -> dict:
        self._auto_jump_active = False
        if self._auto_jump_timer:
            self._auto_jump_timer.cancel()
            self._auto_jump_timer = None
        status = {"active": False}
        self._emit("auto_jump_status", status)
        return status

    def get_auto_jump_status(self) -> dict:
        return {
            "active": self._auto_jump_active,
            "key": self._auto_jump_key,
            "delay": self._auto_jump_delay,
        }

    # --- Engineering (static data loaders) ---

    def _load_json(self, filename: str) -> dict:
        try:
            import json
            return json.loads((BASE_DIR / "data" / filename).read_text(encoding="utf-8"))
        except Exception:
            return {}

    def get_engineers(self) -> list:
        from core.database import get_engineer_progress
        progress = get_engineer_progress()
        engineers = self._load_json("engineers.json").get("engineers", [])
        for e in engineers:
            p = progress.get(e.get("name", ""), {})
            e["progress_status"] = p.get("status", "")
            e["progress_rank"] = p.get("rank", 0)
        return engineers

    def get_blueprints(self) -> list:
        return self._load_json("blueprints.json").get("blueprints", [])

    def get_synthesis_recipes(self) -> list:
        return self._load_json("synthesis.json").get("synthesis", [])

    def get_tech_broker_items(self) -> list:
        return self._load_json("tech_brokers.json").get("items", [])

    def get_materials(self) -> list:
        from core.database import get_materials
        return get_materials()

    def set_material_count(self, name: str, category: str, count: int) -> None:
        from core.database import set_material_count
        set_material_count(name, category, count)
        self._emit("materials_changed", {})

    def search_commodity_markets(self, system: str, commodity: str) -> list:
        import asyncio
        from api.spansh import SpanshAPI
        async def _run():
            spansh = SpanshAPI()
            try:
                return await spansh.commodity_markets(system, commodity)
            finally:
                await spansh.close()
        try:
            return asyncio.run(_run())
        except Exception:
            return []

    # --- Exploration ---

    def get_fss_bodies(self) -> list:
        return self._fss_bodies

    def lookup_system(self, name: str) -> dict:
        import asyncio
        from api.edsm import EdsmAPI
        async def _run():
            edsm = EdsmAPI()
            try:
                system = await edsm.get_system(name)
                bodies = await edsm.get_bodies(name)
                return {
                    "system": {
                        "name": system.name,
                        "coords": system.coords,
                        "id64": system.id64,
                        "allegiance": system.allegiance,
                        "government": system.government,
                        "economy": system.economy,
                        "population": system.population,
                        "security": system.security,
                    } if system else None,
                    "bodies": [
                        {
                            "name": b.name,
                            "type": b.type,
                            "sub_type": b.sub_type,
                            "distance": b.distance_to_arrival,
                            "is_main_star": b.is_main_star,
                            "spectral_class": b.spectral_class,
                            "earth_masses": b.earth_masses,
                            "radius": b.radius,
                        }
                        for b in bodies
                    ],
                }
            finally:
                await edsm.close()
        try:
            return asyncio.run(_run())
        except Exception as e:
            return {"error": str(e), "system": None, "bodies": []}

    def road_to_riches(
        self, origin: str, destination: str, range_ly: float, max_systems: int = 100
    ) -> dict:
        import asyncio
        from api.spansh import SpanshAPI
        async def _run():
            spansh = SpanshAPI()
            try:
                systems = await spansh.road_to_riches(origin, destination, range_ly, max_systems)
                return {"systems": systems}
            finally:
                await spansh.close()
        try:
            return asyncio.run(_run())
        except Exception as e:
            return {"error": str(e), "systems": []}

    # --- Commander ---

    def lookup_commander(self, cmdr_name: str) -> dict:
        import asyncio
        from api.edsm import EdsmAPI
        async def _run():
            edsm = EdsmAPI()
            try:
                return await edsm.get_commander(cmdr_name)
            finally:
                await edsm.close()
        try:
            result = asyncio.run(_run())
            return result or {"error": "Commander not found or profile not public"}
        except Exception as e:
            return {"error": str(e)}

    def get_cmdr_stats(self) -> dict:
        from core.database import get_cmdr_stats
        return get_cmdr_stats()

    def get_current_system(self) -> str:
        return self._current_system

    def get_logbook(self) -> list:
        from core.database import get_logbook
        return get_logbook()

    def save_log_entry(self, entry: dict) -> dict:
        from core.database import save_log_entry
        return save_log_entry(entry)

    def delete_log_entry(self, entry_id: int) -> bool:
        from core.database import delete_log_entry
        return delete_log_entry(entry_id)

    def get_screenshots(self) -> list:
        import os
        from pathlib import Path
        folder = Path(os.environ.get("USERPROFILE", "~")) / "Pictures" / "Frontier Developments" / "Elite Dangerous"
        if not folder.exists():
            return []
        files = []
        for f in sorted(folder.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if f.suffix.lower() in (".png", ".jpg", ".bmp"):
                files.append({
                    "name": f.name,
                    "path": str(f),
                    "modified": f.stat().st_mtime,
                })
        return files[:100]

    def open_file(self, path: str) -> bool:
        try:
            import os
            os.startfile(path)
            return True
        except Exception:
            return False

    def open_screenshots_folder(self) -> bool:
        import os
        from pathlib import Path
        folder = Path(os.environ.get("USERPROFILE", "~")) / "Pictures" / "Frontier Developments" / "Elite Dangerous"
        folder.mkdir(parents=True, exist_ok=True)
        try:
            os.startfile(str(folder))
            return True
        except Exception:
            return False

    # --- Trading ---

    def get_trade_log(self) -> list:
        from core.database import get_trade_log
        return get_trade_log()

    def clear_trade_log(self) -> bool:
        from core.database import clear_trade_log
        return clear_trade_log()

    def find_nearest_service(self, system: str, service: str) -> dict:
        import asyncio
        from api.spansh import SpanshAPI
        async def _run():
            spansh = SpanshAPI()
            try:
                return await spansh.nearest_with_service(system, service)
            finally:
                await spansh.close()
        try:
            result = asyncio.run(_run())
            return result or {"error": "No result found"}
        except Exception as e:
            return {"error": str(e)}

    def get_commodities(self) -> list:
        return self._load_json("commodities.json").get("commodities", [])

    # --- Guardian ---

    def get_guardian_sites(self) -> dict:
        from core.database import get_guardian_visits
        visits = get_guardian_visits()
        data = self._load_json("guardian_sites.json")
        ruins = data.get("ruins", [])
        structures = data.get("structures", [])
        for site in ruins + structures:
            v = visits.get(site["id"], {})
            site["visited"] = bool(v.get("visited", 0))
            site["data_collected"] = bool(v.get("data_collected", 0))
            site["notes"] = v.get("notes", "")
        return {"ruins": ruins, "structures": structures}

    def set_guardian_visit(
        self, site_id: str, visited: bool, data_collected: bool, notes: str = ""
    ) -> bool:
        from core.database import set_guardian_visit
        set_guardian_visit(site_id, visited, data_collected, notes)
        return True

    # --- Galaxy ---

    def _edsm_run(self, coro_factory):
        import asyncio
        from api.edsm import EdsmAPI
        async def _run():
            edsm = EdsmAPI()
            try:
                return await coro_factory(edsm)
            finally:
                await edsm.close()
        try:
            return asyncio.run(_run())
        except Exception as e:
            return {"error": str(e)}

    def get_galnet(self) -> list:
        result = self._edsm_run(lambda e: e.get_news())
        return result if isinstance(result, list) else []

    def get_system_factions(self, system_name: str) -> dict:
        return self._edsm_run(lambda e: e.get_factions(system_name))

    def get_system_traffic(self, system_name: str) -> dict:
        return self._edsm_run(lambda e: e.get_traffic(system_name))

    def get_galaxy_stats(self) -> dict:
        result = self._edsm_run(lambda e: e.get_stats())
        return result if isinstance(result, dict) else {}

    def get_community_goals(self) -> list:
        result = self._edsm_run(lambda e: e.get_community_goals())
        return result if isinstance(result, list) else []

    def get_powerplay_status(self) -> dict:
        from core.database import get_pref
        return {
            "power":   get_pref("pp_power", ""),
            "rank":    get_pref("pp_rank", 0),
            "merits":  get_pref("pp_merits", 0),
            "votes":   get_pref("pp_votes", 0),
            "updated": get_pref("pp_updated", ""),
        }

    def get_system_power(self, system_name: str) -> dict:
        return self._edsm_run(lambda e: e.get_system_power(system_name)) or {}

    # --- Thargoid War ---

    def get_thargoid_system(self, system_name: str) -> dict:
        return self._edsm_run(lambda e: e.get_system_thargoid(system_name)) or {}

    def get_thargoid_nearby(self, system_name: str, radius: int = 50) -> list:
        async def _run():
            edsm = self._edsm
            systems = await edsm.get_systems_in_sphere(system_name, radius) or []
            result = []
            for s in systems:
                info = s.get("information") or {}
                state = (info.get("factionState") or "").lower()
                allegiance = (info.get("allegiance") or "").lower()
                if "thargoid" in state or "thargoid" in allegiance:
                    result.append({
                        "name": s.get("name", ""),
                        "distance": s.get("distance", 0),
                        "state": info.get("factionState", ""),
                        "allegiance": info.get("allegiance", ""),
                        "population": info.get("population", 0),
                        "coords": s.get("coords", {}),
                    })
            return sorted(result, key=lambda x: x.get("distance", 0))
        return self._edsm_run(_run)

    # --- Clipboard ---

    def copy_to_clipboard(self, text: str) -> bool:
        try:
            import pyperclip
            pyperclip.copy(text)
            return True
        except Exception:
            return False

    # --- App ---

    def get_version(self) -> str:
        return "0.1.0"

    def get_app_info(self) -> dict:
        return {
            "version": "0.1.0",
            "name": "EDTC",
            "dev_mode": DEV_MODE,
        }


def _setup_hotkeys(api: API):
    try:
        import keyboard
        keyboard.add_hotkey("ctrl+shift+c", api.copy_next_destination)
    except Exception:
        pass


def _create_desktop_shortcut():
    if not getattr(sys, "frozen", False):
        return
    import os, subprocess
    exe = sys.executable
    marker = Path(exe).parent / ".shortcut_created"
    if marker.exists():
        return
    ps = (
        "$ws = New-Object -ComObject WScript.Shell;"
        f"$sc = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\\\\EDTC.lnk');"
        f"$sc.TargetPath = '{exe}';"
        f"$sc.WorkingDirectory = '{os.path.dirname(exe)}';"
        f"$sc.IconLocation = '{exe},0';"
        "$sc.Description = 'Elite Dangerous Tools & Companion';"
        "$sc.Save()"
    )
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                       capture_output=True, timeout=10)
        marker.touch()
    except Exception:
        pass


def main():
    init_db()
    _create_desktop_shortcut()

    api = API()

    url = DEV_URL if DEV_MODE else FRONTEND_DIST.as_uri()

    window = webview.create_window(
        title="EDTC — Elite Dangerous Tools & Companion",
        url=url,
        js_api=api,
        width=1280,
        height=800,
        min_size=(900, 600),
    )
    api.set_window(window)

    watcher = JournalWatcher(on_event=api.on_journal_event)
    threading.Thread(target=watcher.run, daemon=True).start()

    tray = TrayIcon(
        on_show=window.show,
        on_hide=window.hide,
        on_quit=lambda: webview.windows[0].destroy(),
    )
    threading.Thread(target=tray.run, daemon=True).start()

    threading.Thread(target=_setup_hotkeys, args=(api,), daemon=True).start()

    webview.start(debug=DEV_MODE)


if __name__ == "__main__":
    main()
