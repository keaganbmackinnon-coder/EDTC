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

## Build status — Session 11 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `get_community_goals()` added to EdsmAPI | DONE | `api/edsm.py` |
| `get_community_goals` API method added | DONE | `main.py` |
| `CommunityGoalCard` + `CommunityGoalsTab` components written | DONE | `frontend/src/pages/Galaxy.jsx` |
| `{ id: 'cg', label: 'Community Goals' }` added to TABS array | DONE | `frontend/src/pages/Galaxy.jsx` |
| `{tab === 'cg' && <CommunityGoalsTab />}` render line added | DONE | `frontend/src/pages/Galaxy.jsx` |

## Known issues / notes for next session

- EDSM Community Goals: empty list = no active CGs right now, not a bug. HTML in `description`/`objective` stripped with regex.
- Spansh commodity search and nearest-service response field names are best-guess — verify in-game.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred, needs authoritative game data).

---

## Build status — Session 12 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `data/blueprints.json` — 240 real blueprints from EDEngineer | DONE | `data/blueprints.json` |
| `data/commodities.json` — 159 tradeable commodities from EDCD/FDevIDs | DONE | `data/commodities.json` |
| `data/engineers.json` — all 23 engineers with full unlock/invite/system data | DONE | `data/engineers.json` |
| `data/synthesis.json` — 39 synthesis recipes | DONE | `data/synthesis.json` |
| `data/tech_brokers.json` — 25 Guardian + Human tech broker items | DONE | `data/tech_brokers.json` |
| `scripts/build_data.py` — reproducible fetch+transform script | DONE | `scripts/build_data.py` |
| Overlay toggle fix — track shown state internally (pywebview `window.shown` unreliable) | DONE | `core/overlay.py` |
| Per-overlay opacity slider (10–100%), persisted in prefs DB | DONE | `core/overlay.py`, `main.py`, `Overlays.jsx` |
| Overlay black background fix — set body/html transparent in overlay mode | DONE | `frontend/src/App.jsx` |
| **v0.1.0 alpha released** via GitHub Actions | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases |
| Powerplay tab added to Galaxy page (My Power / System Lookup / Powers Reference) | DONE | `frontend/src/pages/Galaxy.jsx`, `main.py`, `api/edsm.py` |
| README expanded with step-by-step end-user install instructions | DONE | `README.md` |

## Build status — Session 13 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `build_local.bat` — one-click local build + desktop shortcut creator | DONE | `build_local.bat` |
| `frontend/public/icon.ico` — purple ED-style diamond icon (256px, generated with Pillow) | DONE | `frontend/public/icon.ico` |
| `vite.config.js` — `base: './'` so asset paths are relative (fixes `file://` blank page) | DONE | `frontend/vite.config.js` |
| `main.py` — `BASE_DIR` uses `sys._MEIPASS` when frozen (fixes bundled file resolution) | DONE | `main.py` |
| `main.jsx` — `BrowserRouter` → `HashRouter` (fixes file-not-found crash on nav click) | DONE | `frontend/src/main.jsx` |
| `main.py` — `_create_desktop_shortcut()` auto-creates `.lnk` on first frozen launch | DONE | `main.py` |
| `core/journal.py` — `_replay_startup()` replays latest journal on launch to seed current system | DONE | `core/journal.py` |
| `api/spansh.py` — `commodity_markets()` switched to POST with JSON body (fixes 400 errors) | DONE | `api/spansh.py` |
| `api/edsm.py` — `get_system_thargoid()` with `showFactions=1&showThargoids=1` | DONE | `api/edsm.py` |
| `main.py` — `get_thargoid_system`, `get_thargoid_nearby` API methods | DONE | `main.py` |
| `Galaxy.jsx` — Thargoid War tab (System Status / Maelstroms / Nearby Threat) | DONE | `frontend/src/pages/Galaxy.jsx` |
| `Trading.jsx` — sort chips (distance/buy/sell/supply/demand), alphabetical commodity datalist | DONE | `frontend/src/pages/Trading.jsx` |

---

