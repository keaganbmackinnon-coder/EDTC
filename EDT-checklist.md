# EDT — Elite Dangerous Tools
## Project Checklist

> Reconciled against the actual codebase 2026-07-19 (v0.3.79, Session 53).
> ✅ = built and released · 🔶 = partial (note says what's missing) · ❌ = not built

---

## Before first Claude Code session

- [x] Create GitHub account
- [x] Create new GitHub repo — https://github.com/keaganbmackinnon-coder/EDTC
- [x] Decide repo visibility — **public**
- [x] Move checklist + brief into the EDT desktop folder

---

## First Claude Code session — scaffold

- [x] Python project structure with pywebview main window
- [x] React + Vite frontend wired into pywebview
- [x] Tailwind CSS configured
- [x] pywebview JS/Python bridge set up (frontend ↔ backend)
- [x] SQLite database with schema (25+ tables now)
- [x] `api/` module — EDSM, Spansh, EDDN (ZMQ), plus Galnet, Community Goals, Inara (key-gated)
- [x] Bundled static game data JSON files in `data/`
- [x] Journal file watcher via watchdog (+ startup replay, rotation guard)
- [x] Overlay window scaffold — transparent, always-on-top, togglable
- [x] System tray icon via pystray
- [x] React router with all module pages
- [x] GitHub Actions workflow for PyInstaller builds (.exe / macOS / Linux)
- [x] GitHub Releases — binaries attached on version tag push (auto-updater with sha256 verify too)
- [x] README with dev setup and end-user instructions

---

## Pending decisions

- [x] **Auto-jump / autopilot** — removed entirely (2026-07-04)
- [ ] **Frontier CAPI / OAuth** — still deferred to a later phase
- [x] **Repo visibility** — public

---

## MVP — Live overlays

- [x] CMDR proximity ping / beep alert (audio + popup + watchlist + cooldown)
- [x] Route following overlay (Spansh paste AND in-game NavRoute since v0.3.79;
      jumps left, tick bar, remaining ly, scoopable warning, EDSM jump enrichment,
      Ctrl+Shift+C clipboard hotkey)

---

## Module status vs the original feature list

### Navigation & routing
- [x] Neutron star route plotter
- [x] Galaxy Plotter (exact per-jump, live ship loadout) — beyond spec
- [x] Road to Riches planner (Exploration → R2R)
- [x] Fleet carrier route planner (Fleet Carriers → Route Planner)
- [x] Waypoint routing + clipboard hotkey + trip progress overlay
- [x] Nearest service finder (Trading → Nearest Service)
- [x] Tourist / passenger planner (Exploration → Tourist Route)
- [ ] Engineering router (multi-engineer visit route) ❌
- [ ] Spherical & boxel system searching (EDSM) ❌ — used internally
      (Thargoid Nearby) but no general search UI

### Trading
- [x] Commodity price finder — local EDDN cache + Spansh + optional Inara
- [x] Materials trading finder (Engineering → Traders & Brokers)
- [x] Station search (nearest service, commodity search)
- [x] Trade history + commodity price reference
- [x] ~~Trade route planner (A↔B loop finder)~~ — dropped (2026-07-19, CMDR decision)
- [x] ~~Commodity market price alerts~~ — dropped (2026-07-19, CMDR decision)

### Exploration
- [x] Exobiology tracker (live + overlay + carried-value backfill + sales history)
- [x] Exobiology species predictions (FSS-based) — imagery ❌
- [x] Road to Riches body rewards
- [x] System lookup (EDSM) + Session Scanner + value reference + earnings
- [x] Mining hotspot search (Mining page) — covers "celestial body search: hotspots"
- [ ] Star system search with attribute filters ❌
- [ ] Codex Bingo / Canonn Challenge tracker ❌
- [ ] Journey tracker ❌ (screenshots gallery + logbook exist separately)

### Engineering & outfitting
- [x] Engineers DB, blueprints (grouped dropdowns), experimental effects
- [x] Synthesis guide, Tech broker, Material traders finder, materials inventory
- [x] Ship database (Ships page, 3D models) & outfitting in Builder
- [x] Ship build tool — live-ship import with exact game modifiers, per-module
      engineering, grade picker (max-roll values), pinned blueprints, stats
      (incl. heat/s, agility, boost check)
- 🔶 Pip/power distributor + thermal modelling — headline stats only, not
      EDSY-grade interactive pips/thermal curves
- 🔶 Roll % slider — grade picker uses max-roll values; no partial-roll slider
- [ ] SLEF import / export ❌ (journal import instead; SLEF would allow
      EDSY/Coriolis interchange)
- [ ] Module presets (one-click engineered combos) ❌

### Colonisation
- [x] Build progress tracker (Projects, live depot sync)
- [x] Aggregated shopping list (+ buyable-here highlight)
- [x] FC cargo vs build requirements
- [x] Depot view + delivery rate
- [x] Commodity shopping tool (Market Finder)
- [x] Construction material overlay
- [ ] System planner + economy simulator ❌
- [ ] Nexus building planner ❌

### Fleet carriers
- [x] Carrier stats dashboard
- [x] Multi-carrier management (visited carriers, owned/hidden)
- [x] Tritium calculator
- [x] ~~Auto-jump / autopilot~~ (removed 2026-07-04)

### Guardian & POI
- [x] Guardian sites (visit/data tracking), materials, landmarks
- 🔶 Ram Tah — material reference notes only, no per-mission log tracker
- [ ] Human sites maps ❌
- 🔶 "Interactive maps" — site lists + data, not clickable maps

### Galaxy & factions
- [x] GalNet news feed
- [x] Community Goals tracker
- [x] Powerplay tracker (PP2.0 roster, merits, live updates)
- [x] Thargoid War (Titans/Maelstroms, nearby threat search)
- [x] Minor factions (influence, states, traffic)
- [x] Galaxy Map scan-coverage view (live EDDN / week / all-time) — beyond spec
- 🔶 Rankings — own ranks shown in Commander → My Stats; no CQC/leaderboards
- 🔶 Galaxy statistics — traffic + coverage; no global stats dashboard

### Commander & social
- [x] Commander lookup (EDSM)
- [x] My Stats (ranks, credits, kills, awards system — beyond spec)
- [x] Logbook
- [x] Screenshot gallery
- [ ] Squadron management ❌
- [ ] Discussion boards ❌ — conflicts with the no-server design; drop or rethink
- [ ] Shareable build links ❌ — no server; SLEF export would be the no-server answer

### Live in-game overlays
- [x] CMDR proximity ping
- [x] Route following (+ in-game routes as of v0.3.79)
- [x] Construction materials
- [x] FSS planet values
- [x] Bio signals panel — beyond spec
- [x] Station info on docking — beyond spec (absorbed "system preview" role
      together with the route overlay's EDSM jump enrichment; the separate
      System Preview overlay was retired)
- [x] Mining session — beyond spec

### Built but parked
- Hardpoint placement editor (hidden behind `MOUNT_MARKERS_ENABLED` in
  ShipView.jsx since v0.3.79 — awaiting polish pass)

---

## What's left (the honest short list)

Dropped by CMDR decision (2026-07-19): trade route planner, commodity
market price alerts.

Server-free and in-spirit:
1. Star system search with attribute filters + spherical/boxel search UI
2. SLEF import/export (also solves "shareable builds" without a server)
3. Tourist / passenger route planner
4. Engineering router (best path to visit needed engineers)
5. Module presets in Builder
6. EDSY-grade pips/thermal modelling + roll % slider
7. Codex / Canonn challenge tracker
8. Journey tracker (could grow out of logbook + screenshots)
9. Colonisation economy simulator + Nexus planner
10. Ram Tah mission tracker; human sites maps
11. Hardpoint placement editor polish (parked)

Needs a decision first:
- Squadron management (journal data only? limited value without CAPI)
- Discussion boards / shareable links (conflict with no-server philosophy)
- Frontier CAPI / OAuth (deferred phase)

---

## Release

- [x] Internal alpha — shared via GitHub Releases (auto-updater in app)
- [x] Gather feedback (ongoing — CMDR is the alpha tester)
- [x] Fix bugs / polish (Session 51 full audit: clean bill as of v0.3.78)
- [ ] Decide on public release / announcement
