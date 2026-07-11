"""Commander Commendations — a for-fun medals/achievements system.

Awards are evaluated purely from data EDTC already tracks (the journal
Statistics event, ranks, and a few local counts). Each award has a ladder of
thresholds; reaching one grants that tier. Inara's stat-based awards were the
inspiration; the catalogue below mixes ED classics with a few EDTC originals.

`evaluate(data)` is pure — persistence + "newly earned" detection lives in
core.database.record_awards(). The frontend renders the returned list.
"""

# Rarity name + colour key per tier index. The frontend maps `style` → colour.
RARITY = ["bronze", "silver", "gold", "elite", "legendary"]
RARITY_LABEL = {
    "bronze": "Bronze",
    "silver": "Silver",
    "gold": "Gold",
    "elite": "Elite",
    "legendary": "Legendary",
}

# ED rank index for "Elite" in the three classic careers.
_ELITE = 8


def _s(d, cat, key, default=0):
    """Read data['stats'][cat][key] defensively (journal Statistics event)."""
    return ((d.get("stats", {}) or {}).get(cat, {}) or {}).get(key, default) or 0


def _rank(d, career):
    return (d.get("ranks", {}) or {}).get(career, 0) or 0


def _triple_elite(d):
    return 1 if all(_rank(d, c) >= _ELITE for c in ("Combat", "Trade", "Explore")) else 0


