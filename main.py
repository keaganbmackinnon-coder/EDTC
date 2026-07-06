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

from core.database import init_db, DB_PATH
from core.journal import JournalWatcher
from core.overlay import OverlayManager
from core.tray import TrayIcon

BASE_DIR = Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist" / "index.html"
DEV_URL = "http://localhost:5173"

DEV_MODE = "--dev" in sys.argv

APP_VERSION = "0.3.62"  # bump this with every release

# exe + db paths identify WHICH install is running — a stale duplicate exe
# (with its own empty edtc.db beside it) looks identical from inside the app
logging.info(
    f"EDTC starting — version {APP_VERSION}, frozen={getattr(sys, 'frozen', False)}, "
    f"exe={sys.executable}, db={DB_PATH}"
)

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


# Journal internal ship names → display names. The journal's Ship_Localised is
# missing or empty for some ships (notably new releases like the Nomad), so we
# can't rely on it alone.
_SHIP_DISPLAY_NAMES = {
    "sidewinder": "Sidewinder", "eagle": "Eagle", "hauler": "Hauler",
    "adder": "Adder", "empire_eagle": "Imperial Eagle",
    "viper": "Viper Mk III", "viper_mkiv": "Viper Mk IV",
    "cobramkiii": "Cobra Mk III", "cobramkiv": "Cobra Mk IV",
    "cobramkv": "Cobra Mk V", "type6": "Type-6 Transporter",
    "dolphin": "Dolphin", "type7": "Type-7 Transporter",
    "asp": "Asp Explorer", "asp_scout": "Asp Scout", "vulture": "Vulture",
    "empire_trader": "Imperial Clipper", "federation_dropship": "Federal Dropship",
    "federation_dropship_mkii": "Federal Assault Ship",
    "federation_gunship": "Federal Gunship", "diamondback": "Diamondback Scout",
    "diamondbackxl": "Diamondback Explorer", "empire_courier": "Imperial Courier",
    "independant_trader": "Keelback", "orca": "Orca", "type8": "Type-8 Transporter",
    "type9": "Type-9 Heavy", "type9_military": "Type-10 Defender",
    "krait_mkii": "Krait Mk II", "krait_light": "Krait Phantom",
    "typex": "Alliance Chieftain", "typex_2": "Alliance Crusader",
    "typex_3": "Alliance Challenger", "python": "Python",
    "python_nx": "Python Mk II", "belugaliner": "Beluga Liner",
    "ferdelance": "Fer-de-Lance", "mamba": "Mamba", "anaconda": "Anaconda",
    "federation_corvette": "Federal Corvette", "cutter": "Imperial Cutter",
    "mandalay": "Mandalay", "corsair": "Corsair",
    "panthermkii": "Panther Clipper Mk II", "explorer_nx": "Caspian Explorer",
    "smallcombat01_nx": "Nomad",
}


