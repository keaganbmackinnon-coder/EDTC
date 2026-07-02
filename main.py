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

APP_VERSION = "0.3.34"  # bump this with every release

logging.info(f"EDTC starting — version {APP_VERSION}, frozen={getattr(sys, 'frozen', False)}")

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
        self._current_ship: dict = {}
        self._ship_cargo: list[dict] = []
        # ColonisationConstructionDepot re-fires every few seconds while docked
        # at a construction site — remember the last payload to skip no-op re-fires
        self._last_depot_key: tuple | None = None

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
            coords = event.get("StarPos")
            if coords and len(coords) == 3:
                from core.database import upsert_system_coords
                upsert_system_coords(self._current_system, coords[0], coords[1], coords[2])
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
        elif event_name == "Materials":
            self._handle_materials(event)
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
        elif event_name == "NavRoute":
            self._handle_nav_route(event)
        elif event_name == "NavRouteClear":
            self._handle_nav_route_clear()
        elif event_name == "Loadout":
            self._handle_loadout(event)
        elif event_name == "Market":
            self._import_market_json()
        elif event_name == "Cargo":
            self._handle_cargo(event)

    def _import_market_json(self):
        from core.journal import journal_path
        market_file = journal_path() / "Market.json"
        if not market_file.exists():
            return
        try:
            data = json.loads(market_file.read_text(encoding="utf-8"))
            system = data.get("StarSystem", "")
            station = data.get("StationName", "")
            timestamp = data.get("timestamp", "")
            items = data.get("Items", [])
            if not (system and station and items):
                return
            commodities = []
            for item in items:
                if item.get("Rare", False):
                    continue
                raw = item.get("Name", "")
                name = raw.lstrip("$").split("_name;")[0] if raw else ""
                if not name:
                    continue
                commodities.append({
                    "name": name,
                    "buyPrice": item.get("BuyPrice", 0),
                    "sellPrice": item.get("SellPrice", 0),
                    "stock": item.get("Stock", 0),
                    "demand": item.get("Demand", 0),
                })
            if commodities:
                from core.database import upsert_market_data
                upsert_market_data(system, station, timestamp, commodities)
                logging.info(f"Market.json: {len(commodities)} commodities from {station} / {system}")
        except Exception as e:
            logging.warning(f"Market.json import error: {e}")

    def _import_cargo_json(self):
        from core.journal import journal_path
        cargo_file = journal_path() / "Cargo.json"
        if not cargo_file.exists():
            logging.info("Cargo.json: file not found")
            return
        try:
            data = json.loads(cargo_file.read_text(encoding="utf-8"))
            vessel = data.get("Vessel", "Ship")
            inventory = data.get("Inventory", [])
            logging.info(f"Cargo.json: vessel={vessel}, items={len(inventory)}, names={[i.get('Name_Localised') or i.get('Name') for i in inventory[:5]]}")
            if vessel != "Ship":
                logging.info(f"Cargo.json: skipping non-ship vessel ({vessel})")
                return
            self._ship_cargo = inventory
            payload = {"cargo": self._ship_cargo}
            self._emit("ship_cargo_update", payload)
            self._overlay_manager.emit_to_overlay("construction", "ship_cargo_update", payload)
        except Exception as e:
            logging.warning(f"Cargo.json import error: {e}")

    def _handle_cargo(self, event: dict):
        if event.get("Vessel", "Ship") != "Ship":
            return
        self._ship_cargo = event.get("Inventory", [])
        payload = {"cargo": self._ship_cargo}
        self._emit("ship_cargo_update", payload)
        self._overlay_manager.emit_to_overlay("construction", "ship_cargo_update", payload)
        logging.info(f"Cargo event: {len(self._ship_cargo)} items")

    def get_ship_cargo(self) -> list:
        if not self._ship_cargo:
            self._import_cargo_json()
        return self._ship_cargo

    def _push_cargo_to_overlay(self):
        """Push current ship cargo and the active project for the current system
        to the construction overlay after it has time to initialize — otherwise the
        overlay stays empty until the next dock/contribution event fires this session."""
        def _push():
            import time
            time.sleep(2.5)
            payload = {"cargo": self._ship_cargo}
            self._overlay_manager.emit_to_overlay("construction", "ship_cargo_update", payload)
            logging.info(f"Pushed cargo to overlay: {len(self._ship_cargo)} items")
            if self._current_system:
                from core.database import get_construction_projects
                projects = get_construction_projects(active_only=True)
                match = next((p for p in projects if p.get("system", "").lower() == self._current_system.lower()), None)
                if match:
                    self._overlay_manager.emit_to_overlay("construction", "construction_update", match)
                    logging.info(f"Pushed construction project to overlay: {match.get('name')}")
        threading.Thread(target=_push, daemon=True).start()

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

        coords = event.get("StarPos")
        if coords and len(coords) == 3:
            from core.database import upsert_system_coords
            upsert_system_coords(system, coords[0], coords[1], coords[2])

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
        if self._overlay_manager.is_user_enabled("system_preview"):
            self._overlay_manager.show("system_preview")
            self._overlay_manager.emit_to_overlay("system_preview", "system_jumped", preview_payload)
            self._overlay_manager.hide_after("system_preview", 15)

        self._overlay_manager.emit_to_overlay("fss", "system_jumped", {})
        self._overlay_manager.emit_to_overlay("exo_tracker", "system_jumped", {})

        if self._auto_jump_active:
            self._schedule_next_jump()

    def _handle_nav_route(self, event: dict):
        raw = event.get("Route", [])
        if not raw:
            return
        systems = [s["StarSystem"] for s in raw if "StarSystem" in s]
        if not systems:
            return
        route = {"systems": systems, "current": 0, "name": f"In-game route → {systems[-1]}"}
        from core.database import save_route
        save_route(route)
        self._active_route = route
        if self._overlay_manager.is_user_enabled("route"):
            self._overlay_manager.show("route")
        self._overlay_manager.emit_to_overlay("route", "route_update", {
            "route": route,
            "current_system": self._current_system,
        })
        self._emit("route_update", {"route": route, "current_system": self._current_system})

    def _handle_nav_route_clear(self):
        self._active_route = None
        self._overlay_manager.emit_to_overlay("route", "route_update", {
            "route": None,
            "current_system": self._current_system,
        })
        self._emit("route_update", {"route": None, "current_system": self._current_system})

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
        # Refresh ship cargo — delivered goods leave the hold
        self._import_cargo_json()

    def _handle_construction_depot(self, event: dict):
        resources = event.get("ResourcesRequired", [])
        key = (
            event.get("MarketID"),
            event.get("ConstructionProgress"),
            tuple((r.get("Name"), r.get("ProvidedAmount")) for r in resources),
        )
        if key == self._last_depot_key:
            return
        self._last_depot_key = key
        if resources:
            self._emit("construction_depot", {
                "system": self._current_system,
                "station": self._current_station,
                "progress": event.get("ConstructionProgress", 0.0),
                "complete": event.get("ConstructionComplete", False),
                "resources": resources,
            })
            from core.database import sync_construction_depot
            project = sync_construction_depot(self._current_system, resources)
            if project:
                self._overlay_manager.emit_to_overlay("construction", "construction_update", project)
                self._emit("construction_update", project)

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

    def _handle_materials(self, event: dict):
        """'Materials' fires at every login with exact Raw/Manufactured/Encoded
        counts — resync the whole table so delta-tracking drift is cleared."""
        from core.database import sync_materials
        rows = []
        for category in ("Raw", "Manufactured", "Encoded"):
            for m in event.get(category, []):
                name = (m.get("Name_Localised") or m.get("Name", "")).lower()
                if name:
                    rows.append((name, category, int(m.get("Count", 0))))
        if not rows:
            return
        sync_materials(rows)
        logging.info(f"Materials resync: {len(rows)} materials from journal snapshot")
        self._emit("materials_changed", {})

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

    # Guardian FSD Booster adds a flat range bonus (ly) that doesn't scale with mass.
    _GUARDIAN_BOOSTER_BONUS = {1: 4.0, 2: 6.0, 3: 7.75, 4: 9.25, 5: 10.5}

    def _handle_loadout(self, event: dict):
        ship_type = event.get("Ship_Localised") or event.get("Ship", "")
        fuel = event.get("FuelCapacity", {})

        guardian_bonus = 0.0
        for module in (event.get("Modules") or []):
            item = module.get("Item", "").lower()
            if "guardianfsdbooster" in item:
                for part in item.split("_"):
                    if part.startswith("size"):
                        try:
                            guardian_bonus = self._GUARDIAN_BOOSTER_BONUS.get(int(part[4:]), 0.0)
                        except ValueError:
                            pass
                break

        self._current_ship = {
            "ship": ship_type,
            "ship_name": event.get("ShipName", ""),
            "ship_ident": event.get("ShipIdent", ""),
            "max_jump_range": event.get("MaxJumpRange"),
            "unladen_mass": event.get("UnladenMass"),
            "fuel_capacity": fuel.get("Main") if isinstance(fuel, dict) else fuel,
            "cargo_capacity": event.get("CargoCapacity"),
            "guardian_booster_bonus": guardian_bonus,
        }
        self._emit("ship_changed", self.get_ship_info())

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
            enabled = get_pref(f"overlay_auto_{name}", False)
            self._overlay_manager.load_user_enabled(name, bool(enabled))

    def resize_overlay(self, name: str, width: int, height: int) -> None:
        win = self._overlay_manager._windows.get(name)
        if win:
            try:
                win.resize(int(width), int(height))
            except Exception as e:
                logging.warning(f"resize_overlay {name}: {e}")

    def show_overlay(self, name: str):
        self._overlay_manager.show(name)
        if name == "construction":
            self._push_cargo_to_overlay()

    def hide_overlay(self, name: str):
        self._overlay_manager.hide(name)

    def toggle_overlay(self, name: str):
        from core.database import set_pref
        new_state = self._overlay_manager.toggle(name)
        set_pref(f"overlay_auto_{name}", new_state)
        if new_state and name == "construction":
            self._push_cargo_to_overlay()

    def get_overlay_states(self) -> dict:
        from core.database import get_pref
        names = ["cmdr_ping", "route", "fss", "system_preview", "exo_tracker", "construction"]
        return {
            name: {
                "shown": self._overlay_manager.is_shown(name),
                "auto_enabled": self._overlay_manager.is_user_enabled(name),
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
        from core.database import delete_construction_project, get_construction_projects
        delete_construction_project(project_id)
        remaining = get_construction_projects(active_only=True)
        if remaining:
            self._overlay_manager.emit_to_overlay("construction", "construction_update", remaining[0])
        else:
            self._overlay_manager.emit_to_overlay("construction", "construction_update", None)
        return True

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

    def plan_neutron_route(self, origin: str, destination: str, range_ly: float, efficiency: int = 60) -> dict:
        import asyncio
        from api.spansh import SpanshAPI
        async def _run():
            spansh = SpanshAPI()
            try:
                systems = await spansh.neutron_route(origin, destination, range_ly, efficiency)
                total_jumps = sum(s.jumps for s in systems)
                total_dist = sum(s.distance_jumped for s in systems)
                return {
                    "systems": [
                        {
                            "system": s.system,
                            "distance_jumped": round(s.distance_jumped, 2),
                            "distance_remaining": round(s.distance, 2),
                            "jumps": s.jumps,
                            "neutron_star": s.neutron_star,
                        }
                        for s in systems
                    ],
                    "total_jumps": total_jumps,
                    "total_distance": round(total_dist, 1),
                }
            finally:
                await spansh.close()
        try:
            return asyncio.run(_run())
        except Exception as e:
            return {"error": str(e), "systems": [], "total_jumps": 0, "total_distance": 0}

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

    def _handle_eddn_message(self, msg: dict):
        schema = msg.get("$schemaRef", "")
        if "commodity" not in schema:
            return
        message = msg.get("message", {})
        system = message.get("systemName", "")
        station = message.get("stationName", "")
        timestamp = message.get("timestamp", "")
        commodities = message.get("commodities", [])
        if system and station and commodities:
            from core.database import upsert_market_data
            upsert_market_data(system, station, timestamp, commodities)

    def get_market_stats(self) -> dict:
        from core.database import get_market_stats
        return get_market_stats()

    def get_inara_key(self) -> str:
        from core.database import get_pref
        return get_pref("inara_api_key", "") or ""

    def set_inara_key(self, key: str) -> None:
        from core.database import set_pref
        set_pref("inara_api_key", key.strip())

    def test_inara_key(self, key: str) -> dict:
        import asyncio
        from api.inara import InaraAPI
        async def _test():
            inara = InaraAPI(key.strip(), APP_VERSION)
            # Quick test: search for Gold near Sol — always has results if key is valid
            raw = await inara.commodity_markets("Gold", 0.0, 0.0, 0.0, limit=1)
            return raw
        try:
            result = asyncio.run(_test())
            if isinstance(result, list) and len(result) > 0:
                return {"ok": True}
            if isinstance(result, list) and len(result) == 0:
                return {"ok": False, "error": "Key accepted but returned no data — key may be invalid or Inara API may be down"}
            return {"ok": False, "error": "Unexpected response"}
        except Exception as e:
            msg = str(e)
            if "401" in msg or "403" in msg or "invalid" in msg.lower():
                return {"ok": False, "error": "Invalid API key"}
            return {"ok": False, "error": f"Connection error: {msg}"}

    def search_commodity_markets(self, system: str, commodity: str) -> list:
        import asyncio
        from core.database import search_local_markets, get_pref, get_system_coords

        local = search_local_markets(commodity, system)
        seen = {(r["system"].lower(), r["station"].lower()) for r in local}

        inara_key = get_pref("inara_api_key", "") or ""
        ref_coords = get_system_coords(system) if inara_key else None

        async def _run_spansh():
            from api.spansh import SpanshAPI
            spansh = SpanshAPI()
            try:
                raw = await spansh.commodity_markets(system, commodity)
            finally:
                await spansh.close()
            needle = commodity.lower()
            results = []
            for s in raw:
                market_entry = next(
                    (m for m in (s.get("market") or []) if m.get("commodity", "").lower() == needle),
                    None,
                )
                results.append({
                    "station":             s.get("name", ""),
                    "system":              s.get("system_name", ""),
                    "distance":            round(s.get("distance", 0), 1),
                    "distance_to_arrival": round(s.get("distance_to_arrival") or 0),
                    "has_large_pad":       s.get("has_large_pad", False),
                    "is_planetary":        s.get("is_planetary", False),
                    "updated_at":          s.get("market_updated_at", ""),
                    "buy_price":           market_entry.get("buy_price", 0) if market_entry else 0,
                    "sell_price":          market_entry.get("sell_price", 0) if market_entry else 0,
                    "supply":              market_entry.get("supply", 0) if market_entry else 0,
                    "demand":              market_entry.get("demand", 0) if market_entry else 0,
                    "source":              "spansh",
                })
            return results

        async def _run_inara():
            if not inara_key:
                return []
            coords = ref_coords
            if not coords:
                # Coords missing from local DB — look up via EDSM and cache them
                from api.edsm import EdsmAPI
                edsm = EdsmAPI()
                try:
                    sys_info = await edsm.get_system(system)
                    if sys_info and sys_info.coords:
                        c = sys_info.coords
                        coords = (c.get("x", 0.0), c.get("y", 0.0), c.get("z", 0.0))
                        from core.database import upsert_system_coords
                        upsert_system_coords(system, coords[0], coords[1], coords[2])
                        logging.info(f"Inara: fetched coords for {system} from EDSM")
                except Exception as e:
                    logging.warning(f"Inara: EDSM coord lookup failed for {system}: {e}")
                finally:
                    await edsm.close()
            if not coords:
                logging.warning(f"Inara: no coords for {system}, skipping")
                return []
            from api.inara import InaraAPI
            inara = InaraAPI(inara_key, APP_VERSION)
            raw = await inara.commodity_markets(commodity, coords[0], coords[1], coords[2])
            return [InaraAPI.format_result(e) for e in raw]

        async def _run_all():
            return await asyncio.gather(_run_spansh(), _run_inara(), return_exceptions=True)

        try:
            raw_results = asyncio.run(_run_all())
            spansh_results = raw_results[0] if not isinstance(raw_results[0], Exception) else []
            inara_results  = raw_results[1] if not isinstance(raw_results[1], Exception) else []
        except Exception:
            spansh_results, inara_results = [], []

        merged = list(local)
        for r in spansh_results:
            key = (r["system"].lower(), r["station"].lower())
            if key not in seen:
                merged.append(r)
                seen.add(key)
        for r in inara_results:
            key = (r["system"].lower(), r["station"].lower())
            if key not in seen:
                merged.append(r)
                seen.add(key)
        return merged

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

    def plan_exobiology_route(
        self, origin: str, range_ly: float, radius: float = 10000, max_results: int = 20
    ) -> dict:
        import asyncio
        from api.spansh import SpanshAPI
        async def _run():
            spansh = SpanshAPI()
            try:
                systems = await spansh.exobiology_route(origin, range_ly, radius, max_results)
                return {"systems": systems}
            finally:
                await spansh.close()
        try:
            return asyncio.run(_run())
        except Exception as e:
            return {"error": str(e), "systems": []}

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

    def get_ship_info(self) -> dict:
        if not self._current_ship:
            # Replay thread hasn't run yet — scan the journal directly
            try:
                import json as _j
                from core.journal import journal_path
                journals = sorted(journal_path().glob("Journal.*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
                if journals:
                    with open(journals[0], encoding="utf-8", errors="replace") as f:
                        for line in f:
                            try:
                                ev = _j.loads(line.strip())
                                if ev.get("event") == "Loadout":
                                    self._handle_loadout(ev)
                            except Exception:
                                pass
            except Exception:
                pass
        info = dict(self._current_ship)
        if not info:
            return info
        try:
            import json as _json
            from core.journal import journal_path
            status_file = journal_path() / "Status.json"
            if status_file.exists():
                with open(status_file, "r", encoding="utf-8") as f:
                    status = _json.load(f)
                raw_fuel = status.get("Fuel", {}).get("FuelMain", 0) or 0
                cargo = status.get("Cargo", 0) or 0
                # Cap fuel at ship's actual tank capacity — Status.json reports
                # fleet carrier tritium as FuelMain when docked on a carrier
                fuel_cap = info.get("fuel_capacity") or raw_fuel
                fuel = min(raw_fuel, fuel_cap)
                info["fuel_main"] = round(fuel, 2)
                info["cargo"] = cargo
                unladen = info.get("unladen_mass") or 0
                max_range = info.get("max_jump_range") or 0
                if unladen > 0 and max_range > 0:
                    current_mass = unladen + fuel + cargo
                    guardian_bonus = info.get("guardian_booster_bonus", 0.0)
                    fsd_base = max_range - guardian_bonus
                    current_fsd = fsd_base * (unladen / current_mass)
                    info["current_jump_range"] = round(current_fsd + guardian_bonus, 2)
        except Exception:
            pass
        return info

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

    def find_nearest_service(self, system: str, services: list) -> dict:
        import asyncio
        from api.spansh import SpanshAPI

        def station_has(station: dict, label: str) -> bool:
            label_l = label.lower()
            if label_l == "large pad":
                return bool(station.get("has_large_pad"))
            if label_l == "medium pad":
                return (station.get("medium_pads") or 0) > 0
            names = {s.get("name", "").lower() for s in (station.get("services") or [])}
            if label_l == "interstellar factor":
                return any("interstellar factor" in n for n in names)
            return label_l in names

        async def _run():
            spansh = SpanshAPI()
            try:
                return await spansh.stations_near(system)
            finally:
                await spansh.close()

        try:
            stations = asyncio.run(_run())
        except Exception as e:
            return {"error": str(e)}

        match = next((s for s in stations if all(station_has(s, svc) for svc in services)), None)
        if not match:
            return {"error": "No nearby station found with all selected services"}
        return {
            "station": match.get("name", ""),
            "system": match.get("system_name", ""),
            "distance": match.get("distance", 0),
            "distance_to_arrival": match.get("distance_to_arrival", 0),
            "has_large_pad": bool(match.get("has_large_pad")),
            "services": [s.get("name", "") for s in (match.get("services") or [])],
        }

    def get_commodities(self) -> list:
        return self._load_json("commodities.json").get("commodities", [])

    # --- Guardian ---

    def get_guardian_sites(self) -> dict:
        from core.database import get_guardian_visits
        visits = get_guardian_visits()
        data = self._load_json("guardian_sites.json")
        ruins = data.get("ruins", [])
        structures = data.get("structures", [])
        for site in ruins:
            v = visits.get(site["id"], {})
            site["visited"] = bool(v.get("visited", 0))
            site["data_collected"] = bool(v.get("data_collected", 0))
            db_notes = v.get("notes", "")
            if db_notes:
                site["notes"] = db_notes
        for site in structures:
            v = visits.get(site["id"], {})
            site["visited"] = bool(v.get("visited", 0))
            site["data_collected"] = bool(v.get("data_collected", 0))
            site["notes"] = v.get("notes", "")  # UI shows blueprint info visually; only user notes here
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
        import asyncio
        from api.galnet import GalnetAPI
        async def _run():
            galnet = GalnetAPI()
            try:
                return await galnet.get_news()
            finally:
                await galnet.close()
        try:
            result = asyncio.run(_run())
        except Exception:
            return []
        return result if isinstance(result, list) else []

    def get_system_factions(self, system_name: str) -> dict:
        return self._edsm_run(lambda e: e.get_factions(system_name))

    def get_system_traffic(self, system_name: str) -> dict:
        return self._edsm_run(lambda e: e.get_traffic(system_name))

    def get_community_goals(self) -> list:
        import asyncio
        from api.communitygoals import CommunityGoalsAPI
        async def _run():
            cg = CommunityGoalsAPI()
            try:
                return await cg.get_active()
            finally:
                await cg.close()
        try:
            result = asyncio.run(_run())
        except Exception:
            return []
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

    # --- Diagnostics ---

    def log_frontend_error(self, message: str, stack: str) -> None:
        logging.error(f"Frontend error: {message}\n{stack}")

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
        return APP_VERSION

    def get_app_info(self) -> dict:
        return {
            "version": APP_VERSION,
            "name": "EDTC",
            "dev_mode": DEV_MODE,
        }

    def check_for_update(self) -> dict:
        import urllib.request
        try:
            release = self._fetch_highest_release(urllib.request)
            if not release:
                return {"current": APP_VERSION, "latest": None, "update_available": False, "download_url": None}
            latest = release.get("tag_name", "").lstrip("v")
            download_url = next(
                (a["browser_download_url"] for a in release.get("assets", []) if a["name"] == "EDTC.exe"),
                None,
            )
            update_available = self._version_gt(latest, APP_VERSION)
            return {"current": APP_VERSION, "latest": latest, "update_available": update_available, "download_url": download_url}
        except Exception as e:
            logging.warning(f"Update check failed: {e}")
            return {"current": APP_VERSION, "latest": None, "update_available": False, "download_url": None}

    def _fetch_highest_release(self, urllib_request) -> dict | None:
        url = "https://api.github.com/repos/keaganbmackinnon-coder/EDTC/releases?per_page=20"
        req = urllib_request.Request(url, headers={"User-Agent": "EDTC"})
        with urllib_request.urlopen(req, timeout=10) as resp:
            releases = json.loads(resp.read())
        valid = [r for r in releases if not r.get("draft") and not r.get("prerelease")]
        if not valid:
            return None
        def _semver(r):
            try:
                return tuple(int(x) for x in r.get("tag_name", "").lstrip("v").split("."))
            except Exception:
                return (0, 0, 0)
        return max(valid, key=_semver)

    def _version_gt(self, a: str, b: str) -> bool:
        try:
            return tuple(int(x) for x in a.split(".")) > tuple(int(x) for x in b.split("."))
        except Exception:
            return False

    def download_and_install_update(self, download_url: str) -> dict:
        if not getattr(sys, "frozen", False):
            return {"error": "Update only works in the installed .exe — not in dev mode."}
        threading.Thread(target=self._do_update, args=(download_url,), daemon=True).start()
        return {"ok": True}

    def _do_update(self, download_url: str):
        import subprocess
        import tempfile
        import urllib.request
        try:
            tmp = Path(tempfile.gettempdir()) / "EDTC_update.exe"
            exe_path = Path(sys.executable)

            # Always re-fetch highest release URL so we never download a stale version
            try:
                release = self._fetch_highest_release(urllib.request)
                if release:
                    fresh_url = next(
                        (a["browser_download_url"] for a in release.get("assets", []) if a["name"] == "EDTC.exe"),
                        None,
                    )
                    if fresh_url:
                        download_url = fresh_url
                        logging.info(f"Update: using fresh URL for {release.get('tag_name')}")
            except Exception as e:
                logging.warning(f"Update: could not re-fetch latest URL, using cached: {e}")

            req = urllib.request.Request(download_url, headers={"User-Agent": "EDTC"})
            with urllib.request.urlopen(req, timeout=120) as resp:
                total = int(resp.headers.get("Content-Length", 0) or 0)
                downloaded = 0
                chunks = []
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    chunks.append(chunk)
                    downloaded += len(chunk)
                    pct = int(downloaded / total * 100) if total else 0
                    self._emit("update_progress", {"pct": pct, "downloaded": downloaded, "total": total})

            tmp.write_bytes(b"".join(chunks))
            self._emit("update_progress", {"pct": 100, "status": "installing"})

            bat = Path(tempfile.gettempdir()) / "edtc_update.bat"
            bat.write_text(
                f"@echo off\r\n"
                f"timeout /t 3 /nobreak > nul\r\n"
                f"taskkill /f /im EDTC.exe >nul 2>&1\r\n"
                f"timeout /t 2 /nobreak > nul\r\n"
                f'copy /y "{tmp}" "{exe_path}" >> "%TEMP%\\edtc_copy.log" 2>&1\r\n'
                f"if %errorlevel% neq 0 exit /b 1\r\n"
                f'powershell -Command "Unblock-File -LiteralPath \'{exe_path}\'"\r\n'
                f"timeout /t 1 /nobreak > nul\r\n"
                f'powershell -Command "Start-Process -FilePath \'{exe_path}\'"\r\n'
                f"del \"%~f0\"\r\n",
                encoding="utf-8",
            )
            subprocess.Popen(
                ["cmd.exe", "/c", str(bat)],
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
                close_fds=True,
            )
            import time as _time
            _time.sleep(1)
            self._window.destroy()
        except Exception as e:
            logging.error(f"Update install failed: {e}")
            self._emit("update_progress", {"error": str(e)})


def _eddn_listener(api: API):
    import time
    import zlib
    import zmq

    context = zmq.Context()
    while True:
        sub = context.socket(zmq.SUB)
        sub.setsockopt(zmq.RCVTIMEO, 60000)
        sub.setsockopt_string(zmq.SUBSCRIBE, "")
        try:
            sub.connect("tcp://eddn.edcd.io:9500")
            logging.info("EDDN ZMQ connected")
            while True:
                raw = sub.recv()
                try:
                    msg = json.loads(zlib.decompress(raw))
                    api._handle_eddn_message(msg)
                except Exception:
                    pass
        except zmq.error.Again:
            logging.warning("EDDN ZMQ timeout, reconnecting")
        except Exception as e:
            logging.warning(f"EDDN ZMQ error: {e}")
        finally:
            sub.close()
        time.sleep(5)


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


def _prune_markets():
    try:
        from core.database import prune_markets
        n = prune_markets()
        if n:
            logging.info(f"markets prune: removed {n} rows older than 30 days")
    except Exception as e:
        logging.warning(f"markets prune failed: {e}")


def main():
    init_db()
    _create_desktop_shortcut()
    threading.Thread(target=_prune_markets, daemon=True).start()

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
    window.events.closed += api._overlay_manager.close_all

    watcher = JournalWatcher(on_event=api.on_journal_event)
    threading.Thread(target=watcher.run, daemon=True).start()

    tray = TrayIcon(
        on_show=window.show,
        on_hide=window.hide,
        on_quit=lambda: webview.windows[0].destroy(),
    )
    threading.Thread(target=tray.run, daemon=True).start()

    threading.Thread(target=_setup_hotkeys, args=(api,), daemon=True).start()
    threading.Thread(target=_eddn_listener, args=(api,), daemon=True).start()

    def _on_ready():
        api._overlay_manager.enable()
        # Re-emit startup state after window is confirmed ready.
        # Journal replay runs in a background thread and may not have finished
        # by the time the frontend's first get_ship_info() call lands.
        def _push_startup():
            import time
            time.sleep(1.5)
            api._import_market_json()
            api._import_cargo_json()
            if api._current_ship:
                api._emit("ship_changed", api.get_ship_info())
            if api._current_system:
                api._emit("system_changed", {"system": api._current_system})
        threading.Thread(target=_push_startup, daemon=True).start()

    webview.start(debug=DEV_MODE, func=_on_ready)


if __name__ == "__main__":
    main()