## Build status — Session 14 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `markets` + `system_coords` tables added to `init_db()` schema | DONE | `core/database.py` |
| `upsert_market_data()` — stores EDDN commodity v3 messages to SQLite | DONE | `core/database.py` |
| `upsert_system_coords()` — stores system 3D coords from FSDJump/Location events | DONE | `core/database.py` |
| `search_local_markets()` — queries local cache with 3D distance calc, returns `source: "eddn"` | DONE | `core/database.py` |
| `get_market_stats()` — returns station/commodity/system counts in local DB | DONE | `core/database.py` |
| `_handle_fsd_jump()` — now extracts `StarPos` and calls `upsert_system_coords()` | DONE | `main.py` |
| `Location` handler — also stores `StarPos` coords | DONE | `main.py` |
| `_handle_eddn_message()` — parses commodity schema v3, routes to `upsert_market_data()` | DONE | `main.py` |
| `get_market_stats()` API method | DONE | `main.py` |
| `search_commodity_markets()` — queries local EDDN cache first, merges with Spansh (deduped by system+station) | DONE | `main.py` |
| `_eddn_listener()` — ZMQ daemon thread connecting to `tcp://eddn.edcd.io:9500`, auto-reconnects | DONE | `main.py` |
| `Trading.jsx` — EDDN source badge (green), null-safe distance sort, fixed `has_large_pad === false` check | DONE | `frontend/src/pages/Trading.jsx` |
| `pyzmq>=27.0` added to `requirements.txt` | DONE | `requirements.txt` |

## Key EDDN notes

- EDDN ZMQ endpoint: `tcp://eddn.edcd.io:9500` — messages are zlib-compressed JSON
- The WebSocket relay at `wss://eddn.edcd.io:4430/subscribe` returns **404** — do not use it
- Commodity names in EDDN messages are **lowercase** (e.g. `"battleweapons"`, `"gold"`) — stored as-is, queried case-insensitively
- EDDN results show with a green **EDDN** badge in Trading; Spansh results have no badge
- EDDN results have `distance: null` until the ref system's coords are seeded by a FSDJump/Location event
- The local cache fills in real-time as players worldwide dock — more useful the longer EDTC runs

## Build status — Session 14 continued (COMPLETE)

| Item | Status | File |
|---|---|---|
| `_seed_market_db()` — one-time background Spansh seed for all 159 commodities | DONE | `main.py` |
| Trading.jsx — seed progress banner ("Seeding X/159 · CommodityName" in amber) | DONE | `frontend/src/pages/Trading.jsx` |
| Trading.jsx — EDDN stats counter ("EDDN X stations · Y commodities"), refreshes every 15s | DONE | `frontend/src/pages/Trading.jsx` |
| overlay.py — `_enabled` flag suppresses overlays during startup journal replay | DONE | `core/overlay.py` |
| `webview.start(func=...)` — enables overlays only after webview is running | DONE | `main.py` |
| All overlay components — `window.__edtc.on` → `window.__edtc?.on` (fixes crash on load) | DONE | `frontend/src/overlays/*.jsx` |

## Known issues / notes for next session

- Spansh nearest-service response field names are best-guess — verify in-game if results look wrong.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred).
- `data/guardian_sites.json` still only 8 sites — replace with full Canonn dataset when needed.
- pygame not installable on Python 3.14 (no prebuilt wheel yet) — CMDR ping audio silently disabled. CI builds use Python 3.12 so the .exe has audio.
- Maelstrom system names are community-reported best-guess — verify on EDSM or Canonn if needed.
- `get_thargoid_nearby` filters EDSM sphere results by `factionState`/`allegiance` — some affected systems may not appear.
- Market seed runs once on first launch (pref key `market_seeded`). If seed needs to re-run, delete `edtc.db` or clear that pref from the DB.
- Gather feedback from alpha users and triage bugs before v0.2.0.

---
*Session 14 complete — 2026-06-28*

---

## Build status — Session 15 (COMPLETE)

| Item | Status | File |
|---|---|---|
| CI fix: added `shell: bash` to Windows PyInstaller step (backslash line continuation fails in PowerShell) | DONE | `.github/workflows/build.yml` |
| v0.2.1 released — first successful 3-platform build (Windows .exe, macOS, Linux) | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.1 |
| Overlay enable/disable preference persisted to DB (`overlay_auto_{name}`) | DONE | `core/overlay.py`, `main.py` |
| `OverlayManager._user_enabled` dict — tracks per-overlay user preference separate from transient shown state | DONE | `core/overlay.py` |
| `toggle()` now flips `_user_enabled` and returns new state; `toggle_overlay()` saves to DB | DONE | `core/overlay.py`, `main.py` |
| FSD jump handler gates System Preview auto-show on `is_user_enabled("system_preview")` | DONE | `main.py` |
| `get_overlay_states()` now returns `auto_enabled` field in addition to `shown` | DONE | `main.py` |
| `Overlays.jsx` toggle button driven by `auto_enabled` (not transient `shown`); button label changed to Enable/Disable | DONE | `frontend/src/pages/Overlays.jsx` |
| v0.2.2 released — overlay fix shipped | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.2 |