# id, name, icon, category, desc, unit, tiers, metric, [style override for singles]
CATALOG = [
    # ---- Exploration ----
    {"id": "pathfinder", "name": "Pathfinder", "icon": "🧭", "category": "Exploration",
     "desc": "Star systems visited", "unit": "count",
     "tiers": [50, 500, 2500, 10000], "metric": lambda d: _s(d, "Exploration", "Systems_Visited")},
    {"id": "long_hauler", "name": "Long Hauler", "icon": "🚀", "category": "Exploration",
     "desc": "Hyperspace jumps made", "unit": "count",
     "tiers": [100, 1000, 5000, 20000], "metric": lambda d: _s(d, "Exploration", "Total_Hyperspace_Jumps")},
    {"id": "cartographer", "name": "Stellar Cartographer", "icon": "🗺️", "category": "Exploration",
     "desc": "Bodies fully scanned", "unit": "count",
     "tiers": [100, 1000, 5000, 25000], "metric": lambda d: _s(d, "Exploration", "Planets_Scanned_To_Level_3")},
    {"id": "trailblazer", "name": "Trailblazer", "icon": "📏", "category": "Exploration",
     "desc": "Total distance travelled", "unit": "ly",
     "tiers": [5000, 50000, 250000, 1000000], "metric": lambda d: _s(d, "Exploration", "Total_Hyperspace_Distance")},
    {"id": "far_reach", "name": "The Far Reach", "icon": "🌌", "category": "Exploration",
     "desc": "Greatest distance from your start", "unit": "ly",
     "tiers": [1000, 10000, 25000, 65000], "metric": lambda d: int(_s(d, "Exploration", "Greatest_Distance_From_Start"))},
    {"id": "first_footfall", "name": "First Footfall", "icon": "👣", "category": "Exploration",
     "desc": "Worlds where you were the first human to land", "unit": "count",
     "tiers": [1, 10, 50, 250], "metric": lambda d: _s(d, "Exploration", "First_Footfalls")},

    # ---- Exobiology ----
    {"id": "xenobiologist", "name": "Xenobiologist", "icon": "🧬", "category": "Exobiology",
     "desc": "Distinct organic species encountered", "unit": "count",
     "tiers": [5, 25, 75, 150], "metric": lambda d: _s(d, "Exobiology", "Organic_Species_Encountered")},
    {"id": "codex", "name": "Codex Contributor", "icon": "📖", "category": "Exobiology",
     "desc": "Organics you logged first", "unit": "count",
     "tiers": [1, 25, 100, 500], "metric": lambda d: _s(d, "Exobiology", "First_Logged")},
    {"id": "bio_fortune", "name": "Bio Fortune", "icon": "💰", "category": "Exobiology",
     "desc": "Credits earned from organic data", "unit": "cr",
     "tiers": [1_000_000, 100_000_000, 1_000_000_000, 5_000_000_000],
     "metric": lambda d: _s(d, "Exobiology", "Organic_Data_Profits")},

    # ---- Combat ----
    {"id": "bounty_hunter", "name": "Bounty Hunter", "icon": "🎯", "category": "Combat",
     "desc": "Bounties claimed", "unit": "count",
     "tiers": [10, 250, 1000, 5000], "metric": lambda d: _s(d, "Combat", "Bounties_Claimed")},
    {"id": "warzone", "name": "Warzone Veteran", "icon": "🪖", "category": "Combat",
     "desc": "Combat bonds earned", "unit": "count",
     "tiers": [10, 250, 1000, 5000], "metric": lambda d: _s(d, "Combat", "Combat_Bonds")},
    {"id": "assassin", "name": "Assassin", "icon": "🗡️", "category": "Combat",
     "desc": "Assassination contracts fulfilled", "unit": "count",
     "tiers": [1, 25, 100, 500], "metric": lambda d: _s(d, "Combat", "Assassinations")},

    # ---- Thargoid War ----
    {"id": "xeno_hunter", "name": "Xeno Hunter", "icon": "👾", "category": "Thargoid War",
     "desc": "Thargoid craft destroyed", "unit": "count",
     "tiers": [10, 100, 1000, 5000], "metric": lambda d: _s(d, "TG_ENCOUNTERS", "TG_ENCOUNTER_KILLED")},
    {"id": "ax_combatant", "name": "AX Combatant", "icon": "🛸", "category": "Thargoid War",
     "desc": "Thargoid interceptor encounters survived", "unit": "count",
     "tiers": [1, 10, 50, 200], "metric": lambda d: _s(d, "TG_ENCOUNTERS", "TG_ENCOUNTER_TOTAL")},
    {"id": "maelstrom", "name": "Scourge of the Maelstrom", "icon": "🌀", "category": "Thargoid War",
     "desc": "Destroy 1,000 Thargoids", "unit": "count", "style": "legendary",
     "tiers": [1000], "metric": lambda d: _s(d, "TG_ENCOUNTERS", "TG_ENCOUNTER_KILLED")},
    # Per-interceptor bonds, classified from FactionKillBond reward values.
    # These count combat bonds (one per heart destroyed), not whole-ship kills.
    {"id": "cyclops_slayer", "name": "Cyclops Slayer", "icon": "👁️", "category": "Thargoid War",
     "desc": "Thargoid Cyclops bonds earned", "unit": "count",
     "tiers": [1, 10, 50, 200], "metric": lambda d: (d.get("thargoid_kills") or {}).get("cyclops", 0)},
    {"id": "basilisk_slayer", "name": "Basilisk Bane", "icon": "🦎", "category": "Thargoid War",
     "desc": "Thargoid Basilisk bonds earned", "unit": "count",
     "tiers": [1, 10, 25, 100], "metric": lambda d: (d.get("thargoid_kills") or {}).get("basilisk", 0)},
    {"id": "medusa_slayer", "name": "Medusa's End", "icon": "🪼", "category": "Thargoid War",
     "desc": "Thargoid Medusa bonds earned", "unit": "count",
     "tiers": [1, 5, 25, 75], "metric": lambda d: (d.get("thargoid_kills") or {}).get("medusa", 0)},
    {"id": "hydra_slayer", "name": "Hydra Hunter", "icon": "🐉", "category": "Thargoid War",
     "desc": "Thargoid Hydra bonds earned", "unit": "count",
     "tiers": [1, 3, 10, 25], "metric": lambda d: (d.get("thargoid_kills") or {}).get("hydra", 0)},

    # ---- Trade & Industry ----
    {"id": "merchant", "name": "Merchant Prince", "icon": "📦", "category": "Trade & Industry",
     "desc": "Profit from trading", "unit": "cr",
     "tiers": [1_000_000, 100_000_000, 1_000_000_000, 10_000_000_000],
     "metric": lambda d: _s(d, "Trading", "Market_Profits")},
    {"id": "prospector", "name": "Prospector", "icon": "⛏️", "category": "Trade & Industry",
     "desc": "Profit from mining", "unit": "cr",
     "tiers": [1_000_000, 100_000_000, 1_000_000_000, 10_000_000_000],
     "metric": lambda d: _s(d, "Mining", "Mining_Profits")},
    {"id": "network", "name": "Trade Network", "icon": "🏪", "category": "Trade & Industry",
     "desc": "Distinct markets traded with", "unit": "count",
     "tiers": [5, 50, 250, 1000], "metric": lambda d: _s(d, "Trading", "Markets_Traded_With")},

    # ---- Wealth & Fleet ----
    {"id": "tycoon", "name": "Tycoon", "icon": "💎", "category": "Wealth & Fleet",
     "desc": "Total current wealth", "unit": "cr",
     "tiers": [1_000_000, 100_000_000, 1_000_000_000, 10_000_000_000, 100_000_000_000],
     "metric": lambda d: _s(d, "Bank_Account", "Current_Wealth")},
    {"id": "shipwright", "name": "Shipwright", "icon": "🛠️", "category": "Wealth & Fleet",
     "desc": "Ships in your fleet", "unit": "count",
     "tiers": [1, 5, 15, 30], "metric": lambda d: _s(d, "Bank_Account", "Owned_Ship_Count")},
    {"id": "engineers", "name": "Engineer's Friend", "icon": "🔧", "category": "Wealth & Fleet",
     "desc": "Engineers unlocked", "unit": "count",
     "tiers": [1, 5, 15, 23], "metric": lambda d: d.get("engineers_unlocked", 0)},
    {"id": "fleet_carrier", "name": "Fleet Commander", "icon": "🛰️", "category": "Wealth & Fleet",
     "desc": "Command your own Fleet Carrier", "unit": "flag", "style": "legendary",
     "tiers": [1], "metric": lambda d: 1 if d.get("own_carrier") else 0},

    # ---- Prestige & EDTC ----
    {"id": "veteran", "name": "Veteran Commander", "icon": "⏱️", "category": "Prestige",
     "desc": "Hours logged in the black", "unit": "hours",
     "tiers": [10, 100, 500, 2000], "metric": lambda d: int(_s(d, "Exploration", "Time_Played")) // 3600},
    {"id": "triple_elite", "name": "Triple Elite", "icon": "🏆", "category": "Prestige",
     "desc": "Reach Elite in Combat, Trade and Exploration", "unit": "flag", "style": "legendary",
     "tiers": [1], "metric": _triple_elite},
    {"id": "chronicler", "name": "Chronicler", "icon": "📓", "category": "Prestige",
     "desc": "Personal logbook entries written in EDTC", "unit": "count",
     "tiers": [1, 10, 50], "metric": lambda d: d.get("logbook_count", 0)},
    {"id": "guardian_seeker", "name": "Guardian Seeker", "icon": "🛸", "category": "Prestige",
     "desc": "Guardian sites logged as visited", "unit": "count",
     "tiers": [1, 4, 8], "metric": lambda d: d.get("guardian_visited", 0)},
]

CATEGORIES = []
for _a in CATALOG:
    if _a["category"] not in CATEGORIES:
        CATEGORIES.append(_a["category"])


def evaluate(data: dict) -> list:
    """Return one dict per award with earned tier + progress to the next tier."""
    out = []
    for a in CATALOG:
        try:
            value = int(a["metric"](data) or 0)
        except Exception:
            value = 0
        tiers = a["tiers"]
        earned = -1
        for i, t in enumerate(tiers):
            if value >= t:
                earned = i
        if earned >= 0:
            style = a.get("style") or RARITY[min(earned, len(RARITY) - 1)]
        else:
            style = None
        next_threshold = tiers[earned + 1] if earned + 1 < len(tiers) else None
        floor = tiers[earned] if earned >= 0 else 0
        if next_threshold is not None:
            span = next_threshold - floor
            pct = round((value - floor) / span * 100) if span > 0 else 0
            next_pct = max(0, min(100, pct))
        else:
            next_pct = 100
        out.append({
            "id": a["id"],
            "name": a["name"],
            "icon": a["icon"],
            "category": a["category"],
            "desc": a["desc"],
            "unit": a["unit"],
            "value": value,
            "tiers": tiers,
            "earned_tier": earned,               # -1 = not yet earned
            "max_tier": len(tiers) - 1,
            "tier_label": RARITY_LABEL.get(style) if style else None,
            "style": style,                       # bronze|silver|gold|elite|legendary|None
            "is_single": len(tiers) == 1,
            "next_threshold": next_threshold,
            "next_pct": next_pct,
        })
    return out
