# EDTC — Session Handoff

> **New session? Read this file first, then read the project brief.**
> Brief location: `C:\Users\Keagan\OneDrive\Desktop\EDT\elite-companion-claude-code-brief.md`
> Checklist location: `C:\Users\Keagan\OneDrive\Desktop\EDT\EDT\EDT-checklist.md`

---

## Project snapshot

- **App name:** EDTC (Elite Dangerous Tools & Companion)
- **Project root:** `C:\Users\Keagan\OneDrive\Desktop\EDT\EDT\`
- **Stack:** Python + pywebview + React + Vite + Tailwind + SQLite
- **Distribution:** PyInstaller → single .exe, released via GitHub Releases

## Decisions locked in

| Decision | Answer |
|---|---|
| App name | EDTC |
| Auto-jump / autopilot | Implemented with prominent Frontier ToS warning modal in FleetCarriers.jsx |
| Frontier CAPI / OAuth | Deferred — later phase |
| Repo visibility | Public — https://github.com/keaganbmackinnon-coder/EDTC |
| Overlay URL scheme | `?overlay=<key>` query param — works for both dev (localhost:5173) and prod (file://) |
| Route clipboard hotkey | Ctrl+Shift+C (global, via `keyboard` lib) |

---

## Build status — Session 1 (COMPLETE)

| Item | Status | File |
|---|---|---|
| Directory structure | DONE | all dirs created |
| `main.py` (pywebview entry point + API class) | DONE | `main.py` |
| `requirements.txt` | DONE | `requirements.txt` |
| `pyproject.toml` | DONE | `pyproject.toml` |
| `.gitignore` | DONE | `.gitignore` |
| `core/database.py` (SQLite init + CRUD) | DONE | `core/database.py` |
| `core/journal.py` (watchdog watcher) | DONE | `core/journal.py` |
| `core/overlay.py` (overlay window mgmt) | DONE | `core/overlay.py` |
| `core/tray.py` (pystray system tray) | DONE | `core/tray.py` |
| `api/base.py` (rate-limit request wrapper) | DONE | `api/base.py` |
| `api/edsm.py` | DONE | `api/edsm.py` |
| `api/spansh.py` | DONE | `api/spansh.py` |
| `api/eddn.py` (WebSocket) | DONE | `api/eddn.py` |
| `data/` static JSON stubs (9 files) | DONE | `data/*.json` |
| React + Vite frontend scaffold | DONE | `frontend/` |
| Tailwind CSS config | DONE | `frontend/tailwind.config.js` |
| pywebview JS/Python bridge | DONE | `main.py` API class + `frontend/src/main.jsx` |
| React Router + 10 module pages | DONE | `frontend/src/App.jsx` + `pages/` |
| `.github/workflows/build.yml` (CI/CD) | DONE | `.github/workflows/build.yml` |
| `README.md` | DONE | `README.md` |

---

## Build status — Session 2 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `core/audio.py` — pygame.mixer synthesised beep | DONE | `core/audio.py` |
| CMDR Ping overlay (audio + auto-dismiss popup + watchlist) | DONE | `overlays/CmdrPing.jsx` |
| Route Following overlay (FSDJump tracking, progress bar, clipboard hotkey) | DONE | `overlays/Route.jsx` |
| FSS Values overlay (body scan value estimates) | DONE | `overlays/FssValues.jsx` |
| System Preview overlay (auto-hides 15s after jump) | DONE | `overlays/SystemPreview.jsx` |
| Exobiology Tracker overlay (1/3 2/3 3/3 scan dots per species) | DONE | `overlays/ExoTracker.jsx` |
| Construction Materials overlay (commodity progress bars) | DONE | `overlays/Construction.jsx` |
| `Navigation.jsx` — route paste UI + active route status panel | DONE | `pages/Navigation.jsx` |
| `Overlays.jsx` — toggle panel + watchlist manager + construction project manager | DONE | `pages/Overlays.jsx` |
| `App.jsx` — overlay mode via `?overlay=<key>` query param | DONE | `App.jsx` |
| `database.py` — exo_scans, construction_projects tables; watchlist CRUD; routes.active column | DONE | `core/database.py` |
| `journal.py` — ColonisationContribution, ColonisationConstructionDepot events | DONE | `core/journal.py` |
| `overlay.py` — emit_to_overlay(), hide_after(), prod URL support, exo_tracker config | DONE | `core/overlay.py` |
| `main.py` — full event routing for all 6 overlays, all API methods, keyboard hotkey | DONE | `main.py` |

---

## Key architecture notes

- pywebview serves React from `frontend/dist/` (prod) or `localhost:5173` (dev mode: `python main.py --dev`)
- Python↔JS bridge: `window.pywebview.api.methodName()` → returns a Promise
- JS←Python events: backend calls `window.__edtc.onEvent({type, payload})` — listener set up in `frontend/src/main.jsx`
- Overlays = separate pywebview windows (`transparent=True`, `on_top=True`) managed in `core/overlay.py`
- **Overlay URL scheme:** `?overlay=<key>` — App.jsx reads the query param and renders only the overlay component (no sidebar)
- **Overlay event push:** `overlay_manager.emit_to_overlay(name, event_type, payload)` calls `evaluate_js` on the overlay window
- 6 overlays configured in `core/overlay.py`: `cmdr_ping`, `route`, `fss`, `system_preview`, `exo_tracker`, `construction`
- **CMDR ping logic:** pings everyone when watchlist is empty; pings only watchlist members when entries exist
- **Exo scans:** count `ScanOrganic.ScanType == "Analysed"` events per (system, body, species) — 3 = complete. Also persisted in SQLite `exo_scans` table.
- **Construction:** user enters commodity requirements manually in Overlays page; `ColonisationContribution` journal events auto-decrement remaining counts
- **System preview:** auto-hides after 15 seconds; updates body count when `FSSDiscoveryScan` fires
- **Ctrl+Shift+C** global hotkey → copies next route destination to clipboard (set up in `_setup_hotkeys()` in main.py)
- Static data in `data/*.json` — minimal stubs, replace with full EDCD datasets (links in README)
- Journal path (Windows): `%USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous\`
- Auto-jump: ToS warning UI in `FleetCarriers.jsx` — backend logic not yet implemented

---

## Known issues / notes for next session

- `routes.active` column: added in session 2 schema. If DB existed from before session 2, run: `ALTER TABLE routes ADD COLUMN active INTEGER DEFAULT 0;`
- CMDR ping `hide_after(8s)`: if a second ping arrives within 8 seconds, the first timer will hide the new ping early. Fix: track and cancel pending timers.
- Exobiology: if the game fires `ScanOrganic.ScanType == "Logged"` as the final event (rather than a third `Analysed`), adjust `_handle_scan_organic()` in `main.py` accordingly.
- `keyboard` hotkey: may need elevated privileges on Linux. Works without admin on Windows.

---

## Build status — Session 3 (COMPLETE)

| Item | Status | File |
|---|---|---|
| Colonisation.jsx — full tabbed UI (replaces all "Coming Soon" stubs) | DONE | `frontend/src/pages/Colonisation.jsx` |
| Tab 1: Build Progress Tracker (project cards + per-commodity progress bars) | DONE | `frontend/src/pages/Colonisation.jsx` |
| Tab 2: Aggregated Shopping List (net remaining across active projects) | DONE | `frontend/src/pages/Colonisation.jsx` |
| Tab 3: FC Cargo (auto-tracked via CargoTransfer + manual override) | DONE | `frontend/src/pages/Colonisation.jsx` |
| Tab 4: Market Finder (Spansh nearest commodity search) | DONE | `frontend/src/pages/Colonisation.jsx` |
| `fc_cargo` DB table + get/set/update functions | DONE | `core/database.py` |
| `CargoTransfer` journal event handler | DONE | `main.py` |
| FC cargo API methods (get/set/clear) | DONE | `main.py` |
| `search_commodity_markets` API method (calls Spansh) | DONE | `main.py` |
| `construction_update` event also emitted to main window (live updates in Colonisation tab) | DONE | `main.py` |
| `commodity_markets()` method in SpanshAPI | DONE | `api/spansh.py` |
| GitHub repo initialised and pushed | DONE | https://github.com/keaganbmackinnon-coder/EDTC |

---

## Known issues / notes for next session

- `routes.active` column: added in session 2 schema. If DB existed from before session 2, run: `ALTER TABLE routes ADD COLUMN active INTEGER DEFAULT 0;`
- CMDR ping `hide_after(8s)`: if a second ping arrives within 8 seconds, the first timer will hide the new ping early. Fix: track and cancel pending timers.
- Exobiology: if the game fires `ScanOrganic.ScanType == "Logged"` as the final event (rather than a third `Analysed`), adjust `_handle_scan_organic()` in `main.py` accordingly.
- `keyboard` hotkey: may need elevated privileges on Linux. Works without admin on Windows.
- **Spansh commodity search**: `/api/stations/search` with `market[name][]` param — verify this works in-game. Response field names (`distance_to_arrival`, `market[].sell_price`, `market[].supply`) are best-guess from Spansh API conventions; may need adjusting if response shape differs.
- **FC cargo tracking**: `CargoTransfer` only fires when YOU personally move cargo to/from your FC. Cargo sold by your market, loaded by NPCs, or present before EDTC started won't be tracked. "Edit Manually" on the FC Cargo tab handles this.
- System Planner + Economy Simulator and Nexus Building Planner are still unbuilt (need authoritative game data for building types/costs/economy contributions — suggest sourcing from EDCD or community wikis).

---

## Dev setup (run this before first session)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

Run in dev mode (two terminals):
```
Terminal 1:  cd frontend && npm run dev
Terminal 2:  python main.py --dev
```

---

## Build status — Session 4 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `FleetCarriers.jsx` — 3-tab implementation (Stats / Route Planner / Auto-Jump) | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| Carrier Stats tab — fuel bar, cargo space, credits, services, pending jump | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| Route Planner tab — Spansh FC route, jump list, tritium estimate + stock check | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| Auto-Jump tab — ToS gate, keyboard automation, configurable key + delay, countdown | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| `carriers` DB table + `upsert_carrier`, `get_carriers` | DONE | `core/database.py` |
| CarrierStats / CarrierJump / CarrierJumpRequest / CarrierJumpCancelled / CarrierDepositFuel / CarrierBuy added to WATCHED_EVENTS | DONE | `core/journal.py` |
| `_handle_carrier_*` handlers + `_schedule_next_jump()` auto-jump timer | DONE | `main.py` |
| `plan_fc_route`, `start_auto_jump`, `stop_auto_jump`, `get_auto_jump_status` API methods | DONE | `main.py` |

## Known issues / notes for next session

- `routes.active` column: if DB existed from before session 2, run: `ALTER TABLE routes ADD COLUMN active INTEGER DEFAULT 0;`
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early. Fix: cancel pending timer before scheduling new one.
- Exobiology: if final scan fires `ScanType == "Logged"` not `"Analysed"`, adjust `_handle_scan_organic()`.
- **Spansh commodity search** (`/api/stations/search`): response field names are best-guess — verify and adjust if needed.
- **FC cargo auto-tracking**: only tracks your own CargoTransfer events. Pre-existing FC cargo needs manual entry.
- **Tritium estimate**: defaults to 50T/jump — actual cost varies by distance; let user adjust in UI.
- **Auto-jump**: fires a keypress to the active window — game must be in focus. Key defaults to `j` (standard FSD bind).
- **Carrier stats location**: `CarrierStats` event fires when you open Carrier Management in-game. Location updates on `CarrierJump` events.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt.

*Last updated: Session 5 complete — Engineering page done*

---

## Build status — Session 5 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `materials` DB table + `upsert_material`, `set_material_count`, `get_materials` | DONE | `core/database.py` |
| `engineer_progress` DB table + `get_engineer_progress`, `upsert_engineer_progress` | DONE | `core/database.py` |
| `MaterialTrade`, `EngineerCraft`, `Synthesis` added to WATCHED_EVENTS | DONE | `core/journal.py` |
| `_handle_material_collected/discarded/trade/engineer_craft/synthesis_used` | DONE | `main.py` |
| `_handle_engineer_progress` (single + array form) | DONE | `main.py` |
| `get_materials`, `set_material_count` API methods | DONE | `main.py` |
| `get_engineers`, `get_blueprints`, `get_synthesis_recipes`, `get_tech_broker_items` API methods | DONE | `main.py` |
| `Engineering.jsx` — 5-tab UI (Engineers / Blueprints / Synthesis / Tech Broker / Materials) | DONE | `frontend/src/pages/Engineering.jsx` |
| Engineers tab — specialty filter chips, unlock/rank badge from journal progress | DONE | `frontend/src/pages/Engineering.jsx` |
| Blueprints tab — search, accordion per grade, material have/need cross-ref, craftable indicator | DONE | `frontend/src/pages/Engineering.jsx` |
| Synthesis tab — category filter, craftable check vs inventory, grade badge | DONE | `frontend/src/pages/Engineering.jsx` |
| Tech Broker tab — Guardian/Human type filter, unlockable indicator | DONE | `frontend/src/pages/Engineering.jsx` |
| Materials tab — sub-tabs Raw/Manufactured/Encoded, inline count edit, bulk import, fill bar | DONE | `frontend/src/pages/Engineering.jsx` |

## Known issues / notes for next session

- `routes.active` column: if DB existed from before session 2, run: `ALTER TABLE routes ADD COLUMN active INTEGER DEFAULT 0;`
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early.
- Exobiology: if final scan fires `ScanType == "Logged"` not `"Analysed"`, adjust `_handle_scan_organic()`.
- **Data stubs**: `data/blueprints.json`, `data/engineers.json`, `data/synthesis.json`, `data/tech_brokers.json` are minimal stubs. Engineering page shows "No items found" until replaced with full EDCD datasets. EDCD links in README.
- **Material names**: DB stores names lowercase. Blueprint/synthesis JSON material names should match (case-insensitive comparison applied in Engineering.jsx via `.toLowerCase()`).
- **EngineerCraft category tracking**: Ingredients in the craft event don't include category. `upsert_material` retains existing category on delta updates; new materials inserted with empty category, corrected on next `MaterialCollected` event.
- Remaining stub pages: Exploration, Galaxy, Guardian, Trading (all still "Coming Soon").
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt.

---

## Build status — Session 6 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `cmdr_stats` DB table + `set_cmdr_stat`, `get_cmdr_stats` | DONE | `core/database.py` |
| `logbook` DB table + `get_logbook`, `save_log_entry`, `delete_log_entry` | DONE | `core/database.py` |
| `Rank`, `Progress`, `Statistics`, `Reputation` added to WATCHED_EVENTS | DONE | `core/journal.py` |
| `_handle_commander`, `_handle_load_game`, `_handle_rank`, `_handle_progress`, `_handle_statistics` | DONE | `main.py` |
| `lookup_commander`, `get_cmdr_stats`, `get_current_system` API methods | DONE | `main.py` |
| `get_logbook`, `save_log_entry`, `delete_log_entry` API methods | DONE | `main.py` |
| `get_screenshots`, `open_file`, `open_screenshots_folder` API methods | DONE | `main.py` |
| `Commander.jsx` — 4-tab UI (CMDR Lookup / My Stats / Logbook / Screenshots) | DONE | `frontend/src/pages/Commander.jsx` |
| CMDR Lookup tab — EDSM search by name, shows last system + date + coords | DONE | `frontend/src/pages/Commander.jsx` |
| My Stats tab — journal-tracked ranks with progress bars, credits, ship info, statistics groups | DONE | `frontend/src/pages/Commander.jsx` |
| Logbook tab — SQLite-backed personal notes with title/system/body, create/edit/delete | DONE | `frontend/src/pages/Commander.jsx` |
| Screenshots tab — lists files from ED screenshot folder, Open + Open Folder buttons | DONE | `frontend/src/pages/Commander.jsx` |

## Known issues / notes for next session

- Stats only populate after logging into Elite Dangerous with EDTC running (Rank/Progress/Statistics/Commander/LoadGame events fire on game start).
- EDSM CMDR lookup requires the searched CMDR to have opted in to sharing position publicly.
- `open_file` and `open_screenshots_folder` use `os.startfile()` — Windows only.
- Remaining stub pages: Galaxy, Guardian, Trading (all still "Coming Soon").

---

## Build status — Session 7 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `scan_update` emitted to main window from `_handle_scan` | DONE | `main.py` |
| `exo_scan` emitted to main window from `_handle_scan_organic` | DONE | `main.py` |
| `system_changed` emitted on FSDJump and Location events | DONE | `main.py` |
| `get_fss_bodies`, `lookup_system`, `road_to_riches` API methods | DONE | `main.py` |
| `Exploration.jsx` — 4-tab UI (System Lookup / Road to Riches / Exobiology / Session Scanner) | DONE | `frontend/src/pages/Exploration.jsx` |
| System Lookup tab — EDSM search: system info card + collapsible body list | DONE | `frontend/src/pages/Exploration.jsx` |
| Road to Riches tab — Spansh route with per-system body value breakdown | DONE | `frontend/src/pages/Exploration.jsx` |
| Exobiology tab — DB-backed scan tracker, grouped by system, clear per system | DONE | `frontend/src/pages/Exploration.jsx` |
| Session Scanner tab — live FSS scan log, resets on jump, total value estimate | DONE | `frontend/src/pages/Exploration.jsx` |

## Known issues / notes for next session

- Road to Riches Spansh job takes ~10-30s; Promise blocks until done — normal.
- EDSM body data only available for systems that have been visited and submitted by players.
- Exobiology tab uses `get_exo_scans()` which returns in-progress (incomplete) scans only. Completed scans are cleared from the active list but remain in DB; no history view yet.
- Remaining stub pages: Guardian, Trading (all still "Coming Soon").

---

## Build status — Session 8 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `get_news`, `get_factions`, `get_stats` added to EdsmAPI | DONE | `api/edsm.py` |
| `_edsm_run` helper + `get_galnet`, `get_system_factions`, `get_system_traffic`, `get_galaxy_stats` API methods | DONE | `main.py` |
| `Galaxy.jsx` — 4-tab UI (GalNet / Factions / Traffic / Galaxy Stats) | DONE | `frontend/src/pages/Galaxy.jsx` |
| GalNet tab — live EDSM news, expandable articles with HTML stripped | DONE | `frontend/src/pages/Galaxy.jsx` |
| Factions tab — system search, influence bars, allegiance colors, state chips (active + pending) | DONE | `frontend/src/pages/Galaxy.jsx` |
| Traffic tab — system traffic totals (total/week/day) + ship breakdown bars | DONE | `frontend/src/pages/Galaxy.jsx` |
| Galaxy Stats tab — EDSM universe stats: commanders, systems, bodies, stations, logs | DONE | `frontend/src/pages/Galaxy.jsx` |

## Known issues / notes for next session

- GalNet content may contain HTML entities — stripped with regex but complex HTML may show raw.
- EDSM faction/traffic data freshness depends on player submissions; some systems may be stale.
- `get_factions` state fields: `activeStates` entries may be objects `{state}` or plain strings — handled defensively in Galaxy.jsx.
- Remaining stub pages: Trading (still "Coming Soon").

---

## Build status — Session 9 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `guardian_visits` DB table + `get_guardian_visits`, `set_guardian_visit` | DONE | `core/database.py` |
| `get_guardian_sites`, `set_guardian_visit` API methods | DONE | `main.py` |
| `data/guardian_sites.json` expanded to 8 known sites | DONE | `data/guardian_sites.json` |
| `Guardian.jsx` — 3-tab UI (Sites / Materials / Landmarks) | DONE | `frontend/src/pages/Guardian.jsx` |
| Sites tab — ruins/structure browser with type filter, visit+data checkboxes, personal notes, SQLite-backed | DONE | `frontend/src/pages/Guardian.jsx` |
| Materials tab — Guardian material farming reference (15 materials), Tech Broker Guardian items cross-ref | DONE | `frontend/src/pages/Guardian.jsx` |
| Landmarks tab — 10 curated ED landmarks with coordinates, distances from Sol, tag filter, copy-system | DONE | `frontend/src/pages/Guardian.jsx` |

## Known issues / notes for next session

- guardian_sites.json is a stub with 8 sites — replace with full Canonn dataset for complete coverage (link in source field).
- Trading page is the last remaining "Coming Soon" stub.

---
*Session checkpoint: 2026-06-23 00:39:02*

---
*Session checkpoint: 2026-06-23 00:39:55*

---
*Session checkpoint: 2026-06-23 00:40:17*

---
*Session checkpoint: 2026-06-23 00:41:02*

---
*Session checkpoint: 2026-06-23 00:42:08*

---
*Session checkpoint: 2026-06-23 00:42:49*

---
*Session checkpoint: 2026-06-23 00:44:19*

---
*Session checkpoint: 2026-06-23 00:45:13*

---
*Session checkpoint: 2026-06-23 00:56:25*

---
*Session checkpoint: 2026-06-23 00:57:45*

---
*Session checkpoint: 2026-06-23 00:59:29*

---
*Session checkpoint: 2026-06-23 01:00:00*

---
*Session checkpoint: 2026-06-27 19:48:39*

---
*Session checkpoint: 2026-06-27 19:49:21*

---
*Session checkpoint: 2026-06-27 20:07:45*

---
*Session checkpoint: 2026-06-27 20:19:11*

---
*Session checkpoint: 2026-06-27 20:19:39*

---
*Session checkpoint: 2026-06-27 20:20:01*

---
*Session checkpoint: 2026-06-27 20:25:10*

---
*Session checkpoint: 2026-06-27 20:25:35*

---
*Session checkpoint: 2026-06-27 20:30:10*

---
*Session checkpoint: 2026-06-27 20:31:36*

---
*Session checkpoint: 2026-06-27 20:35:03*

---
*Session checkpoint: 2026-06-27 20:35:31*

---
*Session checkpoint: 2026-06-27 20:39:45*

---
*Session checkpoint: 2026-06-27 20:40:46*

---
*Session checkpoint: 2026-06-27 20:43:45*

---
*Session checkpoint: 2026-06-27 20:46:46*

---

## Build status — Session 10 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `trade_log` DB table + `add_trade_entry`, `get_trade_log`, `clear_trade_log` | DONE | `core/database.py` |
| `_current_station` state tracking | DONE | `main.py` |
| `Docked`, `MarketBuy`, `MarketSell` added to journal dispatcher | DONE | `main.py` |
| `_handle_market_buy`, `_handle_market_sell` handlers + `trade_log_update` event | DONE | `main.py` |
| `get_trade_log`, `clear_trade_log`, `find_nearest_service`, `get_commodities` API methods | DONE | `main.py` |
| `data/commodities.json` stub (8 commodities with average prices + categories) | DONE | `data/commodities.json` |
| `Trading.jsx` — 4-tab UI (Commodity Search / Nearest Service / Trade History / Commodity Prices) | DONE | `frontend/src/pages/Trading.jsx` |
| Commodity Search tab — autocomplete from commodities.json, Spansh search, buy/sell/supply display | DONE | `frontend/src/pages/Trading.jsx` |
| Nearest Service tab — 12 service type chips, system input → Spansh nearest station | DONE | `frontend/src/pages/Trading.jsx` |
| Trade History tab — live journal-tracked buys/sells, spent/earned/profit totals, buy/sell filter | DONE | `frontend/src/pages/Trading.jsx` |
| Commodity Prices tab — reference browse with category filter, price bar chart | DONE | `frontend/src/pages/Trading.jsx` |

## Known issues / notes for next session

- All 10 main pages are now COMPLETE. No more "Coming Soon" stubs.
- `data/commodities.json` is a minimal stub with 8 entries. Replace with the full EDCD commodity list for complete autocomplete coverage.
- Spansh `nearest_with_service` response shape is best-guess — verify field names if results look wrong.
- Trade History profit field is from the journal `Profit` key (net profit after accounting for buy price). If 0, journal may not include it; sell total minus buy total gives a rough manual alternative.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred, needs authoritative game data).

---
*Session checkpoint: 2026-06-27*

---
*Session checkpoint: 2026-06-27 20:53:40*