def _ship_display_name(event: dict) -> str:
    raw = event.get("Ship", "")
    return (
        event.get("Ship_Localised")
        or _SHIP_DISPLAY_NAMES.get(raw.lower())
        or raw
    )


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
        self._current_station: str = ""
        self._current_ship: dict = {}
        self._current_loadout: dict = {}   # full Loadout event, for build import
        self._ship_cargo: list[dict] = []
        # ColonisationConstructionDepot re-fires every few seconds while docked
        # at a construction site — remember the last payload to skip no-op re-fires
        self._last_depot_key: tuple | None = None
        # Galaxy scan-coverage: EDDN journal messages buffered here and flushed
        # to the DB periodically (journal traffic is ~20-50 msg/s at peak)
        self._cov_buf: dict[tuple, int] = {}
        self._cov_last_flush: float = 0.0
        self._cov_lock = threading.Lock()
        # ShipTargeted fires constantly in busy space — keep the watchlist in
        # memory instead of hitting the DB per event (invalidated on edits)
        self._watchlist_cache: set[str] | None = None
        # Last FSDTarget payload — re-pushed when the route overlay opens
        # mid-route so the scoopable warning isn't lost until the next target
        self._last_fsd_target: dict | None = None
        # get_market_stats() full-scans the markets table; Trading.jsx polls it
        self._market_stats_cache: dict | None = None
        self._market_stats_time: float = 0.0
        # Buyable commodities at the station we're docked at — pushed to the
        # Colonisation shopping list so it can highlight what's sold here
        self._station_market: dict | None = None
        # commodity symbol → display name, built lazily from data/commodities.json
        self._commodity_names: dict[str, str] | None = None
        # normalized commodity name/symbol → market category, same source
        self._commodity_categories: dict[str, str] | None = None
        # CMDR ping cooldown: name → last ping monotonic-ish time
        self._cmdr_ping_times: dict[str, float] = {}

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
        event_name = event.get("event", "")

        if event_name == "ShipTargeted":
            self._handle_cmdr_event(event)
        elif event_name == "FSDJump":
            self._handle_fsd_jump(event)
        elif event_name == "Location":
            self._current_system = event.get("StarSystem", "")
            # Location fires at login and carries the docked station (if any) —
            # without this, depot/trade events after a relog see no station
            self._current_station = event.get("StationName", "") if event.get("Docked") else ""
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
            self._push_station_market()
        elif event_name == "Undocked":
            self._current_station = ""
            self._push_station_market()
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
        elif event_name == "FSDTarget":
            self._handle_fsd_target(event)
        elif event_name == "CarrierLocation":
            self._handle_carrier_location(event)
        elif event_name == "Loadout":
            self._handle_loadout(event)
        elif event_name == "Market":
            self._import_market_json()
            self._push_station_market()
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

    def _commodity_display(self, symbol: str) -> str:
        """Display name for a market/EDDN commodity symbol ('ceramiccomposites'
        → 'Ceramic Composites'), from data/commodities.json. '' if unknown."""
        import re
        if self._commodity_names is None:
            names = {}
            for c in self._load_json("commodities.json").get("commodities", []):
                key = re.sub(r"[^a-z0-9]", "", (c.get("id") or "").lower())
                if key:
                    names[key] = c.get("name", "")
            self._commodity_names = names
        return self._commodity_names.get(re.sub(r"[^a-z0-9]", "", symbol.lower()), "")

    def _commodity_category_map(self) -> dict[str, str]:
        """Normalized commodity name/symbol → market category ('Metals', …),
        from data/commodities.json. Keyed by both id and display name so it
        resolves whichever form a project requirement or market entry uses.
        The in-game market screen lists categories alphabetically with
        commodities alphabetical inside each — sorting by (category, name)
        reproduces that order."""
        import re
        if self._commodity_categories is None:
            cats = {}
            for c in self._load_json("commodities.json").get("commodities", []):
                cat = c.get("category", "")
                if not cat:
                    continue
                for form in (c.get("id"), c.get("name")):
                    key = re.sub(r"[^a-z0-9]", "", (form or "").lower())
                    if key:
                        cats[key] = cat
            self._commodity_categories = cats
        return self._commodity_categories

    def _push_station_market(self):
        """Emit the buyable-commodity list for the station we're docked at.
        A Market.json written at this station wins (live data — the game writes
        it when the commodities screen is opened); otherwise the local
        EDDN/visit cache is used so the list is available right at touchdown.
        Emits None when not docked / nothing known."""
        payload = None
        if self._current_station:
            commodities, source = [], None
            live_match = False  # Market.json is for THIS station — don't fall back to cache
            try:
                from core.journal import journal_path
                market_file = journal_path() / "Market.json"
                if market_file.exists():
                    data = json.loads(market_file.read_text(encoding="utf-8"))
                    if data.get("StationName", "").lower() == self._current_station.lower():
                        live_match = True
                        for item in data.get("Items", []):
                            if item.get("Rare") or item.get("Stock", 0) <= 0 or item.get("BuyPrice", 0) <= 0:
                                continue
                            raw = item.get("Name", "")
                            name = raw.lstrip("$").split("_name;")[0] if raw else ""
                            if not name:
                                continue
                            commodities.append({
                                "name": name,
                                "display": item.get("Name_Localised") or self._commodity_display(name) or name,
                                "buyPrice": item.get("BuyPrice", 0),
                                "stock": item.get("Stock", 0),
                            })
                        source = "market"
            except Exception as e:
                logging.warning(f"Station market (Market.json) error: {e}")
            if not commodities and not live_match:
                try:
                    from core.database import get_station_commodities
                    for c in get_station_commodities(self._current_system, self._current_station):
                        commodities.append({
                            "name": c["name"],
                            "display": self._commodity_display(c["name"]) or c["name"],
                            "buyPrice": c["buyPrice"],
                            "stock": c["stock"],
                        })
                    source = "cache" if commodities else None
                except Exception as e:
                    logging.warning(f"Station market (cache) error: {e}")
            if commodities:
                payload = {
                    "system": self._current_system,
                    "station": self._current_station,
                    "source": source,
                    "commodities": commodities,
                }
                logging.info(f"Station market: {len(commodities)} buyable at {self._current_station} ({source})")
        self._station_market = payload
        self._emit("station_market_update", payload)
        # construction overlay colors buyable-here commodities blue
        self._overlay_manager.emit_to_overlay("construction", "station_market_update", payload)

    def get_station_market(self) -> dict | None:
        """Current station's buyable commodities (None when not docked)."""
        if self._station_market is None and self._current_station:
            self._push_station_market()
        return self._station_market

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
        if "Inventory" in event:
            self._ship_cargo = event.get("Inventory", [])
            payload = {"cargo": self._ship_cargo}
            self._emit("ship_cargo_update", payload)
            self._overlay_manager.emit_to_overlay("construction", "ship_cargo_update", payload)
            logging.info(f"Cargo event: {len(self._ship_cargo)} items")
        else:
            # Mid-session Cargo events omit Inventory (only the login event has
            # it) — the full list lives in Cargo.json. Reading the old Inventory
            # key here was zeroing the overlay's cargo on every pickup/delivery.
            # Small delay dodges the race with the game still writing the file.
            timer = threading.Timer(0.3, self._import_cargo_json)
            timer.daemon = True
            timer.start()

    def get_ship_cargo(self) -> list:
        if not self._ship_cargo:
            self._import_cargo_json()
        return self._ship_cargo

    def _push_cargo_to_overlay(self):
        """Push current ship cargo and the active project for the current system
        to the construction overlay after it has time to initialize — otherwise the
        overlay stays empty until the next dock/contribution event fires this session.
        The overlay window has no working API bridge, so everything it shows
        must be pushed from this side."""
        def _push():
            import time
            time.sleep(2.5)
            # static per session — lets the overlay sort commodities into the
            # in-game market screen order (category, then name)
            self._overlay_manager.emit_to_overlay(
                "construction", "commodity_categories", self._commodity_category_map()
            )
            payload = {"cargo": self._ship_cargo}
            self._overlay_manager.emit_to_overlay("construction", "ship_cargo_update", payload)
            logging.info(f"Pushed cargo to overlay: {len(self._ship_cargo)} items")
            if self._station_market:
                self._overlay_manager.emit_to_overlay("construction", "station_market_update", self._station_market)
            if self._current_ship:
                self._overlay_manager.emit_to_overlay("construction", "ship_info", {
                    "ship": self._current_ship.get("ship", ""),
                    "cargo_capacity": self._current_ship.get("cargo_capacity") or 0,
                })
            if self._current_system:
                from core.database import get_construction_projects
                projects = get_construction_projects(active_only=True)
                match = next((p for p in projects if p.get("system", "").lower() == self._current_system.lower()), None)
                if match:
                    self._overlay_manager.emit_to_overlay("construction", "construction_update", match)
                    logging.info(f"Pushed construction project to overlay: {match.get('name')}")
        threading.Thread(target=_push, daemon=True).start()

    def _push_fss_to_overlay(self):
        """Seed the FSS overlay with this system's scans when it opens —
        otherwise it shows 'Scanning…' until the next Scan event even though
        _fss_bodies already has data. Same fresh-window pattern as the
        construction/route pushes (no API bridge in overlay windows)."""
        def _push():
            import time
            time.sleep(2.5)
            if self._fss_bodies:
                self._overlay_manager.emit_to_overlay("fss", "body_scanned", {
                    "body": self._fss_bodies[-1],
                    "all_bodies": self._fss_bodies,
                })
                logging.info(f"Pushed {len(self._fss_bodies)} FSS bodies to overlay")
        threading.Thread(target=_push, daemon=True).start()

    def _push_exo_to_overlay(self):
        """Seed the exo overlay with the current system's in-progress scans."""
        def _push():
            import time
            time.sleep(2.5)
            if not self._current_system:
                return
            from core.database import get_exo_scans
            try:
                scans = get_exo_scans(self._current_system)
            except Exception as e:
                logging.warning(f"exo overlay seed: {e}")
                return
            for s in scans[:6]:
                self._overlay_manager.emit_to_overlay("exo_tracker", "exo_scan", {
                    "system": s.get("system", ""),
                    "body": s.get("body", ""),
                    "species": s.get("species", ""),
                    "genus": s.get("genus", ""),
                    "scan_count": s.get("scan_count", 0),
                    "completed": bool(s.get("completed")) or s.get("scan_count", 0) >= 3,
                    "scan_type": "",
                })
            if scans:
                logging.info(f"Pushed {min(len(scans), 6)} exo scans to overlay")
        threading.Thread(target=_push, daemon=True).start()

    def _push_route_to_overlay(self):
        """Push the active route (and last locked jump target) to the route
        overlay after it has time to initialize. The overlay window has no
        working API bridge, so it can't fetch this itself on mount."""
        def _push():
            import time
            time.sleep(2.5)
            self._overlay_manager.emit_to_overlay("route", "route_update", {
                "route": self._active_route,
                "current_system": self._current_system,
            })
            # after route_update — the overlay resets its target info on route change
            if self._active_route and self._last_fsd_target:
                self._overlay_manager.emit_to_overlay("route", "fsd_target", self._last_fsd_target)
            logging.info(f"Pushed route to overlay: {(self._active_route or {}).get('name', 'none')}")
        threading.Thread(target=_push, daemon=True).start()

    def get_journal_path(self) -> str:
        from core.journal import journal_path
        return str(journal_path())

    def _handle_cmdr_event(self, event: dict):
        # NPC pilots always carry a $-macro raw name ($npc_name_decorate:...,
        # $ShipName_Police...); real players are plain "Cmdr <name>". Verified
        # against live journals 2026-07-05 — without this every combat-zone
        # pirate triggered a ping.
        raw = event.get("PilotName") or ""
        if not raw or raw.startswith("$"):
            return
        cmdr = event.get("PilotName_Localised") or raw
        if cmdr.lower().startswith("cmdr "):
            cmdr = cmdr[5:]
        if not cmdr:
            return

        # Re-targeting the same player fires ShipTargeted repeatedly (each
        # scan stage, every re-lock) — one ping per CMDR per 2 minutes
        import time
        now = time.time()
        if now - self._cmdr_ping_times.get(cmdr.upper(), 0) < 120:
            return
        self._cmdr_ping_times[cmdr.upper()] = now

        ship = event.get("Ship_Localised") or _SHIP_DISPLAY_NAMES.get(
            (event.get("Ship") or "").lower(), event.get("Ship") or "")

        if self._watchlist_cache is None:
            from core.database import get_watchlist
            self._watchlist_cache = {r["cmdr"].upper() for r in get_watchlist()}
        watchlist = self._watchlist_cache
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
        if self._overlay_manager.is_user_enabled("cmdr_ping"):
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

    def _handle_nav_route(self, event: dict):
        raw = event.get("Route", [])
        if not raw:
            return
        systems = [s["StarSystem"] for s in raw if "StarSystem" in s]
        if not systems:
            return
        star_classes = [s.get("StarClass", "") for s in raw if "StarSystem" in s]
        route = {"systems": systems, "star_classes": star_classes, "current": 0,
                 "name": f"In-game route → {systems[-1]}"}
        from core.database import save_route
        save_route(route)
        self._active_route = route
        self._last_fsd_target = None  # old target is stale for the new route
        if self._overlay_manager.is_user_enabled("route"):
            self._overlay_manager.show("route")
            # if show() just created the window, the immediate emit below is
            # dropped — the delayed push catches the fresh window
            self._push_route_to_overlay()
        self._overlay_manager.emit_to_overlay("route", "route_update", {
            "route": route,
            "current_system": self._current_system,
        })
        self._emit("route_update", {"route": route, "current_system": self._current_system})

    def _handle_nav_route_clear(self):
        self._active_route = None
        self._last_fsd_target = None
        self._overlay_manager.emit_to_overlay("route", "route_update", {
            "route": None,
            "current_system": self._current_system,
        })
        self._emit("route_update", {"route": None, "current_system": self._current_system})

    # Fuel-scoopable main-sequence classes (exact match — "TTS"/"AEBE" etc are not)
    _SCOOPABLE_CLASSES = {"K", "G", "B", "F", "O", "A", "M"}

    def _handle_fsd_target(self, event: dict):
        """FSDTarget fires when the next jump is locked in — carries the target
        star's class, so the route overlay can warn before a fuel-starved jump."""
        star_class = (event.get("StarClass") or "").upper()
        payload = {
            "name": event.get("Name", ""),
            "star_class": star_class,
            "scoopable": star_class in self._SCOOPABLE_CLASSES if star_class else None,
            "remaining_jumps": event.get("RemainingJumpsInRoute"),
        }
        self._last_fsd_target = payload
        self._overlay_manager.emit_to_overlay("route", "fsd_target", payload)
        self._emit("fsd_target", payload)

    def _handle_carrier_location(self, event: dict):
        """CarrierLocation fires at login and after carrier jumps — keeps the
        carrier's location current without opening Carrier Management."""
        if not event.get("CarrierID"):
            return
        from core.database import upsert_carrier
        carrier = upsert_carrier({
            "CarrierID": event.get("CarrierID"),
            "location": event.get("StarSystem", ""),
        })
        self._emit("carrier_update", {"carrier": carrier})

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
        if self._overlay_manager.is_user_enabled("exo_tracker"):
            self._overlay_manager.show("exo_tracker")
            self._overlay_manager.emit_to_overlay("exo_tracker", "exo_scan", payload)

    def _handle_construction_contribution(self, event: dict):
        contributions = event.get("Contributions", [])
        if not contributions:
            return
        from core.database import record_construction_contribution, add_depot_delivery
        # Log the delivery for the tonnes/hour + ETA estimate on the depot card
        market_id = event.get("MarketID")
        total = sum(int(c.get("Amount", 0)) for c in contributions)
        if market_id and total > 0:
            add_depot_delivery(market_id, total)
        updated = record_construction_contribution(self._current_system, contributions, market_id)
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
            from core.database import upsert_depot, sync_construction_depot
            depot = upsert_depot(
                event.get("MarketID") or 0,
                self._current_system,
                self._current_station,
                event.get("ConstructionProgress", 0.0),
                bool(event.get("ConstructionComplete", False)),
                resources,
            )
            depot["remaining"] = sum(
                max(0, r.get("RequiredAmount", 0) - r.get("ProvidedAmount", 0))
                for r in resources
            )
            logging.info(
                f"Depot: {depot.get('station') or depot.get('system') or 'unknown'} "
                f"(market {event.get('MarketID')}) — {len(resources)} commodities, "
                f"{depot['remaining']:,}T remaining, "
                f"{event.get('ConstructionProgress', 0):.1%} complete"
            )
            self._emit("construction_depot", depot)
            project = sync_construction_depot(self._current_system, resources, event.get("MarketID"))
            if project:
                self._overlay_manager.emit_to_overlay("construction", "construction_update", project)
                self._emit("construction_update", project)
        else:
            logging.warning(
                f"Depot event (market {event.get('MarketID')}) had no ResourcesRequired — skipped"
            )

    def _handle_cargo_transfer(self, event: dict):
        transfers = event.get("Transfers", [])
        if not transfers:
            return
        from core.database import update_fc_cargo_transfer
        updated = update_fc_cargo_transfer(transfers)
        self._emit("fc_cargo_update", {"cargo": updated})

    def _handle_carrier_stats(self, event: dict):
        # CarrierStats only fires from Carrier Management — owner-only
        from core.database import upsert_carrier
        carrier = upsert_carrier({**event, "owned": 1})
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
        # Only the owner can request a jump — marks the carrier as ours
        from core.database import upsert_carrier
        carrier = upsert_carrier({
            "CarrierID": event.get("CarrierID"),
            "pending_jump": event.get("SystemName", ""),
            "owned": 1,
        })
        self._emit("carrier_update", {"carrier": carrier})

    def _handle_carrier_jump_cancelled(self, event: dict):
        from core.database import upsert_carrier
        carrier = upsert_carrier({
            "CarrierID": event.get("CarrierID"),
            "pending_jump": "",
            "owned": 1,
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
            "owned": 1,
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

    # Max fuel per jump in tonnes by (FSD size, class digit 1=E..5=A). Loadout's
    # MaxJumpRange is computed with "just enough fuel for 1 jump" aboard, so
    # this belongs in the baseline mass when scaling to current mass.
    _FSD_MAX_FUEL = {
        (2, 1): 0.6, (2, 2): 0.6, (2, 3): 0.6, (2, 4): 0.8, (2, 5): 0.9,
        (3, 1): 1.2, (3, 2): 1.2, (3, 3): 1.2, (3, 4): 1.5, (3, 5): 1.8,
        (4, 1): 2.0, (4, 2): 2.0, (4, 3): 2.0, (4, 4): 2.5, (4, 5): 3.0,
        (5, 1): 3.3, (5, 2): 3.3, (5, 3): 3.3, (5, 4): 4.1, (5, 5): 5.0,
        (6, 1): 5.3, (6, 2): 5.3, (6, 3): 5.3, (6, 4): 6.6, (6, 5): 8.0,
        (7, 1): 8.5, (7, 2): 8.5, (7, 3): 8.5, (7, 4): 10.6, (7, 5): 12.8,
    }
    # SCO ('overcharge') A-rated drives run slightly hotter per jump
    _FSD_MAX_FUEL_SCO = {(4, 5): 3.2, (5, 5): 5.2, (6, 5): 8.3, (7, 5): 13.1}
    # New-generation drives with no published stats — fitted so the computed
    # current range matches the in-game readout (74.65 ly on the live ship)
    _FSD_MAX_FUEL_OVERRIDES = {
        "int_hyperdrive_overcharge_size8_class5_overchargebooster_mkii": 5.5,
    }

    def _handle_loadout(self, event: dict):
        import re
        ship_type = _ship_display_name(event)
        fuel = event.get("FuelCapacity", {})
        # keep the full event so the ship builder can import the live loadout
        # (every module + its real engineering modifiers)
        if event.get("Modules"):
            self._current_loadout = event

        guardian_bonus = 0.0
        max_fuel_per_jump = 0.0
        fsd_size, fsd_class = 0, 0
        for module in (event.get("Modules") or []):
            item = module.get("Item", "").lower()
            if "guardianfsdbooster" in item:
                for part in item.split("_"):
                    if part.startswith("size"):
                        try:
                            guardian_bonus = self._GUARDIAN_BOOSTER_BONUS.get(int(part[4:]), 0.0)
                        except ValueError:
                            pass
            elif module.get("Slot") == "FrameShiftDrive" and item.startswith("int_hyperdrive"):
                m = re.search(r"size(\d+)_class(\d+)", item)
                if m:
                    fsd_size, fsd_class = int(m.group(1)), int(m.group(2))
                max_fuel_per_jump = self._FSD_MAX_FUEL_OVERRIDES.get(item, 0.0)
                if not max_fuel_per_jump and m:
                    key = (fsd_size, fsd_class)
                    if "overcharge" in item:
                        max_fuel_per_jump = self._FSD_MAX_FUEL_SCO.get(
                            key, self._FSD_MAX_FUEL.get(key, 0.0))
                    else:
                        max_fuel_per_jump = self._FSD_MAX_FUEL.get(key, 0.0)
                # Deep Charge engineering raises max fuel per jump
                eng = module.get("Engineering") or {}
                for mod in eng.get("Modifiers", []):
                    if mod.get("Label") == "MaxFuelPerJump" and mod.get("Value"):
                        max_fuel_per_jump = float(mod["Value"])

        self._current_ship = {
            "ship": ship_type,
            "ship_name": event.get("ShipName", ""),
            "ship_ident": event.get("ShipIdent", ""),
            "max_jump_range": event.get("MaxJumpRange"),
            "unladen_mass": event.get("UnladenMass"),
            "fuel_capacity": fuel.get("Main") if isinstance(fuel, dict) else fuel,
            "reserve_capacity": fuel.get("Reserve") if isinstance(fuel, dict) else 0.0,
            "cargo_capacity": event.get("CargoCapacity"),
            "guardian_booster_bonus": guardian_bonus,
            "max_fuel_per_jump": max_fuel_per_jump,
            "fsd_size": fsd_size,
            "fsd_class": fsd_class,
        }
        self._emit("ship_changed", self.get_ship_info())
        # Ship swap changes the hold size — keep the overlay's trip count honest
        self._overlay_manager.emit_to_overlay("construction", "ship_info", {
            "ship": ship_type,
            "cargo_capacity": event.get("CargoCapacity") or 0,
        })

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
            set_cmdr_stat("ship", _ship_display_name(event))
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
        self._refresh_awards()

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
        self._refresh_awards()

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

    # --- Ship builder / outfitting ---

    def get_modules(self) -> dict:
        """Full outfitting module reference (data/modules.json)."""
        return self._load_json("modules.json")

    def _module_symbol_index(self) -> dict:
        """symbol(lower) → module entry, cached across calls."""
        idx = getattr(self, "_mod_idx_cache", None)
        if idx is None:
            idx = {}
            mods = self._load_json("modules.json").get("modules", {})
            for groups in mods.values():
                for entries in groups.values():
                    for m in entries:
                        sym = str(m.get("symbol", "")).lower()
                        if sym:
                            idx[sym] = m
            self._mod_idx_cache = idx
        return idx

    def _ship_by_id(self, ship_id: str) -> dict:
        for s in self._load_json("ships.json").get("ships", []):
            if s.get("id") == ship_id:
                return s
        return {}

    def _blueprint_effects(self, blueprint_id: str, grade) -> dict:
        """Expand a from-scratch blueprint+grade into {coriolis_field: multiplier}
        so the stat engine can apply it (imported builds already carry the game's
        absolute modifiers instead)."""
        from core.outfitting import LABEL_TO_FIELD
        if not blueprint_id or grade is None:
            return {}
        bp = next((b for b in self.get_blueprints()
                   if b.get("id") == blueprint_id or b.get("name") == blueprint_id), None)
        if not bp:
            return {}
        grade_data = (bp.get("grades") or {}).get(str(grade)) or {}
        out = {}
        for e in grade_data.get("effects", []):
            field = LABEL_TO_FIELD.get(e.get("attribute", ""))
            if field and not field.startswith("_") and e.get("modifier") is not None:
                out[field] = e["modifier"]
        return out

    def compute_build(self, build: dict) -> dict:
        """coriolis-style stats for a build: {ship_id, slots:{key:{symbol,engineering}}}.
        Engineering per slot is either {modifiers:{...}} (imported, absolute) or
        {blueprint, grade, experimental} (from-scratch, expanded to multipliers)."""
        from core.outfitting import compute_stats
        ship = self._ship_by_id(build.get("ship_id", ""))
        if not ship:
            return {"error": "Unknown ship."}
        idx = self._module_symbol_index()
        fitted = []
        for slot_key, slot in (build.get("slots") or {}).items():
            if not slot or not slot.get("symbol"):
                continue
            mod = idx.get(str(slot["symbol"]).lower())
            if not mod:
                continue
            eng = slot.get("engineering")
            if eng and eng.get("blueprint") and not eng.get("modifiers"):
                eng = dict(eng)
                eng["blueprint_effects"] = self._blueprint_effects(
                    eng.get("blueprint"), eng.get("grade"))
            family = slot_key.split(":", 1)[0] if ":" in slot_key else mod.get("family")
            fitted.append({"family": family, "module": mod, "engineering": eng})
        return compute_stats(ship, fitted, unladen_override=build.get("unladen_mass"))

    _CORE_JOURNAL_SLOT = {
        "PowerPlant": "pp", "MainEngines": "t", "FrameShiftDrive": "fsd",
        "LifeSupport": "ls", "PowerDistributor": "pd", "Radar": "s", "FuelTank": "ft",
    }

    def import_current_build(self) -> dict:
        """Snapshot the live in-game loadout as a build (every module + its real
        engineering). Falls back to scanning the latest journal for a Loadout."""
        import re
        if not self._current_loadout.get("Modules"):
            self.get_ship_info()          # triggers journal self-heal → sets _current_loadout
        event = self._current_loadout
        if not event or not event.get("Modules"):
            return {"error": "No loadout found — launch the game so EDTC can read your ship."}

        idx = self._module_symbol_index()
        disp = _ship_display_name(event)
        ship_id = ""
        for s in self._load_json("ships.json").get("ships", []):
            if s.get("name", "").strip().lower() == disp.strip().lower():
                ship_id = s.get("id", ""); break

        core, weapons, utility, optional, military = {}, [], [], [], []
        for module in (event.get("Modules") or []):
            item = str(module.get("Item", "")).lower()
            mod = idx.get(item)
            if not mod:
                continue
            eng = module.get("Engineering") or {}
            engineering = None
            if eng:
                engineering = {
                    "blueprint": eng.get("BlueprintName", ""),
                    "grade": eng.get("Level"),
                    "quality": eng.get("Quality"),
                    "experimental": eng.get("ExperimentalEffect_Localised")
                                    or eng.get("ExperimentalEffect", ""),
                    "modifiers": {m.get("Label"): m.get("Value")
                                  for m in eng.get("Modifiers", []) if m.get("Label")},
                }
            fitted = {"symbol": mod.get("symbol"), "engineering": engineering}
            slot = module.get("Slot", "")
            cls = int(mod.get("class", 0))
            if slot in self._CORE_JOURNAL_SLOT:
                core[f"core:{self._CORE_JOURNAL_SLOT[slot]}"] = fitted
            elif slot.startswith("TinyHardpoint"):
                utility.append(fitted)
            elif re.match(r"(Small|Medium|Large|Huge)Hardpoint", slot):
                weapons.append((cls, fitted))
            elif slot.startswith("Slot"):
                m = re.search(r"Size(\d+)", slot)
                optional.append((int(m.group(1)) if m else cls, fitted))
            elif slot.startswith("Military"):
                military.append(fitted)
            # Armour/bulkheads, cosmetics, cockpit, cargo hatch → not fittable here

        slots = dict(core)
        for i, (_, f) in enumerate(sorted(weapons, key=lambda w: -w[0])):
            slots[f"hardpoint:{i}"] = f
        for i, f in enumerate(utility):
            slots[f"utility:{i}"] = f
        for i, (_, f) in enumerate(sorted(optional, key=lambda o: -o[0])):
            slots[f"optional:{i}"] = f
        for i, f in enumerate(military):
            slots[f"military:{i}"] = f

        return {
            "ship_id": ship_id,
            "ship_name": event.get("ShipName", ""),
            "ship_ident": event.get("ShipIdent", ""),
            "name": (event.get("ShipName") or disp or "Imported ship").strip(),
            "source": "import",
            "unladen_mass": event.get("UnladenMass"),
            "slots": slots,
        }

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
        if self._active_route and self._overlay_manager.is_user_enabled("route"):
            self._overlay_manager.show("route")
            # immediate emit covers an already-open window; the delayed push
            # covers a window show() is still creating (emit drops silently)
            self._overlay_manager.emit_to_overlay("route", "route_update", {
                "route": self._active_route,
                "current_system": self._current_system,
            })
            self._push_route_to_overlay()
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

    def _seed_overlay(self, name: str):
        """Push existing data into a just-opened overlay (no API bridge there)."""
        if name == "construction":
            self._push_cargo_to_overlay()
        elif name == "route":
            self._push_route_to_overlay()
        elif name == "fss":
            self._push_fss_to_overlay()
        elif name == "exo_tracker":
            self._push_exo_to_overlay()

    def show_overlay(self, name: str):
        self._overlay_manager.show(name)
        self._seed_overlay(name)

    def hide_overlay(self, name: str):
        self._overlay_manager.hide(name)

    def toggle_overlay(self, name: str):
        from core.database import set_pref
        new_state = self._overlay_manager.toggle(name)
        set_pref(f"overlay_auto_{name}", new_state)
        if new_state:
            self._seed_overlay(name)

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
        self._watchlist_cache = None
        return add_to_watchlist(cmdr, note)

    def remove_from_watchlist(self, cmdr: str) -> bool:
        from core.database import remove_from_watchlist
        self._watchlist_cache = None
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

    def get_construction_depots(self) -> list:
        """All known construction sites with delivery pace + ETA attached."""
        from core.database import get_depots, get_depot_rate
        depots = get_depots()
        for d in depots:
            remaining = sum(
                max(0, r.get("RequiredAmount", 0) - r.get("ProvidedAmount", 0))
                for r in d["resources"]
            )
            rate = get_depot_rate(d["market_id"]) if not d.get("complete") else None
            d["remaining"] = remaining
            d["rate_per_hour"] = round(rate) if rate else None
            d["eta_hours"] = round(remaining / rate, 1) if rate and remaining else None
        return depots

    def delete_construction_depot(self, market_id: int) -> bool:
        from core.database import delete_depot
        return delete_depot(market_id)

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

    def get_carriers(self, include_hidden: bool = False) -> list:
        from core.database import get_carriers
        return get_carriers(include_hidden)

    def set_carrier_owned(self, carrier_id: str, mine: bool) -> list:
        """Manual 'this is / isn't my carrier' override; wins over auto-detect."""
        from core.database import set_carrier_owned, get_carriers
        set_carrier_owned(carrier_id, mine)
        return get_carriers()

    def remove_carrier(self, carrier_id: str) -> list:
        """Hide a carrier from all lists. Hidden, not deleted — journal events
        for it keep updating the row silently and it can be restored."""
        from core.database import set_carrier_hidden, get_carriers
        set_carrier_hidden(carrier_id, True)
        return get_carriers()

    def restore_carrier(self, carrier_id: str) -> list:
        from core.database import set_carrier_hidden, get_carriers
        set_carrier_hidden(carrier_id, False)
        return get_carriers(include_hidden=True)

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

    # FSD fuel-curve constants (by drive size / rating class digit 1=E..5=A).
    # Size 8 power is extrapolated (+0.15 per size); the small error only shifts
    # mid-curve fuel estimates — max range stays exact because optimal_mass is
    # fitted to the journal's MaxJumpRange below.
    _FSD_FUEL_POWER = {2: 2.00, 3: 2.15, 4: 2.30, 5: 2.45, 6: 2.60, 7: 2.75, 8: 2.90}
    _FSD_FUEL_MULT = {1: 0.011, 2: 0.010, 3: 0.008, 4: 0.010, 5: 0.012}

    def plan_galaxy_route(self, origin: str, destination: str) -> dict:
        """Spansh Galaxy Plotter — every individual jump (incl. neutron boosts
        when worthwhile), not just neutron waypoints. Builds the FSD fuel model
        from the live Loadout; optimal_mass is derived from MaxJumpRange so
        engineering is automatically accounted for."""
        import asyncio
        from api.spansh import SpanshAPI

        ship = self._current_ship
        needed = ("max_jump_range", "unladen_mass", "fuel_capacity", "max_fuel_per_jump")
        if not ship or not all(ship.get(k) for k in needed) or not ship.get("fsd_size"):
            return {"error": "Ship loadout unknown — launch the game so EDTC can read your FSD.",
                    "systems": [], "total_jumps": 0, "total_distance": 0}

        power = self._FSD_FUEL_POWER.get(ship["fsd_size"], 2.45)
        mult = self._FSD_FUEL_MULT.get(ship["fsd_class"], 0.012)
        boost = ship.get("guardian_booster_bonus") or 0.0
        max_fuel = ship["max_fuel_per_jump"]
        reserve = ship.get("reserve_capacity") or 0.0
        base_mass = ship["unladen_mass"] + reserve
        # fuel = mult × (dist × mass / opt)^power  →  at max range (baseline mass,
        # full max_fuel burn):  opt = range × mass / (max_fuel / mult)^(1/power)
        optimal_mass = (ship["max_jump_range"] - boost) * (base_mass + max_fuel) \
            / (max_fuel / mult) ** (1.0 / power)
        cargo = sum(int(c.get("Count", 0)) for c in self._ship_cargo)

        params = {
            "source": origin,
            "destination": destination,
            "is_supercharged": 0,
            "use_supercharge": 1,
            "use_injections": 0,
            "exclude_secondary": 0,
            "fuel_power": power,
            "fuel_multiplier": mult,
            "optimal_mass": round(optimal_mass, 2),
            "supercharge_multiplier": 4.0,
            "base_mass": round(base_mass, 2),
            "tank_size": ship["fuel_capacity"],
            "internal_tank_size": reserve,
            "max_fuel_per_jump": max_fuel,
            "range_boost": boost,
            "cargo": cargo,
        }

        async def _run():
            spansh = SpanshAPI()
            try:
                jumps = await spansh.galaxy_route(params)
                total_dist = sum(j.get("distance", 0) for j in jumps)
                return {
                    "systems": [
                        {
                            "system": j.get("name", ""),
                            "distance_jumped": round(j.get("distance", 0), 2),
                            "distance_remaining": round(j.get("distance_to_destination", 0), 2),
                            "jumps": 1,
                            "neutron_star": j.get("has_neutron", False),
                            "scoopable": j.get("is_scoopable", False),
                            "must_refuel": j.get("must_refuel", False),
                            "fuel_used": round(j.get("fuel_used", 0), 2),
                        }
                        for j in jumps
                    ],
                    "total_jumps": max(0, len(jumps) - 1),
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

    def get_pinned_blueprints(self) -> list:
        from core.database import get_pinned_blueprints
        return get_pinned_blueprints()

    def pin_blueprint(self, blueprint_id: str, grade: str) -> list:
        from core.database import pin_blueprint, get_pinned_blueprints
        pin_blueprint(blueprint_id, grade)
        return get_pinned_blueprints()

    def unpin_blueprint(self, blueprint_id: str, grade: str) -> list:
        from core.database import unpin_blueprint, get_pinned_blueprints
        unpin_blueprint(blueprint_id, grade)
        return get_pinned_blueprints()

    def set_pin_rolls(self, blueprint_id: str, grade: str, rolls: int) -> list:
        from core.database import set_pin_rolls, get_pinned_blueprints
        set_pin_rolls(blueprint_id, grade, rolls)
        return get_pinned_blueprints()

    def get_synthesis_recipes(self) -> list:
        return self._load_json("synthesis.json").get("synthesis", [])

    def get_tech_broker_items(self) -> list:
        return self._load_json("tech_brokers.json").get("items", [])

    def find_material_traders(self, system: str = "", trader_type: str = "") -> dict:
        """Nearest material traders via Spansh. trader_type '' = all,
        else 'Raw' | 'Manufactured' | 'Encoded'."""
        return self._find_station_service("material_trader", system, trader_type)

    def find_tech_brokers(self, system: str = "", broker_type: str = "") -> dict:
        """Nearest technology brokers via Spansh. broker_type '' = all,
        else 'Guardian' | 'Human'."""
        return self._find_station_service("technology_broker", system, broker_type)

    def _find_station_service(self, kind: str, system: str, type_filter: str) -> dict:
        import asyncio
        from api.spansh import SpanshAPI
        ref = system.strip() or self._current_system
        if not ref:
            return {"error": "No reference system — enter one or launch the game.", "results": []}

        async def _run():
            spansh = SpanshAPI()
            try:
                if kind == "material_trader":
                    stations = await spansh.material_traders(ref, type_filter or None)
                else:
                    stations = await spansh.tech_brokers(ref, type_filter or None)
                return {
                    "reference": ref,
                    "results": [
                        {
                            "system": s.get("system_name", ""),
                            "station": s.get("name", ""),
                            # badge shown in the UI: trader or broker type
                            "trader": s.get(kind, "") or "",
                            "distance": round(s.get("distance") or 0, 1),
                            "arrival": round(s.get("distance_to_arrival") or 0),
                            "station_type": s.get("type", ""),
                            "large_pad": s.get("has_large_pad", None),
                            "planetary": s.get("is_planetary", False),
                        }
                        for s in stations
                    ],
                }
            finally:
                await spansh.close()
        try:
            return asyncio.run(_run())
        except Exception as e:
            return {"error": str(e), "results": []}

    def get_materials(self) -> list:
        from core.database import get_materials
        return get_materials()

    def set_material_count(self, name: str, category: str, count: int) -> None:
        from core.database import set_material_count
        set_material_count(name, category, count)
        self._emit("materials_changed", {})

    def _handle_eddn_message(self, msg: dict):
        schema = msg.get("$schemaRef", "")
        if "journal" in schema:
            self._handle_eddn_journal(msg.get("message", {}))
            return
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

    def _handle_eddn_journal(self, message: dict):
        """Every journal-schema message (any player's FSDJump/Scan/Location/...)
        carries StarPos — bin it into the live scan-coverage grid."""
        star_pos = message.get("StarPos")
        if not (isinstance(star_pos, list) and len(star_pos) == 3):
            return
        import time
        from core.database import coverage_cell, bump_coverage_cells
        cell = coverage_cell(star_pos[0], star_pos[1], star_pos[2])
        with self._cov_lock:
            self._cov_buf[cell] = self._cov_buf.get(cell, 0) + 1
            now = time.time()
            if now - self._cov_last_flush < 15:
                return
            buf, self._cov_buf = self._cov_buf, {}
            self._cov_last_flush = now
        try:
            bump_coverage_cells("live", buf)
        except Exception as e:
            logging.warning(f"coverage flush failed: {e}")

    def get_market_stats(self) -> dict:
        import time
        now = time.time()
        if self._market_stats_cache and now - self._market_stats_time < 30:
            return self._market_stats_cache
        from core.database import get_market_stats
        self._market_stats_cache = get_market_stats()
        self._market_stats_time = now
        return self._market_stats_cache

    # --- Galaxy scan coverage ---

    def _refresh_week_coverage(self):
        """Download EDSM's 'systems updated in the last 7 days' dump (~5 MB)
        and rebuild the 'week' coverage layer. Runs at most once per 20h."""
        import gzip
        import time
        import urllib.request
        from datetime import datetime, timezone
        from core.database import get_pref, set_pref, coverage_cell, replace_coverage_layer

        last = get_pref("coverage_week_refreshed", "")
        if last:
            try:
                age_h = (time.time() - float(last)) / 3600
                if age_h < 20:
                    return
            except ValueError:
                pass
        try:
            url = "https://www.edsm.net/dump/systemsWithCoordinates7days.json.gz"
            req = urllib.request.Request(url, headers={"User-Agent": f"EDTC/{APP_VERSION}"})
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = gzip.decompress(resp.read())
            cells: dict[tuple, int] = {}
            n = 0
            # Dump is a JSON array, one object per line: strip array/comma noise
            for line in raw.decode("utf-8", errors="replace").splitlines():
                line = line.strip().rstrip(",")
                if not line.startswith("{"):
                    continue
                try:
                    coords = json.loads(line).get("coords") or {}
                    cell = coverage_cell(coords["x"], coords["y"], coords["z"])
                except (KeyError, ValueError):
                    continue
                cells[cell] = cells.get(cell, 0) + 1
                n += 1
            if not cells:
                logging.warning("coverage: EDSM week dump parsed to 0 systems, keeping old layer")
                return
            replace_coverage_layer("week", cells)
            set_pref("coverage_week_refreshed", str(time.time()))
            logging.info(f"coverage: week layer rebuilt — {n} systems into {len(cells)} cells")
            self._emit("coverage_updated", {"layer": "week", "systems": n, "cells": len(cells)})
        except Exception as e:
            logging.warning(f"coverage: week refresh failed: {e}")

    def _import_alltime_density(self):
        """Seed the 'alltime' layer from the bundled snapshot built by
        scripts/build_density.py (EDSM full dump, ~150M systems). Import is
        skipped when the bundled snapshot has already been loaded."""
        import gzip
        path = BASE_DIR / "data" / "galaxy_density_alltime.json.gz"
        if not path.exists():
            return
        from core.database import get_pref, set_pref, replace_coverage_layer
        try:
            with gzip.open(path, "rt", encoding="utf-8") as f:
                data = json.load(f)
            stamp = data.get("generated", "")
            if not stamp or get_pref("coverage_alltime_imported", "") == stamp:
                return
            raw = data.get("cells", [])
            if raw and len(raw[0]) == 4:
                cells = {(c[0], c[1], c[2]): c[3] for c in raw}
            else:
                # Legacy 2D snapshot (pre height bands) — flatten into band 0
                cells = {(c[0], 0, c[1]): c[2] for c in raw}
            if cells:
                replace_coverage_layer("alltime", cells)
                set_pref("coverage_alltime_imported", stamp)
                logging.info(f"coverage: alltime layer imported — {len(cells)} cells (snapshot {stamp})")
        except Exception as e:
            logging.warning(f"coverage: alltime import failed: {e}")

    def get_galaxy_coverage(self, layer: str = "week", bounds: list | None = None,
                            y_band: int | None = None) -> dict:
        from core.database import (get_coverage_layer, get_coverage_y_bands,
                                   bump_coverage_cells, COVERAGE_CELL_LY,
                                   COVERAGE_Y_BAND_LY, get_pref)
        if layer == "live":
            # Flush any buffered EDDN cells so the map is current
            with self._cov_lock:
                buf, self._cov_buf = self._cov_buf, {}
            if buf:
                try:
                    bump_coverage_cells("live", buf)
                except Exception:
                    pass
        cells = get_coverage_layer(layer, bounds, y_band)
        # Sector views (bounds given) also get the list of height bands with
        # data so the UI can offer only meaningful levels to cycle through.
        y_bands = get_coverage_y_bands(layer, bounds) if bounds else []
        cell_ly = COVERAGE_CELL_LY
        # The alltime layer can hold millions of 300-ly cells; for the full
        # galaxy view aggregate to keep the bridge payload reasonable. The
        # map renders ~2 px per 300 ly, so 4x aggregation loses nothing.
        if not bounds and len(cells) > 150_000:
            f = 4
            agg: dict[tuple, int] = {}
            for gx, gz, c in cells:
                k = (gx // f, gz // f)
                agg[k] = agg.get(k, 0) + c
            cells = [[gx, gz, c] for (gx, gz), c in agg.items()]
            cell_ly = COVERAGE_CELL_LY * f
        refreshed = get_pref("coverage_week_refreshed", "") if layer == "week" else ""
        return {
            "cells": cells,
            "cell_ly": cell_ly,
            "y_band_ly": COVERAGE_Y_BAND_LY,
            "y_bands": y_bands,
            "refreshed": refreshed,
        }

    def get_current_position(self) -> dict:
        """Current system name + galactic coords (if known) for map markers."""
        from core.database import get_system_coords
        if not self._current_system:
            return {}
        coords = get_system_coords(self._current_system)
        if not coords:
            return {"system": self._current_system}
        return {"system": self._current_system, "x": coords[0], "y": coords[1], "z": coords[2]}

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
            if "no access allowed" in msg.lower():
                return {"ok": False, "error": "Your key is valid, but EDTC is not yet registered as an app with Inara — Inara integration stays disabled until Inara grants access"}
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

    # --- Awards / Commendations ---

    def _assemble_award_data(self) -> dict:
        """Gather everything the award catalogue evaluates against."""
        from core.database import (get_cmdr_stats, get_engineer_progress,
                                   get_carriers, get_logbook, get_guardian_visits)
        stats = get_cmdr_stats()
        eng = get_engineer_progress()
        engineers_unlocked = sum(
            1 for e in eng.values()
            if (e.get("rank") or 0) > 0 or str(e.get("status", "")).lower() == "unlocked"
        )
        own_carrier = 1 if any(c.get("is_mine") for c in get_carriers()) else 0
        return {
            "stats": stats.get("statistics", {}) or {},
            "ranks": stats.get("ranks", {}) or {},
            "engineers_unlocked": engineers_unlocked,
            "own_carrier": own_carrier,
            "logbook_count": len(get_logbook()),
            "guardian_visited": len(get_guardian_visits()),
        }

    def get_awards(self) -> dict:
        """Evaluate + persist awards; returns the full catalogue with progress
        plus a summary. Called by the Awards page on load."""
        from core.awards import evaluate, CATEGORIES
        from core.database import record_awards
        awards, newly = record_awards(evaluate(self._assemble_award_data()))
        earned = [a for a in awards if a["earned_tier"] >= 0]
        return {
            "awards": awards,
            "categories": CATEGORIES,
            "earned_count": len(earned),
            "total_count": len(awards),
            "medals": sum(a["earned_tier"] + 1 for a in earned),
            "newly": newly,
        }

    def _refresh_awards(self):
        """Re-evaluate after stat/rank changes; push a toast for anything newly
        earned this session."""
        try:
            from core.awards import evaluate
            from core.database import record_awards
            _, newly = record_awards(evaluate(self._assemble_award_data()))
            if newly:
                self._emit("awards_earned", {"newly": newly})
        except Exception as e:
            logging.warning(f"award refresh failed: {e}")

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
                    # Loadout's MaxJumpRange assumes zero cargo, a full reserve
                    # tank, and just enough main fuel for one jump — scale from
                    # that baseline mass, not bone-dry unladen, or the estimate
                    # runs ~0.3% low. Current mass includes the live reservoir.
                    reserve_cap = info.get("reserve_capacity") or 0.0
                    reservoir = status.get("Fuel", {}).get("FuelReservoir", 0) or 0
                    reservoir = min(reservoir, reserve_cap) if reserve_cap else reservoir
                    base_mass = unladen + reserve_cap + (info.get("max_fuel_per_jump") or 0.0)
                    current_mass = unladen + fuel + reservoir + cargo
                    guardian_bonus = info.get("guardian_booster_bonus", 0.0)
                    fsd_base = max_range - guardian_bonus
                    current_fsd = fsd_base * (base_mass / current_mass)
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

    def get_ships(self) -> list:
        """Full ship reference (slots/modules per ship). Flags the ship the
        commander is currently flying via display-name match against the
        active Loadout, so the Ships page can highlight it."""
        ships = self._load_json("ships.json").get("ships", [])
        current = ""
        if self._current_ship:
            current = _SHIP_DISPLAY_NAMES.get(
                str(self._current_ship.get("ship", "")).lower(), ""
            )
        cur_norm = current.strip().lower()
        for s in ships:
            s["is_current"] = bool(cur_norm) and s.get("name", "").strip().lower() == cur_norm
        return ships

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
            expected_sha256 = None
            try:
                release = self._fetch_highest_release(urllib.request)
                if release:
                    asset = next(
                        (a for a in release.get("assets", []) if a["name"] == "EDTC.exe"),
                        None,
                    )
                    if asset and asset.get("browser_download_url"):
                        download_url = asset["browser_download_url"]
                        # GitHub publishes a sha256 digest per asset — use it to verify the download
                        digest = asset.get("digest") or ""
                        if digest.startswith("sha256:"):
                            expected_sha256 = digest.removeprefix("sha256:").lower()
                        logging.info(f"Update: using fresh URL for {release.get('tag_name')} (sha256: {expected_sha256 or 'unavailable'})")
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

            data = b"".join(chunks)
            if expected_sha256:
                import hashlib
                actual = hashlib.sha256(data).hexdigest()
                if actual != expected_sha256:
                    raise RuntimeError(
                        f"Checksum mismatch — download corrupt or tampered (expected {expected_sha256[:12]}…, got {actual[:12]}…)"
                    )
                logging.info("Update: sha256 checksum verified")
            else:
                logging.warning("Update: no checksum available from GitHub — skipping verification")
            tmp.write_bytes(data)
            self._emit("update_progress", {"pct": 100, "status": "installing"})

            bat = Path(tempfile.gettempdir()) / "edtc_update.bat"
            log = "%TEMP%\\edtc_copy.log"
            bat.write_text(
                f"@echo off\r\n"
                f'echo === update started %date% %time% >> "{log}"\r\n'
                f"timeout /t 3 /nobreak > nul\r\n"
                f"taskkill /f /im EDTC.exe >nul 2>&1\r\n"
                f"timeout /t 2 /nobreak > nul\r\n"
                f'copy /y "{tmp}" "{exe_path}" >> "{log}" 2>&1\r\n'
                f'if %errorlevel% neq 0 (echo copy FAILED errorlevel %errorlevel% >> "{log}" & exit /b 1)\r\n'
                f'powershell -Command "Unblock-File -LiteralPath \'{exe_path}\'" >> "{log}" 2>&1\r\n'
                f"timeout /t 1 /nobreak > nul\r\n"
                f'echo relaunching >> "{log}"\r\n'
                f'powershell -Command "Start-Process -FilePath \'{exe_path}\' -WorkingDirectory \'{exe_path.parent}\'" >> "{log}" 2>&1\r\n'
                f'if %errorlevel% neq 0 (echo Start-Process FAILED errorlevel %errorlevel%, falling back to explorer >> "{log}" & explorer.exe "{exe_path}")\r\n'
                f'echo relaunch step done >> "{log}"\r\n'
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
    # The DB lives next to the exe — running from a write-protected folder
    # (Program Files, a zip preview, …) makes every write fail silently and
    # the app looks like it "just doesn't track anything". Fail loudly instead.
    try:
        init_db()
    except Exception as e:
        logging.critical(f"Database init failed at {DB_PATH}: {e}")
        if sys.platform == "win32":
            import ctypes
            ctypes.windll.user32.MessageBoxW(
                None,
                f"EDTC can't create or write its database:\n{DB_PATH}\n\n{e}\n\n"
                "Move EDTC.exe to a writable folder (e.g. "
                "C:\\Users\\<you>\\AppData\\Local\\EDTC) and launch it again.",
                "EDTC — database error",
                0x10,  # MB_ICONERROR
            )
        raise
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

    def _shutdown_overlays():
        # User request: overlays always start disabled on launch — a stuck or
        # misbehaving overlay is then always recoverable by restarting the app,
        # at the cost of re-enabling the ones you want each session.
        try:
            from core.database import set_pref
            from core.overlay import OVERLAYS
            for name in OVERLAYS:
                set_pref(f"overlay_auto_{name}", False)
            logging.info("shutdown: all overlay auto-enable prefs cleared")
        except Exception as e:
            logging.warning(f"shutdown: failed clearing overlay prefs: {e}")
        api._overlay_manager.close_all()

    window.events.closed += _shutdown_overlays

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
            if api._current_station:
                # launched while docked — seed and push the station market
                api._push_station_market()
            if api._current_ship:
                api._emit("ship_changed", api.get_ship_info())
            if api._current_system:
                api._emit("system_changed", {"system": api._current_system})
        threading.Thread(target=_push_startup, daemon=True).start()
        threading.Thread(target=api._refresh_week_coverage, daemon=True).start()
        threading.Thread(target=api._import_alltime_density, daemon=True).start()

    webview.start(debug=DEV_MODE, func=_on_ready)


if __name__ == "__main__":
    main()
