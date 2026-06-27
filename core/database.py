import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "edtc.db"


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _conn() as conn:
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
        """)


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
                name = contrib.get("Name", "").lower()
                count = int(contrib.get("Count", 0))
                for req in reqs:
                    if req.get("commodity", "").lower() == name:
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