## Known issues / notes for next session

- All previous known issues from Session 14 still apply.
- `_user_enabled` defaults to `True` for all overlays. Existing users upgrading from v0.2.1 will see all overlays enabled (same as before) — no migration needed.
- `hide_after()` sets `_shown = False` but does NOT touch `_user_enabled`, so the overlay correctly re-appears on the next jump if the user hasn't disabled it.
- System Preview is the only overlay that auto-triggers on a game event (FSDJump). If other overlays gain auto-trigger behaviour in future, add the same `is_user_enabled()` gate.
- Spansh nearest-service response field names are still best-guess — verify in-game if results look wrong.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred).

---
*Session 15 complete — 2026-06-28*

---

## Build status — Session 16 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `NavRoute` + `NavRouteClear` added to `WATCHED_EVENTS` | DONE | `core/journal.py` |
| `_handle_nav_route()` — reads galaxy-map route from journal, saves to DB, emits `route_update` | DONE | `main.py` |
| `_handle_nav_route_clear()` — clears active route and notifies overlay + main window | DONE | `main.py` |
| In-game galaxy-map routes now auto-populate the Route Following overlay | DONE | `main.py` |
| `VERSION` file added at project root — bundled by PyInstaller via `--add-data "VERSION;."` | DONE | `VERSION`, `.github/workflows/build.yml` |
| CI "Write version from tag" step: `echo "${GITHUB_REF_NAME#v}" > VERSION` before PyInstaller | DONE | `.github/workflows/build.yml` |
| `APP_VERSION` read from bundled `VERSION` at Python startup; falls back to `"dev"` | DONE | `main.py` |
| `get_version()` API method exposes `APP_VERSION` to React | DONE | `main.py` |
| `App.jsx` version fetch waits for `pywebviewready` event before calling `get_version()` | DONE | `frontend/src/App.jsx` |
| Sidebar now shows `v0.2.5` in the bottom-left corner | DONE | `frontend/src/App.jsx` |
| v0.2.3 released — NavRoute tracking | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.3 |
| v0.2.4 released — version number in sidebar | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.4 |
| v0.2.5 released — fix pywebviewready timing (version was blank on first launch) | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.5 |
| Local install updated to v0.2.5 at `C:\Users\Keagan\AppData\Local\EDTC\EDTC.exe` | DONE | — |

## Key notes from Session 16

- **NavRoute**: when the player sets a route in the galaxy map, ED writes a `NavRoute` journal event with the full system list. EDTC reads it, saves it as the active route, and pushes it to the route overlay. `NavRouteClear` fires when the route is cancelled.
- **Version file flow**: CI tag push → `echo "${GITHUB_REF_NAME#v}" > VERSION` → PyInstaller bundles VERSION → Python reads it at startup → `get_version()` API → React sidebar displays it.
- **`pywebviewready` timing**: pywebview fires this DOM event when the Python bridge becomes callable. `App.jsx` must listen for it rather than calling the API immediately on mount, because the bridge isn't ready at React render time.
- **`_user_enabled` default corrected**: changed from `True` to `False` so overlays start disabled until the user explicitly enables them. This was the root cause of "System Preview auto-shows on every jump."

## Known issues / notes for next session

- All previous known issues from Session 14 still apply.
- `hide_after()` sets `_shown = False` but does NOT touch `_user_enabled` — overlays correctly re-appear on next trigger if user has them enabled.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred).
- `data/guardian_sites.json` still only 8 sites — replace with full Canonn dataset when needed.
- pygame not installable on Python 3.14 — CMDR ping audio silently disabled in dev. CI builds use Python 3.12 so the .exe has audio.
- Spansh nearest-service response field names are best-guess — verify in-game if results look wrong.

---
*Session 16 complete — 2026-06-28*

---
*Session checkpoint: 2026-06-28 12:34:59*
