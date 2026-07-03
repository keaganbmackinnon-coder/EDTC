import json
import re
import sqlite3
import sys
from pathlib import Path

if getattr(sys, "frozen", False):
    DB_PATH = Path(sys.executable).parent / "edtc.db"
else:
    DB_PATH = Path(__file__).parent.parent / "edtc.db"


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Many threads (journal watcher, EDDN listener, UI bridge) share this DB;
    # wait for locks instead of raising "database is locked" immediately.
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def init_db():
    with _conn() as conn:
        # WAL lets the EDDN writer thread and UI readers overlap without
        # blocking each other; the mode is persistent, set once per DB file.
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS builds (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                name     TEXT NOT NULL,
                ship     TEXT NOT NULL,
                data     TEXT NOT NULL,
                created  TEXT DEFAULT (datetime('now')),
                updated  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS routes (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                name     TEXT NOT NULL,
                systems  TEXT NOT NULL,
                current  INTEGER DEFAULT 0,
                active   INTEGER DEFAULT 0,
                created  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS watchlist (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                cmdr    TEXT NOT NULL UNIQUE,
                note    TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS prefs (
                key     TEXT PRIMARY KEY,
                value   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cached_routes (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                type     TEXT NOT NULL,
                payload  TEXT NOT NULL,
                cached   TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS exo_scans (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                system      TEXT NOT NULL,
                body        TEXT NOT NULL,
                species     TEXT NOT NULL,
                genus       TEXT NOT NULL DEFAULT '',
                scan_count  INTEGER DEFAULT 0,
                completed   INTEGER DEFAULT 0,
                created     TEXT DEFAULT (datetime('now')),
                updated     TEXT DEFAULT (datetime('now')),
                UNIQUE(system, body, species)
            );

            CREATE TABLE IF NOT EXISTS construction_projects (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                name         TEXT NOT NULL,
                system       TEXT NOT NULL DEFAULT '',
                requirements TEXT NOT NULL DEFAULT '[]',
                active       INTEGER DEFAULT 1,
                created      TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS fc_cargo (
                commodity TEXT PRIMARY KEY,
                count     INTEGER DEFAULT 0,
                updated   TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS materials (
                name     TEXT PRIMARY KEY,
                category TEXT NOT NULL DEFAULT '',
                count    INTEGER DEFAULT 0,
                updated  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS engineer_progress (
                engineer TEXT PRIMARY KEY,
                status   TEXT DEFAULT '',
                rank     INTEGER DEFAULT 0,
                updated  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS carriers (
                carrier_id   TEXT PRIMARY KEY,
                name         TEXT DEFAULT '',
                callsign     TEXT DEFAULT '',
                location     TEXT DEFAULT '',
                fuel         INTEGER DEFAULT 0,
                jump_range   INTEGER DEFAULT 500,
                finance      TEXT DEFAULT '{}',
                space_usage  TEXT DEFAULT '{}',
                services     TEXT DEFAULT '[]',
                pending_jump TEXT DEFAULT '',
                updated      TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS trade_log (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                type      TEXT NOT NULL,
                commodity TEXT NOT NULL,
                quantity  INTEGER DEFAULT 0,
                price     INTEGER DEFAULT 0,
                total     INTEGER DEFAULT 0,
                profit    INTEGER DEFAULT 0,
                station   TEXT DEFAULT '',
                system    TEXT DEFAULT '',
                timestamp TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS guardian_visits (
                site_id          TEXT PRIMARY KEY,
                visited          INTEGER DEFAULT 0,
                data_collected   INTEGER DEFAULT 0,
                notes            TEXT DEFAULT '',
                updated          TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS cmdr_stats (
                key     TEXT PRIMARY KEY,
                value   TEXT NOT NULL,
                updated TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS logbook (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                title   TEXT NOT NULL DEFAULT '',
                system  TEXT NOT NULL DEFAULT '',
                body    TEXT NOT NULL DEFAULT '',
                created TEXT DEFAULT (datetime('now')),
                updated TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS markets (
                system      TEXT NOT NULL,
                station     TEXT NOT NULL,
                commodity   TEXT NOT NULL,
                buy_price   INTEGER DEFAULT 0,
                sell_price  INTEGER DEFAULT 0,
                supply      INTEGER DEFAULT 0,
                demand      INTEGER DEFAULT 0,
                updated_at  TEXT NOT NULL,
                PRIMARY KEY (system, station, commodity)
            );

            CREATE TABLE IF NOT EXISTS system_coords (
                system TEXT PRIMARY KEY,
                x      REAL NOT NULL,
                y      REAL NOT NULL,
                z      REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS galaxy_coverage (
                layer TEXT    NOT NULL,
                gx    INTEGER NOT NULL,
                gy    INTEGER NOT NULL,
                gz    INTEGER NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (layer, gx, gy, gz)
            );
        """)
        # Migrations for columns added after initial release
        for sql in [
            "ALTER TABLE markets ADD COLUMN has_large_pad INTEGER DEFAULT 0",
        ]:
            try:
                conn.execute(sql)
            except Exception:
                pass  # column already exists
        # Indexes for fast commodity lookups
        conn.execute("CREATE INDEX IF NOT EXISTS idx_markets_commodity ON markets(commodity)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_markets_system ON markets(system)")
        # One-time migration: normalize stored commodity names to bare symbols
        # ('Combat Stabilisers' -> 'combatstabilisers') so searches compare the
        # indexed column directly instead of scanning with REPLACE()/LOWER().
        done = conn.execute(
            "SELECT 1 FROM prefs WHERE key='markets_symbol_migrated'"
        ).fetchone()
        if not done:
            names = [r[0] for r in conn.execute("SELECT DISTINCT commodity FROM markets")]
            for name in names:
                sym = _commodity_symbol(name)
                if sym != name:
                    conn.execute(
                        "UPDATE OR REPLACE markets SET commodity=? WHERE commodity=?",
                        (sym, name),
                    )
            conn.execute(
                "INSERT OR REPLACE INTO prefs (key, value) VALUES ('markets_symbol_migrated', '1')"
            )
        # One-time migration: galaxy_coverage gained a gy (height band) column.
        # The old 2D data can't be split by height, so drop and let every layer
        # rebuild from its source (week: EDSM dump, alltime: bundled snapshot,
        # live: re-accumulates from EDDN).
        cols = [r[1] for r in conn.execute("PRAGMA table_info(galaxy_coverage)")]
        if "gy" not in cols:
            conn.execute("DROP TABLE galaxy_coverage")
            conn.execute("""
                CREATE TABLE galaxy_coverage (
                    layer TEXT    NOT NULL,
                    gx    INTEGER NOT NULL,
                    gy    INTEGER NOT NULL,
                    gz    INTEGER NOT NULL,
                    count INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (layer, gx, gy, gz)
                )
            """)
            conn.execute("DELETE FROM prefs WHERE key IN "
                         "('coverage_week_refreshed', 'coverage_alltime_imported')")


# --- Builds ---

def get_builds() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM builds ORDER BY updated DESC").fetchall()
        return [dict(r) for r in rows]


def save_build(build: dict) -> dict:
    with _conn() as conn:
        if build.get("id"):
            conn.execute(
                "UPDATE builds SET name=?, ship=?, data=?, updated=datetime('now') WHERE id=?",
                (build["name"], build["ship"], json.dumps(build.get("data", {})), build["id"]),
            )
        else:
            cur = conn.execute(
                "INSERT INTO builds (name, ship, data) VALUES (?, ?, ?)",
                (build["name"], build["ship"], json.dumps(build.get("data", {}))),
            )
            build["id"] = cur.lastrowid
    return build


def delete_build(build_id: int) -> bool:
    with _conn() as conn:
        conn.execute("DELETE FROM builds WHERE id=?", (build_id,))
    return True


# --- Routes ---

def get_routes() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM routes ORDER BY created DESC").fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["systems"] = json.loads(d["systems"])
            result.append(d)
        return result


def save_route(route: dict) -> dict:
    with _conn() as conn:
        systems_json = json.dumps(route.get("systems", []))
        if route.get("id"):
            conn.execute(
                "UPDATE routes SET name=?, systems=?, current=?, active=? WHERE id=?",
                (route["name"], systems_json, route.get("current", 0), route.get("active", 0), route["id"]),
            )
        else:
            cur = conn.execute(
                "INSERT INTO routes (name, systems, current, active) VALUES (?, ?, ?, ?)",
                (route["name"], systems_json, route.get("current", 0), route.get("active", 0)),
            )
            route["id"] = cur.lastrowid
    return route


def get_active_route() -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM routes WHERE active=1 ORDER BY created DESC LIMIT 1").fetchone()
        if not row:
            return None
        d = dict(row)
        d["systems"] = json.loads(d["systems"])
        return d


def set_active_route(route_id: int) -> bool:
    with _conn() as conn:
        conn.execute("UPDATE routes SET active=0")
        conn.execute("UPDATE routes SET active=1 WHERE id=?", (route_id,))
    return True


# --- Watchlist ---

def get_watchlist() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM watchlist ORDER BY cmdr ASC").fetchall()
        return [dict(r) for r in rows]


def add_to_watchlist(cmdr: str, note: str = "") -> dict:
    cmdr_upper = cmdr.strip().upper()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO watchlist (cmdr, note) VALUES (?, ?) "
            "ON CONFLICT(cmdr) DO UPDATE SET note=excluded.note",
            (cmdr_upper, note),
        )
        row = conn.execute("SELECT * FROM watchlist WHERE cmdr=?", (cmdr_upper,)).fetchone()
        return dict(row)


def remove_from_watchlist(cmdr: str) -> bool:
    with _conn() as conn:
        conn.execute("DELETE FROM watchlist WHERE cmdr=?", (cmdr.strip().upper(),))
    return True


# --- Prefs ---

def get_pref(key: str, default=None):
    with _conn() as conn:
        row = conn.execute("SELECT value FROM prefs WHERE key=?", (key,)).fetchone()
        if row is None:
            return default
        try:
            return json.loads(row["value"])
        except Exception:
            return row["value"]


def set_pref(key: str, value) -> bool:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, json.dumps(value)),
        )
    return True


# --- Exobiology ---

def get_exo_scans(system: str | None = None) -> list:
    with _conn() as conn:
        if system:
            rows = conn.execute(
                "SELECT * FROM exo_scans WHERE system=? ORDER BY updated DESC", (system,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM exo_scans WHERE completed=0 ORDER BY updated DESC"
            ).fetchall()
        return [dict(r) for r in rows]


def upsert_exo_scan(system: str, body: str, species: str, genus: str, scan_count: int) -> dict:
    completed = 1 if scan_count >= 3 else 0
    with _conn() as conn:
        conn.execute(
            "INSERT INTO exo_scans (system, body, species, genus, scan_count, completed) "
            "VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(system, body, species) DO UPDATE SET "
            "scan_count=excluded.scan_count, completed=excluded.completed, updated=datetime('now')",
            (system, body, species, genus, scan_count, completed),
        )
        row = conn.execute(
            "SELECT * FROM exo_scans WHERE system=? AND body=? AND species=?",
            (system, body, species),
        ).fetchone()
        return dict(row)


def clear_exo_scans_for_system(system: str) -> bool:
    with _conn() as conn:
        conn.execute("DELETE FROM exo_scans WHERE system=?", (system,))
    return True


# --- Construction ---

def get_construction_projects(active_only: bool = True) -> list:
    with _conn() as conn:
        if active_only:
            rows = conn.execute(
                "SELECT * FROM construction_projects WHERE active=1 ORDER BY created DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM construction_projects ORDER BY created DESC"
            ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["requirements"] = json.loads(d["requirements"])
            result.append(d)
        return result


def save_construction_project(project: dict) -> dict:
    reqs_json = json.dumps(project.get("requirements", []))
    with _conn() as conn:
        if project.get("id"):
            conn.execute(
                "UPDATE construction_projects SET name=?, system=?, requirements=?, active=? WHERE id=?",
                (project["name"], project.get("system", ""), reqs_json, project.get("active", 1), project["id"]),
            )
        else:
            cur = conn.execute(
                "INSERT INTO construction_projects (name, system, requirements) VALUES (?, ?, ?)",
                (project["name"], project.get("system", ""), reqs_json),
            )
            project["id"] = cur.lastrowid
        row = conn.execute(
            "SELECT * FROM construction_projects WHERE id=?", (project["id"],)
        ).fetchone()
        d = dict(row)
        d["requirements"] = json.loads(d["requirements"])
        return d


def delete_construction_project(project_id: int) -> bool:
    with _conn() as conn:
        conn.execute("DELETE FROM construction_projects WHERE id=?", (project_id,))
    return True


def _normalize_contrib_name(raw: str) -> str:
    """Normalize commodity name from journal — handles both 'Steel' and '$steel_name;' formats."""
    s = raw.strip().lstrip("$")
    if "_name;" in s.lower():
        s = s.lower().split("_name;")[0]
    return s.lower()


def record_construction_contribution(system: str, contributions: list) -> list:
    """contributions: list of {Name, Count} dicts from journal event"""
    updated = []
    with _conn() as conn:
        projects = conn.execute(
            "SELECT * FROM construction_projects WHERE active=1",
        ).fetchall()
        for project_row in projects:
            if project_row["system"] and project_row["system"].lower() != system.lower():
                continue
            reqs = json.loads(project_row["requirements"])
            changed = False
            for contrib in contributions:
                name = _normalize_contrib_name(contrib.get("Name", "") or contrib.get("Name_Localised", ""))
                count = int(contrib.get("Amount") or contrib.get("Count") or 0)
                for req in reqs:
                    if _normalize_contrib_name(req.get("commodity", "")) == name:
                        req["delivered"] = req.get("delivered", 0) + count
                        changed = True
                        break
            if changed:
                conn.execute(
                    "UPDATE construction_projects SET requirements=? WHERE id=?",
                    (json.dumps(reqs), project_row["id"]),
                )
                d = dict(project_row)
                d["requirements"] = reqs
                updated.append(d)
    return updated


def sync_construction_depot(system: str, resources: list) -> dict | None:
    """Overwrite delivered counts for the active project in `system` from a
    ColonisationConstructionDepot event's ResourcesRequired (game's ground truth,
    includes deliveries from all players). resources: list of
    {Name, Name_Localised, RequiredAmount, ProvidedAmount} dicts."""
    with _conn() as conn:
        project_row = conn.execute(
            "SELECT * FROM construction_projects WHERE active=1 AND LOWER(system)=LOWER(?)",
            (system,),
        ).fetchone()
        if not project_row:
            return None
        reqs = json.loads(project_row["requirements"])
        by_name = {
            _normalize_contrib_name(r.get("Name_Localised") or r.get("Name", "")): r.get("ProvidedAmount", 0)
            for r in resources
        }
        changed = False
        for req in reqs:
            provided = by_name.get(_normalize_contrib_name(req.get("commodity", "")))
            if provided is not None and req.get("delivered") != provided:
                req["delivered"] = provided
                changed = True
        if not changed:
            d = dict(project_row)
            d["requirements"] = reqs
            return d
        conn.execute(
            "UPDATE construction_projects SET requirements=? WHERE id=?",
            (json.dumps(reqs), project_row["id"]),
        )
        d = dict(project_row)
        d["requirements"] = reqs
        return d


# --- FC Cargo ---

def get_fc_cargo() -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT commodity, count, updated FROM fc_cargo WHERE count > 0 ORDER BY commodity"
        ).fetchall()
        return [dict(r) for r in rows]


def set_fc_cargo_items(items: list) -> list:
    with _conn() as conn:
        conn.execute("DELETE FROM fc_cargo")
        for item in items:
            count = int(item.get("count", 0))
            commodity = str(item.get("commodity", "")).strip().lower()
            if commodity and count > 0:
                conn.execute(
                    "INSERT INTO fc_cargo (commodity, count) VALUES (?, ?)",
                    (commodity, count),
                )
    return get_fc_cargo()


def update_fc_cargo_transfer(transfers: list) -> list:
    with _conn() as conn:
        for t in transfers:
            commodity = t.get("Type", "").lower().strip()
            count = int(t.get("Count", 0))
            direction = t.get("Direction", "")
            if not commodity or count <= 0:
                continue
            if direction == "tocarrier":
                conn.execute(
                    """INSERT INTO fc_cargo (commodity, count, updated)
                       VALUES (?, ?, datetime('now'))
                       ON CONFLICT(commodity) DO UPDATE SET
                         count = count + excluded.count,
                         updated = excluded.updated""",
                    (commodity, count),
                )
            elif direction == "toship":
                conn.execute(
                    """UPDATE fc_cargo
                       SET count = MAX(0, count - ?), updated = datetime('now')
                       WHERE commodity = ?""",
                    (count, commodity),
                )
        conn.execute("DELETE FROM fc_cargo WHERE count <= 0")
    return get_fc_cargo()


# --- Carriers ---

def get_carriers() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM carriers ORDER BY updated DESC").fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["finance"] = json.loads(d["finance"])
            d["space_usage"] = json.loads(d["space_usage"])
            d["services"] = json.loads(d["services"])
            result.append(d)
        return result


def upsert_carrier(data: dict) -> dict:
    carrier_id = str(data.get("CarrierID") or data.get("carrier_id", ""))
    if not carrier_id:
        return {}
    with _conn() as conn:
        existing = conn.execute(
            "SELECT * FROM carriers WHERE carrier_id=?", (carrier_id,)
        ).fetchone()
        base = dict(existing) if existing else {}

        name = data.get("Name", base.get("name", ""))
        callsign = data.get("Callsign", base.get("callsign", ""))
        location = data.get("location", base.get("location", ""))
        fuel = data.get("FuelLevel", base.get("fuel", 0))
        jump_range = data.get("JumpRangeCurr", base.get("jump_range", 500))
        finance = json.dumps(data.get("Finance", json.loads(base.get("finance", "{}"))))
        space_usage = json.dumps(data.get("SpaceUsage", json.loads(base.get("space_usage", "{}"))))
        services = json.dumps([
            {"role": c.get("CrewRole", ""), "active": c.get("Activated", False)}
            for c in data.get("Crew", json.loads(base.get("services", "[]")))
        ] if "Crew" in data else json.loads(base.get("services", "[]")))
        pending_jump = data.get("pending_jump", base.get("pending_jump", ""))

        conn.execute("""
            INSERT INTO carriers
                (carrier_id, name, callsign, location, fuel, jump_range,
                 finance, space_usage, services, pending_jump, updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(carrier_id) DO UPDATE SET
                name=excluded.name, callsign=excluded.callsign,
                location=excluded.location, fuel=excluded.fuel,
                jump_range=excluded.jump_range, finance=excluded.finance,
                space_usage=excluded.space_usage, services=excluded.services,
                pending_jump=excluded.pending_jump, updated=excluded.updated
        """, (carrier_id, name, callsign, location, fuel, jump_range,
              finance, space_usage, services, pending_jump))

        row = conn.execute("SELECT * FROM carriers WHERE carrier_id=?", (carrier_id,)).fetchone()
        d = dict(row)
        d["finance"] = json.loads(d["finance"])
        d["space_usage"] = json.loads(d["space_usage"])
        d["services"] = json.loads(d["services"])
        return d


# --- Materials ---

def get_materials() -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT name, category, count FROM materials ORDER BY category, name"
        ).fetchall()
        return [dict(r) for r in rows]


def upsert_material(name: str, category: str, delta: int) -> None:
    key = name.lower()
    with _conn() as conn:
        row = conn.execute("SELECT count FROM materials WHERE name=?", (key,)).fetchone()
        if row:
            new_count = max(0, row["count"] + delta)
            conn.execute(
                "UPDATE materials SET count=?, updated=datetime('now') WHERE name=?",
                (new_count, key),
            )
        else:
            new_count = max(0, delta)
            conn.execute(
                "INSERT INTO materials (name, category, count) VALUES (?,?,?)",
                (key, category, new_count),
            )


def sync_materials(rows: list) -> None:
    """Replace all material counts with the ground-truth snapshot from the
    'Materials' journal event (fires at every login). Clears any drift from
    delta events missed while EDTC wasn't running. rows: (name, category, count)."""
    with _conn() as conn:
        conn.execute("DELETE FROM materials")
        conn.executemany(
            "INSERT INTO materials (name, category, count) VALUES (?, ?, ?)",
            rows,
        )


def set_material_count(name: str, category: str, count: int) -> None:
    key = name.lower()
    with _conn() as conn:
        conn.execute("""
            INSERT INTO materials (name, category, count, updated)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(name) DO UPDATE SET
              count=excluded.count, category=excluded.category,
              updated=excluded.updated
        """, (key, category, max(0, count)))


# --- Engineer Progress ---

def get_engineer_progress() -> dict:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM engineer_progress").fetchall()
        return {r["engineer"]: dict(r) for r in rows}


def upsert_engineer_progress(engineer: str, status: str, rank: int) -> None:
    with _conn() as conn:
        conn.execute("""
            INSERT INTO engineer_progress (engineer, status, rank, updated)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(engineer) DO UPDATE SET
              status=excluded.status, rank=excluded.rank,
              updated=excluded.updated
        """, (engineer, status, rank))


# --- CMDR Stats ---

def set_cmdr_stat(key: str, value) -> None:
    with _conn() as conn:
        conn.execute("""
            INSERT INTO cmdr_stats (key, value, updated)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated
        """, (key, json.dumps(value)))


def get_cmdr_stats() -> dict:
    with _conn() as conn:
        rows = conn.execute("SELECT key, value FROM cmdr_stats").fetchall()
        result = {}
        for r in rows:
            try:
                result[r["key"]] = json.loads(r["value"])
            except Exception:
                result[r["key"]] = r["value"]
        return result


# --- Logbook ---

def get_logbook() -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM logbook ORDER BY created DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def save_log_entry(entry: dict) -> dict:
    with _conn() as conn:
        if entry.get("id"):
            conn.execute(
                "UPDATE logbook SET title=?, system=?, body=?, updated=datetime('now') WHERE id=?",
                (entry.get("title", ""), entry.get("system", ""), entry.get("body", ""), entry["id"]),
            )
            row = conn.execute("SELECT * FROM logbook WHERE id=?", (entry["id"],)).fetchone()
        else:
            cur = conn.execute(
                "INSERT INTO logbook (title, system, body) VALUES (?, ?, ?)",
                (entry.get("title", ""), entry.get("system", ""), entry.get("body", "")),
            )
            row = conn.execute("SELECT * FROM logbook WHERE id=?", (cur.lastrowid,)).fetchone()
        return dict(row)


def delete_log_entry(entry_id: int) -> bool:
    with _conn() as conn:
        conn.execute("DELETE FROM logbook WHERE id=?", (entry_id,))
    return True


# --- Guardian Visits ---

def get_guardian_visits() -> dict:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM guardian_visits").fetchall()
        return {r["site_id"]: dict(r) for r in rows}


def add_trade_entry(
    type_: str, commodity: str, quantity: int, price: int,
    total: int, profit: int, station: str, system: str
) -> dict:
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO trade_log (type, commodity, quantity, price, total, profit, station, system) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (type_, commodity, quantity, price, total, profit, station, system),
        )
        row = conn.execute("SELECT * FROM trade_log WHERE id=?", (cur.lastrowid,)).fetchone()
        return dict(row)


def get_trade_log(limit: int = 200) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM trade_log ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def clear_trade_log() -> bool:
    with _conn() as conn:
        conn.execute("DELETE FROM trade_log")
    return True


# --- EDDN Market Cache ---

def upsert_market_data(system: str, station: str, timestamp: str, commodities: list) -> None:
    rows = []
    for c in commodities:
        # Store the normalized symbol so search_local_markets can compare the
        # column directly and hit idx_markets_commodity.
        name = _commodity_symbol(c.get("name") or "")
        if not name:
            continue
        rows.append((
            system, station, name,
            c.get("buyPrice", 0), c.get("sellPrice", 0),
            c.get("stock", 0), c.get("demand", 0),
            timestamp,
        ))
    if not rows:
        return
    with _conn() as conn:
        conn.executemany("""
            INSERT INTO markets (system, station, commodity, buy_price, sell_price, supply, demand, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(system, station, commodity) DO UPDATE SET
                buy_price=excluded.buy_price,
                sell_price=excluded.sell_price,
                supply=excluded.supply,
                demand=excluded.demand,
                updated_at=excluded.updated_at
        """, rows)


def upsert_system_coords(system: str, x: float, y: float, z: float) -> None:
    with _conn() as conn:
        conn.execute("""
            INSERT INTO system_coords (system, x, y, z) VALUES (?, ?, ?, ?)
            ON CONFLICT(system) DO UPDATE SET x=excluded.x, y=excluded.y, z=excluded.z
        """, (system, x, y, z))


def get_system_coords(system: str) -> tuple[float, float, float] | None:
    with _conn() as conn:
        r = conn.execute(
            "SELECT x, y, z FROM system_coords WHERE LOWER(system) = LOWER(?)", (system,)
        ).fetchone()
        return (r["x"], r["y"], r["z"]) if r else None


def bulk_upsert_spansh_dump(rows: list[tuple]) -> None:
    """rows: (system, station, commodity, buy_price, sell_price, supply, demand, updated_at, has_large_pad)"""
    with _conn() as conn:
        conn.executemany("""
            INSERT INTO markets
                (system, station, commodity, buy_price, sell_price, supply, demand, updated_at, has_large_pad)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(system, station, commodity) DO UPDATE SET
                buy_price    = excluded.buy_price,
                sell_price   = excluded.sell_price,
                supply       = excluded.supply,
                demand       = excluded.demand,
                updated_at   = excluded.updated_at,
                has_large_pad= excluded.has_large_pad
        """, rows)


def _commodity_symbol(name: str) -> str:
    """EDDN/Market.json store commodity names as bare symbols ('combatstabilisers',
    no spaces/punctuation) while the UI searches by display name ('Combat
    Stabilisers') — normalize both sides to the same symbol before comparing."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def search_local_markets(commodity: str, ref_system: str | None = None) -> list[dict]:
    import math
    with _conn() as conn:
        rows = conn.execute("""
            SELECT m.system, m.station, m.buy_price, m.sell_price,
                   m.supply, m.demand, m.updated_at, m.has_large_pad,
                   sc.x, sc.y, sc.z
            FROM markets m
            LEFT JOIN system_coords sc ON sc.system = m.system
            WHERE m.commodity = ?
              AND (m.buy_price > 0 OR m.sell_price > 0)
            ORDER BY m.updated_at DESC
        """, (_commodity_symbol(commodity),)).fetchall()

        ref_coords = None
        if ref_system:
            r = conn.execute(
                "SELECT x, y, z FROM system_coords WHERE system = ?", (ref_system,)
            ).fetchone()
            if r:
                ref_coords = (r["x"], r["y"], r["z"])

        results = []
        for r in rows:
            dist = None
            if ref_coords and r["x"] is not None:
                dx, dy, dz = r["x"] - ref_coords[0], r["y"] - ref_coords[1], r["z"] - ref_coords[2]
                dist = round(math.sqrt(dx*dx + dy*dy + dz*dz), 1)
            results.append({
                "station":             r["station"],
                "system":              r["system"],
                "distance":            dist,
                "distance_to_arrival": 0,
                "has_large_pad":       r["has_large_pad"],
                "is_planetary":        None,
                "updated_at":          r["updated_at"],
                "buy_price":           r["buy_price"],
                "sell_price":          r["sell_price"],
                "supply":              r["supply"],
                "demand":              r["demand"],
                "source":              "eddn",
            })
        return results


def prune_markets(days: int = 30) -> int:
    """Delete market rows older than `days` so the EDDN cache (and everything
    that scans it) stays bounded. Rows with an empty updated_at are kept.
    Returns the number of rows deleted."""
    with _conn() as conn:
        cur = conn.execute(
            "DELETE FROM markets WHERE updated_at != '' "
            "AND substr(updated_at, 1, 10) < date('now', ?)",
            (f"-{int(days)} days",),
        )
        return cur.rowcount


def get_market_stats() -> dict:
    with _conn() as conn:
        stations = conn.execute("SELECT COUNT(DISTINCT system || '/' || station) FROM markets").fetchone()[0]
        commodities = conn.execute("SELECT COUNT(DISTINCT commodity) FROM markets").fetchone()[0]
        systems = conn.execute("SELECT COUNT(*) FROM system_coords").fetchone()[0]
        return {"stations": stations, "commodities": commodities, "systems_with_coords": systems}


# --- Galaxy scan coverage (heatmap grid) ---

# Grid cell size in ly. The top-down map renders ~155 ly/px, so 300 ly ≈ 2 px.
COVERAGE_CELL_LY = 300
# Height (galactic Y) band thickness in ly — sector maps cycle through these.
COVERAGE_Y_BAND_LY = 400


def coverage_cell(x: float, y: float, z: float) -> tuple[int, int, int]:
    return (
        int(x // COVERAGE_CELL_LY),
        int(y // COVERAGE_Y_BAND_LY),
        int(z // COVERAGE_CELL_LY),
    )


def replace_coverage_layer(layer: str, cells: dict) -> None:
    """Atomically replace a layer's whole grid. cells: {(gx, gy, gz): count}"""
    with _conn() as conn:
        conn.execute("DELETE FROM galaxy_coverage WHERE layer = ?", (layer,))
        conn.executemany(
            "INSERT INTO galaxy_coverage (layer, gx, gy, gz, count) VALUES (?, ?, ?, ?, ?)",
            [(layer, gx, gy, gz, c) for (gx, gy, gz), c in cells.items()],
        )


def bump_coverage_cells(layer: str, cells: dict) -> None:
    """Accumulate counts into a layer. cells: {(gx, gy, gz): delta}"""
    with _conn() as conn:
        conn.executemany("""
            INSERT INTO galaxy_coverage (layer, gx, gy, gz, count) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(layer, gx, gy, gz) DO UPDATE SET count = count + excluded.count
        """, [(layer, gx, gy, gz, c) for (gx, gy, gz), c in cells.items()])


def get_coverage_layer(layer: str, bounds: list | None = None,
                       y_band: int | None = None) -> list:
    """Returns [[gx, gz, count], ...].
    bounds: [min_gx, max_gx, min_gz, max_gz] to fetch a viewport only.
    y_band: a single gy band to slice on; None sums across all heights."""
    q = "SELECT gx, gz, SUM(count) AS count FROM galaxy_coverage WHERE layer = ?"
    params: list = [layer]
    if bounds:
        q += " AND gx BETWEEN ? AND ? AND gz BETWEEN ? AND ?"
        params += [bounds[0], bounds[1], bounds[2], bounds[3]]
    if y_band is not None:
        q += " AND gy = ?"
        params.append(y_band)
    q += " GROUP BY gx, gz"
    with _conn() as conn:
        rows = conn.execute(q, params).fetchall()
        return [[r["gx"], r["gz"], r["count"]] for r in rows]


def get_coverage_y_bands(layer: str, bounds: list | None = None) -> list:
    """Which height bands hold data in this viewport: [[gy, count], ...] sorted
    top of the disc first (highest gy first)."""
    q = "SELECT gy, SUM(count) AS count FROM galaxy_coverage WHERE layer = ?"
    params: list = [layer]
    if bounds:
        q += " AND gx BETWEEN ? AND ? AND gz BETWEEN ? AND ?"
        params += [bounds[0], bounds[1], bounds[2], bounds[3]]
    q += " GROUP BY gy ORDER BY gy DESC"
    with _conn() as conn:
        rows = conn.execute(q, params).fetchall()
        return [[r["gy"], r["count"]] for r in rows]


# --- Guardian ---

def set_guardian_visit(site_id: str, visited: bool, data_collected: bool, notes: str) -> None:
    with _conn() as conn:
        conn.execute("""
            INSERT INTO guardian_visits (site_id, visited, data_collected, notes, updated)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(site_id) DO UPDATE SET
              visited=excluded.visited,
              data_collected=excluded.data_collected,
              notes=excluded.notes,
              updated=excluded.updated
        """, (site_id, int(visited), int(data_collected), notes))
