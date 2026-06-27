# EDT — Elite Dangerous Tools
## Claude Code Project Brief

## Project goal

Build EDT (Elite Dangerous Tools) — a one-stop-shop Elite Dangerous companion app. Runs locally as a native desktop application. Distributed to friends as a single executable file. No server, no cloud hosting required.

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Desktop shell | **pywebview** | Native window with embedded webview, overlays, filesystem access, all Python |
| Frontend | **React + Vite** | Component-based UI, served locally inside pywebview's webview |
| Backend / logic | **Python** | Single language throughout; handles API calls, journal watching, stat calculations |
| Styling | **Tailwind CSS** | Utility-first, fast iteration |
| Local storage | **SQLite** (via `sqlite3`) | Stores builds, user prefs, cached API data |
| System tray | **pystray** | System tray icon, show/hide/quit |
| Audio alerts | **playsound** or `pygame.mixer` | CMDR proximity ping and other audio alerts |
| Distribution | **PyInstaller** | Bundles everything into a single .exe / .app / binary |
| Build & release | **GitHub Actions** | Auto-builds platform installers on push |

Everything is Python. No Rust, no IPC bridge, no second language to debug.

---

## Platform targets

- **Primary:** Windows (most ED players)
- **Secondary:** macOS, Linux
- **Mobile:** future goal, not in scope now
- PyInstaller produces cross-platform binaries from a single codebase

---

## Distribution

