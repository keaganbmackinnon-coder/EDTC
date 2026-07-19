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

---
*Session checkpoint: 2026-07-01 00:55:59*

---
*Session checkpoint: 2026-07-01 01:14:22*

---
*Session checkpoint: 2026-07-01 01:27:12*

---
*Session checkpoint: 2026-07-01 01:39:42*

---
*Session checkpoint: 2026-07-01 01:51:39*

---
*Session checkpoint: 2026-07-01 02:07:09*

---
*Session checkpoint: 2026-07-01 02:16:43*

---

## Build status — Session 29 (COMPLETE)

Focus: Galaxy Map polish, three dead-EDSM-endpoint fixes, colonisation overlay
crash + auto-sync, a real local commodity-search bug, and Nearest Service
rewrite.

| Item | Status | File |
|---|---|---|
| Top-down map: 42 named galactic regions added as outline borders + labels (data derived from the community `klightspeed/EliteDangerousRegionMap` boundary grid) | DONE | `frontend/src/pages/Galaxy.jsx` |
| Edge-on map: replaced 3-line ±500ly reference with full ±2000ly banding in 500ly steps | DONE | `frontend/src/pages/Galaxy.jsx` |
| Fixed dead endpoint: `get_galaxy_stats()` called EDSM `/api-v1/stats`, which never existed (confirmed via EDSM's real API docs) — replaced "Galaxy Exploration Progress" with "Local Data Cache" backed by the existing `get_market_stats()` | DONE | `main.py`, `frontend/src/pages/Galaxy.jsx` |
| Removed "Galaxy Stats" tab — relied on the same dead endpoint with no honest local replacement | DONE | `frontend/src/pages/Galaxy.jsx` |
| Fixed dead endpoint: GalNet called EDSM `/api-v1/news` (also never existed) — added `api/galnet.py` hitting Frontier's real CMS (`cms.zaonce.net`, same backend as `community.elitedangerous.com/galnet`) | DONE | `api/galnet.py`, `main.py` |
| Fixed dead endpoint: Community Goals called EDSM `/api-v1/community-goals` (also never existed, same pattern) — added `api/communitygoals.py` hitting the real public initiatives API (`api.orerve.net/2.0/website/initiatives/list`) | DONE | `api/communitygoals.py`, `main.py`, `frontend/src/pages/Galaxy.jsx` |
| Colonisation: docking now auto-syncs delivered counts from the game's `ProvidedAmount` into the matching tracked project (`sync_construction_depot`), instead of only updating on a manual "Sync Delivered" click | DONE | `core/database.py`, `main.py` |
| Colonisation: opening/enabling the construction overlay now also pushes the current system's project state, not just cargo, so it isn't empty on first open | DONE | `main.py` |
| Overlay "white screen" root cause found: real per-pixel window transparency depends on an undocumented, unreliable pywebview/WebView2 mechanism (confirmed via upstream source + open GitHub issues, no fix available) — switched overlays to a solid dark HUD background instead | DONE | `core/overlay.py`, `frontend/src/App.jsx`, `frontend/src/main.jsx` |
| Added an ErrorBoundary around the overlay render path — a React crash there was previously silently unmounting to nothing (indistinguishable from "blank") | DONE | `frontend/src/App.jsx` |
| Found and fixed the real crash the ErrorBoundary exposed: `Construction.jsx` called `api()?.get_construction_projects(true)` with only `api()` optional-chained, not the method call — threw "is not a function" when the pywebview bridge object existed but that method wasn't attached yet | DONE | `frontend/src/overlays/Construction.jsx` |
| Overlay dynamic sizing: replaced single post-render height measurement with a `ResizeObserver` tied to the actual panel DOM node (more reliable than one measurement synced to React's render timing) | DONE | `frontend/src/overlays/Construction.jsx` |
| Fixed real, higher-impact bug: `_import_market_json()` stores commodity names as bare internal symbols (`combatstabilisers`), but `search_local_markets()` compared that against the human-readable display name (`Combat Stabilisers`) — any multi-word commodity failed to match. Affected **all** locally-cached EDDN + Market.json data, not just newly-visited stations | DONE | `core/database.py` |
| Nearest Service rewrite: the old `/nearest` Spansh endpoint actually requires x/y/z coords, not a system name (confirmed via direct testing — 400s on a system name) and only ever supported one service — it was very likely never working. Replaced with `/stations/search` (already used for commodity search), sorted nearest-first, with service matching done client-side against each station's real `services` list | DONE | `api/spansh.py`, `main.py` |
| Nearest Service UI: service chips are now multi-select toggles (find nearest station with ALL selected services) instead of single-select | DONE | `frontend/src/pages/Trading.jsx` |
| Commodity Search: sort chips are now multi-select with priority order (click to add/remove; first selected = primary sort, rest are tiebreakers in order) | DONE | `frontend/src/pages/Trading.jsx` |
| `APP_VERSION` bumped `0.3.33` → `0.3.34` (local build only — not tagged/released to GitHub) | DONE | `main.py` |

## Key notes from Session 29

- **EDSM endpoint audit**: three separate calls (`/api-v1/stats`, `/api-v1/news`, `/api-v1/community-goals`) all 404'd because those paths never existed on EDSM — confirmed by checking EDSM's actual API docs (only `system`/`systems`/`sphere-systems`/`cube-systems` are real). These were likely hallucinated in earlier sessions and had been silently broken (returning error strings) since Session 8/11. All three now have real, verified, working replacements.
- **Spansh sort bug found but not fixed**: `api/spansh.py`'s existing `commodity_markets()` uses `"sort": "distance"` (a bare string) — verified via direct testing that this does **not** actually sort results by distance (returns effectively unsorted order across systems). The new `stations_near()` uses the correct form, `"sort": [{"distance": {"direction": "asc"}}]`. `commodity_markets()` still has the old broken form — worth fixing next session, since Commodity Search's Spansh-sourced results may not be true nearest-first despite the "Closest first" sort option implying otherwise (the local/EDDN-sourced half of results computes real distance correctly in Python, so only the Spansh portion is affected).
- **pywebview/WebView2 transparency is a known dead end**: `transparent=True` on Windows depends on an internal "hack" the pywebview maintainers themselves describe as "no idea why this works," with multiple open, unresolved upstream issues about it rendering solid instead of see-through. Don't re-attempt real transparency for overlays — the solid dark HUD background is the correct, permanent approach here.
- **Local build/deploy loop used this session**: `cd frontend && npm run build` → `pyinstaller --onefile --windowed --name EDTC --icon "frontend/public/icon.ico" --add-data "frontend/dist;frontend/dist" --add-data "data;data" main.py` → `taskkill /F /IM EDTC.exe` → wait ~2s for file lock release → `cp dist/EDTC.exe` over `%LOCALAPPDATA%\EDTC\EDTC.exe` → relaunch. This is what `build_local.bat` does non-interactively; the `.bat` itself has `pause` calls unsuitable for automation.
- **Windows enumeration lesson (read this before automating any more UI clicks)**: `Get-Process -Id X | Select MainWindowHandle` is unreliable once a process owns multiple top-level windows (main window + overlay) — it can silently return whichever window Windows considers "main" at that instant, not necessarily the one you want. Always enumerate with `EnumWindows` + `GetWindowThreadProcessId` and match on window title/handle explicitly before clicking or resizing anything. Two incidents this session (one stray click landed in the live game, one landed in an unrelated always-on-top app, SrvSurvey) both traced back to computing click coordinates from a window rect that went stale before the click executed — the same root cause. Prefer read-only screenshots over synthesized clicks whenever possible.

## Known issues / notes for next session

- `api/spansh.py`'s `commodity_markets()` still uses the broken `"sort": "distance"` string form — fix to the array form used in `stations_near()` for genuinely-nearest-first Spansh results.
- Updater does not verify downloaded exe (no checksum).
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early.
- `data/guardian_sites.json` has 136 sites (37 ruins + 99 structures) — Canonn API (`api.canonn.tech`) was down all session; fetch the full dataset when it recovers.
- pygame not installable on Python 3.14 — audio disabled in dev; CI builds use 3.12.
- Galaxy Map heatmap/y-slice bands are still a stub — no density data source yet (unrelated to the sector outlines added this session, which use a different, boundary-only data source).
- Inara integration wired but blocked pending app registration with Inara (unrelated, unresolved from Session 24).
- Construction overlay visibility over Elite Dangerous in **exclusive fullscreen** may still be blocked by Windows compositor rules — recommend Borderless/Windowed mode in ED's display settings if the overlay doesn't appear even though this session confirmed its data pipeline and rendering are now correct.
- `APP_VERSION` is at `0.3.34` locally but **not tagged or released** — no `v0.3.34` GitHub release exists. Bump/tag/release through the normal CI flow when ready.

---
*Session 29 complete — 2026-07-01*

---
*Session checkpoint: 2026-07-01 02:24:28*

---
*Session checkpoint: 2026-07-01 19:29:04*

---
*Session checkpoint: 2026-07-01 19:31:04*

---
*Session checkpoint: 2026-07-01 19:34:01*

---
*Session checkpoint: 2026-07-01 20:00:10*

---
*Session checkpoint: 2026-07-01 20:07:32*

---
*Session checkpoint: 2026-07-01 20:08:51*

---
*Session checkpoint: 2026-07-01 20:10:34*

---

## Build status — Session 30 (COMPLETE)

Focus: markets DB performance (index use, batched writes, pruning) + three
accuracy fixes found by inspecting live game data.

| Item | Status | File |
|---|---|---|
| `upsert_market_data` — commodity names normalized to bare symbols at insert time (`_commodity_symbol`), rows written with one `executemany` instead of per-row execute | DONE | `core/database.py` |
| `search_local_markets` — WHERE clause compares the indexed column directly (was `LOWER(REPLACE(REPLACE(...)))` which forced a full table scan on every search); verified via `EXPLAIN QUERY PLAN` it now uses `idx_markets_commodity` | DONE | `core/database.py` |
| One-time migration in `init_db` normalizes existing `markets` rows, guarded by `markets_symbol_migrated` pref; `UPDATE OR REPLACE` handles PK collisions (migrated row wins — next EDDN message corrects it) | DONE | `core/database.py` |
| `prune_markets(days=30)` — deletes market rows older than 30 days; called from a background daemon thread at startup; removed 32,915 stale rows on first run | DONE | `core/database.py`, `main.py` |
| **Cargo `Vessel` bug fix**: both `_handle_cargo` and `_import_cargo_json` checked `event.get("Vehicle")` but the journal/Cargo.json key is `Vessel` — the check always defaulted to "Ship", so SRV cargo could overwrite ship cargo | DONE | `main.py` |
| **Materials ground-truth resync**: `Materials` login event (exact Raw/Manufactured/Encoded counts) now triggers `sync_materials()` which replaces the whole materials table — clears drift from sessions played without EDTC | DONE | `main.py`, `core/database.py`, `core/journal.py` |
| Startup replay applies the `Materials` snapshot then re-applies material delta events (collect/discard/trade/craft/synthesis) that came after it in the journal — mid-session EDTC launches land on exact counts; deltas only re-applied when a snapshot exists (no double-count) | DONE | `core/journal.py` |
| **Depot event dedup**: `ColonisationConstructionDepot` re-fires every few seconds while docked at a construction site (2,640 events in one week of journals) — handler now caches (MarketID, progress, ProvidedAmounts) and skips no-op re-fires | DONE | `main.py` |
| Local build + exe swap to `%LOCALAPPDATA%\EDTC\EDTC.exe`; startup log confirms prune, vessel key, and materials resync all working | DONE | — |

## Key notes from Session 30

- **Migration behavior**: when a legacy display-name row collides with an already-normalized row for the same station, the migrated row wins even if older. Acceptable — the EDDN cache self-heals on the next message for that station.
- **`prune_markets` skips rows with empty `updated_at`** (they'd otherwise compare less-than any date and be deleted immediately). Comparison is on `substr(updated_at, 1, 10)` (date part), which tolerates both `T`- and space-separated ISO timestamps.
- **Journal `Cargo` event and Cargo.json use `"Vessel"`, not `"Vehicle"`** — worth remembering for any future Odyssey/SRV work.
- **`Materials` event names**: entries use internal names with `Name_Localised` where they differ; the handler stores `Name_Localised or Name` lowercased, consistent with the existing delta handlers, so Engineering.jsx cross-refs keep working.
- **Live-data findings not yet implemented** (from scanning a week of real journals): `CarrierLocation` fires at login/carrier-jump and would keep carrier location current without opening Carrier Management; `Undocked` is watched but unhandled so `_current_station` never clears (trade log entries after undock attribute to the old station); `FSDTarget` carries next-jump star class + `RemainingJumpsInRoute` (route overlay could warn on non-scoopable stars); `NavRoute` journal event includes per-hop `StarClass` that `_handle_nav_route` currently throws away; `Missions`/`StoredShips`/`HullDamage`/`ShieldState` and the Status.json `Flags` bitmask are all available but unused (feature freeze).
- **Optimization suggestions from this session's code review, not yet implemented**: `get_market_stats()` still full-scans every 15s from Trading.jsx polling; per-call `asyncio.run` + fresh API clients means the rate limiter never actually limits across calls; watchlist is re-read from DB on every `ShipTargeted`; `_emit("journal", ...)` pushes every event to the frontend; WAL mode not enabled; `commodity_markets()` still uses the broken `"sort": "distance"` string form.

## Known issues / notes for next session

- Updater does not verify downloaded exe (no checksum).
- CMDR ping `hide_after(8s)`: second ping within 8s may hide early.
- `data/guardian_sites.json` has 136 sites — fetch full Canonn dataset when `api.canonn.tech` recovers.
- pygame not installable on Python 3.14 — audio disabled in dev and local builds; CI builds use 3.12.
- Inara integration wired but blocked pending app registration.
- `APP_VERSION` still `0.3.34`, **not tagged or released** — local install has Session 30 fixes baked in; bump to 0.3.35 + tag when releasing through CI.

---
*Session 30 complete — 2026-07-01*

---
*Session checkpoint: 2026-07-01 20:13:18*

---
*Session checkpoint: 2026-07-01 20:16:26*

---
*Session checkpoint: 2026-07-01 20:17:24*

---
*Session checkpoint: 2026-07-01 20:38:09*

---

## Session 30 addendum — v0.3.35 release + updater finding

- v0.3.35 tagged, CI built and released: https://github.com/keaganbmackinnon-coder/EDTC/releases/tag/v0.3.35
- Local install updated to v0.3.35 via the in-app updater — download and exe swap worked.
- **NEW BUG — updater relaunch step silently fails**: `edtc_update.bat` copied the new exe fine (`%TEMP%\edtc_copy.log` shows success) but the `Unblock-File` + `Start-Process` relaunch never started the app; it had to be launched manually. The bat logs copy output but nothing from the relaunch step, so there is no error trail. Fix next session: redirect the PowerShell relaunch commands' output to the log too (e.g. `>> "%TEMP%\edtc_copy.log" 2>&1`), and consider `Start-Process -WorkingDirectory` or falling back to `explorer.exe "<exe>"` if Start-Process fails.

---
*Session 30 addendum — 2026-07-01*

---
*Session checkpoint: 2026-07-01 20:44:28*

---
*Session checkpoint: 2026-07-01 20:58:26*

---

## Build status — Session 31 (COMPLETE)

Focus: knock out the four longstanding known-issue items (updater checksum,
CMDR ping timer, Guardian dataset, Inara) while user play-tested colonisation.

| Item | Status | File |
|---|---|---|
| **CMDR ping timer-cancel** — already fixed: `hide_after()` cancels the pending timer before scheduling a new one; the known-issue note had been stale for many sessions | VERIFIED, no change | `core/overlay.py` |
| **Updater checksum** — GitHub's release API exposes a per-asset `digest` (sha256); `_do_update()` now reads it during the pre-download re-fetch and verifies the downloaded bytes with `hashlib.sha256` before writing; aborts with a clear error on mismatch; skips (with log warning) if digest unavailable | DONE | `main.py` |
| **Updater relaunch fix** (Session 30 addendum carryover) — every bat step now appends to `%TEMP%\edtc_copy.log` (was: only the copy); `Start-Process` gets `-WorkingDirectory`; on failure falls back to `explorer.exe "<exe>"` | DONE | `main.py` |
| **Guardian dataset** — replaced 136-site stub with the complete SrvSurvey catalogue: **447 ruin entries (566 individual sites grouped by system+body+type) + 163 structures = 610 entries**, all with real lat/lon coordinates and distance-to-arrival notes | DONE | `data/guardian_sites.json` |
| **Inara** — retested with saved key: still `400 "This application has no access allowed"` (external blocker, needs app registration with Inara). Header-level errors now raised from `InaraAPI.commodity_markets()` and surfaced by `test_inara_key()` so the UI says "EDTC is not registered with Inara" instead of blaming the key | DONE (surfacing only) | `api/inara.py`, `main.py` |
| `APP_VERSION` bumped to `0.3.36` | DONE | `main.py` |

## Key notes from Session 31

- **Canonn API is permanently dead at `api.canonn.tech`** (DNS/connect timeout; `canonn.tech` itself is down). `canonn.science` and their Google Cloud Functions API (`us-central1-canonn-api-236217.cloudfunctions.net/query/...`) are alive, but the cloud API only has Guardian *component* codex entries (pylons/terminals), not site catalogues. The real complete site catalogue lives in **SrvSurvey's repo**: `SrvSurvey/allRuins.json` (566 ruins) + `SrvSurvey/allStructures.json` (163 structures) at github.com/njthomson/SrvSurvey — fields: systemName, bodyName, siteType, idx, lat/lon, siteHeading, relicTowerHeading, starPos, distanceToArrival. Stop waiting for api.canonn.tech to recover — remove that from known issues.
- **Guardian ID scheme preserved**: ids are `slug(system)_slug(body)`, with `_<type>` suffix only when needed for uniqueness (multiple ruin types on one body — 156 bodies have 2–3 types; or a body hosting both ruins and a structure — 23 such bodies). 103/137 old ids survive; the 34 dropped ones were bodies that now split per-type. `guardian_visits` DB table was empty, so nothing orphaned.
- **GitHub asset digest**: every release asset in `/releases` API responses has `"digest": "sha256:..."` — no CI changes needed for update verification. Verified present on v0.3.35 and earlier assets.
- **Inara registration**: the only path forward is asking Inara to whitelist "EDTC" as an app (via their forum/Discord dev contact). Code is fully wired and will start working the moment access is granted.

## Known issues / notes for next session

- ~~Updater does not verify downloaded exe~~ — fixed this session (sha256 digest check).
- ~~CMDR ping hide_after timer~~ — was already fixed; note removed.
- ~~guardian_sites.json incomplete / waiting on Canonn API~~ — full SrvSurvey catalogue imported (610 entries); api.canonn.tech is dead for good, use SrvSurvey repo for refreshes.
- Inara integration wired but blocked pending app registration with Inara (external).
- pygame not installable on Python 3.14 — audio disabled in dev; CI builds use 3.12.
- `commodity_markets()` in `api/spansh.py` still uses the broken `"sort": "distance"` string form (Spansh results not truly nearest-first) — fix to the array form used by `stations_near()`.
- Perf backlog from Session 30 review: WAL mode, `get_market_stats()` full-scan every 15s, rate limiter never limits across calls (per-call `asyncio.run` + fresh clients), watchlist re-read on every `ShipTargeted`.
- Untapped journal data (Session 30 findings): `CarrierLocation`, `Undocked` (stale `_current_station` mis-attributes trade log), `FSDTarget` star class, `NavRoute` per-hop `StarClass`.
- v0.3.36 updater relaunch fix note: the *running* v0.3.35 exe still has the old relaunch code, so the update TO v0.3.36 may still need a manual relaunch — updates FROM v0.3.36 onward relaunch automatically (same bootstrapping pattern as Session 21).

---
*Session 31 complete — 2026-07-01*

---
*Session checkpoint: 2026-07-01 21:31:22*

---
*Session checkpoint: 2026-07-01 21:32:24*

---
*Session checkpoint: 2026-07-02 18:09:41*

---

## Build status — Session 32 (COMPLETE)

Focus: hotfix — Guardian page crash from Session 31's dataset import.

| Item | Status | File |
|---|---|---|
| **Guardian page crash fixed**: 32 entries in the Session 31 SrvSurvey import had `"lat": "NaN"` / `"lon": "NaN"` as *strings*; `site.coordinates.lat?.toFixed(4)` in SiteCard threw `TypeError` (optional chaining doesn't guard non-null non-numbers), crashing SitesTab → ErrorBoundary took down the whole page | DONE | `data/guardian_sites.json` |
| Data fix: those 32 entries now have `coordinates: null` (coords genuinely unknown in SrvSurvey source) | DONE | `data/guardian_sites.json` |
| Render guard hardened: coords line only renders when `Number.isFinite(lat) && Number.isFinite(lon)` — bad data can no longer crash the page | DONE | `frontend/src/pages/Guardian.jsx` |
| `APP_VERSION` bumped to `0.3.37`; local build swapped in and verified running | DONE | `main.py` |

## Key notes from Session 32

- **Lesson for future data imports**: SrvSurvey's allRuins.json uses `NaN` for unsurveyed lat/lon; a str() conversion during Session 31's import turned those into the JSON string `"NaN"`. When importing external datasets, validate that numeric fields are actually numeric (`isinstance(x, (int, float))`) before writing.
- PyInstaller must be run from the project venv: `.venv\Scripts\pyinstaller.exe` (not on the system Python 3.14 path).

---
*Session 32 complete — 2026-07-02*

---
*Session checkpoint: 2026-07-02 18:19:49*

---
*Session checkpoint: 2026-07-02 18:20:31*

---

## Session 32 continued — Spansh market filter + Undocked handler (v0.3.38)

| Item | Status | File |
|---|---|---|
| **Spansh `commodity_markets()` was broken worse than known**: not only was `"sort": "distance"` ignored, the top-level `"market"` filter was ALSO silently ignored — verified by comparing counts for a real commodity, a rare, and a fake name (all identical, 10000). Spansh-sourced Commodity Search results have been unfiltered nearest-station lists all along | DONE | `api/spansh.py` |
| Fix: filter must be nested as `"filters": {"market": [{"name": commodity}]}` and sort as `[{"distance": {"direction": "asc"}}]`. Verified live: fake commodity → count 0; Tritium from Sol → 100 filtered, distance-ascending results with per-station `market` entries (`buy_price`/`sell_price`/`supply`/`demand` keys match main.py's consumer) | DONE | `api/spansh.py` |
| `Undocked` handler added — clears `_current_station` so trade log entries after undocking no longer attribute to the previous station | DONE | `main.py` |
| `APP_VERSION` bumped to `0.3.38`; local build swapped in and verified running | DONE | `main.py` |

## Notes

- **Spansh `/stations/search` lesson**: unknown top-level keys are silently ignored (no 400) — every filter/sort must be verified by comparing result counts against a known-negative (fake name) probe. `stations_near()`'s docstring note about the ignored `services` filter is the same failure mode.

---
*Session 32 continued — 2026-07-02*

---
*Session checkpoint: 2026-07-02 18:28:00*

---

## Session 32 continued — Exploration/Navigation audit for the Nomad (v0.3.39)

Focus: user got the new **Nomad** ship (journal internal name `explorer_nx`, 80.1 ly
max jump range) and wants Exploration + Navigation working perfectly. Live-tested
every backend path those pages use.

| Item | Status | File |
|---|---|---|
| **EDSM bodies endpoint 404**: `get_bodies()` called `/api-system-v0/bodies` which never existed — System Lookup's body list has been broken since Session 7. Fixed to `/api-system-v1/bodies` (verified live: 200, 40 bodies for Sol, field names match existing parser) | DONE | `api/edsm.py` |
| **EDSM traffic endpoint 404**: same v0→v1 bug in `get_traffic()` — Galaxy Traffic tab was broken too | DONE | `api/edsm.py` |
| **Road to Riches 400**: `/riches/route` requires form POST with `from/range/radius/max_results` — the old GET with `max_systems`/`buffer` params always 400'd (endpoint helpfully returns the required-params error). Rewritten as form POST with `radius`, `min_value=300000`, `use_mapping_value=true`; destination now optional (blank = loop near origin) | DONE | `api/spansh.py` |
| **R2R frontend field mismatch**: response bodies use snake_case (`estimated_mapping_value`, `subtype`, `distance_to_arrival`, `is_terraformable`) but the tab read camelCase (`valueMapped`, `subType`, `distanceToArrival`) — values would have shown 0 even if the endpoint had worked. Fixed all reads; added jumps count + Terraformable badge; destination input now optional | DONE | `frontend/src/pages/Exploration.jsx` |
| **Ship display names**: journal `Ship_Localised` is missing/empty for new ships — the Nomad showed as raw `explorer_nx`. Added `_SHIP_DISPLAY_NAMES` map (all ~45 standard ships incl. explorer_nx→Nomad, panthermkii→Panther Clipper Mk II) + `_ship_display_name()` helper used by `_handle_loadout` and `_handle_load_game` | DONE | `main.py` |
| Verified working live, no changes needed: EDSM `get_system`, Spansh `neutron_route` (91 waypoints Sol→Colonia), Spansh `exobiology_route` (field names match ExoPlanner tab), Session Scanner pipeline, jump-range autofill (reads Loadout fields all present for the Nomad) | VERIFIED | — |
| `APP_VERSION` bumped to `0.3.39`; local build swapped in and verified running | DONE | `main.py` |

## Notes

- **Nomad Loadout facts**: `Ship=explorer_nx`, `Ship_Localised` absent, `MaxJumpRange=80.11`, `UnladenMass=1403.6`, `FuelCapacity.Main=128`, `CargoCapacity=64`. All fields `get_ship_info()` needs are present.
- **EDSM system endpoints**: `api-system-v1` is the real prefix for bodies/traffic (v0 404s). `factions` was already on v1. This is the 5th dead-EDSM-endpoint fix across sessions — always verify EDSM paths live before trusting them.
- **Spansh riches API**: rejects GET; returns `{"error":"from, range, radius and max_results are required"}` on 400, which documents its own required params. Result = list of `{name, jumps, bodies[]}`, bodies in snake_case.

---
*Session 32 continued (Nomad audit) — 2026-07-02*

---
*Session checkpoint: 2026-07-02 19:23:38*

---

## Session 32 continued — Exo Planner filters (v0.3.40)

| Item | Status | File |
|---|---|---|
| Exo Planner: bio-type filter chips (multi-toggle by genus, from `landmark.type`) — filters landmarks, recomputes body/system/total values from visible landmarks only, hides emptied bodies/systems | DONE | `frontend/src/pages/Exploration.jsx` |
| Exo Planner + Road to Riches: sort chips (Route Order / Highest Value); row number stays the route index when value-sorted | DONE | `frontend/src/pages/Exploration.jsx` |
| `APP_VERSION` bumped to `0.3.40`; local build swapped in | DONE | `main.py` |

## Notes

- **`landmark_value` semantics verified live**: equals `sum(landmark.value)` — `count` does NOT multiply (one payout per species per body). Filtered totals recompute with the same rule.
- **Landmark `type` field is the genus** (e.g. "Cactoida") — no need to parse `subtype`.
- **No discovery/footfall data in Spansh exo route** (checked all keys: system `{bodies,id64,jumps,name,x,y,z}`, body adds nothing discovery-related). All planner results are by definition already FSS-scanned by someone (data comes from EDDN uploads); the 5× first-logged exobiology bonus and first-footfall status are not available from any public API.

---
*Session 32 continued (exo filters) — 2026-07-02*

---
*Session checkpoint: 2026-07-02 19:33:35*

---

## Session 32 continued — Galaxy Map scan-coverage heatmap (v0.3.41)

Goal: show which sectors players have recently scanned so the user knows where
NOT to go for first discoveries. This is the "heatmap future work" stub from
Session 28, now real.

| Item | Status | File |
|---|---|---|
| `galaxy_coverage` table (layer, gx, gz, count) + `coverage_cell()`, `replace_coverage_layer()`, `bump_coverage_cells()`, `get_coverage_layer()`; `COVERAGE_CELL_LY = 300` | DONE | `core/database.py` |
| **Week layer**: `_refresh_week_coverage()` downloads EDSM `systemsWithCoordinates7days.json.gz` (~5 MB, nightly refresh upstream), bins into grid; runs on startup at most once per 20h (pref `coverage_week_refreshed`). Verified live: 138,081 systems → 12,357 cells in ~1s | DONE | `main.py` |
| **Live layer**: EDDN journal-schema messages (every networked player's FSDJump/Scan/etc, ~17 msg/s measured) binned via `StarPos`, buffered in-memory, flushed to DB every 15s. The ZMQ listener already received all schemas — journal was just being dropped | DONE | `main.py` |
| `get_galaxy_coverage(layer)` API — returns sparse `[[gx,gz,count],...]` + cell size; flushes live buffer on read | DONE | `main.py` |
| Galaxy Map top-down view: "Scan activity" toggle (Off / Last 7 Days / Live EDDN), red log-scale heat cells, legend with report/sector counts; live polls every 60s | DONE | `frontend/src/pages/Galaxy.jsx` |
| `APP_VERSION` bumped to `0.3.41`; local install confirmed rebuilding week layer on launch | DONE | `main.py` |

## Notes / data source facts

- **EDSM 7-day dump**: `https://www.edsm.net/dump/systemsWithCoordinates7days.json.gz` — 5 MB, one JSON object per line inside an array, `{name, coords:{x,y,z}, date}`. Full historical dump is 3.6 GB (`systemsWithCoordinates.json.gz`) — NOT downloaded; would enable an "all known systems ever" base layer via one-time preprocess (offer as scripts/build_density.py if wanted).
- **Spansh galaxy dumps** are 1.5 GB (1-day) / 3 GB (7-day) — rejected in favour of EDSM's 5 MB.
- Coverage grid coords: `gx = floor(x/300)`, `gz = floor(z/300)` — signed, sparse; canvas mapping reuses `gxToCanvas()`.
- Honest framing shown in UI: red = recently visited/scanned by players (EDSM submissions + EDDN traffic). It cannot show all-time discovery status without the 3.6 GB preprocess.

---
*Session 32 continued (coverage heatmap) — 2026-07-02*

---
*Session checkpoint: 2026-07-02 19:57:01*

---
*Session checkpoint: 2026-07-02 20:08:16*

---
*Session checkpoint: 2026-07-02 20:09:17*

---
*Session checkpoint: 2026-07-02 20:10:48*

---
*Session checkpoint: 2026-07-02 20:13:16*

---

## Build status — Session 32 final — Galaxy Map overhaul + all-time layer (v0.3.42)

| Item | Status | File |
|---|---|---|
| Edge-On view removed (user request) — `drawEdgeOn`, projection toggle, edge canvas all deleted | DONE | `frontend/src/pages/Galaxy.jsx` |
| Yellow spiral-arm arcs removed from the top-down map (user request) | DONE | `frontend/src/pages/Galaxy.jsx` |
| **Sector detail maps**: click a region name on the galaxy map (nearest-centroid hit test, 40px) or pick from the "Open sector map…" dropdown → zoomed view of the FULL region | DONE | `frontend/src/pages/Galaxy.jsx` |
| Region bounding boxes computed from klightspeed/EliteDangerousRegionMap boundary grid (2048² cells of 4096/83 ly, origin x0=-49985 z0=-24105; RLE rows) — all 42 regions now carry minX/maxX/minZ/maxZ; viewport fits bbox × 1.08 | DONE | `frontend/src/pages/Galaxy.jsx` |
| Sector view renders: adaptive grid (2,000 or 5,000 ly), region borders (converted from main-map px space), neighbour labels, key locations, coverage heat at native 300 ly, cyan YOU marker via new `get_current_position()` API | DONE | `frontend/src/pages/Galaxy.jsx`, `main.py` |
| **All-time discovery layer**: `scripts/build_density.py` streams/parses EDSM `systemsWithCoordinates.json.gz` (3.6 GB, 96,865,046 systems) → `data/galaxy_density_alltime.json.gz` (274 KB, 56,668 cells); bundled with the exe; imported into `alltime` layer at startup (guarded by `coverage_alltime_imported` pref = snapshot date) | DONE | `scripts/build_density.py`, `data/galaxy_density_alltime.json.gz`, `main.py` |
| "All Time" added to the Scan-activity toggle (Off / All Time / Last 7 Days / Live) | DONE | `frontend/src/pages/Galaxy.jsx` |
| `get_galaxy_coverage(layer, bounds)` — optional `[minGx,maxGx,minGz,maxGz]` viewport filter; auto-aggregates 4× when unbounded results exceed 150k cells (payload guard) | DONE | `main.py`, `core/database.py` |
| `APP_VERSION` = `0.3.42`; local install verified: alltime import + sector maps working | DONE | `main.py` |

## Key notes from Session 32 final

- **EDSM full dump reality check**: 96.9M systems (not the 150M guessed), downloads in ~8 min, parses locally in ~4.5 min (regex per line, no json.loads). Cell count saturates fast — 56k cells by 25M systems, only +400 more cells over the remaining 72M systems. Refresh cadence: months is fine; re-run `scripts/build_density.py` and rebuild.
- **Region bbox source**: `RegionMapData.json` in klightspeed/EliteDangerousRegionMap. Row format is plain RLE `[[run, region_id], ...]` per z-row (no x-offset prefix — RegionMap.py's `findRegion` is the reference decoder). Region ids index the `regions` list; id 0 = outside.
- **Region size spread**: Galactic Centre 6.7k ly → Tenebrae 36.8k ly; the earlier fixed 14k ly sector viewport (first iteration this session) cropped most regions — that's why bboxes were needed.
- Background-task lesson: the 10-min Bash timeout kills long streams; download-to-file with `curl -C -` (resumable) then parse locally beats streaming for multi-GB jobs.

## Known issues / notes for next session

- Sector maps show coverage + landmarks; possible future additions: clickable systems (needs a per-system query source at sector zoom), route overlay, Guardian sites from data/guardian_sites.json (have coordinates only per-body lat/lon, but system coords could come from system_coords/EDSM).
- The `live` EDDN layer accumulates indefinitely in the DB — consider pruning by age (add `last_seen` column) if it ever gets heavy; current volume (~17 msg/s → few thousand cells/day) is harmless.
- Perf backlog from Session 30 review still open: WAL mode, `get_market_stats()` 15s polling full-scan, rate limiter never limits across calls, watchlist re-read per ShipTargeted.
- Untapped journal data (Session 30): `CarrierLocation`, `FSDTarget` star class, `NavRoute` per-hop `StarClass`.
- Inara integration wired but blocked pending app registration (external).
- pygame not installable on Python 3.14 — audio disabled in dev/local builds; CI uses 3.12.

---
*Session 32 complete — 2026-07-02*

---
*Session checkpoint: 2026-07-02 20:30:55*

---
*Session checkpoint: 2026-07-03 09:55:14*

---

## Build status — Session 33 (COMPLETE)

Focus: Y-height band slicer for sector maps, perf backlog, journal wiring
(CarrierLocation / FSDTarget / NavRoute StarClass), ship data fixes.

| Item | Status | File |
|---|---|---|
| Note: v0.3.42 was already released by CI overnight — the Session 32 "not tagged" note was stale | — | — |
| **Height band slicer**: `galaxy_coverage` gained a `gy` column (400-ly Y bands, `COVERAGE_Y_BAND_LY`); PK now (layer,gx,gy,gz); one-time migration drops the old 2D table + clears refresh prefs so all layers rebuild | DONE | `core/database.py` |
| `coverage_cell(x, y, z)`; `get_coverage_layer(layer, bounds, y_band)` aggregates over Y in SQL when y_band is None (main map payload shape unchanged); `get_coverage_y_bands()` lists bands with data for a viewport | DONE | `core/database.py` |
| EDDN live binning + week refresh + alltime import all Y-aware; legacy 3-element snapshots import into band 0 | DONE | `main.py` |
| `scripts/build_density.py` re-run on fresh EDSM full dump (96.9M systems): 409,051 3D cells, 1.9 MB bundled snapshot | DONE | `data/galaxy_density_alltime.json.gz` |
| Sector map UI: Height ▲/▼ cycle + All button next to sector name; cycles only bands that hold data in the viewport; band label like "−400 to 0 ly"; footer shows active slice | DONE | `frontend/src/pages/Galaxy.jsx` |
| **WAL mode** + 5s busy_timeout — fixes the `database is locked` storm when migration/EDDN/week-refresh collide | DONE | `core/database.py` |
| **Rate limiter fixed**: state now class-level keyed by API class name — per-call `asyncio.run` + fresh client instances meant it NEVER limited before; verified 3 calls now take ≥1.0s at 0.5s interval | DONE | `api/base.py` |
| Watchlist cached in memory (invalidated on add/remove) — was a DB read per ShipTargeted | DONE | `main.py` |
| `get_market_stats()` cached 30s — was a full markets-table scan per 15s poll | DONE | `main.py` |
| **CarrierLocation** handled — carrier location stays current without opening Carrier Management | DONE | `main.py`, `core/journal.py` |
| **FSDTarget** handled — emits `fsd_target` (star class, scoopable, remaining jumps) to route overlay + main window | DONE | `main.py`, `core/journal.py` |
| NavRoute per-hop `StarClass` kept (`route.star_classes`, in-memory; not persisted by save_route) | DONE | `main.py` |
| Route overlay: "Class M · NOT SCOOPABLE — check fuel" warning under Next jump (amber); live FSDTarget beats plotted-route class | DONE | `frontend/src/overlays/Route.jsx` |
| **Ship name fix**: `explorer_nx` = **Caspian Explorer** (Session 32 called it Nomad — wrong; the Nomad is the fighter `smallcombat01_nx`, now mapped too) | DONE | `main.py` |
| **Jump range fix**: baseline mass = unladen + reserve capacity + max-fuel-per-jump (what Loadout's MaxJumpRange actually assumes) and current mass includes live reservoir fuel. Was 74.39 vs game 74.65; now computes 74.65 exactly | DONE | `main.py` |
| `_FSD_MAX_FUEL` table (standard by size/class) + `_FSD_MAX_FUEL_SCO` + `_FSD_MAX_FUEL_OVERRIDES`; Deep Charge engineering modifier honored | DONE | `main.py` |
| `APP_VERSION` bumped to `0.3.43`; local install swapped and verified | DONE | `main.py` |

## Key notes from Session 33

- **Ship naming lesson**: `explorer_nx` is the Caspian Explorer; `smallcombat01_nx` is the Nomad (fighter). User misspoke in Session 32 and the wrong name shipped — when a new ship appears, check `Ship_Localised` absence and confirm the name with the user before hardcoding.
- **Jump range formula (final)**: `current = (MaxJumpRange − guardian_bonus) × (unladen + reserve_cap + max_fuel_per_jump) / (unladen + FuelMain + FuelReservoir + cargo) + guardian_bonus`. Frontier's Loadout doc: MaxJumpRange assumes zero cargo + just enough fuel for one jump.
- **Caspian's FSD** (`int_hyperdrive_overcharge_size8_class5_overchargebooster_mkii`) has no published max-fuel stat — the 5.5 T override was fitted against the live in-game readout (74.65). Panther's size-7 SCO observed burning up to 12.86 T/jump, consistent with the 13.1 table value.
- **Height bands**: 400 ly per band. Alltime gy spans −74..+98 but the disc's mass is in gy −1/0 (Sol at y≈−21). The band cycle UI only offers bands with data in the current viewport.
- **Live EDDN layer note**: pre-existing 2D live data was dropped by the migration (rebuilds from live traffic; week/alltime rebuild from their sources automatically).
- **Do not swap the exe while the user is playing** without warning: the mid-session swap ran an old build without busy_timeout during the gy migration → `database is locked` storm → ship card broke until the next swap. Announce, swap fast, verify the log.

## Known issues / notes for next session

- Sector maps: possible future additions — clickable systems, route overlay on map.
- `commodity_markets()` sort was fixed in Session 32; remaining Spansh caveat: `stations_near()` services filter is client-side.
- Inara integration wired but blocked pending app registration (external).
- pygame not installable on Python 3.14 — audio disabled in dev/local builds; CI uses 3.12.
- If jump range drifts on other ships, their FSD may need a `_FSD_MAX_FUEL` entry (esp. new SCO Mk II variants) — ask user for the two readouts and fit.

---
*Session 33 complete — 2026-07-03*

---
*Session checkpoint: 2026-07-03 10:41:13*

---
*Session checkpoint: 2026-07-03 11:25:42*

---
*Session checkpoint: 2026-07-03 11:29:35*

---
*Session checkpoint: 2026-07-03 11:34:18*

---
*Session checkpoint: 2026-07-03 11:39:12*

---
*Session checkpoint: 2026-07-03 11:57:29*

---

## Session 33 continued — Colonisation overhaul (unreleased, local)

Also: sector-map height cycle now enters at the densest band (was: topmost band
with any data, which is usually a single lone-explorer system).

| Item | Status | File |
|---|---|---|
| **Depot-import bug root cause**: `construction_depot` events only reached React if the Colonisation page was mounted at dock time; the Session-30 dedup then suppressed identical re-fires, and nothing was persisted — dock on another page = data gone forever. Confirmed against 12:00 journal/log evidence | FIXED | — |
| `depots` table (PK market_id) + `upsert_depot` (keeps system/station when caller has none), `get_depots` (newest first), `delete_depot` | DONE | `core/database.py` |
| `depot_deliveries` table + `add_depot_delivery`, `get_depot_rate(market_id, hours=6)` (t/h from own ColonisationContribution history, needs ≥2 deliveries) | DONE | `core/database.py` |
| `_handle_construction_depot` upserts to DB and emits the full depot dict (market_id, station, updated, remaining) | DONE | `main.py` |
| `ColonisationConstructionDepot` added to STARTUP_EVENTS — depot recovers from journal replay on launch (verified: recovered Chun Command Facility, 22 commodities, 5,684T) | DONE | `core/journal.py` |
| **Location handler now sets `_current_station`** from StationName when docked — depot/trade events after a game relog were seeing an empty station | DONE | `main.py` |
| API: `get_construction_depots()` (with remaining/rate_per_hour/eta_hours), `delete_construction_depot(market_id)` | DONE | `main.py` |
| Depot View tab → list of all known sites: collapsible cards (newest expanded), progress, updated-ago, remaining T, trips estimate, your pace + ETA, per-depot Import/Sync/Remove, commodities sorted incomplete-first | DONE | `frontend/src/pages/Colonisation.jsx` |
| Banner now driven from the persisted depots list — shows on live dock AND on page open if a site was updated <15 min ago; dismissal tracked per market_id | DONE | `frontend/src/pages/Colonisation.jsx` |
| Haul Planner on Shopping List: total T remaining, trips in current ship (live cargo capacity via get_ship_info/ship_changed), greedy next-load suggestion | DONE | `frontend/src/pages/Colonisation.jsx` |
| Shopping List: "After FC Stock" column + total (shown when FC cargo exists) | DONE | `frontend/src/pages/Colonisation.jsx` |
| Market Finder auto-fills current system on mount | DONE | `frontend/src/pages/Colonisation.jsx` |

## Notes

- Depot resources stored as raw journal `ResourcesRequired` JSON (Name/Name_Localised/RequiredAmount/ProvidedAmount) so existing name helpers keep working.
- `sync_construction_depot` still matches projects by **system** — two depots in one system would cross-sync a project. Known limitation; link projects to market_id if it bites.
- Delivery rate counts only YOUR contributions; depot `ProvidedAmount` (all players) still syncs totals. ETA = remaining/your-rate, so it's pessimistic on group builds.
- **Local build is 0.3.43 + unreleased changes** (densest-band entry + colonisation overhaul). Bump to 0.3.44 and tag when play-tested.

---
*Session 33 continued — 2026-07-03*

---
*Session checkpoint: 2026-07-03 12:24:59*

---
*Session checkpoint: 2026-07-03 12:32:54*

---
*Session checkpoint: 2026-07-03 12:33:50*

---
*Session checkpoint: 2026-07-03 12:34:23*

---
*Session checkpoint: 2026-07-03 12:38:40*

---
*Session checkpoint: 2026-07-03 12:44:16*

---
*Session checkpoint: 2026-07-03 12:44:36*

---

## Session 33 final — Overlay fixes: resize, transparency, cargo bar, trips (v0.3.44)

| Item | Status | File |
|---|---|---|
| **Overlay dynamic sizing root cause**: overlay windows are created without `js_api`, so `window.pywebview.api` is an EMPTY object in them — the overlay's own `resize_overlay()` calls have been silent no-ops all along (also explains Session 29's "method not attached" crash). Data displays only because the backend pushes via `evaluate_js` | FIXED | `core/overlay.py` |
| `OverlayManager.resize_to_content(name)` — backend measures `#overlay-panel` height via `evaluate_js` (0.4s after push) and calls `win.resize()`; auto-runs on every `emit_to_overlay` for `construction`; every resize logged. Verified live: 460×715 → 460×732 | DONE | `core/overlay.py`, `frontend/src/overlays/Construction.jsx` |
| **Opacity slider now does real transparency**: `_apply_opacity` sets whole-window alpha via Win32 layered-window API (`WS_EX_LAYERED` + `SetLayeredWindowAttributes`, hwnd via `FindWindowW` on the unique overlay title). CSS-opacity fallback kept for non-Windows. Per-pixel transparency remains off the table (WebView2). User confirmed slider works | DONE | `core/overlay.py` |
| **Cargo yellow-bar bug**: journal `Cargo` events only include `Inventory` at login; mid-session events omit it — the handler read the missing key as `[]` and ZEROED the overlay's cargo on every pickup/delivery ("Cargo event: 0 items" spam). Now falls back to reading Cargo.json (0.3s delayed for the write race) | FIXED | `main.py` |
| Trips-in-current-ship line on construction overlay: "5,684T remaining · ~89 trips · 64T hold" under the main bar; `ship_info` pushed to overlay on Loadout + overlay open (hold size updates on ship swap) | DONE | `main.py`, `frontend/src/overlays/Construction.jsx` |
| `APP_VERSION` bumped to `0.3.44`, released via CI | DONE | `main.py` |

## Key lessons from Session 33 final

- **Overlay windows have NO working API bridge** (`js_api` not passed at creation). Anything an overlay needs must be PUSHED from Python via `emit_to_overlay`/`evaluate_js`; any `api()?.x()` call in overlay JSX is dead code. The optional-chaining that "fixed" Session 29's crash was masking this.
- **Journal `Cargo` event**: `Inventory` only present in the login event; all later Cargo events require reading Cargo.json. Same family of trap as `Vessel` vs `Vehicle` (Session 30).
- Win32 layered-window alpha (`LWA_ALPHA`) works fine on frameless pywebview windows and applies to the whole subtree incl. WebView2 child HWNDs (Win8+).

## Known issues / notes for next session

- ~~User still to confirm in-game: yellow cargo bar filling on pickup + auto-draining on delivery~~ — confirmed working in-game 2026-07-03.
- `sync_construction_depot` matches projects by system — two depots in one system would cross-sync (link projects to market_id if it bites).
- ~~Route overlay's `copy_next_destination` button + `Route.jsx`'s `get_active_route()` on mount rely on the dead overlay bridge~~ — fixed in Session 34 (overlay bridge audit).
- Perf backlog: `_emit("journal", ...)` still pushes every journal event to the frontend.
- Inara blocked pending app registration (external).

---
*Session 33 final — 2026-07-03*

---
*Session checkpoint: 2026-07-03 12:59:20*

---
*Session checkpoint: 2026-07-03 15:46:26*

---
*Session checkpoint: 2026-07-03 16:04:29*

---

## Build status — Session 34 — Overlay bridge audit (released as v0.3.45)

Focus: audit ALL overlay components for dead `api()` bridge calls (Session 33
carryover) and convert to backend pushes. Yellow cargo bar confirmed working
in-game by user before starting.

| Item | Status | File |
|---|---|---|
| Audit result: only `Route.jsx`, `Construction.jsx`, and App.jsx's overlay ErrorBoundary had bridge calls; CmdrPing/FssValues/SystemPreview/ExoTracker are pure push-listeners (clean) | — | — |
| `_push_route_to_overlay()` — delayed (2.5s) push of active route + cached last `fsd_target`, mirrors `_push_cargo_to_overlay` | DONE | `main.py` |
| Wired into `show_overlay`/`toggle_overlay` for `route` (same pattern as construction) | DONE | `main.py` |
| `set_active_route`/`_handle_nav_route`: emits right after `show()` were silently dropped when the window was still being created (threaded, 1.5s) — the delayed push now covers the fresh-window case; immediate emit kept for already-open windows | DONE | `main.py` |
| `_last_fsd_target` cached in `_handle_fsd_target`, cleared on NavRoute/NavRouteClear — scoopable warning survives opening the overlay mid-route | DONE | `main.py` |
| `Route.jsx`: dead `get_active_route()` mount fetch removed; dead Copy button replaced with "Ctrl+Shift+C copies next" hint (global hotkey works even with game focus — clicking the overlay would steal focus anyway) | DONE | `frontend/src/overlays/Route.jsx` |
| `Construction.jsx`: dead `loadInitial` (get_construction_projects/get_ship_cargo) + dead ResizeObserver `resize_overlay` path removed — backend pushes + `resize_to_content` already do both; `id="overlay-panel"` kept (backend measures it) | DONE | `frontend/src/overlays/Construction.jsx` |
| App.jsx overlay ErrorBoundary: dead `log_frontend_error`/`resize_overlay` calls skipped in overlay windows; error div gets `id="overlay-panel"` in overlay mode so `resize_to_content` can still measure it | DONE | `frontend/src/App.jsx` |
| Local build swapped + verified via log: cargo push (2 items), project push, resize 460×625 all working on the new build | DONE | — |

## Session 34 continued — Route overlay wide-strip redesign (v0.3.45)

| Item | Status | File |
|---|---|---|
| Route overlay redesigned as a wide horizontal strip (user request: "longer than it is tall") — single row: `ROUTE 12/91 · Current → Next · CLASS/scoopable · N jumps left · hotkey hint`, progress bar underneath | DONE | `frontend/src/overlays/Route.jsx` |
| Route window 360×170 → 680×92 | DONE | `core/overlay.py` |
| Route overlay added to the `resize_to_content` auto-fit path (alongside construction); both route panel states carry `id="overlay-panel"` | DONE | `core/overlay.py`, `frontend/src/overlays/Route.jsx` |
| User play-tested the bridge-audit fix in-game: route overlay populates on open ("it works") | VERIFIED | — |
| `APP_VERSION` bumped to `0.3.45`, tagged for CI release | DONE | `main.py` |

## Notes

- `resize_overlay(name, w, h)` API method in main.py is now unused by the frontend (kept — harmless, callable from main window).
- Local install runs the 0.3.44-labelled build containing all Session 34 changes; it will offer the identical v0.3.45 CI build via the in-app updater once CI finishes.
- Wide-strip layout swapped in right before session end — visual check in-game still pending (data pipeline verified).

---
*Session 34 complete — 2026-07-03*

---
*Session checkpoint: 2026-07-03 16:19:07*

---
*Session checkpoint: 2026-07-03 16:43:52*

---
*Session checkpoint: 2026-07-03 16:44:44*

---
*Session checkpoint: 2026-07-03 17:50:30*

---
*Session checkpoint: 2026-07-03 18:48:25*

---

## Build status — Session 35 — Station-market highlight + overlay discipline (v0.3.46)

| Item | Status | File |
|---|---|---|
| **Buyable-here = blue letters** (user request: "simple, so I know what I'm picking up"): on Docked, backend pushes `station_market_update`; commodity names buyable at the docked station render blue (text-blue-400) in the **construction overlay**, **Depot View cards**, and **Shopping List** (which also gets a Sold Here stock@price column + "Docked at X" banner); clears on Undocked. First iteration was green rows on Shopping List only — user was looking at the overlay/Depot View and saw nothing | DONE | `main.py`, `frontend/src/pages/Colonisation.jsx`, `frontend/src/overlays/Construction.jsx` |
| Data source order: Market.json wins when its StationName matches the current station (live, refreshed on the `Market` event when the commodities screen opens); otherwise the local EDDN/Spansh `markets` cache via new `get_station_commodities()` — so the highlight works right at touchdown. A live Market.json match with nothing buyable does NOT fall back to cache (consumer-only stations show honestly empty) | DONE | `core/database.py`, `main.py` |
| Name matching: market symbols ('ceramiccomposites') and display names both normalized to bare alphanumerics; backend enriches entries with `display` via commodities.json id→name map (`_commodity_display`) | DONE | `main.py`, `frontend/src/pages/Colonisation.jsx` |
| `get_station_market()` API — page-mount fetch, self-heals if the push predates the window | DONE | `main.py` |
| **"Route overlay won't close" root cause**: `set_active_route` force-`show("route")`ed ignoring the user's Enable/Disable pref; same bug in `_handle_cmdr_event` (cmdr_ping) and `_handle_scan_organic` (exo_tracker). All three now gated on `is_user_enabled()` | FIXED | `main.py` |
| Hide-during-creation race: `hide()` now flips `_shown` even when the window doesn't exist yet and cancels pending hide-timers; `show()`'s creation thread checks `_shown` after the 1.5s init and hides the fresh window if the user disabled it meanwhile | FIXED | `core/overlay.py` |
| **All overlays disabled on app close** (user request): `window.events.closed` handler wipes every `overlay_auto_*` pref — overlays always start disabled, so a stuck overlay is recoverable by restarting; user re-enables per session | DONE | `main.py` |
| `APP_VERSION` = `0.3.46`; frontend built, exe built from venv, local install swapped and verified running (log: v0.3.46, no errors) | DONE | `main.py` |

## Notes

- Station market payload: `{system, station, source: "market"|"cache", commodities: [{name, display, buyPrice, stock}]}`; only Stock>0 && BuyPrice>0, rares skipped. Also emitted to the construction overlay; `_push_cargo_to_overlay` re-sends it when the overlay opens; `_push_startup` seeds it when launched while docked.
- Backend verified live: "Station market: 58 buyable at YusufibnAyyub Landing (market)" in log.
- Blue commodity highlight confirmed working in-game by user 2026-07-03 ("it works!"); v0.3.46 committed and tagged for CI release same day.
- Still to watch in-game: a disabled route overlay staying closed through route activation.

---
*Session 35 — 2026-07-03*

---
*Session checkpoint: 2026-07-03 18:51:43*

---
*Session checkpoint: 2026-07-03 19:55:24*

---
*Session checkpoint: 2026-07-03 19:58:18*

---
*Session checkpoint: 2026-07-03 20:47:28*

---
*Session checkpoint: 2026-07-03 20:50:49*

---

## Session 35 continued — Galaxy Plotter "Every Jump" mode (v0.3.47)

User: "the route plotter doesnt work — it just tells me to jump to target system even
if its 600ly away." Root cause: NOT a bug — Spansh `/route` is the NEUTRON plotter;
its waypoints are neutron boost stops only. A trip with no useful neutron detour
legitimately returns origin→destination with a jumps count. Verified live: the user's
exact 65.7 ly plot returns 2 waypoints, `jumps: 3` on the destination.

| Item | Status | File |
|---|---|---|
| `galaxy_route(params)` — Spansh `/generic/route` (the site's Galaxy Plotter): POST form + poll job, returns EVERY jump with name/distance/fuel_used/fuel_in_tank/is_scoopable/has_neutron/must_refuel. Params reverse-engineered from Auto_Neutron's ExactTab (endpoint is undocumented) | DONE | `api/spansh.py` |
| `plan_galaxy_route(origin, destination)` — builds the FSD fuel model from the live Loadout: fuel_power/fuel_multiplier tables by drive size/rating; **optimal_mass derived by inverting the fuel equation against MaxJumpRange** (`opt = range × (base_mass + max_fuel) / (max_fuel/mult)^(1/power)`) so engineering is automatically included, no per-module optimal-mass tables needed | DONE | `main.py` |
| `_handle_loadout` now stores `fsd_size`/`fsd_class` | DONE | `main.py` |
| Navigation Route Planner: mode toggle **Every Jump** (default) / **Neutron Waypoints**; range+efficiency inputs hidden in Every Jump mode (uses live loadout); result rows show ☀ scoopable, ⚡ neutron, amber "⛽ REFUEL" (must_refuel) | DONE | `frontend/src/pages/Navigation.jsx` |
| Verified live with Caspian numbers (80.11 ly, 5.5T max fuel, size8 class5 → opt mass 13,656): Trifid → Lagoon ~800 ly = 4 jumps incl. 3 neutron-boosted ~250 ly hops | VERIFIED | — |
| `APP_VERSION` = `0.3.47` | DONE | `main.py` |

## Notes

- Size-8 fuel_power (2.90) is extrapolated (+0.15/size); only mid-curve fuel estimates shift — max range stays exact because optimal_mass is fitted to the journal's MaxJumpRange.
- `/generic/route` quirks: empty-body 400 on wrong params; jobs poll via the same `/results/{job}` endpoint as the neutron plotter.
- Neutron mode kept for long-haul waypoint planning (plot each leg in the galaxy map).

---
*Session 35 continued — 2026-07-03*

---
*Session checkpoint: 2026-07-03 23:48:44*

---

## Session 35 continued — THE overlay won't-hide root cause (v0.3.48)

User: route overlay still wouldn't disappear on Disable (after the v0.3.46 gating
fixes). Isolated with a standalone pywebview repro checking Win32 IsWindowVisible:

- `window.hide()` works fine, even with WS_EX_LAYERED applied
- **`window.resize()` RE-SHOWS a hidden pywebview window** (visible=False → resize → visible=True)

Since Session 34, `emit_to_overlay` auto-runs `resize_to_content` for route +
construction — and pushes fire constantly with an active route (route_update per
FSDJump, fsd_target per star targeted). Disable hid the window; the next push
resized it and pywebview brought it right back. Explains every "overlay bugging
out" report to date.

| Item | Status | File |
|---|---|---|
| `resize_to_content` now bails when `_shown` is False — checked at call, after the 0.4s render delay, and again after the evaluate_js measure (hide can land in any gap) | DONE | `core/overlay.py` |
| `show()` on an existing window re-runs `resize_to_content` (pushes while hidden skip the auto-fit, so size may be stale) | DONE | `core/overlay.py` |
| `hide()` logs "overlay: hid 'name'" so future won't-hide reports are diagnosable from the log | DONE | `core/overlay.py` |
| Repro script kept at scratchpad test_hide.py pattern (pywebview + IsWindowVisible) — rebuild it if pywebview is ever upgraded, to re-verify this behaviour | — | — |
| `APP_VERSION` = `0.3.48`; frontend unchanged from 0.3.47 | DONE | `main.py` |

---
*Session 35 continued (won't-hide root cause) — 2026-07-04*

---
*Session checkpoint: 2026-07-04 00:04:28*

---
*Session checkpoint: 2026-07-04 00:06:42*

---

## Session 35 continued — Traders & Brokers search on Engineering (v0.3.49)

| Item | Status | File |
|---|---|---|
| Engineering gets a 6th tab **Traders & Brokers**: kind toggle (Material Traders / Tech Brokers), type filter chips (All/Raw/Manufactured/Encoded · All/Guardian/Human), near-system input auto-filled from current system, nearest-first results with colored type badge, station, system+Copy, distance ly, arrival ls, pad size, planetary marker | DONE | `frontend/src/pages/Engineering.jsx` |
| `material_traders()` / `tech_brokers()` + shared `_filtered_stations()` — Spansh /stations/search returns per-station `material_trader` ('Raw'/'Manufactured'/'Encoded') and `technology_broker` ('Guardian'/'Human'/None) fields, BOTH server-side filterable with shape `{"field": {"value": [...]}}` (the `[{"name":...}]` shape 400s on these fields). Verified live: MT 1633 total / Raw 372; TB 6811 total / Guardian 808 / Human 1532 | DONE | `api/spansh.py` |
| `find_material_traders(system, type)` / `find_tech_brokers(system, type)` API + shared `_find_station_service()`; blank system falls back to current system | DONE | `main.py` |
| `APP_VERSION` = `0.3.49` | DONE | `main.py` |

## Notes

- Spansh station-search filter shapes now known: list-of-name dicts (`services`, `market`) vs `{"value": [...]}` (`material_trader`, `technology_broker`) — probe with known-negative before trusting any new field.
- "All Brokers" service-filter results include stations whose `technology_broker` is None (badge shows '?').

---
*Session 35 continued (traders & brokers) — 2026-07-04*

---
*Session checkpoint: 2026-07-04 00:19:42*

---
*Session checkpoint: 2026-07-04 00:24:11*

---

## Session 35 continued — dock-state replay fix (v0.3.50)

User lost the blue buyable-here highlight after an app restart. Log showed no
"Station market:" push after relaunch: they had docked at Ranganathan Plant
AFTER game login, and `_replay_startup` only recovers the docked station from
`Location` (login) — `Docked`/`Undocked` weren't replayed, so `_current_station`
came back stale/empty on every mid-session app restart.

| Item | Status | File |
|---|---|---|
| Replay now tracks the last dock-AFFECTING event (Location/Docked/Undocked/FSDJump) separately — can't use `seen` (last-per-kind loses ordering). After the normal replay: last=Docked → replay it (sets station + pushes station market); last=Undocked/FSDJump → synthesize Undocked to clear any stale station the login Location set | DONE | `core/journal.py` |
| Also verified from the user's system: nearest material trader really is 1,034.8 ly (Helgrind Gateway, NGC 6530 / Lagoon) — Trifid colonisation stations have no Material Trader service in Spansh; search is correct, the frontier is just empty | — | — |
| `APP_VERSION` = `0.3.50`; frontend unchanged from 0.3.49 | DONE | `main.py` |

---
*Session 35 continued (dock-state replay) — 2026-07-04*

---
*Session checkpoint: 2026-07-04 00:28:16*

---
*Session checkpoint: 2026-07-04 00:46:07*

---
*Session checkpoint: 2026-07-04 00:54:22*

---

## Session 35 wrap-up — NEXT SESSION: Operations update support

**Game update "Operations" landed 2026-06-30** (after Session 33/34): 6 multi-stage
challenge scenarios for squads up to 4 CMDRs (solo possible), space + on-foot,
plus a networking/balancing beta.

**State of research (2026-07-04):**
- Official patch notes / wiki / elitedangerous.com all 403-block automated fetches.
- No public docs of the new journal events yet; EDMC (EDCD) has shipped NO
  Operations support as of tonight — nobody knows the event shapes publicly.
- User's journals (2026-07-01..04) contain ZERO Operations events — he hasn't
  played one yet.

**The plan (agreed with user):**
1. User plays one Operation (any, solo ok, partial ok). The game journals
   everything regardless of EDTC's watcher — no code needed beforehand.
2. Diff the new journal's event types against
   **`scripts/journal_event_baseline.txt`** (89 known types, committed tonight)
   → the Operation* events + payloads fall out.
3. Design from real payloads (do NOT guess field shapes — see the "NaN" lesson,
   Session 32). Likely shape: an Operations tab (Commander page or own page)
   with active op / stage progress / squad; maybe a stage-objectives overlay;
   new events into WATCHED_EVENTS + handlers in main.py.

**Where everything else stands:** all work through v0.3.50 is released and the
local install matches. Releases tonight: v0.3.46 (blue buyable highlight +
overlay pref gating), v0.3.48 (Galaxy Plotter every-jump mode + pywebview
resize-reshows-hidden fix), v0.3.50 (Traders & Brokers search + dock-state
replay fix). All confirmed working in-game by the user. No known regressions.

---
*Session 35 complete — 2026-07-04*

---
*Session checkpoint: 2026-07-04 00:57:17*

---
*Session checkpoint: 2026-07-04 16:56:44*

---
*Session checkpoint: 2026-07-04 17:24:25*

---
*Session checkpoint: 2026-07-04 17:25:06*

---
*Session checkpoint: 2026-07-04 17:46:53*

---
*Session checkpoint: 2026-07-04 17:47:35*

---
*Session checkpoint: 2026-07-04 19:05:15*

---
*Session checkpoint: 2026-07-04 19:14:40*

---
*Session checkpoint: 2026-07-04 19:19:23*

---
*Session checkpoint: 2026-07-04 19:26:45*

---
*Session checkpoint: 2026-07-04 19:29:52*

---

## Session 36 — Friend's install debugged + diagnostics hardening (v0.3.51)

**Operations capture attempt:** user logged in with a live journal watcher running
(baseline diff every 15s) but didn't reach an Operation — still ZERO Operations
events captured. `scripts/journal_event_baseline.txt` gained `RedeemVoucher`
(vanilla event, just never fired in the baseline journals). The Session 35 plan
stands: diff journals against the baseline after the user plays one.

**Friend's construction bug — RESOLVED, not an EDTC code bug:** friend (v0.3.50,
helping the user's build) saw no depot data / no Import. Confirmed from his journal
that `ColonisationConstructionDepot` DOES fire for non-architect helpers (identical
payload). Root cause: **duplicate EDTC.exe** — he was launching a stale copy with
its own empty `edtc.db` beside it (DB lives next to the exe). Removing the
duplicate fixed it.

Diagnostics hardening (released as v0.3.51, tagged same day):

| Item | Status | File |
|---|---|---|
| Startup log line now includes `exe=` and `db=` paths — duplicate-exe cases visible from line 1 of the log | DONE | `main.py` |
| `init_db()` failure now logs CRITICAL + Windows MessageBox ("move exe to a writable folder") + re-raises — was a silent no-persistence failure when run from a write-protected folder | DONE | `main.py` |
| Depot handler logs each processed depot (station, market id, commodities, remaining T, progress) + warns on empty ResourcesRequired — was a total logging blind spot | DONE | `main.py` |
| `RedeemVoucher` added to journal event baseline | DONE | `scripts/journal_event_baseline.txt` |

**Facts confirmed this session:**
- `ColonisationConstructionDepot` fires for ANY player docked at a construction
  site, architect or helper — multi-player depot tracking needs no special-casing.
- Contribution events are per-player journals, so "your pace"/ETA is per-install
  by design; site totals stay correct via the depot snapshot's ProvidedAmount.

---
*Session 36 — 2026-07-04*

---
*Session checkpoint: 2026-07-04 19:42:07*

---
*Session checkpoint: 2026-07-04 19:48:47*

---
*Session checkpoint: 2026-07-04 21:13:26*

---

## Session 37 — Overlay market-order sort + market_id linking + journal-emit removal (v0.3.52)

| Item | Status | File |
|---|---|---|
| **Construction overlay sorted in station-market order** (user request): pending commodities sort by (category, name) — the in-game market screen lists categories alphabetically with commodities alphabetical inside each, so rows line up while buying. Category map (both id and display-name keys, normalized to bare alphanumerics) built from `data/commodities.json` and pushed to the overlay as `commodity_categories` on open (overlays have no API bridge). Unknown commodities sort last | DONE | `main.py`, `frontend/src/overlays/Construction.jsx` |
| Note: Market.json `Items[]` raw order is NOT the in-game screen order (categories interleaved) — category+name sort is the correct reproduction | — | — |
| **Backlog: depot↔project cross-sync fixed** — `construction_projects` gained a `market_id` column (ALTER TABLE migration). Matching rules: a project linked to the event's market_id wins; unlinked projects fall back to the system match and get the market_id backfilled; a project linked to a DIFFERENT depot in the same system is never touched. Applied to `sync_construction_depot`, `record_construction_contribution`, and the page's `findMatchingProject`/Import/Sync buttons | DONE | `core/database.py`, `main.py`, `frontend/src/pages/Colonisation.jsx` |
| Verified with scripted DB test (two depots in one system: no cross-sync, correct per-market contribution credit, legacy backfill) AND live: existing Chun Command Facility project auto-backfilled market_id 4375393795 on startup replay | DONE | — |
| **Backlog: dead `_emit("journal", event)` removed** from `on_journal_event` — nothing in the frontend ever listened; it was an evaluate_js per journal event for nothing | DONE | `main.py` |
| Inara: still externally blocked (app registration) — no action possible | — | — |
| `APP_VERSION` = `0.3.52`; frontend + exe built, local install swapped and verified (log: v0.3.52, depot replay, overlay pushes + resize OK) | DONE | `main.py` |

## Known issues / notes for next session

- ~~v0.3.52 is local only~~ — user confirmed the overlay market-order sort in-game 2026-07-04; v0.3.52 tagged for CI release same day.
- Operations support still blocked on the user playing one Operation (Session 35 plan stands; diff journals vs `scripts/journal_event_baseline.txt`).
- If the user wants the same market-order sort on the Colonisation page (Shopping List / Depot View cards), the category map is already available backend-side via `_commodity_category_map()` — page has a working API bridge so it could just be an API method.
- Inara integration wired but blocked pending app registration (external).
- pygame not installable on Python 3.14 — audio disabled in dev/local builds; CI uses 3.12.

---
*Session 37 — 2026-07-04*

---
*Session checkpoint: 2026-07-04 21:28:15*

---
*Session checkpoint: 2026-07-04 21:47:56*

---

## Session 37 continued — Carrier Auto-Jump feature removed (v0.3.53)

User decision: remove the fleet carrier Auto-Jump / autopilot entirely (the
ToS-risky feature that fired keypresses to jump the carrier along a route).
The Session-1 "include with ToS warning" decision is superseded.

| Item | Status | File |
|---|---|---|
| `AutoJumpTab` component (ToS gate, key/delay config, countdown UI) deleted; TABS entry + render line removed; page subtitle updated; `useRef` import dropped (only Auto-Jump used it) | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| Backend removed: `_auto_jump_*` state, FSDJump `_schedule_next_jump()` hook, `_schedule_next_jump()` itself (the `keyboard.send` keypress path), `start_auto_jump`/`stop_auto_jump`/`get_auto_jump_status` API methods | DONE | `main.py` |
| `keyboard` lib stays — still used by the Ctrl+Shift+C route-clipboard hotkey | — | `main.py` |
| README feature list + EDT-checklist pending-decision items updated | DONE | `README.md`, `EDT-checklist.md` |
| Fleet Carriers page now has 2 tabs: Carrier Stats / Route Planner | — | — |
| `APP_VERSION` = `0.3.53`; built, local install swapped, verified running (log: v0.3.53, no errors) | DONE | `main.py` |

**Encoding lesson (repeat offender risk)**: editing UTF-8 frontend files via
PowerShell 5.1 `Get-Content`/`Set-Content` corrupts em-dashes/arrows to mojibake
(reads as ANSI without BOM). File was reverted and re-edited with a Python
script (`read_text/write_text encoding="utf-8"`). Use the Edit tool or Python
for bulk text surgery on repo files, never PS 5.1 cmdlets.

---
*Session 37 continued (auto-jump removal) — 2026-07-04*

---
*Session checkpoint: 2026-07-04 23:43:14*

---

## Session 37 continued — Engineering: unlock tracker + pinned blueprints (v0.3.54)

User request: track who's unlocked / who's next, pin blueprints, and see what
materials are missing to engineer parts.

| Item | Status | File |
|---|---|---|
| Engineers tab overhaul: summary bar (X/23 unlocked + progress bar + "N invites waiting"), engineers grouped by journal progress in action order — **Next up (Invited)** / **Working towards an invite (Known)** / **Locked** / **Unlocked** — with the requirement that matters next highlighted (→ Unlock for invited, → Invite for known/locked); unlocked engineers below max grade show a rank-up hint | DONE | `frontend/src/pages/Engineering.jsx` |
| `pinned_blueprints` table (PK blueprint_id+grade, `rolls` multiplier) + CRUD; API: `get_pinned_blueprints` / `pin_blueprint` / `unpin_blueprint` / `set_pin_rolls` (all return the updated pin list) | DONE | `core/database.py`, `main.py` |
| Blueprints tab: 📌 Pin/Pinned button per grade block, 📌 marker on the blueprint header when any grade is pinned | DONE | `frontend/src/pages/Engineering.jsx` |
| New **Pinned** tab (count in tab label): top panel aggregates **materials still needed across all pins** (shortfall = Σ need×rolls − have, grouped w/ Raw/Manufactured/Encoded badges, pointer to Traders & Brokers tab); per-pin cards show grade, applies-to, rolls +/- stepper, per-material have/need with shortfall, "✓ ready to craft" state | DONE | `frontend/src/pages/Engineering.jsx` |
| Pins state lifted to the Engineering parent so Blueprints ↔ Pinned stay in sync; empty state links to the Blueprints tab | DONE | `frontend/src/pages/Engineering.jsx` |
| `APP_VERSION` = `0.3.54`; built, local install swapped, verified (log clean; pinned_blueprints table created; 129 materials + 29 engineer_progress rows live) | DONE | `main.py` |

## Notes

- Material matching between blueprints.json (display names) and the materials
  table (lowercased journal names) uses `.toLowerCase()` — same convention as
  the existing craftable checks.
- `engineer_progress` has 29 rows vs 23 in engineers.json — the extras are
  Odyssey on-foot engineers from the journal; they simply don't render (ship
  engineers only in engineers.json). Add an on-foot dataset later if wanted.
- Rolls default to 1 per pin; the stepper multiplies material needs (a grade
  realistically takes several rolls to max).
- v0.3.54 is local only — tag for CI release once the user has play-tested
  pinning.

---
*Session 37 continued (engineering tracker) — 2026-07-05*

---
*Session checkpoint: 2026-07-05 00:02:12*

---

## Session 37 continued — Carrier ownership + Visited Carriers tab (v0.3.55)

User request: tell own carrier apart from visited ones; separate tab with the
ability to remove unwanted entries.

| Item | Status | File |
|---|---|---|
| **Ownership detection**: `CarrierStats` / `CarrierBuy` / `CarrierJumpRequest` / `CarrierJumpCancelled` are owner-only journal events → handlers pass `owned: 1`. `CarrierJump` / `CarrierLocation` / `CarrierDepositFuel` fire for ANY carrier you're docked on or donate to → never mark ownership | DONE | `main.py` |
| `carriers` gained `owned` (event-derived, never downgrades), `owned_override` (manual, wins when set), `hidden` columns; PRAGMA-guarded migration backfills `owned=1` where name/finance exist (those fields only ever came from CarrierStats) | DONE | `core/database.py` |
| `get_carriers(include_hidden)` returns computed `is_mine`; `set_carrier_owned` / `set_carrier_hidden`; API: `set_carrier_owned`, `remove_carrier` (hide, not delete — journal replay can't resurrect it), `restore_carrier` | DONE | `core/database.py`, `main.py` |
| Stats tab → **My Carrier**: filters to `is_mine`, each card gets a "Not my carrier" link (moves it to Visited) | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| New **Visited Carriers** tab: docked-on/refuelled carriers with name/callsign/location/last-seen/fuel, per-card **This is mine** + **Remove** buttons, collapsible "Show removed" list with Restore | DONE | `frontend/src/pages/FleetCarriers.jsx` |
| `APP_VERSION` = `0.3.55`; built, swapped, verified (log clean; migration: MACK HORIZON owned=1, REBUY DISTRIB. CENTER owned=1, anonymous fuel-only carrier owned=0 → Visited) | DONE | `main.py` |

## Notes

- **Remove = hide, not delete**: journal startup replay re-upserts carriers from
  the latest journal every launch, so a hard delete would resurrect them. The
  hidden flag survives upserts (event upserts never touch owned_override/hidden).
- **REBUY DISTRIB. CENTER (RXDS) has CarrierStats data in the user's journal**,
  meaning the owner-only event fired for it — either the user owns two carriers
  or has management access to it. Ask the user; "Not my carrier" corrects it in
  one click if needed.
- v0.3.54 (engineering tracker) and v0.3.55 both unreleased — tag through CI
  after play-testing (0.3.55 tag covers both).

---
*Session 37 continued (carrier ownership) — 2026-07-05*

---
*Session checkpoint: 2026-07-05 00:12:08*

---

## Session 37 continued — Overlay audit + CMDR ping fixes (v0.3.56)

Full audit of all 6 overlays (user request) plus "make the beep actually work
and not ping AI".

**Audit results:**
- route / construction / system_preview / overlay manager: clean, no changes.
- cmdr_ping: THREE bugs (below).
- fss + exo_tracker: no seed-on-open — opened mid-session they showed
  "Scanning…"/"No scans" despite existing data (same class of bug as the
  Session 34 bridge audit; overlay windows have no API bridge to self-fetch).

| Fix | Status | File |
|---|---|---|
| **NPC ping filter**: NPC pilots always have $-macro raw `PilotName` (`$npc_name_decorate:#name=...;`) — verified against live journals; real players are plain "Cmdr <name>". Handler now returns early on `$`-prefixed or missing raw PilotName. Every combat-zone pirate used to ping | DONE | `main.py` |
| "Cmdr " prefix stripped from player names (display used to read "CMDR Cmdr X"); ship name resolved via `_SHIP_DISPLAY_NAMES` | DONE | `main.py` |
| **Re-ping cooldown**: ShipTargeted re-fires per scan stage / re-lock — one ping per CMDR per 120s (`_cmdr_ping_times`) | DONE | `main.py` |
| **Audio rewritten around winsound** (stdlib): synthesized decaying-sine WAV played via `SND_MEMORY` — works on Python 3.14 local builds where pygame never installs (beep has been silently dead in every local build). pygame kept as non-Windows fallback only. Custom `ping_sound_path` pref must be a .wav on Windows | DONE | `core/audio.py` |
| `ScanBarCode` removed from WATCHED_EVENTS + dispatcher — not a real journal event (hallucinated in Session 1, never fired) | DONE | `core/journal.py`, `main.py` |
| FSS overlay seeded on open with `_fss_bodies` (last body + all_bodies) | DONE | `main.py` |
| Exo overlay seeded on open with current system's scans from `get_exo_scans(system)` (max 6, matches overlay cap) | DONE | `main.py` |
| Seed dispatch unified in `_seed_overlay(name)` used by both `show_overlay` and `toggle_overlay` | DONE | `main.py` |
| Audio verified audibly via winsound test script; NPC filter logic unit-checked; `APP_VERSION` = `0.3.56`, built, swapped, log clean | DONE | — |

## Known issues / notes for next session

- ~~v0.3.54/55/56 unreleased~~ — v0.3.56 tagged 2026-07-05; one release ships
  the engineering tracker, carrier ownership tabs, and overlay/ping fixes.
- CMDR ping still needs an in-game encounter with a real player to confirm
  end-to-end (filter verified against journal data, beep verified audibly).
- Operations support still blocked on the user playing one Operation.

---
*Session 37 continued (overlay audit + cmdr ping) — 2026-07-05*

---
*Session checkpoint: 2026-07-05 00:29:14*

---
*Session checkpoint: 2026-07-05 00:32:07*

---
*Session checkpoint: 2026-07-05 09:31:36*

---

## Session 38 — Ships reference tab (v0.3.57)

User request: a Ships tab listing every ship, click a ship to see its modules
(slot sizing + how many), and show the ship as an outline/framework.

| Item | Status | File |
|---|---|---|
| `build_ships()` added — fetches all 47 ships from EDCD/coriolis-data `ships/*.json`, transforms to slot layout (core/hardpoints/utility/optional/military/planetary), writes `data/ships.json`. Wired into `main()` as [6/6] | DONE | `scripts/build_data.py` |
| `data/ships.json` — full 47-ship dataset (replaces the 2-ship stub) incl. Corsair, Mandalay, Panther Clipper Mk II, Type-11 Prospector, Caspian Explorer, Nomad, Kestrel | DONE | `data/ships.json` |
| `get_ships()` API method — serves ships.json, flags `is_current` by display-name match against the flown ship (`_SHIP_DISPLAY_NAMES[_current_ship.ship]`) | DONE | `main.py` |
| `Ships.jsx` — searchable + pad-filterable ship list -> detail panel; **generated angled 3D "roll-cage" wireframe** (lofted hull: octagonal cross-section hoops + longitudinal rails per family, 3/4 projection with depth-dimmed far edges) + **size-scaled hardpoint chip rack** (one chip per mount, bigger chip = bigger size, off the ship) + utility chips + full slot breakdown (7 labelled core internals, optional slots as size pills, military/planetary slots). Reviewed via standalone Artifact preview before build | DONE | `frontend/src/pages/Ships.jsx` |
| Sidebar nav item + route wired (`/ships`, between Navigation and Trading) | DONE | `frontend/src/App.jsx` |
| `APP_VERSION` = `0.3.57`; frontend built (51 modules OK), exe built, local install swapped + verified (log: v0.3.57 frozen, no errors) | DONE | `main.py` |

## Notes / next session

- **No real ship images exist in the EDCD ecosystem** (Coriolis renders 3D
  models, no bundled SVGs; real OBJ/STL meshes exist on Cults3D/Sketchfab but
  need three.js + licensing). So the ship is a *procedurally generated* angled
  3D wireframe — a lofted hull from a per-family `[z, halfWidth, halfHeight]`
  profile (`FAMILY_PROFILES`), octagonal cross-section (`K=8`), projected at
  `YAW=-0.62 / PITCH=0.34`, depth-dimmed. Not a literal likeness. Families are
  mapped per ship in `SHIP_FAMILY` (fallback by pad size). To fix a ship that
  looks wrong: tweak its family's station profile, add a new family, or remap
  it. A standalone preview generator lives at
  `scratchpad/gen_static.py` (bakes all 47 to static SVG for eyeballing).
- **coriolis `slots.standard` order** is fixed: Power Plant, Thrusters, FSD,
  Life Support, Power Distributor, Sensors, Fuel Tank (see `CORE_SLOT_NAMES` in
  build_data.py and `CORE_NAMES` in Ships.jsx — keep them in sync).
- Hardpoint array uses 0 = utility mount, 1/2/3/4 = S/M/L/H.
- v0.3.57 is **local only** — tag for CI release after the user play-tests the
  Ships tab (silhouettes + slot data need an eyeball in-app).
- To regenerate ship data later: `python scripts/build_data.py` (or just the
  `build_ships()` fn) — pulls live from coriolis-data.

---
*Session 38 — 2026-07-05*

---
*Session checkpoint: 2026-07-05 09:51:38*

---
*Session checkpoint: 2026-07-05 10:03:31*

---
*Session checkpoint: 2026-07-05 10:05:47*

---
*Session checkpoint: 2026-07-05 10:07:55*

---
*Session checkpoint: 2026-07-05 10:12:04*

---
*Session checkpoint: 2026-07-05 10:14:18*

---
*Session checkpoint: 2026-07-05 10:15:21*

---
*Session checkpoint: 2026-07-05 10:16:54*

---
*Session checkpoint: 2026-07-05 13:50:27*

---
*Session checkpoint: 2026-07-05 14:45:28*

---

## Session 39 — Ship Builder (outfitting + save builds + engineering tracking) (v0.3.58)

User request: "add in ship building (like coriolis.io), and let me save a build
so I can track each part and engineering level." Confirmed scope: import the live
ship AND build from scratch; full coriolis-style stats with engineering applied.

| Item | Status | File |
|---|---|---|
| `build_modules()` added — pulls every module from coriolis-data `modules/{standard,internal,hardpoints}` via the GitHub contents API (same pipeline as `build_ships`), classifies by dir (standard→core, hardpoints w/ `mount`→weapon else utility, internal→optional + `military_ok` by name), writes `data/modules.json` grouped core/hardpoint/utility/optional. Ran locally: core 297, hardpoint 177, utility 38, optional 458 | DONE | `scripts/build_data.py`, `data/modules.json` |
| `core/outfitting.py` — pure-Python stat engine. `compute_stats(ship, fitted, unladen_override)` → mass, power (deployed/retracted vs plant), jump range (laden + max), shields (gen mass-curve + boosters + guardian reinf), armour (+HRP), speed/boost (thruster mass-curve), DPS, cargo, fuel, cost, rebuy. Engineering via effective-field overlay | DONE | `core/outfitting.py` |
| **Units gotcha**: journal `Engineering.Modifiers` Values are MIXED units — most absolute real units (FSDOptimalMass tons, Mass, PowerDraw), but some are PERCENT while coriolis stores a fraction (`EngineOptPerformance` 133→1.33, `ShieldGenStrength` 217→2.17, `DefenceModifierShieldMultiplier` 26→0.26, resistances). `PERCENT_LABELS` set ÷100. Missing this gave 127× speed / 43M shields | DONE | `core/outfitting.py` |
| Imported builds pass the journal's real `UnladenMass` as `unladen_override` → jump range matches the game exactly despite bulkhead mass not being in the module DB | DONE | `core/outfitting.py`, `main.py` |
| API: `get_modules`, `compute_build` (expands from-scratch blueprint+grade → multipliers via `_blueprint_effects` using blueprints.json), `import_current_build` (maps journal Loadout → slot-keyed build w/ real modifiers). `_current_loadout` captured in `_handle_loadout` | DONE | `main.py` |
| **Persistence reused the pre-existing (Session-1, never-wired) `builds` table** + `get_builds`/`save_build`/`delete_build` — build JSON stored in the `data` blob. No new table needed | DONE | `core/database.py`, `main.py` |
| `Builder.jsx` — new page: builds library (Import current ship / New from hull / saved list), slot editor grouped by section (Hardpoints/Utility/Core/Optional/Military) with per-slot module picker (valid by family+size, searchable) + engineering editor (blueprint search + grade + experimental), live stats panel (debounced `compute_build`, power bar). Sidebar item "Ship Builder" between Ships and Trading | DONE | `frontend/src/pages/Builder.jsx`, `frontend/src/App.jsx` |
| Validated engine vs ground truth: computed max jump range == game `MaxJumpRange` exactly for Anaconda/Caspian/Corvette/FdL/Panther/Sidewinder/Viper. `APP_VERSION`=0.3.58; frontend built (52 modules), exe built, local install swapped + verified (log v0.3.58 frozen, clean; user confirmed tab looks good) | DONE | `main.py` |

## Notes / next session

- **Jump range is exact for the common fleet**, but a few of the NEWEST ships
  (Corsair, Type-8) read ~3-4% high — likely the SCO/overcharged FSD fuel model
  (maxfuel/fuelmul) differs from what coriolis-data encodes. Verify their FSD
  entries in `data/modules.json` and the SCO max-fuel handling if it matters.
- **Bulkheads/armour grade are NOT modelled yet**: bulkheads live in the coriolis
  *ship* files (not modules/), so they're not in `modules.json`. Imported builds
  stay accurate via `unladen_override`; from-scratch builds slightly undercount
  mass and use bulkhead multiplier = 1 (Lightweight) for armour. To fully model:
  extract `bulkheads` into ships.json and add a bulkhead slot.
- **From-scratch engineering is approximate**: it multiplies coriolis base fields
  by blueprint grade multipliers (blueprints.json). Imported engineering is exact
  (game's own modifiers). Shield-strength from-scratch only scales optmul, not the
  min/max mass-curve points — minor.
- Blueprint picker in the engineering editor is currently unfiltered (full list,
  searchable) — could filter to blueprints whose `applies_to` matches the module
  group for a tighter UX.
- v0.3.58 is **local only** — tag for CI release after the user play-tests the
  Ship Builder (import a couple of ships, build one from scratch, save/reload).

---
*Session 39 — 2026-07-05*

---
*Session checkpoint: 2026-07-05 14:48:00*

---
*Session checkpoint: 2026-07-05 14:53:22*

---
*Session checkpoint: 2026-07-05 14:54:28*

---
*Session checkpoint: 2026-07-05 14:55:36*

---
*Session checkpoint: 2026-07-05 19:43:06*

---

## Session 40 — Journal watcher rotation/tailing fix (v0.3.59)

User report: "the colonisation tab is broke — it won't update or show my cargo
anymore." Confirmed symptoms (via AskUserQuestion): delivered counts don't move
+ in-game construction overlay shows wrong/zero cargo. User hauls **directly**
(not via carrier), so stale FC cargo was a red herring.

**Root cause — journal-file rotation was not handled reliably.** Diagnosed from
the live data, not the code (every handler path *looked* correct end to end):
- DB depot frozen at 71.3% (last updated at the 14:47 local dock) while the
  game's current journal was at 83%+ and climbing — EDTC had processed **zero**
  events since its 18:37 restart.
- The current journal `Journal.2026-07-05T184027.01.log` was created at 18:40 —
  **3 min after** EDTC launched at 18:37. EDTC latched onto the previous journal
  at startup and never switched to the new session file.
- `JournalWatcher` relied entirely on watchdog directory events to notice a new
  journal. On Windows, ED appends to the journal without reliably firing
  directory change notifications, and the game rotates to a fresh `Journal.*.log`
  on every (re)start — so if EDTC starts before the game's session file exists,
  the feed silently freezes. Compounding it, `run()` looped on
  `while self._observer.is_alive()`, so a dead observer thread also killed
  everything with no log.

| Fix | File |
|---|---|
| Added a **1 s polling loop** in `run()` that (a) switches to a newer journal on rotation and (b) drains appended lines every tick — independent of watchdog and of observer liveness (`while self._running`, not `observer.is_alive()`) | `core/journal.py` |
| `threading.Lock` serialises file-position access between the watchdog callback and the poll loop so appended lines are never read/emitted twice; `_read_new_lines_locked()` runs under the lock from both paths | `core/journal.py` |
| File identity compared by `.name` (unique timestamp) not `Path` equality — avoids backslash/casing mismatches between glob results and `event.src_path` that would reset `_file_pos=0` and re-emit a whole file | `core/journal.py` |
| Observer start wrapped in try/except; `stop()` method added; rotation logged (`journal rotation: switching to …`) | `core/journal.py` |
| `APP_VERSION` = `0.3.59`; exe rebuilt (frontend unchanged, dist reused), local install swapped, relaunched | `main.py` |

**Verified:** isolated rotation/append test (temp dir) — picks up rotated
journal, reads appended lines exactly once, idle polls don't duplicate. Live:
v0.3.59 relaunch replayed the current journal → depot 71.3% → **93.8%**,
titanium delivered 18 → **2282**, ship cargo 0 → **titanium (1)**. Both user
symptoms resolved.

## Notes / next session

- This bug hit any session where EDTC was started **before** ED created its
  session journal (autostart, or restarting EDTC between play sessions). The
  poll makes the feed self-healing regardless of watchdog reliability.
- Guardian sites dataset is now **610 sites** (no longer a stub) — dropped from
  the known-issues list per user.
- ~~v0.3.59 is local only~~ — **v0.3.59 tagged + released 2026-07-05** (CI run
  succeeded); it also carried the Session 37–39 work (engineering tracker,
  carrier ownership, Ships tab, Ship Builder).

---
*Session 40 — 2026-07-05*

---
*Session checkpoint: 2026-07-05 20:10:35*

---
*Session checkpoint: 2026-07-05 20:12:31*

---
*Session checkpoint: 2026-07-05 20:14:05*

---
*Session checkpoint: 2026-07-05 20:15:28*

---
*Session checkpoint: 2026-07-05 20:15:51*

---
*Session checkpoint: 2026-07-05 20:17:36*

---

## Session 41 — Commendations: medals/awards system (v0.3.60)

User request: a for-fun awards/medals system that grants something as you hit
milestones (Inara-style, with latitude to invent/replace awards).

| Item | Status | File |
|---|---|---|
| `core/awards.py` — pure catalogue (23 awards, 5 categories) + `evaluate(data)`; tiered ladders with Bronze/Silver/Gold/Elite/Legendary rarity, progress to next tier. Metrics read from the journal Statistics event + ranks + a few local counts | DONE | `core/awards.py` |
| `awards_earned` table (PK award_id+tier, earned_at) added to schema; `record_awards(evaluated)` persists first-earned timestamps, annotates `earned_at`, returns `newly` — **suppressed on the very first run** so an established CMDR isn't buried in toasts (backfills silently) | DONE | `core/database.py` |
| `get_awards()` API (evaluate+record → awards, categories, earned/total, medals, newly); `_assemble_award_data()` gathers stats/ranks/engineers-unlocked/own-carrier/logbook/guardian counts; `_refresh_awards()` re-evaluates + emits `awards_earned` toast event, hooked into `_handle_statistics` and `_handle_rank` | DONE | `main.py` |
| `Awards.jsx` — Commendations page: summary (earned/total, medal count, % bar), All/Earned/In-Progress + category filters, medal cards with glowing rarity disc, tier pips, progress-to-next, earned date; on-page toast for newly earned (listens to `awards_earned`) | DONE | `frontend/src/pages/Awards.jsx` |
| Sidebar item "Commendations" + `/awards` route (between Commander and Overlays) | DONE | `frontend/src/App.jsx` |
| `APP_VERSION` = `0.3.60`; frontend built (53 modules), exe built, local install swapped + verified (log v0.3.60 clean; `awards_earned` backfilled 49 rows via the startup Statistics replay) | DONE | `main.py` |

**Award catalogue** (tiers tuned so the current CMDR earns a satisfying spread —
20/23, 49 medals — with motivating near-misses): Exploration (Pathfinder,
Long Hauler, Stellar Cartographer, Trailblazer, The Far Reach, First Footfall),
Exobiology (Xenobiologist, Codex Contributor, Bio Fortune), Combat (Bounty
Hunter, Warzone Veteran, Assassin), Trade & Industry (Merchant Prince,
Prospector, Trade Network), Wealth & Fleet (Tycoon, Shipwright, Engineer's
Friend, Fleet Commander), Prestige (Veteran Commander, **Triple Elite**,
Chronicler, Guardian Seeker). Chronicler + Guardian Seeker deliberately nudge
the user toward EDTC's own logbook/Guardian pages; Triple Elite is a legendary
near-miss (CMDR is Combat Dangerous, one rank short).

**Verified:** award eval against the real DB (20/23, spread Bronze→Legendary);
`record_awards` unit test — silent first-run backfill, idempotent, later
milestone toasts exactly the 2 headline tiers with `earned_at` stamped;
frontend build clean; app relaunch backfilled 49 rows with no errors.

## Notes / next session

- Awards populate/refresh from the periodic **Statistics** journal event (fires
  on major stat changes + game events) and on **Rank** ups — both call
  `_refresh_awards()`. The Awards page also re-evaluates live on the
  `awards_earned` event.
- Toast is currently **page-scoped** (Commendations page). A global toast in
  App.jsx would double-fire there; if wanted app-wide, move the listener to
  App.jsx and drop it from Awards.jsx.
- Thresholds are all in `core/awards.py` CATALOG — trivial to retune or add
  awards (each is a dict with a `metric` lambda + `tiers` ladder).
- Commendations shipped in the **v0.3.61** release (see the Thargoid
  continuation below) — v0.3.60 was the interim local build.

---
*Session 41 — 2026-07-05*

---

## Session 41 continued — Thargoid War awards (v0.3.61)

User: "I don't see any Thargoid achievements — those would be cool." The
Statistics event carries a `TG_ENCOUNTERS` block (CMDR has
`TG_ENCOUNTER_KILLED=964`, `TG_ENCOUNTER_TOTAL=16`).

| Item | Status | File |
|---|---|---|
| New **Thargoid War** category, 3 awards: **Xeno Hunter** (Thargoids destroyed [10/100/1000/5000]), **AX Combatant** (interceptor encounters [1/10/50/200]), **Scourge of the Maelstrom** (single legendary — destroy 1,000 Thargoids) | DONE | `core/awards.py` |
| `APP_VERSION` = `0.3.61`; exe rebuilt (backend-only change — Awards page is data-driven, no frontend rebuild), swapped + relaunched, log clean; startup replay recorded xeno_hunter + ax_combatant at Silver, Scourge correctly unearned (964<1000) | DONE | `main.py` |

Result for the current CMDR: Xeno Hunter **Silver** (96% to Gold) and Scourge
**96% to Legendary** — both just ~36 kills away, so one AX sortie unlocks both.
Now 25 awards total. Per-variant kills (Cyclops/Basilisk/Medusa/Hydra/Orthrus)
weren't in this CMDR's Statistics block, so awards use the reliable aggregate
`TG_ENCOUNTER_KILLED`/`_TOTAL`; add variant-specific medals later if a journal
exposes those fields.

**Released:** committed to `main` (`0d4ae88`) and **tagged v0.3.61 —
released via CI 2026-07-05**. One release ships the Session 40 journal-watcher
fix plus the full Commendations system (incl. Thargoid War).

---
*Session 41 continued (Thargoid awards) — 2026-07-05*

---
*Session checkpoint: 2026-07-05 20:40:16*

---
*Session checkpoint: 2026-07-05 20:52:32*

---
*Session checkpoint: 2026-07-05 20:53:52*

---
*Session checkpoint: 2026-07-05 20:54:43*

---
*Session checkpoint: 2026-07-05 20:57:29*

---
*Session checkpoint: 2026-07-06 09:20:48*

---
*Session checkpoint: 2026-07-06 09:31:20*

---

## Session 42 — Ship schematic mount locator in Ship Builder (v0.3.62)

User request: "fix the models in the ship builder — make them look like the ship
so when you click a hardpoint it shows where it's attached on the ship."

| Item | Status | File |
|---|---|---|
| Extracted the procedural hull wireframe out of `Ships.jsx` into a **shared** `ShipSchematic` component; added `buildShipModel(ship)` pure geometry that returns hull edges **and** projected mount positions sharing one transform (so markers align to the hull) | DONE | `frontend/src/components/ShipSchematic.jsx` |
| Mount placement: hardpoints on symmetric port/starboard anchors (`HP_ANCHORS`, big guns forward), utilities spread along the upper hull. Markers sit on the hull surface (profile sampled at the mount's hull-fraction, pushed out ~1.15×), colour/size-coded (H/L/M/S + grey U), depth-dimmed | DONE | `frontend/src/components/ShipSchematic.jsx` |
| Interactive: `activeKey` prop pulses a marker + drops a leader-line label; `onSelectMount(key)` fires on marker click. Slot keys match the Builder (`hardpoint:<i>`, `utility:<i>`) | DONE | `frontend/src/components/ShipSchematic.jsx` |
| Builder.jsx — sticky schematic at the top of the slot-editor column. **Hover a hardpoint/utility row → its mount lights up on the ship; click a marker → opens that slot's module picker.** Row also highlights when its mount is active | DONE | `frontend/src/pages/Builder.jsx` |
| Ships.jsx — swapped its inline `ShipWireframe` for the shared `ShipSchematic` (deleted the duplicated FAMILY_PROFILES/projection); the Ships page schematic now also shows mount markers | DONE | `frontend/src/pages/Ships.jsx` |
| `APP_VERSION` = `0.3.62`; frontend built (54 modules, clean), exe built, local install swapped + relaunched — log clean, v0.3.62 frozen, no tracebacks | DONE | `main.py` |

## Notes / next session

- **Still schematic, not a literal likeness.** There are no real ship meshes in
  the EDCD/coriolis ecosystem and **no real hardpoint-coordinate data**, so mount
  positions are *procedurally placed* (plausible symmetric layout), not the
  actual in-game mount points. This is the honest ceiling without sourcing
  external 3D models (three.js + licensing). To improve realism: hand-tune
  `FAMILY_PROFILES` per family, add families, or add real mount coords per ship.
- Geometry lives in `frontend/src/components/ShipSchematic.jsx` — `buildShipModel`
  is a pure fn (edges + mounts), `ShipSchematic` is the SVG renderer. `HP_ANCHORS`
  controls hardpoint placement order; utility placement is the loop below it.
- Only **hardpoint + utility** slots get surface markers (internals aren't on the
  skin). Selecting a core/optional slot just shows no active marker.
- v0.3.62 is **local only** — tag for CI release after the user eyeballs the
  schematic + mount highlighting in the Builder and Ships pages.

---
*Session 42 — 2026-07-06*

---
*Session checkpoint: 2026-07-06 10:02:16*

---

## Session 42 continued — real 3D ship models (wireframe) (v0.3.62)

User chose to make the hulls look like real ships by supplying **3D model
files**, rendered as **wireframe** (their call: "they can still be wireframe, no
hi-rez needed"), and "we can tune the hardpoints later."

| Item | Status | File |
|---|---|---|
| Added `three`, `@react-three/fiber` (v8), `@react-three/drei` (v9) — React 18 compatible | DONE | `frontend/package.json` |
| `ShipView` component — loads a per-ship mesh and renders it as orange **wireframe edges** (`EdgesGeometry`, 18° crease) with OrbitControls (drag-rotate, scroll-zoom, slow auto-rotate). Auto-centres + normalises scale | DONE | `frontend/src/components/ShipView.jsx` |
| **Auto-detection**: `import.meta.glob('../ship-models/*.{glb,gltf,obj}')` → `{ id: url }`. Drop a file named `<ship_id>.glb/.gltf/.obj` in `frontend/src/ship-models/` and it's bundled on next build. `hasModel(id)` exported | DONE | `frontend/src/components/ShipView.jsx` |
| **Graceful fallback**: any ship with no model file → 2D `ShipSchematic`; a model that fails to load (bad file, no WebGL, Draco) → caught by an error boundary + Suspense → also 2D. No blank panels | DONE | `frontend/src/components/ShipView.jsx` |
| Builder + Ships now use `<ShipView>` instead of `<ShipSchematic>` directly. Builder caption switches to "drag to rotate · scroll to zoom" when a model exists | DONE | `frontend/src/pages/Builder.jsx`, `frontend/src/pages/Ships.jsx` |
| Loaders: `GLTFLoader`/`OBJLoader` via `useLoader` (NOT drei `useGLTF`) to avoid drei's **Draco decoder CDN fetch** (would fail offline). No `Environment`/`Stage` for the same reason | DONE | `frontend/src/components/ShipView.jsx` |
| Placeholder `sidewinder.obj` (low-poly lofted hull) generated so 3D-wireframe mode is verifiable immediately; `_README.txt` with the full id→name list added to the models folder | DONE | `frontend/src/ship-models/` |
| `APP_VERSION` = `0.3.62`; frontend built (650 modules, bundle 369 KB gzip — three.js weight), exe rebuilt, install swapped + relaunched, log clean | DONE | `main.py` |

## Notes / next session

- **Bundle jumped to ~1.35 MB (369 KB gzip)** from three.js. Acceptable; could
  code-split the 3D path with a dynamic import if load time becomes an issue.
- **Models are bundled INTO the app** (via Vite → `frontend/dist` → PyInstaller
  `--add-data`). 47 real glb files could add tens of MB to the exe. If that gets
  too big, switch to loading models from an external folder next to the exe, or a
  CDN/release asset, instead of bundling.
- Small models (< 4 KB, like the placeholder) get **inlined as a data-URI** by
  Vite; larger ones emit as hashed files in `dist/assets`. Both load fine.
- **Hardpoint mount markers are NOT on the 3D model yet** (deferred per user).
  The 2D schematic keeps click-to-locate. Next: place markers in 3D (procedural
  along the longest bbox axis, or raycast onto the mesh) and re-wire
  `activeKey`/`onSelectMount` so slot-row hover highlights on the 3D model too.
- **To add a ship model**: name the file `<id>.glb` (ids in
  `frontend/src/ship-models/_README.txt`), drop it in that folder, rebuild.
  Prefer uncompressed glTF (no Draco). Replace the placeholder `sidewinder.obj`
  with a real one.
- **Verify 3D actually renders in WebView2**: open Ship Builder → "New build
  from… Sidewinder Mk I" (or Ships → Sidewinder). A rotating orange wireframe =
  3D works. The flat schematic with H/L/M/S chips = it fell back (report it).
- v0.3.62 still **local only** — tag for CI release once real models are in and
  the 3D path is confirmed working in-app.

---
*Session 42 continued — 2026-07-06*

---
*Session checkpoint: 2026-07-06 10:22:02*

---
*Session checkpoint: 2026-07-06 10:25:18*

---
*Session checkpoint: 2026-07-06 10:32:32*

---
*Session checkpoint: 2026-07-06 11:01:17*

---
*Session checkpoint: 2026-07-06 11:06:07*

---
*Session checkpoint: 2026-07-06 11:11:33*

---
*Session checkpoint: 2026-07-06 11:23:08*

---
*Session checkpoint: 2026-07-06 11:38:30*

---
*Session checkpoint: 2026-07-06 11:42:20*

---
*Session checkpoint: 2026-07-06 11:44:41*

---

## Session 42 continued — real 3D models for the whole fleet (STL + Thingiverse) (v0.3.62)

Followed the 3D-model route through: added STL support, sourced real ship meshes,
and wired up 38 of 47 ships as rotatable 3D wireframes.

| Item | Status | File |
|---|---|---|
| Added STL loader (STLLoader) alongside glb/gltf/obj; glob widened to *.{glb,gltf,obj,stl} | DONE | frontend/src/components/ShipView.jsx |
| 3D mount markers restored on the model (procedural bbox placement; hover a slot row -> its marker highlights; click a marker -> opens the slot picker). Rough placement - "tune later" per user | DONE | frontend/src/components/ShipView.jsx |
| Auto lay-flat: rotates each model's thinnest axis to vertical so stood-up print STLs sit level (fixes "spinning like a top") | DONE | frontend/src/components/ShipView.jsx |
| FLIP_UPRIGHT set: rolls 180deg about the length axis for models that land belly-up. Populated with all 38 Kahnindustries ships. MODEL_ROTATION map available for full per-ship overrides | DONE | frontend/src/components/ShipView.jsx |
| Sourced models: Kahnindustries Elite Dangerous set via the Thingiverse API (user supplied a temporary App Token). 38 EDTC ships matched; downloaded the full (non-split) STL each | DONE | frontend/src/ship-models/*.stl |
| Decimated every mesh to ~12k faces (trimesh + fast-simplification) - wireframe only needs low poly. Bundle ~28 MB instead of ~150 MB. Files ~0.6-3 MB each | DONE | frontend/src/ship-models/ |
| Attributions recorded (_ATTRIBUTIONS.txt, CC-BY 3.0, thing ids) | DONE | frontend/src/ship-models/_ATTRIBUTIONS.txt |
| APP_VERSION = 0.3.62; frontend built (38 STL assets), exe rebuilt (50.7 MB), install swapped + relaunched, log clean | DONE | main.py |

### The 9 ships with NO 3D model (still 2D schematic)

Kahnindustries never modelled these (all newer ships): Cobra Mk V (cobramkv),
Corsair (imperial_corsair), Caspian Explorer (explorer_nx), Kestrel Mk II (kestrel),
Mandalay (mandalay), Panther Clipper Mk II (panthermkii), Python Mk II (python_nx),
Type-8 (type_8_transport), Type-11 Prospector (type_11_prospector).
They fall back to the 2D ShipSchematic automatically.

### How the model pipeline works (repro)

- Scratchpad scripts (ephemeral): tv_discover.py (list Kahnindustries things via
  /users/Kahnindustries/things), tv_batch.py (map thing->ship id, download full STL
  via /things/<id>/files -> download_url, decimate, install + attribute).
- Thingiverse API needs a Bearer App Token (create at thingiverse.com/apps/create ->
  Desktop app). The token used this session was the user's and can be revoked.
- To add one of the 9 missing ships later: get any glb/stl/obj, name it <id>.stl
  (ids in _README.txt), drop in frontend/src/ship-models/, add to FLIP_UPRIGHT if it
  lands belly-up, rebuild.

### Notes / next session

- Verify orientation across the fleet: the 180deg flip was applied to all 38 on the
  assumption of a single orientation convention. Spot-check big/odd hulls (Anaconda,
  Corvette, Cutter, Type-9, Krait) - if any is belly-up or nose-wrong, remove it from
  FLIP_UPRIGHT or add a MODEL_ROTATION entry.
- Hardpoint marker placement on 3D models is still rough (bbox-based) - tune later.
- Bundle/exe is ~50 MB now. Fine for GitHub Releases; if it grows, move models out of
  the bundle to a downloaded-on-demand folder next to the exe.
- Decimation target is 12k faces (TARGET_FACES in tv_batch.py); some hulls kept more
  (topology-limited). Raise/lower if wireframes look too rough/dense.
- v0.3.62 still local only - tag for CI release once orientation is confirmed.

---
*Session 42 continued - 2026-07-06*

---
*Session checkpoint: 2026-07-06 11:57:45*

---

## Session 42 continued — 5 newer ships added (Pizza42) → 43/47 in 3D (v0.3.62)

Searched the Thingiverse catalog (API) for the 9 previously-missing ships. Creator
**Pizza42** has 5 of the newer hulls; downloaded + decimated + installed them:
`cobramkv`, `imperial_corsair`, `mandalay`, `python_nx`, `type_8_transport`.

- These 5 are a DIFFERENT creator, so NOT added to `FLIP_UPRIGHT` yet — pending the
  user's orientation eyeball. Add any that render belly-up.
- **4 ships still have no 3D model anywhere** (nobody's modelled the 2024 hulls):
  `explorer_nx` (Caspian Explorer), `kestrel` (Kestrel Mk II),
  `panthermkii` (Panther Clipper Mk II), `type_11_prospector` (Type-11 Prospector).
  They stay on the 2D schematic.
- Now 43/47 ships in 3D; exe 54 MB; batch script `tv_batch2.py` in scratchpad.

---
*Session 42 continued — 2026-07-06*

---
*Session checkpoint: 2026-07-06 12:25:59*

---
*Session checkpoint: 2026-07-06 12:34:14*

---
*Session checkpoint: 2026-07-06 12:37:04*

---

## Session 42 continued — Caspian + Panther via Printables, 3D hardpoint raycasting (v0.3.62)

- **Printables anonymous download works**: their GraphQL `getDownloadLink(printId,id,fileType,source)`
  returns a public `files.printables.com` STL URL with NO login. Pulled the last 2
  obtainable ships (Pizza42, Printables-only): **Caspian Explorer** (`explorer_nx`,
  print 1540081) and **Panther Clipper Mk II** (`panthermkii`, print 1420758).
  Decimated + installed + flipped. **Now 45/47 ships in 3D.**
- **Still unmodelled anywhere**: `type_11_prospector`, `kestrel` (no STL exists on
  Thingiverse/Printables/Cults/Sketchfab yet).
- **3D hardpoint placement reworked** (was bbox-float): `buildWireframe` now also
  builds a merged `raycastMesh` (position-only, same lay-flat/flip transform as the
  wire). `computeMounts3D` raycasts each mount inward onto the hull skin, with
  Y=up / longest-horizontal=length / other-horizontal=width axis mapping, and a
  bbox fallback. Markers now sit on the surface and respect up/down.
- Printables GraphQL enums: `DownloadFileTypeEnum` = stl/gcode/sla/other/pack;
  `DownloadSourceEnum` = model_viewer/model_detail. File id via
  `{ print(id){ stls { id name } } }`.
- exe 55 MB; v0.3.62 local only.

## Notes / next session

- Verify the 2 new ships' orientation (flipped like the other Pizza42 set) and that
  the raycast hardpoint markers sit sensibly across hulls. Tune `HP_ANCHORS` /
  `place()` offsets if a ship's mounts look off.
- If Type-11 / Kestrel models appear later, drop `type_11_prospector.stl` /
  `kestrel.stl` in ship-models, add to FLIP_UPRIGHT if belly-up, rebuild.

---
*Session 42 continued — 2026-07-06*

---
*Session checkpoint: 2026-07-06 12:46:08*

---

## ⚠ TODO — tweak 3D hardpoint marker placement

Hardpoint/utility markers on the 3D models are placed **procedurally** and still
need hand-tuning per ship. They are raycast onto the hull surface, but the *choice*
of where along the hull (and which flank/top) comes from the generic `HP_ANCHORS`
layout + `place()` in `frontend/src/components/ShipView.jsx`, NOT real in-game mount
data (which doesn't exist in the model files). So on some hulls a marker can land in
a spot that isn't the actual weapon hardpoint.

To improve: adjust `HP_ANCHORS` (hull-fraction + cross-section angle per index),
the `place()` length spread (`* 0.82`) / surface nudge, or add per-ship overrides.
Best done with the app open, eyeballing each hull. This is a polish item, not a bug.

---
*Session 42 — 2026-07-06*

---
*Session checkpoint: 2026-07-06 12:50:15*

---
*Session checkpoint: 2026-07-06 15:55:22*

---
*Session checkpoint: 2026-07-06 18:17:00*

---
*Session checkpoint: 2026-07-07 01:09:17*

---
*Session checkpoint: 2026-07-08 00:37:46*

---

## Session 43 — Journal feed killed by startup DB contention + Coriolis-parity Ship Builder (v0.3.64)

### Bug: colonisation not updating AGAIN (different root cause than Session 40)

User delivered to a construction depot; DB depot stayed frozen at yesterday's
57.6% while the journal showed 75.4%. **Not** the rotation bug — the v0.3.59
poll loop never started:

- `_prune_markets` (startup thread) ran one big DELETE over the now-673 MB
  markets table and held the SQLite write lock ~7 s (00:29:17→:24).
- Other threads hit the 5 s `busy_timeout` and logged "database is locked"
  (caught). The journal watcher's `_replay_startup()` also writes to the DB
  (stats/awards/materials/coords) but had NO exception guard — its write
  raised, the exception propagated out of `run()`, and the watcher thread
  died BEFORE the poll loop started. Thread exceptions bypass `sys.excepthook`
  → totally silent in the frozen exe. Feed dead for the whole session.

| Fix | File |
|---|---|
| `_replay_startup()` wrapped in try/except in `run()`; every `_on_event` goes through `_dispatch()` (per-event try/except) in both replay and live tail — a poison event/handler can never kill the feed or stall the file position | `core/journal.py` |
| "journal watcher: live tail started on <file> pos=N" logged when the poll loop starts — a dead feed is now visible in the log | `core/journal.py` |
| `threading.excepthook` installed → any uncaught background-thread exception is logged CRITICAL | `main.py` |
| `busy_timeout` 5000 → 30000 — writers wait out long locks instead of raising | `core/database.py` |
| `prune_markets()` rewritten: collect stale rowids with a read (never blocks in WAL), then DELETE in 5000-row chunks with 50 ms gaps — write lock held ms at a time | `core/database.py` |
| `_prune_markets` delayed 120 s past the startup window | `main.py` |

**Verified:** resilience test (raising handler in replay/live/rotation — feed
survives, events dispatched exactly once); chunked-prune unit test; live: swap
+ relaunch → "live tail started" logged, depot jumped 57.6% → 75.4% instantly
via startup replay (`ColonisationConstructionDepot` is a STARTUP_EVENT).

### Coriolis parity: Ship Builder now shows everything coriolis.io shows

| Item | Status | File |
|---|---|---|
| ships.json: bulkheads (5 grades × mass/cost/hullboost/kin/therm/expl/caus res), pitch/roll/yaw, hardness, masslock, boost_energy, heat_capacity, reserve_fuel for all 47 ships | DONE | `scripts/build_data.py`, `data/ships.json` |
| Engine: bulkhead slot (armour = base × (1+hullboost) + HRP), shield + armour resistances with the game's diminishing-returns stacking (>30% stacked contribution halved, 0.7-multiplier breakpoint), regen/broken-regen times, SCB reserve (cells × reinforcement × duration), MRP module protection (capped 60%), DPS by damage type + EPS + HPS + sustained DPS vs distributor WEP recharge + capacitor drain time, per-weapon list, pitch/roll/yaw × thruster curve, boost-energy vs ENG cap check, per-module power priority (P1-5) + enabled flag (disabled = mass only), power split per priority, fuel_t/cargo_t current-state params, jump_range_current + jump_range_total (successive max-fuel jumps) | DONE | `core/outfitting.py` |
| New engineering labels: DefenceModifierHealthMultiplier→hullboost, ModuleDefenceAbsorption→protection (both PERCENT), RegenRate, BrokenRegenRate, ShieldBank*, DistributorDraw, FSDJumpRangeBoost | DONE | `core/outfitting.py` |
| `compute_build`: passes bulkhead_index/bulkhead_engineering, per-slot priority/enabled, fuel_t/cargo_t | DONE | `main.py` |
| `import_current_build`: maps the Loadout Armour item (…_grade1/2/3/_mirrored/_reactive → bulkhead index 0-4) incl. its engineering; imports per-module `Priority` (0-based → P1-5) and `On` flag | DONE | `main.py` |
| Builder UI: Bulkheads slot (picker shows armour value/mass/cost/res per grade + engineering), sectioned stats panel (Power w/ retracted+deployed bars + per-priority, Summary w/ fuel+cargo sliders driving jump-current, Offence w/ damage-type split bar + sustained/EPS/HPS/drain, Defence w/ shield+armour res grids + effective HP + regen/SCB/MRP/hardness, Movement w/ pitch/roll/yaw + boost check + masslock), per-slot P1-5 cycle + on/off toggle (dims row) | DONE | `frontend/src/pages/Builder.jsx` |

**Verified:** jump-range parity preserved (engine 36.57 vs game 36.5747 on the
live Panther Clipper Mk II import incl. bulkhead + priorities); synthetic
Vulture combat build exercises booster DR stacking (matches manual formula),
reactive-armour res, MRP cap, sustained DPS, disabled-module exclusion,
priority power split. Frontend builds clean.

### Notes / next session

- The DB file is 673 MB (markets/EDDN + coverage). Deletes don't shrink it
  (no VACUUM). Not urgent; a one-time `VACUUM` while EDTC is closed would
  reclaim space if it becomes a problem.
- Blueprint effects table in the engineering editor (uncommitted from last
  session) shipped in this build too.
- From-scratch bulkhead engineering uses blueprint multipliers (approximate);
  imported armour engineering is exact (game modifiers).
- ~~v0.3.64 is local only~~ — **v0.3.64 tagged + released via CI 2026-07-08**
  after the user confirmed the new Builder panels in-app.

---
*Session 43 — 2026-07-08*

---
*Session checkpoint: 2026-07-08 01:27:30*

---
*Session checkpoint: 2026-07-08 01:32:57*

---
*Session checkpoint: 2026-07-08 02:01:07*

---
*Session checkpoint: 2026-07-10 00:01:53*

---
*Session checkpoint: 2026-07-10 00:04:37*

---
*Session checkpoint: 2026-07-10 00:06:47*

---
*Session checkpoint: 2026-07-10 00:09:34*

---
*Session checkpoint: 2026-07-10 00:12:40*

---
*Session checkpoint: 2026-07-10 00:31:46*

---
*Session checkpoint: 2026-07-10 00:33:38*

---
*Session checkpoint: 2026-07-10 00:37:05*

---
*Session checkpoint: 2026-07-10 00:37:36*

---
*Session checkpoint: 2026-07-10 00:39:39*

---
*Session checkpoint: 2026-07-10 00:41:16*

---
*Session checkpoint: 2026-07-10 00:43:56*

---
*Session checkpoint: 2026-07-10 00:45:08*

---
*Session checkpoint: 2026-07-10 00:45:54*

---
*Session checkpoint: 2026-07-10 00:59:57*

---
*Session checkpoint: 2026-07-10 01:05:36*

---

## Session 44 — Exobiology overhaul (v0.3.65, local)

Rebuilt the whole exobiology feature set. **Root-cause bug fixed:** `ScanOrganic`
`ScanType` is `Log`/`Sample`/`Analyse`, NOT `"Analysed"` — the old code counted
`== "Analysed"`, which never matched, so every exo tracker sat at 0/3 forever.
Confirmed against the user's real journals. This was the long-flagged
"Logged vs Analysed" issue across sessions 2–7; now resolved.

### Data foundation
| Item | File |
|---|---|
| `data/exobiology.json` — 22 genera, 119 species: Vista Genomics base values, per-genus clonal colony ranges, and per-species occurrence conditions (atmosphere/gravity/temp/body-type/volcanism) | `data/exobiology.json` |
| Source: EDMC-BioScan rulesets (github.com/Silarn/EDMC-BioScan) + community colony ranges. Concha Biconcavis 0xFFFFFF sentinel patched to 19,010,800 | — |
| Reproducible fetch+transform script (downloads rulesets from raw GitHub, regenerates JSON) | `scripts/build_exobiology.py` |
| `core/exobiology.py` — data loader + lookup maps, `predict()` (ruleset matcher), `surface_distance()` (haversine) | `core/exobiology.py` |

### Backend (main.py / core)
| Item | File |
|---|---|
| `_handle_scan_organic` rewritten: Log→1, Sample→2, Analyse→3; attaches value + required colony distance; records sample lat/lon for the distance helper | `main.py` |
| Sample-distance helper: `_read_surface_position()` (Status.json Latitude/Longitude/PlanetRadius) + `_exo_distance_loop()` daemon → emits `exo_distance` {distance, required, clear} to overlay + main window every 1 s while sampling | `main.py` |
| `_handle_sell_organic` (SellOrganicData → `exo_sales` table; Bonus = 4× base = first-logged 5× total) | `main.py`, `core/database.py` |
| `_handle_saa_signals` (DSS `Genuses[]` → confirmed genera + predictions) + `_handle_fss_body_signals` (FSS bio count → predicted candidates) | `main.py` |
| `_handle_scan` now caches landable-body params (atmosphere/gravity_g/temp/volcanism/class) for prediction; caches cleared on FSD jump | `main.py` |
| `exo_scans` migration: `value`, `body_name` columns. New `exo_sales` table + `record_exo_sales`/`get_exo_sales`/`get_exo_sales_summary`/`get_completed_exo_scans` | `core/database.py` |
| API: `get_exobiology_data`, `predict_species`, `get_body_bio`, `get_exo_sales`, `get_exo_sales_summary`, `get_exo_carried_value`, `get_completed_exo_scans` | `main.py` |
| `SAASignalsFound`, `FSSBodySignals` added to WATCHED_EVENTS | `core/journal.py` |

### Frontend
| Item | File |
|---|---|
| Exobiology tab rebuilt as 3 sub-tabs — **Tracker** (live distance meter + bio-signal bodies w/ confirmed/predicted species + values + carried unsold value + sampling progress), **Value Reference** (genus browser: value range, colony distance, conditions chips, search/sort — the target-hunting view), **Earnings** (Vista totals, first-logged bonus, carrying, recent sales) | `frontend/src/pages/Exploration.jsx` |
| Sampling progress filters out pre-fix 0/3 stale rows (`scan_count >= 1`) | `frontend/src/pages/Exploration.jsx` |
| ExoTracker overlay gains a live distance bar (`exo_distance`) | `frontend/src/overlays/ExoTracker.jsx` |
| exo_tracker overlay height 200→280 for the distance bar | `core/overlay.py` |

### Verified
- Backend E2E harness (throwaway DB): Log/Sample/Analyse → 1/2/3 + value + required distance; DB persistence; SellOrganicData → summary (base/bonus/first-logged); carried-value logic; SAA → confirmed genera + predictions (top = Stratum Tectonicas, the species actually sampled on that body); haversine sane.
- Prediction validated against a real body scan (Dryooe Flyou JO-E c26-128 C 2): correctly surfaced Stratum Tectonicas as top candidate.
- Built exe, swapped install, launched v0.3.65: clean startup, live tail, DB migration applied (value/body_name cols + exo_sales table), all 3 sub-tabs render (screenshots), stale 0/3 rows gone.

### Notes / next session
- **v0.3.65 is LOCAL ONLY** — tag for CI release once the user confirms in-app, especially the live sample-distance overlay, which could only be code/math-verified this session (needs a planetside sampling run to confirm end-to-end; game was in space).
- Prediction intentionally ignores star-type/region/pressure constraints (we don't always have parent star/region) — it over-lists rather than hiding real candidates. Confirmed genera from a DSS map are exact; FSS-only bodies show predicted candidates.
- `exo_sales` only records sales made with EDTC running (no journal backfill) — Earnings starts empty and fills going forward.
- Carried-unsold value matches completed scans against later sales by species name — approximate (can't tie a specific sample to a specific sale).

### Per-interceptor Thargoid kill awards (v0.3.66)

Added four new Commendations under **Thargoid War**, one per interceptor type,
because the journal `Statistics` event only carries a single total
(`TG_ENCOUNTER_KILLED`) with no per-type breakdown.

| Item | File |
|---|---|
| `thargoid_kills` table (type → count) + `add_thargoid_kill`/`get_thargoid_kills`/`set_thargoid_kills` | `core/database.py` |
| `FactionKillBond` added to WATCHED_EVENTS; `_handle_faction_kill_bond` classifies Thargoid bonds by exact reward value and increments the DB, then re-evaluates awards | `main.py`, `core/journal.py` |
| `_backfill_thargoid_kills` — one-time scan of all journals (pref-guarded), tallies past bonds so awards reflect history; live tail counts new bonds with no overlap | `main.py` |
| `thargoid_kills` added to `_assemble_award_data` | `main.py` |
| Four awards: Cyclops Slayer 👁️, Basilisk Bane 🦎, Medusa's End 🪼, Hydra Hunter 🐉 | `core/awards.py` |

**Reward → type mapping (exact-value, CMDR-confirmed against their kill history):**
`8,000,000 → cyclops · 24,000,000 → basilisk · 40,000,000 → medusa · 60,000,000 → hydra`.
Deliberately excluded per the CMDR: Hunter (4.5M), pre-adjustment Cyclops (6.5M)
and Basilisk (20M), scouts (65k–80k), and a stray 1M bond. **These count combat
bonds (one per heart), not whole-ship kills** — an interceptor drops 3–6 bonds.

**Verified:** backfill on the real DB produced Cyclops 73 / Basilisk 27 / Medusa 57
/ Hydra 1 (matches a standalone journal tally); awards evaluate to Gold/Gold/Gold/
Bronze; all four render in the Commendations page (screenshot).

- If Thargoids return with different bond values, `_THARGOID_BOND_TYPE` in main.py
  needs the new values added (exact-match, so unknown values are ignored, not
  miscounted).

---
*Session 44 — 2026-07-11 (v0.3.66 local)*

---
*Session checkpoint: 2026-07-10 23:24:12*

---
*Session checkpoint: 2026-07-11 00:31:25*

---
*Session checkpoint: 2026-07-11 00:32:05*

---
*Session checkpoint: 2026-07-11 00:36:00*

---
*Session checkpoint: 2026-07-11 00:42:00*

---
*Session checkpoint: 2026-07-11 00:45:30*

---
*Session checkpoint: 2026-07-11 00:58:09*

---
*Session checkpoint: 2026-07-11 00:59:49*

---
*Session checkpoint: 2026-07-11 01:05:19*

---
*Session checkpoint: 2026-07-11 01:18:10*

---
*Session checkpoint: 2026-07-11 01:19:36*

---

## PLANNED — Mining tab (next session)

A new **Mining** page (sidebar), scoped as its own session (comparable size to
the exobiology work). Two tools, modelled on these community sites:

- **Mining tool** — model: https://edtools.cc/miner (CMDR VicTic, v1.5).
  Input: current system + target commodity (platinum, painite, LTDs, void opals,
  tritium, etc.). Output: best hotspot rings (with ring type/reserve) sorted by
  distance, and best sell stations sorted by price/demand. Plus a **live session
  tracker** from the journal: prospected asteroids, refined tonnage, cr/hr,
  cargo fill.
- **Merit tool** — model: https://meritminer.cc/ (the interactive one).
  Powerplay-2.0 merit mining: pick Power + goal (acquire/reinforce/undermine) +
  commodity + ring type/reserve/age + radius (≤200 ly) + pad size/system-state
  filters → systems where the commodity spawns in hotspots AND a station buys it
  for your Power, with merits/tonne. Live EDDN market status shown.
- **Powerplay reference** — https://edtools.cc/pp returned 404 on fetch; verify
  the real path (maybe needs a system param or is /powerplay) before relying on it.

### Data / integration notes (what EDTC already has)
- **Spansh** integration exists: `api/spansh.py` (`commodity_markets` POST,
  nearest-service search) and `SpanshAPI` — reuse for sell-station lookup.
- **Local EDDN market cache** exists: `core/database.py` `search_local_markets`,
  `upsert_market_data`; live ZMQ listener `_eddn_listener` in main.py. Good for
  live sell prices without hitting Spansh.
- **Hotspot/ring data** is the gap — edtools/meritminer use their own hotspot
  datasets. Options to research: Spansh `/rings` or bodies dump, the community
  "hotspot" CSV, or EDSM/Canonn. Pick a source the next session can fetch +
  bundle (like scripts/build_data.py does), or query live.
- **Journal events for the live tracker**: `MiningRefined` (already WATCHED +
  handled), plus add `ProspectedAsteroid` (per-asteroid material %), maybe
  `AsteroidCracked`, and use existing `Cargo`/`Cargo.json`. Merits: Powerplay
  merit gains come from `Powerplay` / delivery events — check the journal for
  what actually reports merit deltas (may need a `PowerplayMerits` event).
- **Powerplay**: EDTC already has a Powerplay tab in Galaxy (`get_powerplay_status`,
  `get_system_power`, `api/edsm.py`) — reuse power/pledge data.

### Scope reminder
Full new page + overlay + backend handlers + data sourcing + build + screenshot
verify. Start it fresh; read this section first.

---
*Session checkpoint: 2026-07-11 01:24:25*

---
*Session checkpoint: 2026-07-11 01:25:09*

---

## Session 45 — Mining tab (v0.3.67, local)

Built the planned Mining page (see the PLANNED section above): hotspot finder
(edtools.cc/miner model), Powerplay merit miner (meritminer.cc model), live
session tracker, and a mining overlay.

### Data source resolution (the open question from the plan)
**Spansh covers everything — no bundled hotspot dataset needed.**
- `POST /api/bodies/search` with `{"ring_signals": [{"name": <commodity>}]}`
  returns bodies whose rings have that hotspot, with `rings[].signals`
  (name+count), ring `type`, body `reserve_level`, `distance`,
  `distance_to_arrival`, AND `system_controlling_power` + `system_power_state`
  — the power fields make the merit tool possible with the same endpoint.
- **`{"ring_type": {"value": [...]}}` is silently IGNORED** by /bodies/search.
  The working ring-type filter is `{"rings": [{"type": "Metallic"}]}`
  (verified: bogus type → count 0). It matches *bodies* having a ring of that
  type, so `search_ring_hotspots` re-applies the type narrowing per-ring.
- `reserve_level` / `system_controlling_power` / `system_power_state` use the
  `{"value": [...]}` shape on both bodies and stations search (verified live).
- Sell prices: `POST /api/stations/search` with per-commodity demand filter
  `{"market": [{"name": X, "demand": {"comparison": ">=", "value": [lo, hi]}}]}`
  and price sort `[{"market_sell_price": [{"name": X, "direction": "desc"}]}]`.
- edtools.cc/pp was 404 in planning; never needed — Spansh power fields cover it.

| Item | Status | File |
|---|---|---|
| `ring_hotspots()` + `mining_sell_stations()` (all filter shapes verified live) | DONE | `api/spansh.py` |
| `ProspectedAsteroid`, `AsteroidCracked`, `PowerplayMerits` added to WATCHED_EVENTS | DONE | `core/journal.py` |
| `MiningRefined` was watched but never dispatched — now handled (session tracker) | DONE | `main.py` |
| Mining session state + handlers (`_handle_mining_refined/_prospected_asteroid/_asteroid_cracked/_powerplay_merits`), `_mining_payload()`, `_push_mining()` | DONE | `main.py` |
| `PowerplayMerits` also persists pp_power/pp_merits prefs + emits `merits_update` | DONE | `main.py` |
| API: `search_ring_hotspots`, `search_mining_sell`, `get_mining_session`, `reset_mining_session` | DONE | `main.py` |
| `Mining.jsx` — 3-tab page (Hotspot Finder / Merit Miner / Session Tracker), sidebar entry after Trading | DONE | `frontend/src/pages/Mining.jsx`, `App.jsx` |
| Merit Miner: goal presets (Reinforce = your power's systems, Undermine = rival powers, Acquire = Unoccupied), client-side join of hotspot systems × buyer stations → "mine & sell in the same system" table | DONE | `frontend/src/pages/Mining.jsx` |
| `mining` overlay (tons, T/hr, refined breakdown, last prospect, merits) + config + auto-resize | DONE | `frontend/src/overlays/Mining.jsx`, `core/overlay.py`, `Overlays.jsx`, `App.jsx` |
| Session value estimates use `average_price` from data/commodities.json | DONE | `main.py` |

### Session tracker semantics
- Session starts on the first ProspectedAsteroid / MiningRefined /
  AsteroidCracked after launch (or reset) — in-memory only, resets on restart.
- `PowerplayMerits` gained while a session is live count toward the session
  merit tally (merits with no live session are ignored by the tracker but
  still update the pp_merits pref + Galaxy Powerplay tab).
- MiningRefined has no tonnage field — each event = 1 tonne (correct: it
  fires once per refined tonne).

### Verified
- E2E harness (scratchpad test_mining.py): synthetic Log→refined/prospected/
  cracked/merit events → payload correct (content split, motherlode tally,
  avg-price values, pre-session merits ignored, reset). Live Spansh: ring
  search near Sol returns Delkar (2× Pt Metallic Pristine) nearest — matches
  edtools; power-filtered searches return only Kaine-space results.
- CMDR's power auto-detected from journal PowerplayMerits (Nakato Kaine).

### Notes / next session
- ~~v0.3.67 is LOCAL ONLY~~ — **v0.3.67 tagged + pushed for CI release
  2026-07-11** after the user confirmed the Mining page in-app. A real mining
  run hasn't exercised the session tracker/overlay live yet (code-path is
  harness-verified) — worth a look after the CMDR's next mining trip.
- Merit miner shows merits context but NOT merits/tonne numbers — FDev doesn't
  publish the formula (scales with sale value). The session tracker measures
  actual merits/hr live instead.
- Acquire goal lists Unoccupied-state systems but can't validate acquisition
  range (needs the power's Stronghold/Fortified sphere math) — caveat shown in UI.
- Hotspot data only exists for rings players have DSS-scanned (noted in UI).
- Undermine goal passes the 11 rival powers server-side; the POWERS list in
  Mining.jsx is the PP2.0 roster (Jerome Archer, no Zachary Hudson) — the
  older POWERS table in Galaxy.jsx still has Hudson and lacks Archer.
- Latent bug spotted (not fixed, separate concern): Trading.jsx and some
  Galaxy.jsx listeners read `e?.payload?.X` but `__edtc.on` handlers receive
  the payload directly — e.g. Trading's `system_changed` listener always sets
  currentSystem to ''. Mining.jsx uses the correct form.

---
*Session 45 — 2026-07-11 (v0.3.67 local)*

---
*Session checkpoint: 2026-07-11 17:00:25*

---
*Session checkpoint: 2026-07-11 17:02:21*

---
*Session checkpoint: 2026-07-11 17:05:18*

---
*Session checkpoint: 2026-07-11 18:48:54*

---
*Session checkpoint: 2026-07-11 18:54:18*

---

## Session 46 — event-listener payload fix + PP2.0 roster in Galaxy

Fixed the latent bug flagged in Session 45: `window.__edtc.on` handlers receive
the **payload directly** (see `main.jsx` — `handlers.forEach(fn => fn(event.payload))`),
but five listeners read `e?.payload?.X` and therefore always got `undefined`.

| Fix | File |
|---|---|
| `system_changed` listener set currentSystem to `''` on every jump | `frontend/src/pages/Trading.jsx` |
| `system_changed` listener (same bug) | `frontend/src/pages/Galaxy.jsx` |
| `powerplay_update` listener wiped Powerplay status to `{}` on live update | `frontend/src/pages/Galaxy.jsx` |
| `scan_update` listener cleared the Session Scanner body list on every scan | `frontend/src/pages/Exploration.jsx` |
| `system_changed` listener (same bug) | `frontend/src/pages/Exploration.jsx` |
| POWERS table updated to PP2.0 roster: Zachary Hudson → Jerome Archer (Federation, Nanomam — also fixed "Nanoman" typo), Nakato Kaine added (Alliance, Tionisla). Now 12 powers, matching Mining.jsx | `frontend/src/pages/Galaxy.jsx` |

Notes: the Session 45 note only flagged Trading + Galaxy, but Exploration.jsx had
two more instances of the same bug — all five sites fixed. Archer/Kaine "perk"
column uses PP2.0 pledge bonuses (bounty/mining profit) since PP2.0 modules are
no longer power-exclusive. Frontend builds clean.

---
*Session 46 — 2026-07-11*

---
*Session checkpoint: 2026-07-11 19:03:58*

---
*Session checkpoint: 2026-07-11 19:17:24*

---
*Session checkpoint: 2026-07-11 19:17:30*

---
*Session checkpoint: 2026-07-11 19:17:44*

---
*Session checkpoint: 2026-07-11 19:19:55*

---
*Session checkpoint: 2026-07-11 19:22:21*

---
*Session checkpoint: 2026-07-11 19:23:38*

---
*Session checkpoint: 2026-07-11 19:25:14*

---
*Session checkpoint: 2026-07-11 19:26:43*

---
*Session checkpoint: 2026-07-11 19:33:37*

---
*Session checkpoint: 2026-07-11 19:38:41*

---
*Session checkpoint: 2026-07-11 19:40:13*

---
*Session checkpoint: 2026-07-11 19:40:52*

---
*Session checkpoint: 2026-07-11 19:41:03*

---
*Session checkpoint: 2026-07-11 19:41:27*

---
*Session checkpoint: 2026-07-11 19:42:10*

---
*Session checkpoint: 2026-07-11 19:44:26*

---
*Session checkpoint: 2026-07-11 19:45:53*

---
*Session checkpoint: 2026-07-11 19:46:54*

---
*Session checkpoint: 2026-07-11 19:47:46*

---
*Session checkpoint: 2026-07-11 19:48:04*

---
*Session checkpoint: 2026-07-11 19:49:03*

---
*Session checkpoint: 2026-07-11 19:49:17*

---
*Session checkpoint: 2026-07-11 19:51:44*

---
*Session checkpoint: 2026-07-11 19:54:49*

---
*Session checkpoint: 2026-07-11 19:56:23*

---
*Session checkpoint: 2026-07-11 20:00:15*

---
*Session checkpoint: 2026-07-11 20:02:33*

---
*Session checkpoint: 2026-07-11 20:04:20*

---
*Session checkpoint: 2026-07-11 20:04:28*

---
*Session checkpoint: 2026-07-11 20:04:59*

---
*Session checkpoint: 2026-07-11 20:05:10*

---
*Session checkpoint: 2026-07-11 20:05:18*

---
*Session checkpoint: 2026-07-11 20:05:42*

---
*Session checkpoint: 2026-07-11 20:05:53*

---
*Session checkpoint: 2026-07-11 20:06:04*

---
*Session checkpoint: 2026-07-11 20:06:13*

---
*Session checkpoint: 2026-07-11 20:06:23*

---
*Session checkpoint: 2026-07-11 20:06:45*

---
*Session checkpoint: 2026-07-11 20:06:52*

---
*Session checkpoint: 2026-07-11 20:07:08*

---

## PLANNED — Overlay overhaul: SrvSurvey parity (next session)

Live observation session 2026-07-11: watched the CMDR run a full exobiology
trip (station → 63-jump route → FSS → DSS → land → sample 2 species to 100%)
with SrvSurvey overlays active, screenshotting each overlay state. Reference
screenshots: `docs/srvsurvey_reference/*.png` (16 images, named by state).
Goal: rebuild EDTC's overlays to show the same information.

### Observed overlays (in trigger order)

1. **Jump overlay** (`jump_overlay.png`) — draws top-center during hyperspace.
   Next-system name + star class (colour-coded); "#2 of 63" route progress bar
   with one tick per jump and arrow at current position + total ly remaining;
   "Discovered by <cmdr> <date> / Last updated"; traffic 24h/week/ever (EDSM);
   body count. → Upgrade EDTC `Route` overlay: NavRoute list + StartJump
   StarClass + EDSM system/traffic lookups (all already available).
2. **Station info** (`station_info.png`) — on docking approach. Station name,
   type (Dodec Starport), pad size ✓, economy shares (%), controlling faction
   + Inf% + rep, services list, "Data: Spansh + updated date". → New overlay
   candidate; Docked event + Spansh station data (client exists).
3. **FSS system summary** (`fss_system_summary.png`, `fss_summary_with_bio.png`)
   — persistent left panel. System name + ✔ when 100% scanned; "Scanned N
   bodies: X CR" total; per-body lines "3 - High metal content body 🌿
   33.29 K | 200,113 | 2 Genus" = FSS value | DSS value | genus count, sorted
   by value, "(Hiding bodies < 10 K CR)" filter; flag = undiscovered; icons
   for terraformable/landable; green row = DSS'd. → Upgrade EDTC `fss`
   overlay: all fields derivable from Scan events (WasDiscovered/WasMapped/
   TerraformState/Landable) + existing value estimator.
4. **Bio signals panel** (`bio_signals_panel.png`) — after FSS, persists
   outside FSS mode. "Bio signals: 4" system total; per-body genus icon chips
   + predicted max value ("3 [chips] 20.7 M"); "Rewards: 41.4 M" system total.
   → core/exobiology.py predict() already computes species+values; needs
   per-body value rollup emitted to overlay.
5. **Approach body card** (`approach_body_card.png`) — on ApproachBody.
   Body name + "(⚑ Undiscovered)"; scan value; temp/gravity/pressure;
   "Bio signals: 2 (value 20.7 M cr)"; volcanism; atmosphere composition;
   full surface materials table with rare mats (Niobium/Molybdenum/Yttrium)
   bolded. → Scan event has all of this incl. Materials[].
6. **Bio tracker strip** (`bio_tracker_pre_sampling.png` → `sampling_active_
   ff_value.png` → `tracker_one_species_done.png` → `tracker_body_complete.png`)
   — top-center on planet. States: (a) genus list "Bacterium|500m Stratum|500m"
   (genus + colony distance) + "Analyzed: 0" + body progress bar %;
   (b) active sampling: 3 big sample dots + species/variant name + value
   ("95.05 M CR (FF bonus)" = 5× when WasLogged false/first footfall) +
   distance-since-last-sample bar scaled to colony range; (c) species done:
   strikethrough in genus list; (d) body done: "All signals scanned with FF
   bonus applied" + 100%.
7. **Sample-distance radar** (`sample_radar_inside_zone.png`,
   `sample_radar_two_zones.png`) — right side, on foot/SRV. Top-down minimap:
   green hatched circle per sample = colony exclusion zone (terrain-anchored,
   scrolls as you move), crosshair = you; header "Ship: 41m · SRV: 41m" live
   distances; footer "1st: 1.84km · 2nd: 1.16km" per-sample distances.
   → EDTC has Status.json lat/lon/heading + PlanetRadius + sample positions
   (session 44 groundwork); needs a canvas minimap in ExoTracker overlay.
8. **Body bio panel** (`species_predictions.png` → `species_confirmed_
   sampling.png` → `species_one_done.png` → `panel_body_complete.png`) —
   bottom-left. Per-species lifecycle styling: predicted = "?Cerbrus:?Teal"
   orange with ?s; confirmed+sampling = green highlight bars, ?s dropped;
   complete = strikethrough + dimmed. Shows value per species, "Rewards:
   20.7 M" + "(FF bonus: 104 M)". Predictions were EXACT both times
   (Stratum Tectonicas Green 19.01M, Bacterium Cerbrus Teal 1.69M).

### Key data points from the live run

- ScanOrganic sequence is **Log → Sample → Sample → Analyse** (4 events; the
  3rd scan emits a second "Sample", then "Analyse" auto-fires ~5 s later).
  Verify `_handle_scan_organic` counts this as 1→2→2→3, not 4 scans.
- First-footfall bonus: SrvSurvey shows base × 5 when `WasLogged: false`
  (labelled "FF bonus"); body totals shown both ways (20.7 M / 104 M).
- Colony ranges shown per genus in-strip (Bacterium 500m, Stratum 500m) —
  matches data/exobiology.json clonal ranges.
- SrvSurvey species/variant prediction from body params was exactly right on
  both species — our predict() (same BioScan rulesets) should match.

### Suggested build order

1. ExoTracker overlay rebuild (tracker strip states + body bio panel styling
   + FF bonus math) — biggest win, all data already flows.
2. Sample-distance radar minimap (needs sample lat/lon history + canvas).
3. FSS overlay upgrade (value pairs, filters, undiscovered flags, genus count).
4. Route overlay upgrade (tick progress bar + EDSM enrichment on StartJump).
5. Station info overlay (new; Docked + Spansh).
6. Bio signals system panel (predict() rollup after FSSBodySignals).

---
*Observation session complete — 2026-07-12*

---
*Session checkpoint: 2026-07-11 20:10:30*

---

## Session 46/47 wrap-up — READ THIS FIRST NEXT SESSION

**State: ALL CHANGES UNCOMMITTED** (session ended near token limit):

1. **Session 46 fixes (done, verified, builds clean, NOT committed):**
   - 5 event-listener payload bugs fixed (`e?.payload?.X` → payload direct):
     Trading.jsx, Galaxy.jsx ×2, Exploration.jsx ×2 (see Session 46 entry)
   - Galaxy.jsx POWERS → PP2.0 roster (Hudson→Archer, +Kaine, Nanomam typo)
   - `npm run build` passed; NOT yet version-bumped/released/exe-swapped
2. **`docs/srvsurvey_reference/` — 16 new screenshot files, untracked.**
3. **HANDOFF.md — Session 46 entry + PLANNED SrvSurvey-parity spec (above).**

**Next session, in order:**
1. Commit everything (payload fixes + roster + docs + HANDOFF).
2. Verify `_handle_scan_organic` handles Log→Sample→Sample→Analyse (4 events,
   3 scans, live-confirmed) — see Key data points above.
3. Start the PLANNED overlay overhaul, build order in the spec (ExoTracker
   rebuild first). Read the spec + docs/srvsurvey_reference images first.
4. Version bump + release when user confirms in-app.

---
*Session 47 (observation) complete — 2026-07-12*

---
*Session checkpoint: 2026-07-11 20:13:33*

---
*Session checkpoint: 2026-07-11 23:47:30*

---

## Session 47 — Overlay overhaul: SrvSurvey parity (v0.3.68, local)

Executed the PLANNED spec (all 6 items) in the build order it prescribed.
Every step harness-verified against the real 2026-07-11 journal (55 checks,
scratchpad test_exo_body.py) and screenshot-verified per overlay state.

| Item | What shipped |
|---|---|
| 1. ExoTracker rebuild | Signals/Analyzed header + progress bar; genus chips w/ colony distances (struck when done); sampling card: 3 dots + variant + FF 5x value + distance bar; species lifecycle panel (predicted ?s orange / sampling green / done struck) + Rewards + FF totals |
| 2. Sample radar | Canvas minimap in ExoTracker: exclusion circle per sample (heading-up, terrain-anchored), player crosshair, ship distance (Touchdown lat/lon, cleared Liftoff/LeaveBody/jump), per-sample footer |
| 3. FSS overlay | Frontier value formula (k + k*q*m^0.2; 2.6x first-discovery; first-map mults; Odyssey +30%; x1.25 at efficient SAAScanComplete) — matches SrvSurvey to the credit; stars included, belts skipped, dedup; FSS \| DSS \| genus rows, green when mapped, <10K filter, undiscovered flags |
| 4. Route overlay | StartJump (Hyperspace) -> jump_info: name + colour-coded class instantly, EDSM discovery/traffic/bodies enrichment in background (get_bodies_raw added); #N of M tick bar; remaining ly from NavRoute StarPos coords |
| 5. Station info | New station_info overlay: DockingGranted shows card + Spansh stations_near enrichment; Docked = authoritative (economies %, pads, services mapped, DistFromStarLS); faction Inf%/Rep from cached FSDJump/Location Factions[]; hides 30s after dock / on Undocked |
| 6. Bio signals panel | New bio_signals overlay: system rollup — per-body genus chips + predicted value + Rewards total; _body_species_rows() shared with the body tracker; clears+hides on jump |

### Key facts locked down this session
- **ScanOrganic**: `Variant_Localised` + **`WasLogged`** are in the event —
  WasLogged=false → 5x first-logged value. Log→Sample→Sample→Analyse maps
  1→2→2→3 via the ScanType dict (verified, no 4-scan bug).
- **Exploration values**: verified constants — HMC k=9654 (+100677 TF),
  rocky 300 (+93328), WW/ELW 64831 (+116295), ammonia 96932, metal-rich
  21790, GG I 1656, GG II 9654; stars k=1200 (D* 14057, N/H 22628),
  value = k + M*k/66.25. First-map x3.6996 (both firsts) / x3.2917 (map
  only) / x3.3333; Odyssey +30%; efficiency x1.25 only when
  ProbesUsed <= EfficiencyTarget.
- **New watched events**: ApproachBody, Touchdown, Liftoff, LeaveBody,
  StartJump, DockingGranted.
- **Overlay auto-resize** now skips no-op resizes (_last_size) — exo
  distance ticks at 1/s would have spammed resize/log otherwise.
- New overlays keyed `station-info`, `bio-signals`; OVERLAY_MAP in App.jsx,
  toggles in Overlays.jsx.

### State
- 6 commits pushed to main; **v0.3.68 built locally + installed**
  (C:\Users\Keagan\AppData\Local\EDTC\EDTC.exe), startup log clean,
  frozen=True, correct DB, live tail running.
- **NOT tagged for CI release yet** — tag v0.3.68 once the CMDR confirms
  the overlays in-game (esp. radar + station card, which only ran against
  synthetic/replayed data this session).

### Next session
- Tag + release after in-app confirmation.
- Watch for: station_info Spansh field names (economies/pads shapes are
  defensive best-guess), radar scale feel on foot, FSS overlay row cap (12).

---
*Session checkpoint: 2026-07-12 00:10:06*

---
*Session checkpoint: 2026-07-12 00:11:56*

---
*Session checkpoint: 2026-07-12 00:13:14*

---
*Session checkpoint: 2026-07-12 00:15:05*

---
*Session checkpoint: 2026-07-12 09:46:57*

---

## Session 48 — Route overlay: FSD-engagement-only + Clear route (v0.3.69, local)

User feedback: route overlay always showed a stale route from old testing, and
there was no way to clear a route in the app. Also removed System Preview
overlay (the upgraded route/jump overlay covers it).

| Item | What shipped |
|---|---|
| Route overlay lifecycle | Shows on StartJump (Hyperspace) when enabled, `hide_after(10s)` on FSDJump arrival, `cancel_hide` on back-to-back jumps. Enabling in Overlays arms it without showing (`toggle(show_on_enable=False)`). NavRoute/set_active_route no longer show it. |
| **Stale-route root cause** | `_handle_nav_route` saved in-game routes WITHOUT `active=1` — an old manually-activated route kept `active=1` forever and reloaded every launch. Now: `clear_active_route()` + save with `active: 1`. |
| Clear route | New `clear_active_route()` API + DB fn (`UPDATE routes SET active=0`); red "Clear route" button in Navigation active-route panel; `_handle_nav_route_clear` (in-game NavRouteClear) now also clears the DB flag + hides the overlay. |
| Payload bug #6 | Navigation.jsx `route_update` listener read the `{route, current_system}` wrapper as the route itself (Session 46 family). Fixed; FSDJump route advance now also `_emit`s to the main window so the Navigation panel updates live. |
| Jump card staleness | `_last_jump_info` stored/re-pushed by `_push_route_to_overlay` (fresh-window seed), cleared on arrival; Route.jsx drops the jump card when `route_update.current_system` matches it. |
| System Preview removed | Deleted from OVERLAYS (core/overlay.py), main.py handlers/name lists, Overlays.jsx, App.jsx OVERLAY_MAP; SystemPreview.jsx deleted. |
| Pref-load bug | `station_info`/`bio_signals` were missing from `_load_overlay_opacities` + `get_overlay_states` name lists — their enable prefs never loaded at startup. Fixed. |

### Verified
- Harness (scratchpad test_route_lifecycle.py, 20/20): NavRoute doesn't show
  overlay + activates in DB; StartJump cancel_hide→show→jump_info + delayed
  re-push; FSDJump advances/persists/emits both sides/schedules hide/clears
  jump card; clear_active_route hides + DB active=0; disabled overlay never shows.
- `npm run build` clean; py_compile clean; v0.3.69 built locally, installed,
  running (frozen=True, correct DB), code pushed to main (c97d37a).

### State / next session
- CMDR confirmed the route overlay in-game — **v0.3.69 tagged + pushed for CI
  release 2026-07-12**.
- The old stale test route may still be active in the prod DB — one click of
  the new "Clear route" button in Navigation removes it for good.
- Still open from Session 47: radar scale feel on foot. (FSS overlay and
  station_info both confirmed fine in-game 2026-07-14 — no longer open items.)

---
*Session 48 — 2026-07-12 (v0.3.69 local)*

---
*Session checkpoint: 2026-07-12 10:26:15*

---
*Session checkpoint: 2026-07-12 10:29:54*

---
*Session checkpoint: 2026-07-12 10:40:57*

---

## Session 48 (cont.) — Blueprints tab cleanup (v0.3.70, local)

User: "the stuff we can synthesise in our ship is mixed in with the engineering
blueprints." Root cause: EDEngineer's blueprints.json lists synthesis recipes
(engineers = `@Synthesis`, 65 entries) and Odyssey suit/weapon gear
(`@Merchant`, 15) alongside real ship engineering.

- `data/blueprints.json` filtered 240 → **160** (kept only entries with ≥1
  real engineer; verified all 160 are ship modules, 38 module types).
- `scripts/build_data.py` `build_blueprints()` applies the same filter on
  future regens.
- Nothing lost: the Synthesis tab has its own dataset (synthesis.json); the
  dropped EDEngineer synthesis set is regenerable if ever wanted (it's more
  granular — per-weapon munitions — could upgrade synthesis.json someday).
- Carries over: the Ship Builder blueprint picker reads the same file/API, so
  it's clean too. Pins referencing removed ids drop gracefully (null join).
- User confirmed the Blueprints tab in-app — **v0.3.70 tagged + pushed for CI
  release 2026-07-12**.
- Deferred ideas for the Builder-polish session (from this session's recon):
  filter Builder's blueprint picker by the slot's module type (`applies_to`),
  per-grade craftable ✓ from materials in the Builder editor, experimentals
  dataset (free-text today), engineer unlock status in the editor footer,
  "pin all engineering in this build" → Pinned shopping list.

---
*Session 48 (cont.) — 2026-07-12 (v0.3.70 local)*

---
*Session checkpoint: 2026-07-12 10:42:23*

---
*Session checkpoint: 2026-07-12 10:45:26*

---

## Session 48 (cont. 2) — Ship Builder module-data polish (v0.3.71, local)

User: "ship builder seems to be missing components, some things have wrong
info — I can't tell if my weapons are gimballed/fixed/turreted."

### Root causes found (data audit vs journals + EDSY)
- Mount type existed in modules.json (`mount: F/G/T`) but fitted slot rows
  showed only name + class/RATING — rating letters (F/G) read like mount
  codes but aren't.
- coriolis-data mirror had: 29 duplicate entries, 10 "Missing module"
  placeholders shown as real modules, and 20+ groups with wrong or raw-key
  names (sfn "Shock Cannon"→Shutdown Field Neutraliser, pwa→Pulse Wave
  Analyser, ss→Detailed Surface Scanner, rcpl/rpl limpets shifted, regular
  Mining Lasers displayed as bare "Fixed").
- Genuinely missing: the 9 Panther Mk II passenger cabins (not upstream;
  added with EDSY stats, fdids 129043770-78), and `_free`-suffix store
  variants / Int_FighterBayMk2_* silently dropped on import (aliased now).
- NOT missing (verified unreleased, EDSY comments/hidden flags): huge cannon
  turret, prisoner cells, size-8 standard FSDs (SCO size-8s already in),
  anti-corrosion rack size 2, 1B shield gen — do not "fix" these.

### Shipped
| Item | File |
|---|---|
| Mount in every hardpoint display name ("Pulse Laser (Gimballed)", "Missile Rack (Pack-Hound, Fixed)") | `data/modules.json` |
| All group names corrected; dedup; placeholders dropped; Mk II cabins added (940 modules total) | `data/modules.json` |
| Same transforms for future regens (GROUP_NAMES verified per-key, `_skip` placeholders, dedup in `_sort`, MKII_CABINS supplement, mount+variant display in `_clean_module`) | `scripts/build_data.py` |
| `_module_symbol_index`: `_free` + FighterBayMk2 aliases | `main.py` |
| Engineering editor: blueprint list filtered to fitted module's type (BP_TYPE alias map + All toggle; "can't be engineered" note when none apply) | `frontend/src/pages/Builder.jsx` |

### Verified
- 13/13 harness (scratchpad test_builder_import.py): real Panther Mk II
  import 17/17 modules, unladen mass exact vs game; MkII cabin swap moves
  mass correctly; aliases resolve; blueprint applies_to ↔ module group
  cross-check = every blueprint type maps, unmatched groups are genuinely
  unengineerable.
- Journal scan (60 files, whole fleet): 0 unresolved fittable modules.

### State
- User confirmed the Builder in-app — **v0.3.71 tagged + pushed for CI
  release 2026-07-12**. Local install already on v0.3.71.

---
*Session 48 (cont. 2) — 2026-07-12 (v0.3.71 local)*

---

## Session 48 (cont. 3) — Ship Builder resize-layout fix (v0.3.72, local)

User: resizing the window made the module list impossible to see after
shrinking again, and the stats panel got cut off. Two root causes in
`frontend/src/pages/Builder.jsx`:

1. **Schematic was width-driven** — `aspectRatio: 340/240` on a full-width div
   inside the `shrink-0` header. Wide middle column → 500-600px-tall schematic
   → module list below squeezed to ~0 height. Now height-driven:
   `clamp(140px, 26vh, 250px)`, centered, aspect box inside.
2. **Grid rows never height-constrained** — columns grew to content and the
   stats column clipped past the window instead of scrolling. Added
   `lg:grid-rows-[minmax(0,1fr)]` so each column scrolls internally and always
   fits the viewport.

Also: side columns narrower at lg (220/280px, full 240/300 at xl); in stacked
(<lg) mode the saved-builds list caps at max-h-48 and the right column at 70vh
so long pickers scroll instead of stretching the page; empty-state panel got
min-h so it can't collapse.

- `npm run build` clean; built + installed locally as **v0.3.72**
  (startup log: frozen=True, correct exe/db).
- User confirmed — **v0.3.72 tagged + pushed for CI release 2026-07-12**.

---
*Session 48 (cont. 3) — 2026-07-12 (v0.3.72 local)*

---

## Session 48 (cont. 4) — Hardpoint anchor placement editor (v0.3.73, local)

Research first: user pointed at jixxed/ed-odyssey-materials-helper — their ship
builder's hardpoint locations are ~430 hand-authored pixel coords hardcoded in
Ship.java (`ImageSlot.builder()...x(1107).y(597).fdevName("SmallHardpoint1")`)
on 1920x1080 in-game screenshots, 2-4 views/ship. No 3D, no machine source —
accurate placement is always hand-authored. They DO have Type-11 (lakonminer)
and Kestrel Mk II (smallcombat01_nx) but only as 2D images — no meshes for our
missing STLs (check Pizza42 Thingiverse/Printables for those).

Built the EDTC equivalent — click-to-place on our 3D hulls:

| Item | File |
|---|---|
| `data/hardpoint_anchors.json` — ship id → slot key → [x,y,z] normalised to oriented-model bbox | new |
| `get_hardpoint_anchors` (bundled + per-machine user file merged, user wins) / `save_hardpoint_anchor` (dev → repo data file = shipped defaults; frozen → `hardpoint_anchors_user.json` beside exe) | `main.py` |
| Anchored slots override procedural guesses; placed markers solid, guesses faint (0.5) | `ShipView.jsx` |
| Placement mode: invisible raycast hull catches clicks (e.delta>6 = drag, ignored), converts to normalised coords, saves; autoRotate paused; crosshair cursor | `ShipView.jsx` |
| 📍 Place mounts button (shows placed count) → armed-slot banner: label i/n, ✓ if placed, ←/→/reset/done, auto-advance after each click; clicking a hardpoint/utility row while placing arms it | `Builder.jsx` |

Harness: 9/9 (scratchpad test_anchors.py — save/read/round/delete/dev-file/_note).
py_compile + npm build clean. v0.3.73 built + installed + running (frozen=True).

**Workflow note**: placements made in the installed app land in
`%LOCALAPPDATA%\EDTC\hardpoint_anchors_user.json` — copy its `ships` entries
into `data/hardpoint_anchors.json` in the repo to ship them as defaults for
everyone. Use jixxed's annotated screenshots as visual reference while placing.
If a ship's STL is ever replaced, its anchors need re-placing (bbox-relative).

NOT tagged — tag v0.3.73 after the CMDR tries the placement editor in-app.

---
*Session 48 (cont. 4) — 2026-07-12 (v0.3.73 local)*

---
*Session checkpoint: 2026-07-12 12:49:11*

---
*Session checkpoint: 2026-07-12 13:28:12*

---
*Session checkpoint: 2026-07-12 14:55:02*

---
*Session checkpoint: 2026-07-12 14:56:21*

---
*Session checkpoint: 2026-07-12 15:04:14*

---
*Session checkpoint: 2026-07-12 15:07:21*

---
*Session checkpoint: 2026-07-12 15:08:28*

---
*Session checkpoint: 2026-07-12 15:10:04*

---
*Session checkpoint: 2026-07-12 15:20:31*

---
*Session checkpoint: 2026-07-12 15:41:34*

---
*Session checkpoint: 2026-07-12 15:43:03*

---

## Session 49 — FSS species predictions + first-footfall carried value (v0.3.74, local)

User (live session, running SrvSurvey side-by-side): (1) SrvSurvey shows predicted
species the moment a bio body is FSS'd, EDTC didn't; (2) SrvSurvey said unsold exo
data ≈ 411M with FF bonus, EDTC's "Carrying (unsold)" showed 21.7M.

### Root causes (all live-verified against the 2026-07-13 journal)
1. **FSS ordering bug**: `FSSBodySignals` lands one journal line BEFORE the
   body's detailed `Scan` — **every time** (7/7 bio bodies watched live via
   monitor). `_handle_fss_body_signals` predicted with no `_body_params` →
   empty predictions, never re-ran. Fix: `_handle_scan` re-predicts + re-emits
   + re-pushes the bio panel when a pending unconfirmed bio body's Scan lands.
2. **Carried value**: (a) no FF ×5 — `WasLogged` wasn't stored; (b) sale
   matching by species name only (ignored time), over-consuming carried scans;
   (c) `Died` not handled — 31 of the CMDR's 43 analysed scans were lost to
   deaths but still matched sales. Ground truth from full journal replay:
   **410,563,000 cr** (82,112,600 base, 8 species, all first-logged ×5) —
   matches SrvSurvey exactly.

### Shipped
| Item | File |
|---|---|
| Re-predict on late Scan + `was_footfalled` cached in `_body_params` | `main.py` `_handle_scan` |
| `exo_scans` columns: `was_logged` (NULL=unknown, 0=first-logged ×5), `sold`, `lost` + migration | `core/database.py` |
| `mark_exo_sold` (FIFO per sale), `mark_exo_lost` (death), `get_carried_exo_scans`, `replace_completed_exo_scans` | `core/database.py` |
| `Died` watched + handler (wipes carried + partial scans, `exo_data_lost` event) | `core/journal.py`, `main.py` |
| **`_backfill_exo_history()`** — full journal replay at EVERY startup (bg thread): rebuilds completed scans with sold/lost/was_logged chronologically (incl. sessions where EDTC wasn't running — the SrvSurvey approach) | `main.py` |
| `get_exo_carried_value()` rewrite: carried = completed ∧ ¬sold ∧ ¬lost; payout ×5 where `was_logged=0`; returns `total`(payable), `base_total` | `main.py` |
| `_body_species_rows`: per-row `ff_value` (×5 sampled first-logged; ×5 potential when body `WasFootfalled=false`) | `main.py` |
| Bio panel payload: per-body `species` detail rows, `ff_value`, `ff_rewards`, `focus` body | `main.py` `_push_bio_panel` |
| BioSignals overlay: focused (just-scanned) body expands to predicted species list ("?Species value ×5", "predicted — DSS to confirm"), FF total in footer | `overlays/BioSignals.jsx` |
| ExoTracker: FF bonus total = per-species `ff_rewards` (was all-or-nothing rewards×5) | `overlays/ExoTracker.jsx` |
| Exploration page: carried tiles show FF-inclusive total + "FF ×5" hint | `pages/Exploration.jsx` |

### Verified
- Harness 23/23 (scratchpad test_exo_fixes.py, isolated test DB): backfill from
  real journals → carried == 410,563,000 exactly; ordering fix replayed with
  tonight's actual B 2 c events (empty → 24 candidates incl. Recepta on Scan);
  sold/lost FIFO; upsert re-scan resets sold; ×5 potential rows.
- py_compile + npm run build clean.

### Notes
- FF detection is automatic: `ScanOrganic.WasLogged=false` → ×5 (user asked for
  a manual checkbox fallback — not needed, journal has it; add only if a body
  ever shows was_logged NULL).
- Backfill runs every startup (not pref-gated) so state self-heals; ~seconds in
  a bg thread over 60 journals.
- exo_sales table untouched by backfill (already matched journal 35/35).

### State
- Committed + pushed to main. v0.3.74 installed locally; backfill verified on
  first launch (45 completed scans rebuilt from 209 journals, carried 513.9M —
  410.6M ground truth + tonight's two new first-logged species). CMDR confirmed
  in-app — **v0.3.74 tagged + pushed for CI release 2026-07-13**.

---
*Session 49 — 2026-07-13*

---

## Session 50 — Always-on overlays + position lock (v0.3.75, local)

User changed their mind on overlay lifecycle: "I want the overlays to just
always be there", plus a lock checkbox so an overlay always reopens where
they dragged it.

| Item | What shipped |
|---|---|
| Always-on lifecycle | Enabled overlays are always on screen; game events only update content. Removed every auto-hide: cmdr_ping 8s, route 10s post-arrival, station_info 30s + Undocked hide, exo_tracker LeaveBody hide, bio_signals jump hide. `hide_after`/`cancel_hide`/`_hide_timers` deleted from OverlayManager; `toggle()` lost `show_on_enable` (route special-case gone). |
| Startup show | `_show_enabled_overlays()` called from `_on_ready` — every user-enabled overlay comes up at launch (at its locked position). |
| Position lock | `overlay_lock_{name}` + `overlay_pos_{name}` prefs. `set_overlay_lock` API snapshots the live window's x/y (`win.x/win.y`) and persists. Locked overlays: created with `x=/y=` kwargs, `win.move()` on re-show, and `win.events.moved` hook re-saves the spot on drag (latest position wins; hook is best-effort try/except per backend). |
| Overlays page UI | "Lock position" checkbox per overlay (disabled until the overlay is enabled; 🔒 when locked); page subtitle explains drag-then-lock. Route desc no longer mentions hiding. |
| Idle states | CmdrPing.jsx: window persists, so added "Listening for CMDRs…" idle card; ping card clears itself after 8s client-side (fresh ping restarts the timer). Others already had awaiting-states. |
| system_changed to overlays | `_handle_fsd_jump` now broadcasts `system_changed` to ALL overlay windows — StationInfo/FssValues/ExoTracker listeners finally fire (backend used to send `system_jumped`, which nothing listened to; dead emits removed). Station card resets to "Awaiting docking…" on jump. |

### Verified
- Harness 15/15 (scratchpad test_overlay_lock.py, stubbed webview): toggle
  always shows, lock snapshot, drag-while-locked persists via callback,
  unlocked drag ignored, locked re-show moves back, fresh window created at
  saved pos, hide_after/cancel_hide gone.
- py_compile + npm run build clean.

### Round 2 (same session): bio panel body names + price range
CMDR confirmed always-on + lock working in-game, then asked: full body
designation in the bio panel (was truncated to ~3 chars by `w-7 truncate`),
and a price range instead of just the max value.

- `_body_species_rows`: every row gets `value_min` — sampled rows exact
  (min == max); predicted rows use the cheapest candidate species of that
  genus (`genus_min` dict built from predictions).
- `_push_bio_panel`: per-body `value_min` + payload `rewards_min`.
- BioSignals.jsx: `fmtRange(min, max)` → "1.2 M–4.5 M", single value once
  min == max (range tightens as species are confirmed/sampled); body name
  no longer width-capped (`shrink-0 whitespace-nowrap`); panel widened
  248→296px (window 250→300 in core/overlay.py) to fit.
- Harness 10/10 (scratchpad test_bio_range.py, stubbed webview + fake
  overlay manager): row mins, body/panel range sums, designation kept,
  sampled row min==max, range tightens after sampling.

### State
- CMDR confirmed always-on + lock AND the bio panel range in-game —
  **v0.3.75 tagged + pushed for CI release 2026-07-15** (commit 2879522).
  Local install already on v0.3.75; CI run was still in_progress at session
  end — verify the release assets published if anyone downloads from GitHub.
- Note: `win.events.moved` availability on WebView2 unverified in the field —
  if drag-while-locked doesn't re-save, the fallback is untick/re-tick the
  lock box (snapshot path, verified).

### Known issues / notes for next session
- FSS overlay + station_info confirmed fine in-game (2026-07-14); the only
  Session 47 leftover is radar scale feel on foot.
- Overlays are now always-on: if a future overlay needs event-only behaviour,
  don't reintroduce hide_after — give it an idle card like CmdrPing instead.
- Bio panel value_min uses the cheapest candidate species per predicted
  genus; FSS-only bodies still show the top-N genera by value, so the true
  floor could be lower if lower-value genera are present. Fine in practice.
- Hardpoint anchor placements still land in
  %LOCALAPPDATA%\EDTC\hardpoint_anchors_user.json — copy into
  data/hardpoint_anchors.json to ship as defaults.
- Updater still has no exe checksum; guardian_sites.json still 8 sites;
  pygame unavailable on Python 3.14 (dev only — CI builds on 3.12 have audio).

---
*Session 50 — 2026-07-15 (v0.3.75 released)*

---
*Session checkpoint: 2026-07-13 20:48:49*

---
*Session checkpoint: 2026-07-13 20:49:37*

---
*Session checkpoint: 2026-07-13 20:53:16*

---
*Session checkpoint: 2026-07-13 20:58:07*

---
*Session checkpoint: 2026-07-13 20:58:16*

---
*Session checkpoint: 2026-07-13 21:00:37*

---
*Session checkpoint: 2026-07-13 21:28:02*

---
*Session checkpoint: 2026-07-13 21:36:59*

---
*Session checkpoint: 2026-07-13 21:41:01*

---
*Session checkpoint: 2026-07-13 21:54:57*

---
*Session checkpoint: 2026-07-14 23:31:14*

---
*Session checkpoint: 2026-07-14 23:32:43*

---
*Session checkpoint: 2026-07-14 23:33:42*

---
*Session checkpoint: 2026-07-14 23:57:42*

---
*Session checkpoint: 2026-07-15 00:06:33*

---
*Session checkpoint: 2026-07-15 00:09:18*

---
*Session checkpoint: 2026-07-15 00:11:21*

---
*Session checkpoint: 2026-07-15 00:11:58*

---
*Session checkpoint: 2026-07-16 18:54:37*

---
*Session checkpoint: 2026-07-16 18:55:40*

---
*Session checkpoint: 2026-07-16 18:57:05*

---
*Session checkpoint: 2026-07-16 19:03:00*

---
*Session checkpoint: 2026-07-16 19:04:36*

---
*Session checkpoint: 2026-07-16 19:07:29*

---

## Session 51 — Full-codebase audit (read-only) + fix pass (2026-07-18)

User request: review everything built so far for bugs and optimisation areas.
Audited: all of core/, api/, main.py (4,149 lines), frontend App/main/overlays +
pattern checks across pages. Findings below, ranked; fixes applied same session
(see the shipped table after the list).

### Audit findings — bugs

1. **`get_thargoid_nearby` broken (always errors)** — main.py:3800 referenced
   `self._edsm` (never assigned) and `_run()` took no args while `_edsm_run`
   calls `coro_factory(edsm)`. Every Nearby Threat search failed since the
   method was written.
2. **Journal watchdog could switch the feed to a stale journal** —
   `_on_file_change` switched to whichever Journal.*.log was touched (not the
   newest). An AV/backup touching an old journal would replay its entire
   history into live handlers (duplicate trade log / material / kill counts).
3. **Spansh `_poll_job` didn't detect failed jobs** — errored jobs polled for
   the full 120s then raised a misleading TimeoutError.
4. **DB migrations swallowed every exception** — `except Exception: pass`
   treated "database is locked" the same as "duplicate column".
5. **`routes` table grew forever** — every in-game NavRoute inserted a new
   permanent row.
6. **`search_local_markets` case-inconsistent coord lookup** + LOWER() in
   `get_system_coords` defeated the PK index.
7. **`_handle_fss_body_signals` called `_mark_body_bio` twice** — no-op dup.

### Audit findings — optimisations

8. **edtc_debug.log at DEBUG, unbounded, never rotated** (httpx/watchdog noise).
9. **`get_market_stats` full-scans markets table** ~every 30s while Trading open.
10. **`search_local_markets` had no LIMIT** — common commodities pushed
    thousands of rows through the JS bridge into React.
11. EDDN market writes are per-message (coverage already batches; markets could
    use the same buffer pattern). **DEFERRED**
12. `_latest_journal` globbed + statted 200+ journals every second.
13. `_load_json` had no cache — Builder recomputes re-parsed ships/blueprints
    JSON per edit (and per engineered slot).
14. `get_ship_info` self-heal re-scanned the whole latest journal on every call
    until a Loadout appeared.
15. Per-call asyncio.run + fresh httpx client per API request. **DEFERRED**
16. `_backfill_exo_history` replays all journals every startup (fine today;
    checkpoint by mtime someday). **DEFERRED**
17. sqlite connections closed only by GC (`with conn:` commits, doesn't close).
    **DEFERRED**

### Clean bill of health

- Frontend hygiene good: all setInterval/`__edtc.on` subscriptions have cleanup.
- outfitting.py / awards.py / exobiology.py / overlay lifecycle: no bugs found.
- **Updater checksum**: `_do_update` now verifies the GitHub sha256 digest —
  the long-standing "no checksum" known issue is FIXED; drop it from notes.

### Fix pass — shipped (same session, v0.3.76 local)

| # | Fix | File |
|---|---|---|
| 1 | `get_thargoid_nearby` rewritten to `_edsm_run(coro_factory)` pattern — Nearby Threat search works for the first time | `main.py` |
| 8 | Logging → INFO + RotatingFileHandler (5 MB × 2 backups) | `main.py` |
| 2 | Watchdog only switches to mtime-NEWER journals (stale-touch replay guard) | `core/journal.py` |
| 12 | Poll re-globs the journal dir every 10th tick (~10s) instead of every second; watchdog still catches rotation instantly | `core/journal.py` |
| 10 | `search_local_markets`: 250-row cap, nearest-first when ref coords known | `core/database.py` |
| 9 | `get_market_stats`: 5-min TTL, stale-while-revalidate on a bg thread | `main.py` |
| 6 | `get_system_coords` exact-match (PK index) first, LOWER() scan only as fallback; used for ref coords in market search | `core/database.py` |
| 3 | Spansh `_poll_job` raises immediately on job `error` payload | `api/spansh.py` |
| 4 | Migration guard narrowed to `sqlite3.OperationalError` "duplicate column" | `core/database.py` |
| 5 | `delete_ingame_routes()` — newest NavRoute replaces prior auto-saved rows | `core/database.py`, `main.py` |
| 7 | Removed duplicate `_mark_body_bio` call in `_handle_fss_body_signals` | `main.py` |
| 13 | `_load_json` mtime-keyed cache (+ `get_guardian_sites` copies its dicts so DB-note clears don't linger on cached objects) | `main.py` |
| 14 | `get_ship_info` journal self-heal scans at most once | `main.py` |

Verified: py_compile clean; harness 16/16 (scratchpad `test_session51_fixes.py`,
isolated DB + stubbed webview) covering the watchdog guard, poll throttle,
market cap/sort/case-fallback, route pruning, migration idempotence, Spansh
error fast-fail, JSON cache invalidation, one-shot ship scan, and stats cache.
No frontend changes — no npm build needed.

### Notes / deferred for a future session

- #11 batch EDDN market upserts (reuse the coverage buffer pattern), #15 reuse
  httpx clients/event loop, #16 checkpoint `_backfill_exo_history` by mtime,
  #17 close sqlite connections deterministically (the test run's flood of
  `ResourceWarning: unclosed database` confirms it empirically).
- The harness test file lives in the session scratchpad — copy into the repo
  if a permanent test suite is ever wanted.
- v0.3.76 NOT tagged — tag after the CMDR confirms in-app (especially the
  Galaxy → Thargoid War → Nearby Threat tab, now working).

---
*Session 51 — 2026-07-18*

---
*Session checkpoint: 2026-07-18 23:01:13*

---
*Session checkpoint: 2026-07-18 23:08:28*
