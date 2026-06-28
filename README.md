# EDTC — Elite Dangerous Tools & Companion

A one-stop-shop Elite Dangerous companion app. Runs locally as a native desktop application. No server, no cloud hosting, no third-party dependencies at runtime.

---

## Features

- Navigation & routing (neutron plotter, Road to Riches, fleet carrier routes via Spansh)
- Trading (commodity prices via EDDN live feed)
- Exploration (exobiology, body scanning, codex tracker)
- Engineering & outfitting (blueprints, ship builder, SLEF import/export)
- Colonisation (system planner, build tracker, shopping lists)
- Fleet carriers (stats, tritium calculator, auto-jump with ToS warning)
- Guardian & POI (ruins maps, Ram Tah tracker)
- Galaxy & factions (GalNet, Powerplay, Thargoid War)
- Commander & social (CMDR lookup, logbooks, screenshots)
- Live in-game overlays (CMDR ping, route following, FSS values)

---

## For end users

### Windows

1. Go to the [Releases](https://github.com/keaganbmackinnon-coder/EDTC/releases) page and download **EDTC.exe** from the latest release.
2. Move it anywhere you like (Desktop, a dedicated folder, etc.).
3. Double-click **EDTC.exe** to launch.
   - Windows may show a "Windows protected your PC" SmartScreen warning the first time. Click **More info → Run anyway**. This happens because the app isn't code-signed yet.
4. The EDTC window will open and an icon will appear in your system tray.

**Requirements:** Nothing extra — Python, Node, and all libraries are bundled inside the .exe.

> **Note:** EDTC reads your Elite Dangerous journal files automatically. Make sure Elite Dangerous is installed and has been launched at least once so the journal folder exists at:
> `%USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous\`

### macOS

1. Download **EDTC** (no extension) from the [Releases](https://github.com/keaganbmackinnon-coder/EDTC/releases) page.
2. Open Terminal and run:
   ```
   chmod +x ~/Downloads/EDTC
   ~/Downloads/EDTC
   ```
3. macOS may block it on first launch. Go to **System Settings → Privacy & Security** and click **Open Anyway**.

### Linux

1. Download **EDTC** from the [Releases](https://github.com/keaganbmackinnon-coder/EDTC/releases) page.
2. Make it executable and run:
   ```
   chmod +x ./EDTC
   ./EDTC
   ```

---

## For developers

### Requirements

- Python 3.11+
- Node.js 20+

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/EDTC.git
cd EDTC

# Create a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS / Linux

# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Development mode

Run the frontend dev server and the Python backend together:

```bash
# Terminal 1 — Vite dev server
cd frontend
npm run dev

# Terminal 2 — pywebview backend pointing at Vite
python main.py --dev
```

The app window will load from `http://localhost:5173` with hot reload.

### Production build

```bash
cd frontend && npm run build && cd ..
python main.py
```

### Distribution (single .exe)

```bash
pip install pyinstaller
pyinstaller --onefile --windowed --name EDTC \
  --add-data "frontend/dist;frontend/dist" \
  --add-data "data;data" \
  main.py
# Output: dist/EDTC.exe
```

Or push a version tag to trigger the GitHub Actions build:

```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## Bundled data

Static game data lives in `data/`. The stubs included are minimal examples — replace them with full datasets from:

- **Ships & modules:** https://github.com/EDCD/coriolis-data
- **Blueprints & engineers:** https://github.com/EDCD/EDSY
- **Exobiology & Canonn data:** https://canonn.science

---

## Data sources

| Source | Used for | Auth |
|--------|----------|------|
| ED Journal files | Live in-game events | None (local files) |
| EDSM | Systems, bodies, coordinates | None |
| Spansh | Route plotting | None |
| EDDN | Live commodity prices (WebSocket) | None |

---

## Architecture

```
main.py              — pywebview entry point, API bridge
core/
  database.py        — SQLite (builds, routes, prefs, watchlist)
  journal.py         — watchdog journal file watcher
  overlay.py         — transparent always-on-top overlay windows
  tray.py            — pystray system tray icon
api/
  edsm.py            — EDSM REST API
  spansh.py          — Spansh route API (async job polling)
  eddn.py            — EDDN WebSocket commodity listener
data/                — bundled static JSON game data
frontend/            — React + Vite + Tailwind CSS
  src/
    App.jsx          — router + sidebar layout
    pages/           — one file per module (10 pages)
.github/workflows/   — PyInstaller CI/CD for all platforms
```