- GitHub repository (private or public, owner's choice)
- GitHub Releases hosts the installer files
- Friends download the latest release binary and run it — no Python install required
- GitHub Actions workflow auto-builds and publishes a new release on every version tag push

**TODO: Set up GitHub Actions CI/CD pipeline for cross-platform builds**

---

## Authentication

- **Deferred** — no account linking or OAuth at MVP
- All data comes from local journal files or open public data APIs (no auth required)
- Frontier CAPI / OAuth can be added in a later phase

---

## Design philosophy — recreate, don't integrate

This app **recreates the features** of existing tools (Inara, EDSY, Spansh, CATS, Raven Colonial, SrvSurvey) rather than connecting to their APIs or depending on their services. The goal is a single self-contained app that doesn't rely on any third-party site staying online or keeping their API open.

Data sources are limited to:
1. **Local ED journal files** — written by the game itself, no auth needed
2. **Open public data APIs** — EDSM, Spansh, EDDN (all free, no keys required)
3. **Static game data** — bundled with the app (ship stats, module data, engineering blueprints, commodity lists, etc.)

---

## API integrations (scaffold all stubs on day one)

| API | Used for | Auth needed? |
|---|---|---|
| **EDSM** | Systems, bodies, coordinates, star types | None |
| **Spansh** | Route plotting, neutron routes, road to riches, FC routes | None |
| **eddn-realtime.space** | Live commodity prices, market data (WebSocket) | None |

Create a Python `api/` module with one file per integration. Each file should have typed dataclass models, async HTTP methods (use `httpx` for REST, `websockets` for EDDN), error handling, and a rate-limit-aware request wrapper. Stub out all endpoints even if not fully implemented — return mock data where needed so the frontend can be built in parallel.

### Bundled static game data
The following should be bundled as JSON files in the app and loaded at startup — no network calls needed:
- Ship list, stats, and slot configurations
- Module database (all classes, ratings, stats)
- Engineering blueprints and experimental effects
- Engineer locations and unlock requirements
- Synthesis recipes
- Commodity list and categories
- Exobiology species and genus data
- Guardian site locations
- Technology broker items

Source these from the EDCD community data repos (open licensed, regularly maintained).

---

## Journal file watcher

The Elite Dangerous journal files live at:
- **Windows:** `%USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous\`
- **macOS:** `~/Library/Application Support/Frontier Developments/Elite Dangerous/`
- **Linux:** `~/.local/share/Frontier Developments/Elite Dangerous/`

The journal watcher must:
- Watch the latest journal file using `watchdog`
- Parse journal events as newline-delimited JSON
- Expose events to the frontend via pywebview's JS/Python bridge (`window.pywebview.api`)
- Key events to handle at launch: `FSDJump`, `Location`, `Scan`, `ScanBarCode`, `CargoTransfer`, `Docked`, `Undocked`, `ShipTargeted`

---

## Overlay system

Overlays are separate pywebview windows with transparent backgrounds. Requirements:
- Transparent background (`transparent=True` in pywebview window config)
- Always-on-top (`on_top=True`)
- Click-through when not interacting (toggle via global hotkey using `keyboard` library)
- Draggable position, saved to local SQLite prefs
- Toggled via system tray (pystray) or global hotkey

Planned overlays (build stubs for all, implement first two at MVP):
1. CMDR proximity ping — audio beep + brief name popup when another CMDR appears in system (from `ScanBarCode` / `ShipTargeted` journal events)
2. Route following — current waypoint, next jump, trip progress bar
3. Construction material requirements (colonisation)
4. FSS planet value scanner
5. System preview on FSD jump

---

## MVP module — Live in-game overlays

Build these two features fully at launch:

### 1. CMDR proximity alert
- Journal watcher detects `ScanBarCode` or `ShipTargeted` events with a CMDR name
- Play a configurable audio ping (playsound or pygame.mixer)
- Show a small overlay popup with the CMDR name and ship type
- Optional: watchlist mode — only ping for specific named CMDRs

### 2. Route following overlay
- User pastes a Spansh-generated route (list of systems)
- App tracks current system via `FSDJump` journal events
- Overlay shows: current system, next jump target, systems remaining, distance to go
- Hotkey copies next system name to clipboard for in-game galaxy map paste

---

## Full feature list

### Navigation & routing
- Neutron star route plotter (Spansh API)
- Road to Riches planner (Spansh API)
- Tourist / passenger planner (Spansh API)
- Fleet carrier route planner (Spansh API)
- Engineering router
- Waypoint routing + clipboard hotkey paste + trip progress overlay ⭐
- Nearest known system finder (EDSM)
- Spherical & boxel system searching (EDSM)

### Trading
- Trade route planner
- Commodity price finder — best buy/sell (EDDN)
- Materials / components trading finder
- Station search by commodity, ship, module
- Commodity market price alerts ⭐

### Exploration
- Celestial body search — mining hotspots, artefacts (EDSM)
- Star system search with attribute filters (EDSM)
- Exobiology / organic scanning tracker ⭐
- Exobiology species imagery & predictions ⭐
- Road to Riches body scanning rewards (Spansh)
- Codex Bingo / Canonn Challenge tracker ⭐
- Journey tracker with screenshots ⭐

### Engineering & outfitting
- Engineers database & blueprints (bundled data)
- Experimental effects guide (bundled data)
- Synthesis guide (bundled data)
- Material traders finder
- Ship database & outfitting search (bundled data)
- Technology broker (bundled data)
- Ship build tool (theory-crafter) ⭐
- Pip & power distributor modelling (from EDSY)
- Thermal load & heat dissipation modelling (from EDSY)
- Engineering grade & roll percentage slider (from EDSY)
- Experimental / oversized build mode (from EDSY)
- SLEF format import / export
- Module presets — one-click engineered module combinations (from EDSY)

### Colonisation
- System planner with economy simulator ⭐
- Build progress tracker — solo & group ⭐
- Multi-build aggregated shopping list ⭐
- Fleet carrier cargo vs build requirements tracker ⭐
- Commodity shopping tool — markets near build sites
- Nexus building planner ⭐
- Live in-game overlay for construction material requirements ⭐

### Fleet carriers
- Fleet carrier stats dashboard — fuel, credits, cargo (journal data)
- Multi-carrier / multi-account management ⭐
- Tritium calculator ⭐
- Auto-jump / autopilot — ⚠️ DECISION PENDING: possible Frontier ToS violation. Add prominent warning or remove.

### Guardian & POI
- Guardian ruins & structures interactive maps (bundled data)
- Ram Tah mission tracker
- Human sites maps (bundled data)

### Galaxy & factions
- GalNet news feed
- Community Goals tracker
- Powerplay tracker
- Thargoid War tracker
- Minor factions database (EDSM)
- Powers database
- Rankings — overall, Powerplay, CQC
- Galaxy statistics

### Commander & social
- Commander lookup (EDSM)
- Squadron management
- Logbooks / commander stories ⭐
- Discussion boards ⭐
- Screenshot gallery ⭐
- Shareable build links

### Live in-game overlays
- CMDR proximity ping / beep alert ⭐ ← MVP
- Route following + hotkey clipboard paste ⭐ ← MVP
- Construction material requirements overlay ⭐
- FSS scanner planet values overlay ⭐
- System preview on FSD jump ⭐

⭐ = original idea not found in existing tools
⚠️ = flagged, decision needed

---

## Reference tools reviewed

These were reviewed during feature planning to avoid duplication and identify gaps:

| Tool | URL | Focus |
|---|---|---|
| INARA | inara.cz | Comprehensive companion site |
| Spansh | spansh.co.uk | Route plotting & galaxy search |
| SrvSurvey | GitHub | Exploration / exobiology / Guardian overlays (Windows) |
| CATS | GitHub | Fleet carrier administration (screen automation, not API) |
| Raven Colonial | ravencolonial.com | Colonisation planning & logistics |
| EDSY | edsy.org | Ship outfitting & theory-crafting |

---

## Scaffold session checklist

The first Claude Code session should produce:

- [ ] Python project structure with `pywebview` main window
- [ ] React + Vite frontend wired into pywebview's webview
- [ ] Tailwind CSS configured
- [ ] pywebview JS/Python bridge set up for frontend↔backend communication
- [ ] SQLite database initialised with schema stubs for: builds, user prefs, watchlist, cached routes
- [ ] `api/` Python module with stubs for: EDSM, Spansh, EDDN (eddn-realtime.space WebSocket)
- [ ] Bundled static game data JSON files downloaded from EDCD repos and placed in `data/`
- [ ] Journal file watcher running via `watchdog`, emitting key events to frontend
- [ ] Overlay window scaffold — transparent, always-on-top, togglable pywebview windows
- [ ] System tray icon via `pystray` with show/hide/quit
- [ ] React router with placeholder pages for all 10 modules
- [ ] GitHub Actions workflow for cross-platform PyInstaller builds (.exe / .app / Linux binary)
- [ ] GitHub Releases config so binaries are attached on version tag push
- [ ] README with setup instructions for development and for end-users

---

## Pending decisions

- [ ] **Auto-jump / autopilot** — confirm whether to include with ToS warning, or remove entirely
- [ ] **Frontier CAPI / OAuth** — deferred, add in a later phase when CMDR profile import is needed
- [ ] **Repo visibility** — private (friends only) or public (community)?
- [x] **App name** — EDT (Elite Dangerous Tools)
