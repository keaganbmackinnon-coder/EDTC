# EDT — Elite Dangerous Tools
## Project Checklist

---

## Before first Claude Code session

- [ ] Create GitHub account (if not already done)
- [ ] Create new GitHub repo named `EDT` or `elite-dangerous-tools`
- [ ] Decide repo visibility — private (friends only) or public (community)
- [ ] Move this checklist and the project brief into your EDT desktop folder

---

## First Claude Code session — scaffold

Drop `elite-companion-claude-code-brief.md` into the session and say:
> *"Read this project brief and scaffold the EDT project"*

- [ ] Python project structure with pywebview main window
- [ ] React + Vite frontend wired into pywebview
- [ ] Tailwind CSS configured
- [ ] pywebview JS/Python bridge set up (frontend ↔ backend)
- [ ] SQLite database with schema stubs
- [ ] `api/` module with stubs for EDSM, Spansh, EDDN
- [ ] Bundled static game data JSON files from EDCD repos placed in `data/`
- [ ] Journal file watcher running via watchdog
- [ ] Overlay window scaffold — transparent, always-on-top, togglable
- [ ] System tray icon via pystray (show / hide / quit)
- [ ] React router with placeholder pages for all 10 modules
- [ ] GitHub Actions workflow for PyInstaller builds (.exe / .app / Linux)
- [ ] GitHub Releases config — binaries attached on version tag push
- [ ] README with dev setup and end-user instructions

---

## Pending decisions

- [x] **Auto-jump / autopilot** — removed entirely (2026-07-04, user decision; had shipped with ToS warning through v0.3.52)
- [ ] **Frontier CAPI / OAuth** — deferred to later phase
- [ ] **Repo visibility** — private or public?

---

## MVP — Live overlays (session 2)

- [ ] CMDR proximity ping / beep alert
  - [ ] Journal watcher detects ScanBarCode / ShipTargeted events
  - [ ] Audio ping plays on detection
  - [ ] Overlay popup shows CMDR name + ship type
  - [ ] Watchlist mode — ping only for specific CMDRs
- [ ] Route following overlay
  - [ ] User can paste Spansh route (list of systems)
  - [ ] App tracks current system via FSDJump events
  - [ ] Overlay shows current system, next jump, systems remaining
  - [ ] Hotkey copies next system to clipboard

---

## Module sessions (one or two per session)

- [ ] Navigation & routing
  - [ ] Neutron star route plotter
  - [ ] Road to Riches planner
  - [ ] Tourist / passenger planner
  - [ ] Fleet carrier route planner
  - [ ] Engineering router
  - [ ] Nearest known system finder
  - [ ] Spherical & boxel searching

- [ ] Trading
  - [ ] Trade route planner
  - [ ] Commodity price finder
  - [ ] Materials trading finder
  - [ ] Station search
  - [ ] Commodity market alerts

- [ ] Exploration
  - [ ] Celestial body search
  - [ ] Star system search
  - [ ] Exobiology / organic tracker
  - [ ] Exobiology species imagery & predictions
  - [ ] Road to Riches body rewards
  - [ ] Codex Bingo / Canonn Challenge tracker
  - [ ] Journey tracker with screenshots

- [ ] Engineering & outfitting
  - [ ] Engineers DB & blueprints
  - [ ] Experimental effects guide
  - [ ] Synthesis guide
  - [ ] Material traders finder
  - [ ] Ship database & outfitting search
  - [ ] Technology broker
  - [ ] Ship build tool
  - [ ] Pip & power distributor modelling
  - [ ] Thermal load & heat dissipation modelling
  - [ ] Engineering grade & roll % slider
  - [ ] Experimental / oversized build mode
  - [ ] SLEF import / export
  - [ ] Module presets

- [ ] Colonisation
  - [ ] System planner + economy simulator
  - [ ] Build progress tracker
  - [ ] Aggregated shopping list
  - [ ] Fleet carrier cargo vs build requirements
  - [ ] Commodity shopping tool
  - [ ] Nexus building planner
  - [ ] Construction material overlay

- [ ] Fleet carriers
  - [ ] Carrier stats dashboard
  - [ ] Multi-carrier management
  - [ ] Tritium calculator
  - [x] ~~Auto-jump / autopilot~~ (removed 2026-07-04)

- [ ] Guardian & POI
  - [ ] Guardian ruins interactive maps
  - [ ] Ram Tah mission tracker
  - [ ] Human sites maps

- [ ] Galaxy & factions
  - [ ] GalNet news feed
  - [ ] Community Goals tracker
  - [ ] Powerplay tracker
  - [ ] Thargoid War tracker
  - [ ] Minor factions database
  - [ ] Powers database
  - [ ] Rankings
  - [ ] Galaxy statistics

- [ ] Commander & social
  - [ ] Commander lookup
  - [ ] Squadron management
  - [ ] Logbooks / commander stories
  - [ ] Discussion boards
  - [ ] Screenshot gallery
  - [ ] Shareable build links

- [ ] Live in-game overlays
  - [ ] CMDR proximity ping / beep alert ← MVP
  - [ ] Route following + hotkey paste ← MVP
  - [ ] Construction material overlay
  - [ ] FSS scanner planet values
  - [ ] System preview on FSD jump

---

## Release

- [ ] Internal alpha — share with friends via GitHub Releases
- [ ] Gather feedback
- [ ] Fix bugs / polish
- [ ] Decide on public release
