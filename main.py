import json
import sys
import threading
from pathlib import Path

import webview

from core.database import init_db
from core.journal import JournalWatcher
from core.overlay import OverlayManager
from core.tray import TrayIcon

BASE_DIR = Path(__file__).parent
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
        self._active_route: dict | None = None
        self._current_system: str = ""
        # exo state: (system, body, species) -> scan_count
        self._exo_state: dict[tuple, int] = {}
        self._fss_bodies: list[dict] = []
        # auto-jump state
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

    def show_overlay(self, name: str):
        self._overlay_manager.show(name)

    def hide_overlay(self, name: str):
        self._overlay_manager.hide(name)

    def toggle_overlay(self, name: str):
        self._overlay_manager.toggle(name)

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


def main():
    init_db()

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
