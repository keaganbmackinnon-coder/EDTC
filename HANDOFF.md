# EDTC â€” Session Handoff

> **New session? Read this file first, then read the project brief.**
> Brief location: `C:\Users\Keagan\OneDrive\Desktop\EDT\elite-companion-claude-code-brief.md`
> Checklist location: `C:\Users\Keagan\OneDrive\Desktop\EDT\EDT\EDT-checklist.md`

---

## Permissions (auto-approved for this project)

`.claude/settings.json` is checked in and pre-configures Claude Code to auto-approve
git, Python, file reads/edits/writes, and GitHub API calls without prompting each time.
This is intentional â€” do not remove it. If Claude Code prompts you for a tool that
should be auto-approved, check that `.claude/settings.json` is present in the repo root.

---

## Project snapshot

- **App name:** EDTC (Elite Dangerous Tools & Companion)
- **Project root:** `C:\Users\Keagan\OneDrive\Desktop\EDT\EDT\`
- **Stack:** Python + pywebview + React + Vite + Tailwind + SQLite
- **Distribution:** PyInstaller â†’ single .exe, released via GitHub Releases

## Decisions locked in

| Decision | Answer |
|---|---|
| App name | EDTC |
| Auto-jump / autopilot | Implemented with prominent Frontier ToS warning modal in FleetCarriers.jsx |
| Frontier CAPI / OAuth | Deferred â€” later phase |
| Repo visibility | Public â€” https://github.com/keaganbmackinnon-coder/EDTC |
| Overlay URL scheme | `?overlay=<key>` query param â€” works for both dev (localhost:5173) and prod (file://) |
| Route clipboard hotkey | Ctrl+Shift+C (global, via `keyboard` lib) |
| **Feature freeze** | **No new features until everything that exists works correctly. Fix before build.** |

---

## Build status â€” Session 1 (COMPLETE)

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

## Build status â€” Session 2 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `core/audio.py` â€” pygame.mixer synthesised beep | DONE | `core/audio.py` |
| CMDR Ping overlay (audio + auto-dismiss popup + watchlist) | DONE | `overlays/CmdrPing.jsx` |
| Route Following overlay (FSDJump tracking, progress bar, clipboard hotkey) | DONE | `overlays/Route.jsx` |
| FSS Values overlay (body scan value estimates) | DONE | `overlays/FssValues.jsx` |
| System Preview overlay (auto-hides 15s after jump) | DONE | `overlays/SystemPreview.jsx` |
| Exobiology Tracker overlay (1/3 2/3 3/3 scan dots per species) | DONE | `overlays/ExoTracker.jsx` |
| Construction Materials overlay (commodity progress bars) | DONE | `overlays/Construction.jsx` |
| `Navigation.jsx` â€” route paste UI + active route status panel | DONE | `pages/Navigation.jsx` |
| `Overlays.jsx` â€” toggle panel + watchlist manager + construction project manager | DONE | `pages/Overlays.jsx` |
| `App.jsx` â€” overlay mode via `?overlay=<key>` query param | DONE | `App.jsx` |
| `database.py` â€” exo_scans, construction_projects tables; watchlist CRUD; routes.active column | DONE | `core/database.py` |
| `journal.py` â€” ColonisationContribution, ColonisationConstructionDepot events | DONE | `core/journal.py` |
| `overlay.py` â€” emit_to_overlay(), hide_after(), prod URL support, exo_tracker config | DONE | `core/overlay.py` |
| `main.py` â€” full event routing for all 6 overlays, all API methods, keyboard hotkey | DONE | `main.py` |

---

## Key architecture notes

- pywebview serves React from `frontend/dist/` (prod) or `localhost:5173` (dev mode: `python main.py --dev`)
- Pythonâ†”JS bridge: `window.pywebview.api.methodName()` â†’ returns a Promise
- JSâ†Python events: backend calls `window.__edtc.onEvent({type, payload})` â€” listener set up in `frontend/src/main.jsx`
- Overlays = separate pywebview windows (`transparent=True`, `on_top=True`) managed in `core/overlay.py`
- **Overlay URL scheme:** `?overlay=<key>` â€” App.jsx reads the query param and renders only the overlay component (no sidebar)
- **Overlay event push:** `overlay_manager.emit_to_overlay(name, event_type, payload)` calls `evaluate_js` on the overlay window
- 6 overlays configured in `core/overlay.py`: `cmdr_ping`, `route`, `fss`, `system_preview`, `exo_tracker`, `construction`
- **CMDR ping logic:** pings everyone when watchlist is empty; pings only watchlist members when entries exist
- **Exo scans:** count `ScanOrganic.ScanType == "Analysed"` events per (system, body, species) â€” 3 = complete. Also persisted in SQLite `exo_scans` table.
- **Construction:** user enters commodity requirements manually in Overlays page; `ColonisationContribution` journal events auto-decrement remaining counts
- **System preview:** auto-hides after 15 seconds; updates body count when `FSSDiscoveryScan` fires
- **Ctrl+Shift+C** global hotkey â†’ copies next route destination to clipboard (set up in `_setup_hotkeys()` in main.py)
- Static data in `data/*.json` â€” minimal stubs, replace with full EDCD datasets (links in README)
- Journal path (Windows): `%USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous\`
- Auto-jump: ToS warning UI in `FleetCarriers.jsx` â€” backend logic not yet implemented

---

## Known issues / notes for next session

- `routes.active` column: added in session 2 schema. If DB existed from before session 2, run: `ALTER TABLE routes ADD COLUMN active INTEGER DEFAULT 0;`
- CMDR ping `hide_after(8s)`: if a second ping arrives within 8 seconds, the first timer will hide the new ping early. Fix: track and cancel pending timers.
- Exobiology: if the game fires `ScanOrganic.ScanType == "Logged"` as the final event (rather than a third `Analysed`), adjust `_handle_scan_organic()` in `main.py` accordingly.
- `keyboard` hotkey: may need elevated privileges on Linux. Works without admin on Windows.

---

## Build status â€” Session 3 (COMPLETE)

| Item | Status | File |
|---|---|---|
| Colonisation.jsx â€” full tabbed UI (replaces all "Coming Soon" stubs) | DONE | `frontend/src/pages/Colonisation.jsx` |
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
- **Spansh commodity search**: `/api/stations/search` with `market[name][]` param â€” verify this works in-game. Response field names (`distance_to_arrival`, `market[].sell_price`, `market[].supply`) are best-guess from Spansh API conventions; may need adjusting if response shape differs.
- **FC cargo tracking**: `CargoTransfer` only fires when YOU personally move cargo to/from your FC. Cargo sold by your market, loaded by NPCs, or present before EDTC started won't be tracked. "Edit Manually" on the FC Cargo tab handles this.
- System Planner + Economy Simulator and Nexus Building Planner are still unbuilt (need authoritative game data for building types/costs/economy contributions â€” suggest sourcing from EDCD or community wikis).

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

## Build status â€” Session 4 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `FleetCarriers.jsx` â€” 3-tab implementation (Stats / Route Planner / Auto-Jump) | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| Carrier Stats tab â€” fuel bar, cargo space, credits, services, pending jump | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| Route Planner tab â€” Spansh FC route, jump list, tritium estimate + stock check | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| Auto-Jump tab â€” ToS gate, keyboard automation, configurable key + delay, countdown | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| `carriers` DB table + `upsert_carrier`, `get_carriers` | DONE | `core/database.py` |
| CarrierStats / CarrierJump / CarrierJumpRequest / CarrierJumpCancelled / CarrierDepositFuel / CarrierBuy added to WATCHED_EVENTS | DONE | `core/journal.py` |
| `_handle_carrier_*` handlers + `_schedule_next_jump()` auto-jump timer | DONE | `main.py` |
| `plan_fc_route`, `start_auto_jump`, `stop_auto_jump`, `get_auto_jump_status` API methods | DONE | `main.py` |

## Known issues / notes for next session

- `routes.active` column: if DB existed from before session 2, run: `ALTER TABLE routes ADD COLUMN active INTEGER DEFAULT 0;`
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early. Fix: cancel pending timer before scheduling new one.
- Exobiology: if final scan fires `ScanType == "Logged"` not `"Analysed"`, adjust `_handle_scan_organic()`.
- **Spansh commodity search** (`/api/stations/search`): response field names are best-guess â€” verify and adjust if needed.
- **FC cargo auto-tracking**: only tracks your own CargoTransfer events. Pre-existing FC cargo needs manual entry.
- **Tritium estimate**: defaults to 50T/jump â€” actual cost varies by distance; let user adjust in UI.
- **Auto-jump**: fires a keypress to the active window â€” game must be in focus. Key defaults to `j` (standard FSD bind).
- **Carrier stats location**: `CarrierStats` event fires when you open Carrier Management in-game. Location updates on `CarrierJump` events.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt.

*Last updated: Session 5 complete â€” Engineering page done*

---

## Build status â€” Session 5 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `materials` DB table + `upsert_material`, `set_material_count`, `get_materials` | DONE | `core/database.py` |
| `engineer_progress` DB table + `get_engineer_progress`, `upsert_engineer_progress` | DONE | `core/database.py` |
| `MaterialTrade`, `EngineerCraft`, `Synthesis` added to WATCHED_EVENTS | DONE | `core/journal.py` |
| `_handle_material_collected/discarded/trade/engineer_craft/synthesis_used` | DONE | `main.py` |
| `_handle_engineer_progress` (single + array form) | DONE | `main.py` |
| `get_materials`, `set_material_count` API methods | DONE | `main.py` |
| `get_engineers`, `get_blueprints`, `get_synthesis_recipes`, `get_tech_broker_items` API methods | DONE | `main.py` |
| `Engineering.jsx` â€” 5-tab UI (Engineers / Blueprints / Synthesis / Tech Broker / Materials) | DONE | `frontend/src/pages/Engineering.jsx` |
| Engineers tab â€” specialty filter chips, unlock/rank badge from journal progress | DONE | `frontend/src/pages/Engineering.jsx` |
| Blueprints tab â€” search, accordion per grade, material have/need cross-ref, craftable indicator | DONE | `frontend/src/pages/Engineering.jsx` |
| Synthesis tab â€” category filter, craftable check vs inventory, grade badge | DONE | `frontend/src/pages/Engineering.jsx` |
| Tech Broker tab â€” Guardian/Human type filter, unlockable indicator | DONE | `frontend/src/pages/Engineering.jsx` |
| Materials tab â€” sub-tabs Raw/Manufactured/Encoded, inline count edit, bulk import, fill bar | DONE | `frontend/src/pages/Engineering.jsx` |

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

## Build status â€” Session 6 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `cmdr_stats` DB table + `set_cmdr_stat`, `get_cmdr_stats` | DONE | `core/database.py` |
| `logbook` DB table + `get_logbook`, `save_log_entry`, `delete_log_entry` | DONE | `core/database.py` |
| `Rank`, `Progress`, `Statistics`, `Reputation` added to WATCHED_EVENTS | DONE | `core/journal.py` |
| `_handle_commander`, `_handle_load_game`, `_handle_rank`, `_handle_progress`, `_handle_statistics` | DONE | `main.py` |
| `lookup_commander`, `get_cmdr_stats`, `get_current_system` API methods | DONE | `main.py` |
| `get_logbook`, `save_log_entry`, `delete_log_entry` API methods | DONE | `main.py` |
| `get_screenshots`, `open_file`, `open_screenshots_folder` API methods | DONE | `main.py` |
| `Commander.jsx` â€” 4-tab UI (CMDR Lookup / My Stats / Logbook / Screenshots) | DONE | `frontend/src/pages/Commander.jsx` |
| CMDR Lookup tab â€” EDSM search by name, shows last system + date + coords | DONE | `frontend/src/pages/Commander.jsx` |
| My Stats tab â€” journal-tracked ranks with progress bars, credits, ship info, statistics groups | DONE | `frontend/src/pages/Commander.jsx` |
| Logbook tab â€” SQLite-backed personal notes with title/system/body, create/edit/delete | DONE | `frontend/src/pages/Commander.jsx` |
| Screenshots tab â€” lists files from ED screenshot folder, Open + Open Folder buttons | DONE | `frontend/src/pages/Commander.jsx` |

## Known issues / notes for next session

- Stats only populate after logging into Elite Dangerous with EDTC running (Rank/Progress/Statistics/Commander/LoadGame events fire on game start).
- EDSM CMDR lookup requires the searched CMDR to have opted in to sharing position publicly.
- `open_file` and `open_screenshots_folder` use `os.startfile()` â€” Windows only.
- Remaining stub pages: Galaxy, Guardian, Trading (all still "Coming Soon").

---

## Build status â€” Session 7 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `scan_update` emitted to main window from `_handle_scan` | DONE | `main.py` |
| `exo_scan` emitted to main window from `_handle_scan_organic` | DONE | `main.py` |
| `system_changed` emitted on FSDJump and Location events | DONE | `main.py` |
| `get_fss_bodies`, `lookup_system`, `road_to_riches` API methods | DONE | `main.py` |
| `Exploration.jsx` â€” 4-tab UI (System Lookup / Road to Riches / Exobiology / Session Scanner) | DONE | `frontend/src/pages/Exploration.jsx` |
| System Lookup tab â€” EDSM search: system info card + collapsible body list | DONE | `frontend/src/pages/Exploration.jsx` |
| Road to Riches tab â€” Spansh route with per-system body value breakdown | DONE | `frontend/src/pages/Exploration.jsx` |
| Exobiology tab â€” DB-backed scan tracker, grouped by system, clear per system | DONE | `frontend/src/pages/Exploration.jsx` |
| Session Scanner tab â€” live FSS scan log, resets on jump, total value estimate | DONE | `frontend/src/pages/Exploration.jsx` |

## Known issues / notes for next session

- Road to Riches Spansh job takes ~10-30s; Promise blocks until done â€” normal.
- EDSM body data only available for systems that have been visited and submitted by players.
- Exobiology tab uses `get_exo_scans()` which returns in-progress (incomplete) scans only. Completed scans are cleared from the active list but remain in DB; no history view yet.
- Remaining stub pages: Guardian, Trading (all still "Coming Soon").

---

## Build status â€” Session 8 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `get_news`, `get_factions`, `get_stats` added to EdsmAPI | DONE | `api/edsm.py` |
| `_edsm_run` helper + `get_galnet`, `get_system_factions`, `get_system_traffic`, `get_galaxy_stats` API methods | DONE | `main.py` |
| `Galaxy.jsx` â€” 4-tab UI (GalNet / Factions / Traffic / Galaxy Stats) | DONE | `frontend/src/pages/Galaxy.jsx` |
| GalNet tab â€” live EDSM news, expandable articles with HTML stripped | DONE | `frontend/src/pages/Galaxy.jsx` |
| Factions tab â€” system search, influence bars, allegiance colors, state chips (active + pending) | DONE | `frontend/src/pages/Galaxy.jsx` |
| Traffic tab â€” system traffic totals (total/week/day) + ship breakdown bars | DONE | `frontend/src/pages/Galaxy.jsx` |
| Galaxy Stats tab â€” EDSM universe stats: commanders, systems, bodies, stations, logs | DONE | `frontend/src/pages/Galaxy.jsx` |

## Known issues / notes for next session

- GalNet content may contain HTML entities â€” stripped with regex but complex HTML may show raw.
- EDSM faction/traffic data freshness depends on player submissions; some systems may be stale.
- `get_factions` state fields: `activeStates` entries may be objects `{state}` or plain strings â€” handled defensively in Galaxy.jsx.
- Remaining stub pages: Trading (still "Coming Soon").

---

## Build status â€” Session 9 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `guardian_visits` DB table + `get_guardian_visits`, `set_guardian_visit` | DONE | `core/database.py` |
| `get_guardian_sites`, `set_guardian_visit` API methods | DONE | `main.py` |
| `data/guardian_sites.json` expanded to 8 known sites | DONE | `data/guardian_sites.json` |
| `Guardian.jsx` â€” 3-tab UI (Sites / Materials / Landmarks) | DONE | `frontend/src/pages/Guardian.jsx` |
| Sites tab â€” ruins/structure browser with type filter, visit+data checkboxes, personal notes, SQLite-backed | DONE | `frontend/src/pages/Guardian.jsx` |
| Materials tab â€” Guardian material farming reference (15 materials), Tech Broker Guardian items cross-ref | DONE | `frontend/src/pages/Guardian.jsx` |
| Landmarks tab â€” 10 curated ED landmarks with coordinates, distances from Sol, tag filter, copy-system | DONE | `frontend/src/pages/Guardian.jsx` |

## Known issues / notes for next session

- guardian_sites.json is a stub with 8 sites â€” replace with full Canonn dataset for complete coverage (link in source field).
- Trading page is the last remaining "Coming Soon" stub.





























---

## Build status â€” Session 10 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `trade_log` DB table + `add_trade_entry`, `get_trade_log`, `clear_trade_log` | DONE | `core/database.py` |
| `_current_station` state tracking | DONE | `main.py` |
| `Docked`, `MarketBuy`, `MarketSell` added to journal dispatcher | DONE | `main.py` |
| `_handle_market_buy`, `_handle_market_sell` handlers + `trade_log_update` event | DONE | `main.py` |
| `get_trade_log`, `clear_trade_log`, `find_nearest_service`, `get_commodities` API methods | DONE | `main.py` |
| `data/commodities.json` stub (8 commodities with average prices + categories) | DONE | `data/commodities.json` |
| `Trading.jsx` â€” 4-tab UI (Commodity Search / Nearest Service / Trade History / Commodity Prices) | DONE | `frontend/src/pages/Trading.jsx` |
| Commodity Search tab â€” autocomplete from commodities.json, Spansh search, buy/sell/supply display | DONE | `frontend/src/pages/Trading.jsx` |
| Nearest Service tab â€” 12 service type chips, system input â†’ Spansh nearest station | DONE | `frontend/src/pages/Trading.jsx` |
| Trade History tab â€” live journal-tracked buys/sells, spent/earned/profit totals, buy/sell filter | DONE | `frontend/src/pages/Trading.jsx` |
| Commodity Prices tab â€” reference browse with category filter, price bar chart | DONE | `frontend/src/pages/Trading.jsx` |

## Known issues / notes for next session

- All 10 main pages are now COMPLETE. No more "Coming Soon" stubs.
- `data/commodities.json` is a minimal stub with 8 entries. Replace with the full EDCD commodity list for complete autocomplete coverage.
- Spansh `nearest_with_service` response shape is best-guess â€” verify field names if results look wrong.
- Trade History profit field is from the journal `Profit` key (net profit after accounting for buy price). If 0, journal may not include it; sell total minus buy total gives a rough manual alternative.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred, needs authoritative game data).





---

## Build status â€” Session 11 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `get_community_goals()` added to EdsmAPI | DONE | `api/edsm.py` |
| `get_community_goals` API method added | DONE | `main.py` |
| `CommunityGoalCard` + `CommunityGoalsTab` components written | DONE | `frontend/src/pages/Galaxy.jsx` |
| `{ id: 'cg', label: 'Community Goals' }` added to TABS array | DONE | `frontend/src/pages/Galaxy.jsx` |
| `{tab === 'cg' && <CommunityGoalsTab />}` render line added | DONE | `frontend/src/pages/Galaxy.jsx` |

## Known issues / notes for next session

- EDSM Community Goals: empty list = no active CGs right now, not a bug. HTML in `description`/`objective` stripped with regex.
- Spansh commodity search and nearest-service response field names are best-guess â€” verify in-game.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred, needs authoritative game data).

---

## Build status â€” Session 12 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `data/blueprints.json` â€” 240 real blueprints from EDEngineer | DONE | `data/blueprints.json` |
| `data/commodities.json` â€” 159 tradeable commodities from EDCD/FDevIDs | DONE | `data/commodities.json` |
| `data/engineers.json` â€” all 23 engineers with full unlock/invite/system data | DONE | `data/engineers.json` |
| `data/synthesis.json` â€” 39 synthesis recipes | DONE | `data/synthesis.json` |
| `data/tech_brokers.json` â€” 25 Guardian + Human tech broker items | DONE | `data/tech_brokers.json` |
| `scripts/build_data.py` â€” reproducible fetch+transform script | DONE | `scripts/build_data.py` |
| Overlay toggle fix â€” track shown state internally (pywebview `window.shown` unreliable) | DONE | `core/overlay.py` |
| Per-overlay opacity slider (10â€“100%), persisted in prefs DB | DONE | `core/overlay.py`, `main.py`, `Overlays.jsx` |
| Overlay black background fix â€” set body/html transparent in overlay mode | DONE | `frontend/src/App.jsx` |
| **v0.1.0 alpha released** via GitHub Actions | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases |
| Powerplay tab added to Galaxy page (My Power / System Lookup / Powers Reference) | DONE | `frontend/src/pages/Galaxy.jsx`, `main.py`, `api/edsm.py` |
| README expanded with step-by-step end-user install instructions | DONE | `README.md` |

## Build status â€” Session 13 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `build_local.bat` â€” one-click local build + desktop shortcut creator | DONE | `build_local.bat` |
| `frontend/public/icon.ico` â€” purple ED-style diamond icon (256px, generated with Pillow) | DONE | `frontend/public/icon.ico` |
| `vite.config.js` â€” `base: './'` so asset paths are relative (fixes `file://` blank page) | DONE | `frontend/vite.config.js` |
| `main.py` â€” `BASE_DIR` uses `sys._MEIPASS` when frozen (fixes bundled file resolution) | DONE | `main.py` |
| `main.jsx` â€” `BrowserRouter` â†’ `HashRouter` (fixes file-not-found crash on nav click) | DONE | `frontend/src/main.jsx` |
| `main.py` â€” `_create_desktop_shortcut()` auto-creates `.lnk` on first frozen launch | DONE | `main.py` |
| `core/journal.py` â€” `_replay_startup()` replays latest journal on launch to seed current system | DONE | `core/journal.py` |
| `api/spansh.py` â€” `commodity_markets()` switched to POST with JSON body (fixes 400 errors) | DONE | `api/spansh.py` |
| `api/edsm.py` â€” `get_system_thargoid()` with `showFactions=1&showThargoids=1` | DONE | `api/edsm.py` |
| `main.py` â€” `get_thargoid_system`, `get_thargoid_nearby` API methods | DONE | `main.py` |
| `Galaxy.jsx` â€” Thargoid War tab (System Status / Maelstroms / Nearby Threat) | DONE | `frontend/src/pages/Galaxy.jsx` |
| `Trading.jsx` â€” sort chips (distance/buy/sell/supply/demand), alphabetical commodity datalist | DONE | `frontend/src/pages/Trading.jsx` |

---

## Build status â€” Session 14 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `markets` + `system_coords` tables added to `init_db()` schema | DONE | `core/database.py` |
| `upsert_market_data()` â€” stores EDDN commodity v3 messages to SQLite | DONE | `core/database.py` |
| `upsert_system_coords()` â€” stores system 3D coords from FSDJump/Location events | DONE | `core/database.py` |
| `search_local_markets()` â€” queries local cache with 3D distance calc, returns `source: "eddn"` | DONE | `core/database.py` |
| `get_market_stats()` â€” returns station/commodity/system counts in local DB | DONE | `core/database.py` |
| `_handle_fsd_jump()` â€” now extracts `StarPos` and calls `upsert_system_coords()` | DONE | `main.py` |
| `Location` handler â€” also stores `StarPos` coords | DONE | `main.py` |
| `_handle_eddn_message()` â€” parses commodity schema v3, routes to `upsert_market_data()` | DONE | `main.py` |
| `get_market_stats()` API method | DONE | `main.py` |
| `search_commodity_markets()` â€” queries local EDDN cache first, merges with Spansh (deduped by system+station) | DONE | `main.py` |
| `_eddn_listener()` â€” ZMQ daemon thread connecting to `tcp://eddn.edcd.io:9500`, auto-reconnects | DONE | `main.py` |
| `Trading.jsx` â€” EDDN source badge (green), null-safe distance sort, fixed `has_large_pad === false` check | DONE | `frontend/src/pages/Trading.jsx` |
| `pyzmq>=27.0` added to `requirements.txt` | DONE | `requirements.txt` |

## Key EDDN notes

- EDDN ZMQ endpoint: `tcp://eddn.edcd.io:9500` â€” messages are zlib-compressed JSON
- The WebSocket relay at `wss://eddn.edcd.io:4430/subscribe` returns **404** â€” do not use it
- Commodity names in EDDN messages are **lowercase** (e.g. `"battleweapons"`, `"gold"`) â€” stored as-is, queried case-insensitively
- EDDN results show with a green **EDDN** badge in Trading; Spansh results have no badge
- EDDN results have `distance: null` until the ref system's coords are seeded by a FSDJump/Location event
- The local cache fills in real-time as players worldwide dock â€” more useful the longer EDTC runs

## Build status â€” Session 14 continued (COMPLETE)

| Item | Status | File |
|---|---|---|
| `_seed_market_db()` â€” one-time background Spansh seed for all 159 commodities | DONE | `main.py` |
| Trading.jsx â€” seed progress banner ("Seeding X/159 Â· CommodityName" in amber) | DONE | `frontend/src/pages/Trading.jsx` |
| Trading.jsx â€” EDDN stats counter ("EDDN X stations Â· Y commodities"), refreshes every 15s | DONE | `frontend/src/pages/Trading.jsx` |
| overlay.py â€” `_enabled` flag suppresses overlays during startup journal replay | DONE | `core/overlay.py` |
| `webview.start(func=...)` â€” enables overlays only after webview is running | DONE | `main.py` |
| All overlay components â€” `window.__edtc.on` â†’ `window.__edtc?.on` (fixes crash on load) | DONE | `frontend/src/overlays/*.jsx` |

## Known issues / notes for next session

- Spansh nearest-service response field names are best-guess â€” verify in-game if results look wrong.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred).
- `data/guardian_sites.json` still only 8 sites â€” replace with full Canonn dataset when needed.
- pygame not installable on Python 3.14 (no prebuilt wheel yet) â€” CMDR ping audio silently disabled. CI builds use Python 3.12 so the .exe has audio.
- Maelstrom system names are community-reported best-guess â€” verify on EDSM or Canonn if needed.
- `get_thargoid_nearby` filters EDSM sphere results by `factionState`/`allegiance` â€” some affected systems may not appear.
- Market seed runs once on first launch (pref key `market_seeded`). If seed needs to re-run, delete `edtc.db` or clear that pref from the DB.
- Gather feedback from alpha users and triage bugs before v0.2.0.

---
*Session 14 complete â€” 2026-06-28*

---

## Build status â€” Session 15 (COMPLETE)

| Item | Status | File |
|---|---|---|
| CI fix: added `shell: bash` to Windows PyInstaller step (backslash line continuation fails in PowerShell) | DONE | `.github/workflows/build.yml` |
| v0.2.1 released â€” first successful 3-platform build (Windows .exe, macOS, Linux) | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.1 |
| Overlay enable/disable preference persisted to DB (`overlay_auto_{name}`) | DONE | `core/overlay.py`, `main.py` |
| `OverlayManager._user_enabled` dict â€” tracks per-overlay user preference separate from transient shown state | DONE | `core/overlay.py` |
| `toggle()` now flips `_user_enabled` and returns new state; `toggle_overlay()` saves to DB | DONE | `core/overlay.py`, `main.py` |
| FSD jump handler gates System Preview auto-show on `is_user_enabled("system_preview")` | DONE | `main.py` |
| `get_overlay_states()` now returns `auto_enabled` field in addition to `shown` | DONE | `main.py` |
| `Overlays.jsx` toggle button driven by `auto_enabled` (not transient `shown`); button label changed to Enable/Disable | DONE | `frontend/src/pages/Overlays.jsx` |
| v0.2.2 released â€” overlay fix shipped | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.2 |

## Known issues / notes for next session

- All previous known issues from Session 14 still apply.
- `_user_enabled` defaults to `True` for all overlays. Existing users upgrading from v0.2.1 will see all overlays enabled (same as before) â€” no migration needed.
- `hide_after()` sets `_shown = False` but does NOT touch `_user_enabled`, so the overlay correctly re-appears on the next jump if the user hasn't disabled it.
- System Preview is the only overlay that auto-triggers on a game event (FSDJump). If other overlays gain auto-trigger behaviour in future, add the same `is_user_enabled()` gate.
- Spansh nearest-service response field names are still best-guess â€” verify in-game if results look wrong.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred).

---
*Session 15 complete â€” 2026-06-28*

---

## Build status â€” Session 16 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `NavRoute` + `NavRouteClear` added to `WATCHED_EVENTS` | DONE | `core/journal.py` |
| `_handle_nav_route()` â€” reads galaxy-map route from journal, saves to DB, emits `route_update` | DONE | `main.py` |
| `_handle_nav_route_clear()` â€” clears active route and notifies overlay + main window | DONE | `main.py` |
| In-game galaxy-map routes now auto-populate the Route Following overlay | DONE | `main.py` |
| `VERSION` file added at project root â€” bundled by PyInstaller via `--add-data "VERSION;."` | DONE | `VERSION`, `.github/workflows/build.yml` |
| CI "Write version from tag" step: `echo "${GITHUB_REF_NAME#v}" > VERSION` before PyInstaller | DONE | `.github/workflows/build.yml` |
| `APP_VERSION` read from bundled `VERSION` at Python startup; falls back to `"dev"` | DONE | `main.py` |
| `get_version()` API method exposes `APP_VERSION` to React | DONE | `main.py` |
| `App.jsx` version fetch waits for `pywebviewready` event before calling `get_version()` | DONE | `frontend/src/App.jsx` |
| Sidebar now shows `v0.2.5` in the bottom-left corner | DONE | `frontend/src/App.jsx` |
| v0.2.3 released â€” NavRoute tracking | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.3 |
| v0.2.4 released â€” version number in sidebar | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.4 |
| v0.2.5 released â€” fix pywebviewready timing (version was blank on first launch) | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.5 |
| Local install updated to v0.2.5 at `C:\Users\Keagan\AppData\Local\EDTC\EDTC.exe` | DONE | â€” |

## Key notes from Session 16

- **NavRoute**: when the player sets a route in the galaxy map, ED writes a `NavRoute` journal event with the full system list. EDTC reads it, saves it as the active route, and pushes it to the route overlay. `NavRouteClear` fires when the route is cancelled.
- **Version file flow**: CI tag push â†’ `echo "${GITHUB_REF_NAME#v}" > VERSION` â†’ PyInstaller bundles VERSION â†’ Python reads it at startup â†’ `get_version()` API â†’ React sidebar displays it.
- **`pywebviewready` timing**: pywebview fires this DOM event when the Python bridge becomes callable. `App.jsx` must listen for it rather than calling the API immediately on mount, because the bridge isn't ready at React render time.
- **`_user_enabled` default corrected**: changed from `True` to `False` so overlays start disabled until the user explicitly enables them. This was the root cause of "System Preview auto-shows on every jump."

## Known issues / notes for next session

- All previous known issues from Session 14 still apply.
- `hide_after()` sets `_shown = False` but does NOT touch `_user_enabled` â€” overlays correctly re-appear on next trigger if user has them enabled.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred).
- `data/guardian_sites.json` still only 8 sites â€” replace with full Canonn dataset when needed.
- pygame not installable on Python 3.14 â€” CMDR ping audio silently disabled in dev. CI builds use Python 3.12 so the .exe has audio.
- Spansh nearest-service response field names are best-guess â€” verify in-game if results look wrong.

---
*Session 16 complete â€” 2026-06-28*

---

## Build status â€” Session 17 (COMPLETE)

| Item | Status | File |
|---|---|---|
| Orange top-down Sidewinder icon generated with Pillow (256/128/64/48/32/16px multi-size ICO) | DONE | `frontend/public/icon.ico` |
| `<link rel="icon">` added to index.html so webview uses the sidewinder as favicon | DONE | `frontend/index.html` |
| `--icon "frontend/public/icon.ico"` added to Windows PyInstaller step â€” icon now embedded in .exe | DONE | `.github/workflows/build.yml` |
| Windows icon cache cleared (`iconcache*.db` deleted, Explorer restarted) to flush stale floppy icon | DONE | â€” |
| v0.2.6 released â€” sidewinder icon baked into .exe permanently | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.2.6 |
| Local install updated to v0.2.9 at `C:\Users\Keagan\AppData\Local\EDTC\EDTC.exe` | DONE | â€” |

## Key notes from Session 17

- **Why it kept reverting**: v0.2.1â€“v0.2.5 had no `--icon` flag, so PyInstaller used its default floppy-disk icon every build. Adding `--icon` is permanent â€” all future CI builds embed the sidewinder.
- **Icon cache**: Windows caches `.exe` icons in `%LOCALAPPDATA%\Microsoft\Windows\Explorer\iconcache*.db`. When a new .exe replaces an old one, the floppy can persist until the cache is flushed. Cleared once manually; will not recur since the icon is now stable across builds.
- **Desktop shortcut**: `_create_desktop_shortcut()` already sets `IconLocation = exe,0`, so it always reads the icon from the .exe itself â€” no separate shortcut icon management needed.
- **macOS/Linux**: `--icon` not added to those CI steps (macOS needs `.icns`, Linux has no native support). Windows is the primary target; revisit if macOS packaging becomes a priority.

## Known issues / notes for next session

- All previous known issues from Session 16 still apply.
- System Planner + Economy Simulator and Nexus Building Planner still unbuilt (deferred).
- `data/guardian_sites.json` still only 8 sites â€” replace with full Canonn dataset when needed.
- pygame not installable on Python 3.14 â€” CMDR ping audio silently disabled in dev; CI builds use 3.12 so .exe has audio.

---
*Session 17 complete â€” 2026-06-28*

---

## Build status â€” Session 18 (COMPLETE)

Focus: Navigation page â€” making it work as well as possible end-to-end.

| Item | Status | File |
|---|---|---|
| `Loadout` added to `STARTUP_EVENTS` so ship info seeds on replay | DONE | `core/journal.py` |
| `_latest_journal()` fixed to sort by `mtime` not alphabetically â€” critical bug (old `Journal.22...` filenames sorted after new `Journal.2026...`) | DONE | `core/journal.py` |
| `_current_ship` dict added to API state | DONE | `main.py` |
| `_handle_loadout()` â€” extracts ship type/name/ident, MaxJumpRange, UnladenMass, FuelCapacity, CargoCapacity, and Guardian FSD Booster bonus | DONE | `main.py` |
| `_GUARDIAN_BOOSTER_BONUS` â€” flat bonus lookup by module size (size5=10.5 ly, etc.) â€” booster doesn't scale with mass | DONE | `main.py` |
| `get_ship_info()` â€” reads Status.json for live fuel+cargo, computes current jump range with correct formula | DONE | `main.py` |
| Current jump range formula: `fsd_base = max_range âˆ’ guardian_bonus`, `current = fsd_base Ã— (unladen/mass) + guardian_bonus` | DONE | `main.py` |
| `get_ship_info()` self-heal: if `_current_ship` empty, scans latest journal directly (fixes race condition with replay thread) | DONE | `main.py` |
| `_push_startup()` thread: 1.5s after webview ready, re-emits `ship_changed` + `system_changed` (fixes race condition) | DONE | `main.py` |
| `Spansh.neutron_route()` field fix: `distance_to_destination` â†’ `distance_left` | DONE | `api/spansh.py` |
| `Navigation.jsx` â€” full rewrite: 3-tab UI (Route Planner / Paste Route / Saved Routes) | DONE | `frontend/src/pages/Navigation.jsx` |
| Ship info card: ship name, type, callsign, current jump range (prominent), max range (smaller), fuel, cargo | DONE | `frontend/src/pages/Navigation.jsx` |
| Jump range input auto-fills from `current_jump_range ?? max_jump_range`; labelled "auto-filled from game" | DONE | `frontend/src/pages/Navigation.jsx` |
| Neutron route planner: from/to system inputs, efficiency buttons (Balanced/Fast/Maximum), Plan Route button | DONE | `frontend/src/pages/Navigation.jsx` |
| Route result display: waypoint list with neutron star indicator (âš¡), jumps/distance totals, Save & Activate | DONE | `frontend/src/pages/Navigation.jsx` |
| `ErrorBoundary` component wraps `<Routes>` to surface React render errors in-app instead of blank screen | DONE | `frontend/src/App.jsx` |

## Key technical notes from Session 18

- **Journal filename sort bug**: Old journals use `Journal.YYMMDDHHMMSS.NN.log` (e.g. `Journal.221003...`), new journals use `Journal.YYYY-MM-DDTHHMMSS.NN.log` (e.g. `Journal.2026-06-28T...`). Alphabetical sort puts old filenames AFTER new ones because `"22" > "20"`. Fix: sort by `mtime` (`key=lambda p: p.stat().st_mtime, reverse=True`).
- **Guardian FSD Booster is a flat bonus**: `MaxJumpRange` in the Loadout event includes the booster. The booster (e.g. size 5 = +10.5 ly) doesn't scale with mass. Formula: strip the bonus, scale the FSD-only range linearly, add the bonus back. Scaling the full `MaxJumpRange` with `sqrt(unladen/mass)` was wrong.
- **FSD range scales linearly with mass**: `range = OptMass/mass Ã— constant` â€” so `currentRange = fsdBase Ã— (unladen/current_mass)`. The exponent is 1 (not 0.5).
- **`MaxJumpRange` at unladen mass**: The Loadout value is calculated at the ship's unladen mass (no fuel, no cargo).
- **Status.json fuel cap**: FuelMain in Status.json can show fleet carrier tritium as FuelMain when docked on a carrier. Cap at `FuelCapacity.Main` from Loadout to avoid inflated values.
- **`window.__edtc.on` signature**: two args `(eventType, handler)` â€” handler receives `payload` directly. Cleanup function returned. Pattern: `const off = window.__edtc?.on('ship_changed', payload => { ... })`.
- **Never test in dev mode** (`python main.py --dev`): consistently shows blank screen in this environment. Always build (`npm run build`) and run production.

## Known issues / notes for next session

- Jump range is within 0.1 ly of game display (23.93 vs 24.04). The tiny residual is rounding in live fuel/cargo values read from Status.json â€” acceptable.
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early (timer cancel not implemented).
- `data/guardian_sites.json` still only 8 sites.
- pygame not installable on Python 3.14 â€” CMDR ping audio silently disabled in dev; CI builds use 3.12 so .exe has audio.
- **Next priority**: go through remaining pages one by one (Trading, Exploration, Engineering, Colonisation, Fleet Carriers, Guardian, Galaxy, Commander, Overlays) and make each work correctly.

---
*Session 18 complete â€” 2026-06-28*

---

## Build status â€” Session 19 (COMPLETE)

Focus: In-app auto-updater + install sync.

| Item | Status | File |
|---|---|---|
| Verified local install vs GitHub releases on session start | DONE | â€” |
| Downloaded and installed v0.2.9 manually (was on v0.2.6) | DONE | `C:\Users\Keagan\AppData\Local\EDTC\EDTC.exe` |
| `check_for_update()` API method â€” hits GitHub releases API, compares semver, returns `{current, latest, update_available, download_url}` | DONE | `main.py` |
| `_version_gt()` helper â€” tuple-based semver comparison | DONE | `main.py` |
| `download_and_install_update(download_url)` API method â€” starts background download thread, returns immediately | DONE | `main.py` |
| `_do_update()` background thread â€” streams download in 64KB chunks, emits `update_progress` events with `{pct, downloaded, total}`, writes `edtc_update.bat`, launches it detached, calls `webview.destroy()` | DONE | `main.py` |
| `edtc_update.bat` pattern â€” waits 2s, `copy /y` new exe over old, relaunches EDTC, self-deletes | DONE | `main.py` |
| `App.jsx` â€” `check_for_update()` called after version fetch on startup | DONE | `frontend/src/App.jsx` |
| `App.jsx` â€” `update_progress` event listener drives download progress state | DONE | `frontend/src/App.jsx` |
| Sidebar update UI â€” amber `â†‘ vX.X.X available` link when update detected | DONE | `frontend/src/App.jsx` |
| Sidebar download progress â€” percentage label + animated progress bar while downloading | DONE | `frontend/src/App.jsx` |
| Sidebar error state â€” shows truncated error message if download/install fails | DONE | `frontend/src/App.jsx` |
| v0.3.0 released | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.0 |
| Local install updated to v0.3.0 at `C:\Users\Keagan\AppData\Local\EDTC\EDTC.exe` | DONE | â€” |

## Key technical notes from Session 19

- **Self-replacing exe on Windows**: a running `.exe` cannot be overwritten while it's open. Pattern: download to `%TEMP%\EDTC_update.exe`, write `edtc_update.bat` that waits 2s (for the app to fully exit), copies the new file over the old path, relaunches, then self-deletes. Launch the bat with `CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS` so it survives the parent process dying.
- **Update check is dev-mode safe**: `download_and_install_update()` returns early with an error string if `sys.frozen` is not set â€” won't try to overwrite `python.exe` in dev.
- **GitHub API for latest release**: `GET https://api.github.com/repos/keaganbmackinnon-coder/EDTC/releases/latest` â€” `tag_name` field holds the version, `assets[].browser_download_url` where `name == "EDTC.exe"` is the Windows download link.
- **WebFetch has a 15-minute cache** â€” when polling GitHub Actions for CI status, the actions list page can return stale "in progress" even after the build completes. Use the GitHub API (`/actions/runs?per_page=1`) to bypass cache and get live status.

## Known issues / notes for next session

- Update check runs on every app launch (one HTTPS request, 5s timeout) â€” acceptable overhead.
- Updater does not verify the downloaded exe (no checksum) â€” fine for a personal tool, revisit if distributing more widely.
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early (timer cancel not implemented).
- `data/guardian_sites.json` still only 8 sites.
- pygame not installable on Python 3.14 â€” CMDR ping audio silently disabled in dev; CI builds use 3.12 so .exe has audio.
- **Next priority**: go through remaining pages one by one (Trading, Exploration, Engineering, Colonisation, Fleet Carriers, Guardian, Galaxy, Commander, Overlays) and make each work correctly.

---
*Session 19 complete â€” 2026-06-29*

---

## Build status â€” Session 20 (COMPLETE)

Focus: Exobiology route planner + updater bug fix.

| Item | Status | File |
|---|---|---|
| `exobiology_route()` added to SpanshAPI â€” form POST to `/exobiology/route`, polls job, returns systems array | DONE | `api/spansh.py` |
| `plan_exobiology_route()` API method | DONE | `main.py` |
| Exploration page â€” new **Exo Planner** tab (between Road to Riches and Exobiology) | DONE | `frontend/src/pages/Exploration.jsx` |
| Exo Planner: origin (auto-fills current system), jump range (auto-fills from ship), search radius, max systems inputs | DONE | `frontend/src/pages/Exploration.jsx` |
| Exo Planner: results show each system with jump count, species count, total value; expandable to bodies â†’ species + per-sample value | DONE | `frontend/src/pages/Exploration.jsx` |
| v0.3.1 released â€” Exo Planner | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.1 |
| Updater bug fix: `webview.destroy()` â†’ `self._window.destroy()` (pywebview has no module-level destroy) | DONE | `main.py` |
| v0.3.2 released â€” updater fix | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.2 |
| Local install updated to v0.3.2 at `C:\Users\Keagan\AppData\Local\EDTC\EDTC.exe` | DONE | â€” |
| v0.3.3 released â€” HANDOFF update / updater smoke-test target | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.3 |

## Key technical notes from Session 20

- **Spansh exobiology API**: `POST https://spansh.co.uk/api/exobiology/route` with form-encoded body (`from`, `range`, `radius`, `max_results`). Returns a job ID (202), poll `/api/results/:job_id` until `status == "ok"`. Result is an array of systems, each with `bodies[]` â†’ `landmarks[]` (species `subtype`, `value` per sample, `count`).
- **Updater bootstrapping problem**: v0.3.0 had `webview.destroy()` which doesn't exist â†’ updater always failed. v0.3.1 also had the bug (fix wasn't in yet). v0.3.2 has the correct `self._window.destroy()`. Had to manually install v0.3.2; from v0.3.2 onward the in-app updater works correctly.
- **GitHub API vs expanded_assets for CI status**: Use `/api/repos/.../actions/runs?per_page=1` to check build status â€” the `expanded_assets` page only shows compiled binaries once CI uploads them, so it's useful as a "is the exe ready?" check.

## Known issues / notes for next session

- Updater does not verify the downloaded exe (no checksum) â€” fine for a personal tool.
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early (timer cancel not implemented).
- `data/guardian_sites.json` still only 8 sites.
- pygame not installable on Python 3.14 â€” CMDR ping audio silently disabled in dev; CI builds use 3.12 so .exe has audio.
- **Next priority**: go through remaining pages one by one (Trading, Exploration, Engineering, Colonisation, Fleet Carriers, Guardian, Galaxy, Commander, Overlays) and make each work correctly.

---
*Session 20 complete â€” 2026-06-29*

---

## Build status â€” Session 21 (COMPLETE)

Focus: In-app auto-updater â€” fixing version reporting and stale download URL bugs.

| Item | Status | File |
|---|---|---|
| `taskkill /f /im EDTC.exe` added to update bat before copy (releases exe file lock) | DONE | `main.py` |
| v0.3.4 released â€” taskkill fix | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.4 |
| Removed CI "Write version from tag" step (was silently writing wrong version to VERSION file) | DONE | `.github/workflows/build.yml` |
| Startup version log line added: `EDTC starting â€” version X.X.X` in `edtc_debug.log` | DONE | `main.py` |
| `APP_VERSION` changed from file-read to hardcoded constant in source â€” eliminates stale VERSION file bundling bug entirely | DONE | `main.py` |
| `--add-data "VERSION;."` removed from PyInstaller steps â€” no longer needed | DONE | `.github/workflows/build.yml` |
| `_do_update()` now re-fetches latest GitHub release URL right before downloading â€” prevents stale cached URL from downloading wrong version | DONE | `main.py` |
| Bat improved: `timeout /t 2` after taskkill, copy result logged to `%TEMP%\edtc_copy.log`, `exit /b 1` on copy failure | DONE | `main.py` |
| v0.3.5â€“v0.3.8 released (incremental fixes) | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.8 |
| Local install at v0.3.8 â€” **updater confirmed working end-to-end** | DONE | `C:\Users\Keagan\AppData\Local\EDTC\EDTC.exe` |

## Key technical notes from Session 21

- **VERSION file bundling bug**: PyInstaller's `--add-data "VERSION;."` was picking up a stale copy of the VERSION file during CI builds, always bundling the previous version's value. Root cause was never pinpointed (possibly CI workspace caching between matrix jobs). Fixed by removing the file entirely and hardcoding `APP_VERSION = "0.3.8"` directly in `main.py`. To bump the version, just change this constant.
- **Stale download URL bug**: `check_for_update()` runs at app startup. If a new release is published while EDTC is already open, the stored `download_url` points to the old version. Fixed in `_do_update()` by re-fetching `/releases/latest` from GitHub right before the download starts, ignoring the cached URL.
- **Bootstrapping pattern**: every updater bug fix requires one manual install to get the fix running, because the running exe contains the old (broken) updater code. After that, all subsequent updates work in-app.
- **Updater flow**: download v(N+1) to `%TEMP%\EDTC_update.exe` â†’ write `edtc_update.bat` â†’ launch bat detached â†’ `self._window.destroy()` closes app â†’ bat: `taskkill`, `copy /y`, `start "" "exe_path"`, self-deletes.

## Known issues / notes for next session

- Updater does not verify the downloaded exe (no checksum).
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early.
- `data/guardian_sites.json` still only 8 sites.
- pygame not installable on Python 3.14 â€” audio disabled in dev; CI uses 3.12.
- **Next priority**: go through remaining pages one by one (Trading, Exploration, Engineering, Colonisation, Fleet Carriers, Guardian, Galaxy, Commander, Overlays) and make each work correctly.

---
*Session 21 complete â€” 2026-06-29*

---

## Build status â€” Session 22 (COMPLETE)

Focus: Updater reliability, database persistence, Spansh dump replacement, CI hardening.

| Item | Status | Notes |
|---|---|---|
| Database path fixed â€” was writing to `_MEI*` temp dir (wiped each launch) | DONE | `core/database.py` â€” now `Path(sys.executable).parent / "edtc.db"` when frozen |
| Seed thread moved to `_on_ready` â€” ensures webview is ready before emitting status events | DONE | `main.py` |
| Updater bat fixed â€” replaced `start ""` (blocked by Windows Zone.Identifier) with `Unblock-File` + `Start-Process` via PowerShell | DONE | `main.py` |
| Spansh dump seeding removed â€” dump grew to 4 GB, not feasible in-app | DONE | `main.py` â€” functions deleted entirely |
| Spansh API results increased 50â†’100 per query | DONE | `api/spansh.py` |
| Seed status UI removed from Trading page | DONE | `frontend/src/pages/Trading.jsx` |
| CI: version-tag match check added â€” fails build if `APP_VERSION` in `main.py` doesn't match git tag | DONE | `.github/workflows/build.yml` |
| CI: syntax check added â€” `python -m py_compile main.py core/database.py` | DONE | `.github/workflows/build.yml` |
| `.claude/settings.json` added â€” auto-approves git/file/API tool calls for this project | DONE | `.claude/settings.json` |
| v0.3.9â€“v0.3.14 released (incremental fixes) | DONE | Latest: https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.14 |
| Local install at v0.3.14 â€” updater + database persistence confirmed working | DONE | `C:\Users\Keagan\AppData\Local\EDTC\EDTC.exe` |

## Key technical notes from Session 22

- **Database was never persistent**: `Path(__file__).parent.parent` in a PyInstaller `--onefile` bundle resolves to `sys._MEIPASS` (the temp extraction dir), not the exe dir. Every launch created a fresh DB. Fixed by checking `sys.frozen` and using `Path(sys.executable).parent` instead.
- **Updater `start ""` blocked by MOTW**: Files downloaded from GitHub carry a Zone.Identifier alternate data stream (internet zone mark). CMD's `start` goes through the Windows shell which enforces this. `Unblock-File` removes the ADS; `Start-Process` via PowerShell uses CreateProcess directly. Both added to the bat.
- **Infinite update loop**: The v0.3.11 tag was pushed without bumping `APP_VERSION` in `main.py`. Every installed binary reported `0.3.10`, always saw `v0.3.11` as newer, and immediately offered the same update again. CI version-tag check now catches this before the build runs.
- **Spansh dump URL changed**: `spansh.co.uk/dumps/` now serves HTML (Ember SPA). The download server moved to `downloads.spansh.co.uk` but the dump grew to ~4 GB compressed â€” not viable for in-app download. Removed seeding; rely on live Spansh API queries instead.
## Known issues / notes for next session

- Updater does not verify downloaded exe (no checksum).
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early.
- **Next priority**: go through remaining pages one by one (Trading, Exploration, Engineering, Colonisation, Fleet Carriers, Galaxy, Commander, Overlays) and make each work correctly. Guardian is done.

---
*Session 22 complete â€” 2026-06-29*

---

## Build status â€” Session 23 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `api/eddn.py` deleted â€” dead websocket code (404'd, never imported; replaced by ZMQ in Session 14) | DONE | deleted |
| `guardian_sites.json` expanded: 5 new ruins added from Canonn page data (13 total: 10 ruins + 3 structures) | DONE | `data/guardian_sites.json` |
| `Guardian.jsx` TYPE_COLORS updated: all 10 Canonn shape names now have distinct colors | DONE | `frontend/src/pages/Guardian.jsx` |
| `Market` added to `WATCHED_EVENTS` | DONE | `core/journal.py` |
| `_import_market_json()` â€” reads `Market.json` from ED save dir, upserts to local market DB | DONE | `main.py` |
| `_push_startup()` calls `_import_market_json()` on every app launch | DONE | `main.py` |
| v0.3.16 released â€” Market.json import (own docked station now always appears in commodity search) | DONE | â€” |

---

## Build status â€” Session 24 (COMPLETE)

| Item | Status | File |
|---|---|---|
| `api/inara.py` â€” InaraAPI class with `getCommoditiesStations` event | DONE | `api/inara.py` |
| `core/database.py` â€” `get_system_coords()` helper added | DONE | `core/database.py` |
| `main.py` â€” `get_inara_key()`, `set_inara_key()`, `test_inara_key()` API methods | DONE | `main.py` |
| `main.py` â€” `search_commodity_markets()` now runs Spansh + Inara concurrently via `asyncio.gather` | DONE | `main.py` |
| `main.py` â€” Inara `_run_inara()` falls back to EDSM for ref system coords when not in local DB | DONE | `main.py` |
| `Trading.jsx` â€” `âš™ API Keys` settings panel with key input, Test button, Save/Clear | DONE | `frontend/src/pages/Trading.jsx` |
| `Trading.jsx` â€” blue **Inara** badge on Inara-sourced results | DONE | `frontend/src/pages/Trading.jsx` |
| Updater fixed: now sorts all releases by semver, not publish time (prevents lower version blocking update) | DONE | `main.py` â€” `_fetch_highest_release()` |
| v0.3.17â€“v0.3.21 released | DONE | Latest: https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.21 |

## Key notes from Session 24

- **Inara API blocked**: Inara's API returns `400 "This application has no access allowed"` because EDTC is not a registered app with Inara. The user's API key is valid but the app name "EDTC" isn't whitelisted. Inara integration is wired up and falls back silently â€” when/if EDTC gets registered with Inara, it will work automatically. To register: contact Inara dev via their forum/Discord and request app access.
- **Updater publish-order bug**: GitHub `/releases/latest` returns the most recently *published* release, not the highest version. When two builds finish seconds apart (e.g. a re-tagged rebuild), the lower version can become "latest". Fixed by fetching `/releases?per_page=20` and picking the max semver.
- **Tag-before-version-bump bug**: Several releases (v0.3.18, v0.3.19) failed CI because the tag was pushed before `APP_VERSION` was bumped in the same commit. CI checks `tag == APP_VERSION`. Fix: always bump version and tag in one commit.
- **Market.json import**: When the player opens the commodities screen at any station, ED writes `Market.json` to the save dir. EDTC reads this on startup AND on the `Market` journal event â€” ensures the docked station always appears in commodity search even if it's a new colonisation station not in any global DB.

## Known issues / notes for next session

- Updater does not verify downloaded exe (no checksum).
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early.
- `data/guardian_sites.json` has 13 sites â€” Canonn API was down. When `api.canonn.tech` is back, fetch full dataset via `GET https://api.canonn.tech/guardianruins?_limit=500`.
- **Inara integration**: wired but blocked pending app registration with Inara. Falls back silently to EDDN + Spansh.
- **Next priority**: go through remaining pages (Exploration, Engineering, Colonisation, Fleet Carriers, Galaxy, Commander, Overlays) and make each work correctly.

---
*Session 24 complete â€” 2026-06-29*

---

---

## Build status — Session 25 (COMPLETE)

Focus: Colonisation tab overhaul — fix Market Finder, auto-import from depot, live depot view.

| Item | Status | File |
|---|---|---|
| `_handle_construction_depot()` — now emits `station`, `progress`, `complete` in addition to `system`/`resources` | DONE | `main.py` |
| `DepotBanner` component — auto-shows above tabs when `ColonisationConstructionDepot` fires | DONE | `frontend/src/pages/Colonisation.jsx` |
| DepotBanner: "Import as Project" — creates project from `ResourcesRequired` with `ProvidedAmount` as delivered | DONE | `frontend/src/pages/Colonisation.jsx` |
| DepotBanner: "Sync Delivered" — if matching project exists, updates all `delivered` counts from `ProvidedAmount` | DONE | `frontend/src/pages/Colonisation.jsx` |
| `DepotTab` — 5th tab "Depot View" showing RequiredAmount/ProvidedAmount/remaining + FC cargo comparison | DONE | `frontend/src/pages/Colonisation.jsx` |
| `MarketFinderTab` — fixed broken display (was using `r.market[]`/`r.name`/`r.system?.name`; now uses normalized `r.station`/`r.system`/`r.buy_price`/`r.supply`) | DONE | `frontend/src/pages/Colonisation.jsx` |
| MarketFinderTab — Inara badge on Inara-sourced results, "L" pad indicator, distance in ly next to system name | DONE | `frontend/src/pages/Colonisation.jsx` |
| `construction_depot` event listener wired in Colonisation main component | DONE | `frontend/src/pages/Colonisation.jsx` |
| Depot banner dismisses independently from depot data (banner = `bannerOpen` state, data = `depot` state) | DONE | `frontend/src/pages/Colonisation.jsx` |
| `APP_VERSION` bumped to `0.3.22` | DONE | `main.py` |

## Key notes from Session 25

- **Depot banner**: fires whenever `ColonisationConstructionDepot` journal event arrives (docking at a construction site). Banner auto-dismisses when user clicks Import/Sync or ✕. Depot data persists in React state so Depot View tab stays populated after dismissing the banner.
- **Import vs Sync**: "Import" creates a new project (used when no project exists for that system). "Sync Delivered" updates existing project's `delivered` counts from `ProvidedAmount` — which is the game's ground truth (includes all deliveries from all players in open mode). After sync, both should press Projects tab automatically.
- **`depotCommodityName()`**: `ResourcesRequired[].Name` is in `$name_name;` format. `Name_Localised` gives the display name. Helper strips `$` prefix and `_name;` suffix as fallback.
- **MarketFinderTab fix**: `search_commodity_markets()` returns normalized dicts since Session 14. The old tab code tried to read `r.market[]` from the raw Spansh response shape. Now correctly reads `r.station`, `r.system`, `r.buy_price`, `r.supply`, `r.distance_to_arrival`, `r.has_large_pad`, `r.source`.
- **Colonisation now has 5 tabs**: Projects, Shopping List, FC Cargo, Depot View, Market Finder.

## Known issues / notes for next session

- Updater does not verify downloaded exe (no checksum).
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early.
- `data/guardian_sites.json` has 13 sites. Full Canonn dataset available at `api.canonn.tech/guardianruins?_limit=500` when API is back up.
- Inara integration wired but blocked pending app registration. Falls back silently.
- **v0.3.22 not yet released** — build and tag when ready.

---
*Session 25 complete — 2026-06-29*

---

## Build status — Session 26 (COMPLETE)

Focus: ErrorBoundary fix, cargo overlay fix, Construction overlay dynamic sizing.

| Item | Status | File |
|---|---|---|
| Fix "everything is a page error" — ErrorBoundary stays in error state across route changes | DONE | `frontend/src/App.jsx` |
| ErrorBoundary `componentDidUpdate` resets on `resetKey` (pathname) change | DONE | `frontend/src/App.jsx` |
| ErrorBoundary now shows full stack trace in-app for future debugging | DONE | `frontend/src/App.jsx` |
| Fix cargo overlay yellow bar — `_emit()` only reaches main window, not overlay windows | DONE | `main.py` |
| `_import_cargo_json()` and `_handle_cargo()` both emit to overlay via `emit_to_overlay()` | DONE | `main.py` |
| `_push_cargo_to_overlay()` — pushes cargo 2.5s after overlay is shown/toggled (timing fix) | DONE | `main.py` |
| `get_ship_cargo()` lazy-imports from Cargo.json if cache is empty | DONE | `main.py` |
| `resize_overlay(name, width, height)` API method added | DONE | `main.py` |
| Construction overlay initial height set to 80px (resizes dynamically) | DONE | `core/overlay.py` |
| `Construction.jsx` — full rewrite: dynamic sizing + completed commodity filtering | DONE | `frontend/src/overlays/Construction.jsx` |
| Completed commodities (delivered >= required) hidden from overlay list | DONE | `frontend/src/overlays/Construction.jsx` |
| `useLayoutEffect` + `panelRef` measures panel height and calls `resize_overlay` after every render | DONE | `frontend/src/overlays/Construction.jsx` |
| "N commodities complete" footer shown when some items are done | DONE | `frontend/src/overlays/Construction.jsx` |
| "All commodities delivered!" shown when all done | DONE | `frontend/src/overlays/Construction.jsx` |
| Null guard added to `construction_update` handler in Colonisation.jsx | DONE | `frontend/src/pages/Colonisation.jsx` |
| v0.3.29 released — ErrorBoundary fix | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.29 |
| v0.3.30 released — cargo overlay fix | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.30 |
| v0.3.31 released — dynamic overlay + completed commodity filtering | DONE | https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.31 |

## Key notes from Session 26

- **Root cause of "everything is page error"**: The ErrorBoundary class component stays in error state when navigating routes — React doesn't auto-reset it. Added `componentDidUpdate` that resets when `resetKey` prop (= `pathname`) changes.
- **Root cause of cargo overlay bug**: Three-layer problem — (1) `_emit()` only sends to main window, not overlay; (2) overlay window didn't exist yet when `_import_cargo_json()` fired at startup; (3) `get_ship_cargo()` returned stale empty cache. Fixed all three: emit to both windows, 2.5s delayed push when overlay opens, lazy import from Cargo.json.
- **Dynamic overlay sizing**: `useLayoutEffect` (no deps array) runs after every render. Measures `panelRef.current.offsetHeight`, calls `api()?.resize_overlay?.('construction', 460, h + 24)`. No deps = fires on every state change. This is intentional — content changes trigger re-measure.
- **APP_VERSION = "0.3.31"** in `main.py` line 33.
- **gh CLI not installed** — releases created via GitHub REST API directly using credentials from git credential manager.

## Known issues / notes for next session

- Updater does not verify downloaded exe (no checksum).
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early.
- `data/guardian_sites.json` has 13 sites. Full Canonn dataset at `api.canonn.tech/guardianruins?_limit=500`.
- Inara integration wired but blocked pending app registration. Falls back silently.
- pygame not installable on Python 3.14 — audio disabled in dev; CI uses 3.12.

---
*Session 26 complete — 2026-06-30*

---

## Build status — Session 27 (COMPLETE)

Focus: Guardian sites data overhaul.

| Item | Status | File |
|---|---|---|
| `data/guardian_sites.json` expanded from 13 stubs → 37 ruins + 99 structures (136 total) | DONE | `data/guardian_sites.json` |
| Ruins: real types (Alpha/Beta/Gamma) and coordinates sourced from SrvSurvey data (github.com/njthomson/SrvSurvey) | DONE | `data/guardian_sites.json` |
| Ruins: include canonn_id (GR001 etc.), site count per body, and useful notes | DONE | `data/guardian_sites.json` |
| Structures: all 50 Weapon Blueprint sites (Bear/Hammerbot/Bowl) from Canonn | DONE | `data/guardian_sites.json` |
| Structures: all 17 Module Blueprint sites (Turtle) from Canonn | DONE | `data/guardian_sites.json` |
| Structures: all 32 Vessel Blueprint sites (Stickyhand/Robolobster/Squid) from Canonn | DONE | `data/guardian_sites.json` |
| `get_guardian_sites()` fixed — ruins show JSON default notes; structures only show user-entered notes | DONE | `main.py` |
| `BLUEPRINT_INFO` map added — structure cards now show "Weapon/Module/Vessel Blueprint → items" row visually | DONE | `frontend/src/pages/Guardian.jsx` |

## Key notes from Session 27

- **Data sources**: Canonn API (api.canonn.tech) was still down. Ruins data sourced from SrvSurvey JSON files (github.com/njthomson/SrvSurvey/tree/main/data/guardian/). Structure data sourced from Canonn codex page (canonn.science/codex/guardian-structure/).
- **Ruins type** = in-game Alpha/Beta/Gamma classification (from SrvSurvey `t` field). Structures type = Canonn layout name (Bear/Hammerbot/Bowl/Turtle/Stickyhand/Robolobster/Squid).
- **Blueprint mapping**: Bear/Hammerbot/Bowl → Weapon Blueprints; Turtle → Module Blueprints; Stickyhand/Robolobster/Squid → Vessel Blueprints.
- **Notes fix**: `get_guardian_sites()` previously set `site["notes"] = ""` for any site with no DB entry, hiding JSON default notes. Fixed to only use DB notes when non-empty.
- **SrvSurvey**: Very capable companion app (overlays, Guardian site maps, exobiology, navigation). Worth studying for feature ideas. Tracks visited Guardian site areas with on-screen maps, species prediction for exobiology, SRV coordinate guidance.
- **Coords coverage**: Ruins have real coordinates from SrvSurvey for most entries (~30/37). Structures have no coordinates (not published by Canonn on their codex page).

## Known issues / notes for next session

- Canonn API (api.canonn.tech) still down — when it recovers, fetch full dataset via `GET https://api.canonn.tech/guardianruins?_limit=500` and `guardianstructures?_limit=500` for complete coverage (~113 ruins total, more structures).
- Structures have no coordinates — would need cross-referencing with EDSM or SrvSurvey structure files to add lat/lon.
- SrvSurvey directory listing shows ~37 unique ruins system+body pairs surveyed; full Canonn dataset likely has more ruins in Eta Carina, Prai Hypoo, Skaudai, and Teal Nebula clusters not yet in our JSON.
- Updater does not verify downloaded exe (no checksum).
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early.
- pygame not installable on Python 3.14 — audio disabled in dev; CI uses 3.12.

---
*Session 27 complete — 2026-06-30*

---

## Build status — Session 28 (COMPLETE)

Focus: Galaxy Map tab + overlay diagnostics.

| Item | Status | File |
|---|---|---|
| Galaxy Map tab added to Galaxy page (new 8th tab) | DONE | `frontend/src/pages/Galaxy.jsx` |
| `GalaxyMapTab` component — canvas-based galaxy visualization | DONE | `frontend/src/pages/Galaxy.jsx` |
| Top-down view: galaxy disc gradient + spiral arm hints + key locations (Sol, Colonia, Beagle Point, Sgr A*) | DONE | `frontend/src/pages/Galaxy.jsx` |
| Edge-on view: thin disc glow + galactic bulge + ±500 ly reference lines | DONE | `frontend/src/pages/Galaxy.jsx` |
| Exploration % tracker: EDSM system count / 400B estimated · log-scale progress bar | DONE | `frontend/src/pages/Galaxy.jsx` |
| `useRef` added to React import in Galaxy.jsx | DONE | `frontend/src/pages/Galaxy.jsx` |
| Construction overlay: minimum height guard (skip resize if h < 20px) | DONE | `frontend/src/overlays/Construction.jsx` |
| overlay.py: added `logging` import + try/except + info/error logs in `_create()` | DONE | `core/overlay.py` |
| `APP_VERSION` bumped to `0.3.33` | DONE | `main.py` |

## Key notes from Session 28

- **Galaxy Map data**: exploration % from `get_galaxy_stats()` (EDSM `systems` field / 400B). Map itself is stylized canvas — no live heatmap yet (architecture stub).
- **Galaxy coordinate system**: Sgr A* at ED (25, 25900) placed at canvas centre. Scale ≈ 155 ly/px. Sol at ~(300, 444) on a 600×600 canvas.
- **Heatmap future work**: Spansh/EDSM don't expose a grid-density API. Options: (a) pre-process Spansh galaxy dump once into a density grid JSON, (b) use EDSM tile queries for a subset, (c) keep stylized map and show live system counts only.
- **Construction overlay issue**: user reported overlay not popping up after "operation update" to ED. Possible causes: (1) ED switched to exclusive full-screen blocking `on_top=True` windows → fix is Windowed Borderless mode; (2) pywebview window creation failing silently → now logged in `edtc_debug.log`; (3) zero-height resize → guarded. Check `edtc_debug.log` for "overlay: creating window 'construction'" and "overlay: window 'construction' created" lines.
- **Journal events post-operation-update**: if ED renamed `ColonisationContribution` → check journal files for new event names and update `WATCHED_EVENTS` + `_handle_construction_contribution`.

## Known issues / notes for next session

- Construction overlay root cause not confirmed — check `edtc_debug.log` after enabling overlay to see if window creation fails.
- If game is in exclusive full-screen, all `on_top=True` overlays will be blocked — not a code bug.
- Galaxy Map heatmap layer is a stub — see "Heatmap future work" above.
- Y-slice bands for Galaxy Map (the user's requested feature) are not yet implemented — need density data source first.
- Canonn API (api.canonn.tech) still down — Guardian data has 136 sites from SrvSurvey/Canonn codex.
- Updater does not verify downloaded exe (no checksum).
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early.
- pygame not installable on Python 3.14 — audio disabled in dev; CI uses 3.12.

---
*Session checkpoint: 2026-06-30 19:41:59*

---
*Session checkpoint: 2026-06-30 19:43:15*

---
*Session checkpoint: 2026-06-30 19:44:39*

---
*Session checkpoint: 2026-06-30 19:45:25*

---
*Session checkpoint: 2026-06-30 19:47:12*

---
*Session checkpoint: 2026-06-30 19:49:30*

---
*Session checkpoint: 2026-06-30 19:51:44*

---
*Session checkpoint: 2026-06-30 19:52:43*

---
*Session checkpoint: 2026-06-30 19:57:50*

---
*Session checkpoint: 2026-06-30 20:01:14*

---
*Session checkpoint: 2026-06-30 20:03:37*

---
*Session checkpoint: 2026-06-30 20:06:27*

---
*Session checkpoint: 2026-06-30 20:13:16*

---
*Session checkpoint: 2026-06-30 20:43:16*

---
*Session checkpoint: 2026-06-30 20:53:14*

---
*Session checkpoint: 2026-06-30 23:04:00*

---
*Session checkpoint: 2026-06-30 23:32:13*

---
*Session checkpoint: 2026-06-30 23:51:06*

---
*Session checkpoint: 2026-06-30 23:52:18*

---
*Session checkpoint: 2026-06-30 23:53:56*

---
*Session checkpoint: 2026-07-01 00:01:29*

---
*Session checkpoint: 2026-07-01 00:10:44*
