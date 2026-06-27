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
| Repo visibility | TBD (doesn't block anything) |
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

## Next session — Colonisation module (Session 3)

Build the full Colonisation module. Replace the "Coming Soon" stubs in `Colonisation.jsx`.

### Features to implement

1. **Build Progress Tracker** — multiple projects, commodity requirements vs delivered, ties to construction overlay
2. **Aggregated Shopping List** — combine all active projects, subtract delivered, net remaining per commodity
3. **Fleet Carrier Cargo vs Requirements** — compare FC cargo (from journal) against open project needs
4. **System Planner + Economy Simulator** — which building types produce which economies
5. **Commodity Shopping Tool** — find nearest markets with stock for shopping list items (Spansh/EDDN)
6. **Nexus Building Planner** (stretch) — plan build order for target economy

### Files to touch
- `frontend/src/pages/Colonisation.jsx` — replace stubs with real UI (currently all "Coming Soon")
- `core/database.py` — `construction_projects` table already exists from session 2
- `main.py` — construction API methods already wired from session 2
- `api/spansh.py` — add colonisation commodity market endpoints if needed
- Possibly new: `data/colonisation_buildings.json` — building types, costs, economy contributions

### Notes
- Construction CRUD already in `database.py` + `main.py` from session 2
- Construction overlay already built and tracking live deliveries
- `ColonisationContribution` journal event already handled in `main.py`
- GitHub setup still pending — doesn't block this work

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

*Last updated: Session 2 complete — all 6 overlays fully implemented*

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
