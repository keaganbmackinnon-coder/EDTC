"""
Fetch and transform EDCD/community data into EDTC's data/ format.
Run from the project root: python scripts/build_data.py
"""

import json
import re
import urllib.request
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(__file__).parent.parent / "data"

BLUEPRINT_URL = "https://raw.githubusercontent.com/msarilar/EDEngineer/master/EDEngineer/Resources/Data/blueprints.json"
ENTRY_DATA_URL = "https://raw.githubusercontent.com/msarilar/EDEngineer/master/EDEngineer/Resources/Data/entryData.json"
COMMODITY_CSV_URL = "https://raw.githubusercontent.com/EDCD/FDevIDs/master/commodity.csv"

# Known average prices for common tradeable commodities (CR)
COMMODITY_PRICES = {
    "Platinum": 57458, "Palladium": 13244, "Gold": 9401, "Silver": 4775,
    "Bertrandite": 2374, "Indite": 2064, "Gallite": 1819, "Coltan": 1319,
    "Uraninite": 836, "Lepidolite": 544, "Cobalt": 647, "Rutile": 299,
    "Bauxite": 120, "Water": 120, "Beryllium": 8288, "Indium": 5727,
    "Gallium": 5135, "Tantalum": 3962, "Uranium": 2771, "Lithium": 1596,
    "Titanium": 1006, "Copper": 481, "Aluminium": 340,
    "Algae": 137, "Fruit and Vegetables": 312, "Grain": 210, "Animal Meat": 632,
    "Fish": 406, "Food Cartridges": 100, "Synthetic Meat": 271, "Tea": 1245, "Coffee": 1279,
    "Leather": 205, "Natural Fabrics": 439, "Synthetic Fabrics": 281,
    "Polymers": 171, "Semiconductors": 968, "Superconductors": 6609,
    "Hydrogen Fuel": 110, "Mineral Oil": 181, "Explosives": 261, "Pesticides": 241,
    "Agri-Medicines": 1819, "Performance Enhancers": 6816, "Basic Medicines": 461,
    "Narcotics": 9567, "Tobacco": 5765, "Beer": 186, "Wine": 260, "Liquor": 587,
    "Power Generators": 461, "Water Purifiers": 257, "Microbial Furnaces": 231,
    "Mineral Extractors": 406, "Crop Harvesters": 2021, "Marine Equipment": 3706,
    "Computer Components": 513, "H.E. Suits": 348, "Robotics": 1856,
    "Auto-Fabricators": 3734, "Animal Monitors": 313, "Aquaponic Systems": 3158,
    "Advanced Catalysers": 2947, "Land Enrichment Systems": 4179,
    "Personal Weapons": 4528, "Battle Weapons": 7259, "Reactive Armour": 2199,
    "Non-Lethal Weapons": 1837, "Domestic Appliances": 487,
    "Consumer Technology": 6816, "Clothing": 286, "Slaves": 10584,
    "Biowaste": 63, "Toxic Waste": 287, "Chemical Waste": 131, "Scrap": 48,
    "Progenitor Cells": 6779, "Combat Stabilisers": 3528,
    "Tritium": 44144, "Low Temperature Diamonds": 173649, "Void Opal": 173649,
    "Painite": 40508, "Alexandrite": 51772, "Musgravite": 51807,
    "Grandidierite": 45353, "Benitoite": 47046, "Monazite": 47893,
    "Rhodplumsite": 47683, "Serendibite": 47866, "Taaffeite": 51773,
    "Meta-Alloys": 88082, "Hafnium 178": 69640, "Osmium": 7591,
    "Lanthanum": 8766, "Samarium": 15966, "Praseodymium": 10945,
    "Thallium": 3427, "Bismuth": 2284, "Thorium": 11513,
    "Ceramic Composites": 232, "Insulating Membrane": 7838, "CMM Composite": 3331,
    "Micro-weave Cooling Hoses": 1693, "Neofabric Insulation": 2435,
    "Synthetic Reagents": 20260, "Nerve Agents": 14290, "Surface Stabilisers": 467,
    "Methanol Monohydrate Crystals": 2407, "Lithium Hydroxide": 5646,
    "Methane Clathrate": 630, "Liquid oxygen": 263, "Hydrogen Peroxide": 917,
    "HN Shock Mount": 406, "Energy Grid Assembly": 1184, "Exhaust Manifold": 111,
    "Reinforced Mounting Plate": 2018, "Ion Distributor": 1156,
    "Power Transfer Bus": 723, "Radiation Baffle": 398, "Heatsink Interlink": 1288,
    "Magnetic Emitter Coil": 1220, "Articulation Motors": 4113,
    "Modular Terminals": 695, "Emergency Power Cells": 1009,
    "Power Converter": 599, "Geological Equipment": 4076,
    "Thermal Cooling Units": 3310, "Building Fabricators": 4293,
    "Skimmer Components": 859, "Bootleg Liquor": 503,
    "Nanobreakers": 2852, "Telemetry Suite": 2113, "Micro Controllers": 3300,
    "Hardware Diagnostic Sensor": 4375, "Muon Imager": 6195, "Structural Regulators": 4324,
    "Landmines": 4560, "Evacuation Shelter": 2529,
    "Steel": 114, "Haematite": 166, "Cryolite": 185, "Goslarite": 290,
    "Moissanite": 8971, "Pyrophyllite": 1736,
    "Bromellite": 7284,
}

# Skip non-tradeable categories for the commodity list
SKIP_CATEGORIES = {"NonMarketable", "Salvage"}
TRADEABLE_CATEGORIES = {
    "Metals", "Minerals", "Chemicals", "Foods", "Textiles",
    "Industrial Materials", "Medicines", "Legal Drugs", "Machinery",
    "Technology", "Weapons", "Consumer Items", "Slavery",
    "Waste",
}


def fetch(url: str) -> str:
    print(f"  Fetching {url} ...")
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode("utf-8-sig")


def parse_effect_modifier(effect_str: str) -> float:
    """Convert '+27%' → 1.27, '-10%' → 0.9"""
    m = re.match(r"([+-]?\d+(?:\.\d+)?)\s*%", effect_str.strip())
    if not m:
        return 1.0
    pct = float(m.group(1))
    return round(1.0 + pct / 100.0, 4)


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


# ── Commodities ─────────────────────────────────────────────────────────────

def build_commodities():
    print("\n[1/5] Building commodities.json …")
    raw = fetch(COMMODITY_CSV_URL)
    commodities = []
    for line in raw.strip().splitlines()[1:]:  # skip header
        parts = line.split(",", 3)
        if len(parts) < 4:
            continue
        fdev_id, symbol, category, name = parts
        if category not in TRADEABLE_CATEGORIES:
            continue
        commodities.append({
            "id": slugify(name),
            "fdev_id": int(fdev_id),
            "name": name,
            "category": category,
            "average_price": COMMODITY_PRICES.get(name, 0),
        })
    commodities.sort(key=lambda c: (c["category"], c["name"]))
    out = {"_source": "EDCD/FDevIDs commodity.csv", "commodities": commodities}
    (DATA_DIR / "commodities.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  OK  {len(commodities)} commodities")


# ── Material category lookup (from entryData.json) ───────────────────────────

def build_material_category_map(entry_data: list) -> dict:
    """name → category (Raw/Manufactured/Encoded/Guardian/Odyssey)"""
    cat_map = {}
    subkind_map = {"Raw": "Raw", "Manufactured": "Manufactured", "Encoded": "Encoded"}
    for item in entry_data:
        name = item.get("Name", "")
        kind = item.get("Kind", "")
        subkind = item.get("Subkind", "")
        if kind == "Material":
            cat_map[name.lower()] = subkind_map.get(subkind, subkind or "Material")
        elif kind == "Data":
            cat_map[name.lower()] = "Encoded"
        elif kind == "Commodity":
            cat_map[name.lower()] = "Commodity"
        elif kind == "OdysseyIngredient":
            cat_map[name.lower()] = "Odyssey"
    return cat_map


# ── Blueprints ───────────────────────────────────────────────────────────────

def build_blueprints(mat_cat: dict):
    print("\n[2/5] Building blueprints.json …")
    raw = fetch(BLUEPRINT_URL)
    entries = json.loads(raw)

    # Group by (Type, Name)
    grouped = defaultdict(lambda: {"engineers": set(), "grades": {}})
    for e in entries:
        if "Grade" not in e:
            continue
        key = (e["Type"], e["Name"])
        g = str(e["Grade"])
        grouped[key]["engineers"].update(e.get("Engineers", []))
        materials = [
            {
                "name": ing["Name"],
                "category": mat_cat.get(ing["Name"].lower(), ""),
                "amount": ing["Size"],
            }
            for ing in e.get("Ingredients", [])
        ]
        effects = []
        for eff in e.get("Effects", []):
            effects.append({
                "attribute": eff["Property"],
                "modifier": parse_effect_modifier(eff["Effect"]),
                "positive": eff.get("IsGood", True),
            })
        grouped[key]["grades"][g] = {"materials": materials, "effects": effects}

    blueprints = []
    for (bp_type, bp_name), data in grouped.items():
        blueprints.append({
            "id": slugify(f"{bp_type}_{bp_name}"),
            "name": bp_name,
            "applies_to": [bp_type],
            "engineers": sorted(data["engineers"]),
            "grades": data["grades"],
        })
    blueprints.sort(key=lambda b: (b["applies_to"][0], b["name"]))

    out = {"_source": "github.com/msarilar/EDEngineer", "blueprints": blueprints}
    (DATA_DIR / "blueprints.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  OK  {len(blueprints)} blueprints")


# ── Engineers ────────────────────────────────────────────────────────────────

ENGINEERS = [
    {
        "id": "felicity_farseer", "name": "Felicity Farseer",
        "location": "Deciat / Farseer Inc", "system": "Deciat", "station": "Farseer Inc",
        "specialties": ["FSD", "Thrusters", "Sensors", "Life Support"], "max_grade": 5,
        "invitation": "Reach 3 kly exploration data OR deliver 1 Soontill Relic",
        "unlock": "Provide 1 unit of Meta-Alloys",
    },
    {
        "id": "elvira_martuuk", "name": "Elvira Martuuk",
        "location": "Long Sight Base / Khun", "system": "Khun", "station": "Long Sight Base",
        "specialties": ["FSD", "Shields"], "max_grade": 5,
        "invitation": "Travel > 300 ly from starting system",
        "unlock": "Provide 3 units of Soontill Relics",
    },
    {
        "id": "the_dweller", "name": "The Dweller",
        "location": "Black Hide / Wyrd", "system": "Wyrd", "station": "Black Hide",
        "specialties": ["Power Distributor", "Weapons"], "max_grade": 5,
        "invitation": "Spend 500,000 CR in black markets",
        "unlock": "Provide 500,000 CR",
    },
    {
        "id": "marco_qwent", "name": "Marco Qwent",
        "location": "Qwent Research Base / Sirius", "system": "Sirius", "station": "Qwent Research Base",
        "specialties": ["Power Plant"], "max_grade": 4,
        "invitation": "Referred by Elvira Martuuk (need grade 3 unlock)",
        "unlock": "Provide 25 units of Modular Terminals",
    },
    {
        "id": "hera_tani", "name": "Hera Tani",
        "location": "The Jet's Hole / Kuwemaki", "system": "Kuwemaki", "station": "The Jet's Hole",
        "specialties": ["Power Plant", "Sensors"], "max_grade": 5,
        "invitation": "Spend 1,000,000 CR at black markets",
        "unlock": "Provide 50 units of Kamitra Cigars",
    },
    {
        "id": "lori_jameson", "name": "Lori Jameson",
        "location": "Jameson Base / Col 285 Sector IX-T d3-43", "system": "Col 285 Sector IX-T d3-43", "station": "Jameson Base",
        "specialties": ["Sensors", "Life Support"], "max_grade": 3,
        "invitation": "Referred by Marco Qwent (need grade 3 unlock)",
        "unlock": "Provide 25 units of Kongga Ale",
    },
    {
        "id": "bill_turner", "name": "Bill Turner",
        "location": "Alioth Research Centre / Alioth", "system": "Alioth", "station": "Alioth Research Centre",
        "specialties": ["Armour", "Sensors"], "max_grade": 5,
        "invitation": "Referred by Marco Qwent (need grade 3 unlock)",
        "unlock": "Provide 50 units of Bromellite",
    },
    {
        "id": "professor_palin", "name": "Professor Palin",
        "location": "Palin Research Centre / Arque", "system": "Arque", "station": "Palin Research Centre",
        "specialties": ["Thrusters"], "max_grade": 5,
        "invitation": "Travel > 5,000 ly from starting system",
        "unlock": "Provide 25 units of Sensor Fragments",
    },
    {
        "id": "selene_jean", "name": "Selene Jean",
        "location": "Prospector's Rest / Kuk", "system": "Kuk", "station": "Prospector's Rest",
        "specialties": ["Armour", "Hull Reinforcement"], "max_grade": 5,
        "invitation": "Mine 500 units of ore",
        "unlock": "Provide 10 units of Painite",
    },
    {
        "id": "lei_cheung", "name": "Lei Cheung",
        "location": "Trader's Rest / Laksak", "system": "Laksak", "station": "Trader's Rest",
        "specialties": ["Shields"], "max_grade": 5,
        "invitation": "Trade 50 markets",
        "unlock": "Provide 200 units of Gold",
    },
    {
        "id": "tod_mcquinn", "name": "Tod 'The Blaster' McQuinn",
        "location": "Trophy Camp / Wolf 397", "system": "Wolf 397", "station": "Trophy Camp",
        "specialties": ["Multi-cannon", "Fragmentation Cannon"], "max_grade": 5,
        "invitation": "Earn a bounty voucher ≥ 50,000 CR in Wolf 397",
        "unlock": "Provide bounty vouchers worth 100,000 CR in Wolf 397",
    },
    {
        "id": "broo_tarquin", "name": "Broo Tarquin",
        "location": "Broo's Legacy / Muang", "system": "Muang", "station": "Broo's Legacy",
        "specialties": ["Beam Laser", "Burst Laser"], "max_grade": 5,
        "invitation": "Earn combat bonds worth 5,000 CR",
        "unlock": "Provide 50 units of Fujin Tea",
    },
    {
        "id": "the_sarge", "name": "The Sarge",
        "location": "The Sarge's Saloon / Beta Sculptoris", "system": "Beta Sculptoris", "station": "The Sarge's Saloon",
        "specialties": ["Weapons"], "max_grade": 3,
        "invitation": "Earn 10 bounties",
        "unlock": "Provide bounty vouchers worth 50,000 CR from Beta Sculptoris",
    },
    {
        "id": "juri_ishmaak", "name": "Juri Ishmaak",
        "location": "Perkam Relay / Giryak", "system": "Giryak", "station": "Perkam Relay",
        "specialties": ["Mine", "Missile", "Scanner"], "max_grade": 5,
        "invitation": "Earn 10 combat bonds",
        "unlock": "Provide combat bonds worth 100,000 CR",
    },
    {
        "id": "zacariah_nemo", "name": "Zacariah Nemo",
        "location": "Nemo Cyber Party Base / Yoru", "system": "Yoru", "station": "Nemo Cyber Party Base",
        "specialties": ["Pulse Laser", "Burst Laser"], "max_grade": 5,
        "invitation": "Referred by The Dweller (need grade 3 unlock)",
        "unlock": "Provide 25 units of Yoru Superspice",
    },
    {
        "id": "didi_vatermann", "name": "Didi Vatermann",
        "location": "Vatermann LLC / Leesti", "system": "Leesti", "station": "Vatermann LLC",
        "specialties": ["Shield Booster"], "max_grade": 5,
        "invitation": "Trade 37 markets",
        "unlock": "Provide 25 units of Leestian Evil Juice",
    },
    {
        "id": "etienne_dorn", "name": "Etienne Dorn",
        "location": "The Brig / Los / Maia", "system": "Los", "station": "The Brig",
        "specialties": ["Plasma Accelerator", "Cannon", "Weapons"], "max_grade": 5,
        "invitation": "Referred by Selene Jean (need grade 3 unlock)",
        "unlock": "Provide 25 units of Unknown Fragment",
    },
    {
        "id": "mel_brandon", "name": "Mel Brandon",
        "location": "The Brig / Hyades Sector DR-V c2-23", "system": "Hyades Sector DR-V c2-23", "station": "The Brig",
        "specialties": ["FSD", "Shields", "Weapons"], "max_grade": 5,
        "invitation": "Referred by The Dweller (need grade 3 unlock)",
        "unlock": "Provide 25 units of Tanmark Tranquil Tea",
    },
    {
        "id": "ram_tah", "name": "Ram Tah",
        "location": "Phoenix Base / Meene", "system": "Meene", "station": "Phoenix Base",
        "specialties": ["Weapons"], "max_grade": 5,
        "invitation": "Referred by Elvira Martuuk (need grade 3 unlock)",
        "unlock": "Provide 50 units of Occupied Escape Pod",
    },
    {
        "id": "petra_olmanova", "name": "Petra Olmanova",
        "location": "Sp. Olmanova's Studio / Asphodel in Etain", "system": "Etain", "station": "Sp. Olmanova's Studio",
        "specialties": ["Armour"], "max_grade": 3,
        "invitation": "Earn 100 combat bonds",
        "unlock": "Provide 200 units of Progenitor Cells",
    },
    {
        "id": "kit_fowler", "name": "Kit Fowler",
        "location": "The Stained Saucer / Capoya", "system": "Capoya", "station": "The Stained Saucer",
        "specialties": ["Weapons"], "max_grade": 5,
        "invitation": "Referred by Tod 'The Blaster' McQuinn (need grade 3 unlock)",
        "unlock": "Provide 50 units of Uszaian Tree Grub",
    },
    {
        "id": "eleanor_bresa", "name": "Eleanor Bresa",
        "location": "Bresa Modifications / Marralteki", "system": "Marralteki", "station": "Bresa Modifications",
        "specialties": ["Thrusters"], "max_grade": 5,
        "invitation": "Referred by Professor Palin (need grade 3 unlock)",
        "unlock": "Provide 25 units of Aganippe Rush",
    },
    {
        "id": "yi_shen", "name": "Yi Shen",
        "location": "Awyra Flirble / Kuwemaki", "system": "Kuwemaki", "station": "Awyra Flirble",
        "specialties": ["Shields"], "max_grade": 5,
        "invitation": "Referred by Lei Cheung (need grade 3 unlock)",
        "unlock": "Provide 50 units of Rusani Old Smokey",
    },
]

def build_engineers():
    print("\n[3/5] Building engineers.json …")
    out = {"_source": "Community data / Inara / EDCD", "engineers": ENGINEERS}
    (DATA_DIR / "engineers.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  OK  {len(ENGINEERS)} engineers")


# ── Synthesis ────────────────────────────────────────────────────────────────

SYNTHESIS = [
    # Ammunition
    {"id": "ammo_basic", "name": "Basic Munitions Reload", "category": "Ammunition", "grade": "Basic",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Sulphur", "category": "Raw", "amount": 1}]},
    {"id": "ammo_standard", "name": "Standard Munitions Reload", "category": "Ammunition", "grade": "Standard",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Carbon", "category": "Raw", "amount": 1}, {"name": "Zinc", "category": "Raw", "amount": 1}]},
    {"id": "ammo_premium", "name": "Premium Munitions Reload", "category": "Ammunition", "grade": "Premium",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Zinc", "category": "Raw", "amount": 2}, {"name": "Manganese", "category": "Raw", "amount": 1}, {"name": "Selenium", "category": "Raw", "amount": 1}]},
    # SRV Ammo
    {"id": "srv_ammo_basic", "name": "SRV Ammo Restock (Basic)", "category": "SRV", "grade": "Basic",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 2}, {"name": "Phosphorus", "category": "Raw", "amount": 1}]},
    {"id": "srv_ammo_standard", "name": "SRV Ammo Restock (Standard)", "category": "SRV", "grade": "Standard",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 2}, {"name": "Phosphorus", "category": "Raw", "amount": 1}, {"name": "Iron", "category": "Raw", "amount": 1}, {"name": "Arsenic", "category": "Raw", "amount": 1}]},
    {"id": "srv_ammo_premium", "name": "SRV Ammo Restock (Premium)", "category": "SRV", "grade": "Premium",
     "materials": [{"name": "Phosphorus", "category": "Raw", "amount": 2}, {"name": "Manganese", "category": "Raw", "amount": 2}, {"name": "Molybdenum", "category": "Raw", "amount": 1}]},
    # SRV Fuel
    {"id": "srv_fuel_basic", "name": "SRV Refuel (Basic)", "category": "SRV", "grade": "Basic",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 1}]},
    {"id": "srv_fuel_standard", "name": "SRV Refuel (Standard)", "category": "SRV", "grade": "Standard",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 1}, {"name": "Carbon", "category": "Raw", "amount": 1}, {"name": "Phosphorus", "category": "Raw", "amount": 1}]},
    {"id": "srv_fuel_premium", "name": "SRV Refuel (Premium)", "category": "SRV", "grade": "Premium",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 1}, {"name": "Carbon", "category": "Raw", "amount": 1}, {"name": "Phosphorus", "category": "Raw", "amount": 1}, {"name": "Mercury", "category": "Raw", "amount": 1}]},
    # SRV Repair
    {"id": "srv_repair_basic", "name": "SRV Repair (Basic)", "category": "SRV", "grade": "Basic",
     "materials": [{"name": "Iron", "category": "Raw", "amount": 2}, {"name": "Nickel", "category": "Raw", "amount": 1}]},
    {"id": "srv_repair_standard", "name": "SRV Repair (Standard)", "category": "SRV", "grade": "Standard",
     "materials": [{"name": "Iron", "category": "Raw", "amount": 2}, {"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Manganese", "category": "Raw", "amount": 1}]},
    {"id": "srv_repair_premium", "name": "SRV Repair (Premium)", "category": "SRV", "grade": "Premium",
     "materials": [{"name": "Iron", "category": "Raw", "amount": 2}, {"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Manganese", "category": "Raw", "amount": 1}, {"name": "Molybdenum", "category": "Raw", "amount": 1}]},
    # AFMU
    {"id": "afmu_basic", "name": "AFMU Ammo (Basic)", "category": "AFMU", "grade": "Basic",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Vanadium", "category": "Raw", "amount": 1}]},
    {"id": "afmu_standard", "name": "AFMU Ammo (Standard)", "category": "AFMU", "grade": "Standard",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Vanadium", "category": "Raw", "amount": 2}, {"name": "Zirconium", "category": "Raw", "amount": 1}]},
    {"id": "afmu_premium", "name": "AFMU Ammo (Premium)", "category": "AFMU", "grade": "Premium",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Vanadium", "category": "Raw", "amount": 2}, {"name": "Zirconium", "category": "Raw", "amount": 1}, {"name": "Tin", "category": "Raw", "amount": 1}]},
    # FSD Injection
    {"id": "fsd_basic", "name": "FSD Injection (Basic)", "category": "FSD", "grade": "Basic",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 3}, {"name": "Carbon", "category": "Raw", "amount": 1}]},
    {"id": "fsd_standard", "name": "FSD Injection (Standard)", "category": "FSD", "grade": "Standard",
     "materials": [{"name": "Vanadium", "category": "Raw", "amount": 1}, {"name": "Germanium", "category": "Raw", "amount": 1}, {"name": "Cadmium", "category": "Raw", "amount": 1}]},
    {"id": "fsd_premium", "name": "FSD Injection (Premium)", "category": "FSD", "grade": "Premium",
     "materials": [{"name": "Arsenic", "category": "Raw", "amount": 1}, {"name": "Niobium", "category": "Raw", "amount": 1}, {"name": "Yttrium", "category": "Raw", "amount": 1}]},
    # Heat Sinks
    {"id": "heatsink_basic", "name": "Heat Sink (Basic)", "category": "Heat Sink", "grade": "Basic",
     "materials": [{"name": "Basic Conductors", "category": "Manufactured", "amount": 2}, {"name": "Heat Conduction Wiring", "category": "Manufactured", "amount": 1}]},
    {"id": "heatsink_standard", "name": "Heat Sink (Standard)", "category": "Heat Sink", "grade": "Standard",
     "materials": [{"name": "Heat Conduction Wiring", "category": "Manufactured", "amount": 2}, {"name": "Heat Dispersion Plate", "category": "Manufactured", "amount": 1}, {"name": "Mechanical Components", "category": "Manufactured", "amount": 1}]},
    {"id": "heatsink_premium", "name": "Heat Sink (Premium)", "category": "Heat Sink", "grade": "Premium",
     "materials": [{"name": "Heat Exchangers", "category": "Manufactured", "amount": 2}, {"name": "Heat Vanes", "category": "Manufactured", "amount": 1}, {"name": "Proprietary Composites", "category": "Manufactured", "amount": 1}]},
    # Life Support
    {"id": "life_support_basic", "name": "Life Support (Basic)", "category": "Life Support", "grade": "Basic",
     "materials": [{"name": "Iron", "category": "Raw", "amount": 2}, {"name": "Nickel", "category": "Raw", "amount": 1}]},
    {"id": "life_support_standard", "name": "Life Support (Standard)", "category": "Life Support", "grade": "Standard",
     "materials": [{"name": "Iron", "category": "Raw", "amount": 2}, {"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Basic Conductors", "category": "Manufactured", "amount": 1}]},
    {"id": "life_support_premium", "name": "Life Support (Premium)", "category": "Life Support", "grade": "Premium",
     "materials": [{"name": "Iron", "category": "Raw", "amount": 2}, {"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Manganese", "category": "Raw", "amount": 1}, {"name": "Basic Conductors", "category": "Manufactured", "amount": 1}]},
    # Chaff
    {"id": "chaff_basic", "name": "Chaff (Basic)", "category": "Chaff", "grade": "Basic",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 1}, {"name": "Salvaged Alloys", "category": "Manufactured", "amount": 1}]},
    {"id": "chaff_standard", "name": "Chaff (Standard)", "category": "Chaff", "grade": "Standard",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 1}, {"name": "Zirconium", "category": "Raw", "amount": 1}, {"name": "Worn Shield Emitters", "category": "Manufactured", "amount": 1}]},
    {"id": "chaff_premium", "name": "Chaff (Premium)", "category": "Chaff", "grade": "Premium",
     "materials": [{"name": "Niobium", "category": "Raw", "amount": 1}, {"name": "Tin", "category": "Raw", "amount": 1}, {"name": "Shield Emitters", "category": "Manufactured", "amount": 1}]},
    # Point Defence
    {"id": "pd_basic", "name": "Point Defence (Basic)", "category": "Point Defence", "grade": "Basic",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 1}, {"name": "Carbon", "category": "Raw", "amount": 1}]},
    {"id": "pd_standard", "name": "Point Defence (Standard)", "category": "Point Defence", "grade": "Standard",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 1}, {"name": "Carbon", "category": "Raw", "amount": 1}, {"name": "Zinc", "category": "Raw", "amount": 1}, {"name": "Mechanical Scrap", "category": "Manufactured", "amount": 1}]},
    {"id": "pd_premium", "name": "Point Defence (Premium)", "category": "Point Defence", "grade": "Premium",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 1}, {"name": "Carbon", "category": "Raw", "amount": 1}, {"name": "Zirconium", "category": "Raw", "amount": 1}, {"name": "Selenium", "category": "Raw", "amount": 1}, {"name": "Mechanical Equipment", "category": "Manufactured", "amount": 1}]},
    # Fuel
    {"id": "fuel_basic", "name": "Fuel (Basic)", "category": "Fuel", "grade": "Basic",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 1}]},
    {"id": "fuel_standard", "name": "Fuel (Standard)", "category": "Fuel", "grade": "Standard",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 1}, {"name": "Carbon", "category": "Raw", "amount": 1}]},
    {"id": "fuel_premium", "name": "Fuel (Premium)", "category": "Fuel", "grade": "Premium",
     "materials": [{"name": "Sulphur", "category": "Raw", "amount": 1}, {"name": "Carbon", "category": "Raw", "amount": 1}, {"name": "Phosphorus", "category": "Raw", "amount": 1}]},
    # Repair
    {"id": "repair_basic", "name": "Repair (Basic)", "category": "Repair", "grade": "Basic",
     "materials": [{"name": "Iron", "category": "Raw", "amount": 2}, {"name": "Nickel", "category": "Raw", "amount": 1}]},
    {"id": "repair_standard", "name": "Repair (Standard)", "category": "Repair", "grade": "Standard",
     "materials": [{"name": "Iron", "category": "Raw", "amount": 2}, {"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Manganese", "category": "Raw", "amount": 1}]},
    {"id": "repair_premium", "name": "Repair (Premium)", "category": "Repair", "grade": "Premium",
     "materials": [{"name": "Iron", "category": "Raw", "amount": 2}, {"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Vanadium", "category": "Raw", "amount": 1}, {"name": "Zirconium", "category": "Raw", "amount": 1}]},
    # Shield Cell Bank
    {"id": "scb_basic", "name": "Shield Cell Bank (Basic)", "category": "Shield Cell Bank", "grade": "Basic",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Phosphorus", "category": "Raw", "amount": 1}, {"name": "Worn Shield Emitters", "category": "Manufactured", "amount": 1}]},
    {"id": "scb_standard", "name": "Shield Cell Bank (Standard)", "category": "Shield Cell Bank", "grade": "Standard",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Phosphorus", "category": "Raw", "amount": 1}, {"name": "Shield Emitters", "category": "Manufactured", "amount": 1}, {"name": "Polonium", "category": "Raw", "amount": 1}]},
    {"id": "scb_premium", "name": "Shield Cell Bank (Premium)", "category": "Shield Cell Bank", "grade": "Premium",
     "materials": [{"name": "Nickel", "category": "Raw", "amount": 2}, {"name": "Phosphorus", "category": "Raw", "amount": 1}, {"name": "Shielding Sensors", "category": "Manufactured", "amount": 1}, {"name": "Mercury", "category": "Raw", "amount": 1}, {"name": "Antimony", "category": "Raw", "amount": 1}]},
]

def build_synthesis():
    print("\n[4/5] Building synthesis.json …")
    out = {"_source": "Community data / Elite Dangerous wiki", "synthesis": SYNTHESIS}
    (DATA_DIR / "synthesis.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  OK  {len(SYNTHESIS)} synthesis recipes")


# ── Tech Brokers ─────────────────────────────────────────────────────────────

TECH_BROKER_ITEMS = [
    # Guardian Tech Broker
    {"id": "guardian_fsd_booster", "name": "Guardian FSD Booster", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 10}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 10}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 6}, {"name": "Focus Crystals", "category": "Manufactured", "amount": 8}, {"name": "HN Shock Mount", "category": "Manufactured", "amount": 10}, {"name": "Manganese", "category": "Raw", "amount": 10}, {"name": "Arsenic", "category": "Raw", "amount": 10}]},
    {"id": "guardian_module_reinf", "name": "Guardian Module Reinforcement Package", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 15}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 5}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 4}, {"name": "Mechanical Scrap", "category": "Manufactured", "amount": 9}, {"name": "Vanadium", "category": "Raw", "amount": 10}, {"name": "Chromium", "category": "Raw", "amount": 6}]},
    {"id": "guardian_hull_reinf", "name": "Guardian Hull Reinforcement Package", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 10}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 12}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 5}, {"name": "Mechanical Components", "category": "Manufactured", "amount": 15}, {"name": "Molybdenum", "category": "Raw", "amount": 8}]},
    {"id": "guardian_shield_reinf", "name": "Guardian Shield Reinforcement Package", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 10}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 8}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 6}, {"name": "Phase Alloys", "category": "Manufactured", "amount": 10}, {"name": "Tin", "category": "Raw", "amount": 10}]},
    {"id": "guardian_gauss_fixed_small", "name": "Guardian Gauss Cannon (Fixed/Small)", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 3}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 4}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 2}, {"name": "Manganese", "category": "Raw", "amount": 3}, {"name": "Focus Crystals", "category": "Manufactured", "amount": 3}]},
    {"id": "guardian_gauss_fixed_medium", "name": "Guardian Gauss Cannon (Fixed/Medium)", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 4}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 6}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 3}, {"name": "Arsenic", "category": "Raw", "amount": 4}, {"name": "Focus Crystals", "category": "Manufactured", "amount": 4}]},
    {"id": "guardian_plasma_fixed_small", "name": "Guardian Plasma Charger (Fixed/Small)", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 3}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 4}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 2}, {"name": "Chromium", "category": "Raw", "amount": 3}, {"name": "Heat Vanes", "category": "Manufactured", "amount": 3}]},
    {"id": "guardian_plasma_fixed_medium", "name": "Guardian Plasma Charger (Fixed/Medium)", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 4}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 6}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 3}, {"name": "Selenium", "category": "Raw", "amount": 4}, {"name": "Heat Vanes", "category": "Manufactured", "amount": 4}]},
    {"id": "guardian_shard_fixed_small", "name": "Guardian Shard Cannon (Fixed/Small)", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 3}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 4}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 2}, {"name": "Carbon", "category": "Raw", "amount": 3}, {"name": "Mechanical Scrap", "category": "Manufactured", "amount": 3}]},
    {"id": "guardian_shard_fixed_medium", "name": "Guardian Shard Cannon (Fixed/Medium)", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 4}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 6}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 3}, {"name": "Vanadium", "category": "Raw", "amount": 4}, {"name": "Mechanical Components", "category": "Manufactured", "amount": 4}]},
    {"id": "guardian_shard_turret_small", "name": "Guardian Shard Cannon (Turret/Small)", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 4}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 5}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 3}, {"name": "Carbon", "category": "Raw", "amount": 4}, {"name": "Mechanical Components", "category": "Manufactured", "amount": 4}]},
    {"id": "guardian_plasma_turret_small", "name": "Guardian Plasma Charger (Turret/Small)", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 4}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 5}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 3}, {"name": "Chromium", "category": "Raw", "amount": 4}, {"name": "Heat Vanes", "category": "Manufactured", "amount": 4}]},
    {"id": "guardian_gauss_turret_small", "name": "Guardian Gauss Cannon (Turret/Small)", "type": "Guardian", "cost_credits": 0,
     "materials": [{"name": "Guardian Power Cell", "category": "Guardian", "amount": 4}, {"name": "Guardian Sentinel Weapon Parts", "category": "Guardian", "amount": 5}, {"name": "Guardian Technology Component", "category": "Guardian", "amount": 3}, {"name": "Manganese", "category": "Raw", "amount": 4}, {"name": "Focus Crystals", "category": "Manufactured", "amount": 4}]},
    # Human Tech Broker
    {"id": "meta_alloy_hull_reinf", "name": "Meta-Alloy Hull Reinforcement Package", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Meta-Alloys", "category": "Commodity", "amount": 1}, {"name": "Reinforced Mounting Plate", "category": "Manufactured", "amount": 15}, {"name": "Compound Shielding", "category": "Manufactured", "amount": 10}, {"name": "Proprietary Composites", "category": "Manufactured", "amount": 10}]},
    {"id": "shock_cannon_fixed_small", "name": "Shock Cannon (Fixed/Small)", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Vanadium", "category": "Raw", "amount": 5}, {"name": "Tungsten", "category": "Raw", "amount": 5}, {"name": "Rhenium", "category": "Raw", "amount": 3}, {"name": "Mechanical Components", "category": "Manufactured", "amount": 5}, {"name": "Compound Shielding", "category": "Manufactured", "amount": 5}]},
    {"id": "shock_cannon_fixed_medium", "name": "Shock Cannon (Fixed/Medium)", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Vanadium", "category": "Raw", "amount": 8}, {"name": "Tungsten", "category": "Raw", "amount": 8}, {"name": "Technetium", "category": "Raw", "amount": 4}, {"name": "Mechanical Components", "category": "Manufactured", "amount": 8}, {"name": "Compound Shielding", "category": "Manufactured", "amount": 8}]},
    {"id": "shock_cannon_fixed_large", "name": "Shock Cannon (Fixed/Large)", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Vanadium", "category": "Raw", "amount": 10}, {"name": "Tungsten", "category": "Raw", "amount": 10}, {"name": "Technetium", "category": "Raw", "amount": 5}, {"name": "Mechanical Components", "category": "Manufactured", "amount": 10}, {"name": "Compound Shielding", "category": "Manufactured", "amount": 10}]},
    {"id": "shock_cannon_turret_small", "name": "Shock Cannon (Turret/Small)", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Vanadium", "category": "Raw", "amount": 5}, {"name": "Tungsten", "category": "Raw", "amount": 5}, {"name": "Rhenium", "category": "Raw", "amount": 3}, {"name": "Mechanical Equipment", "category": "Manufactured", "amount": 5}, {"name": "Compound Shielding", "category": "Manufactured", "amount": 5}]},
    {"id": "enzyme_missile_fixed_large", "name": "Enzyme Missile Rack (Fixed/Large)", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Thargoid Link", "category": "Commodity", "amount": 3}, {"name": "Thargoid Resin", "category": "Commodity", "amount": 12}, {"name": "Propulsion Elements", "category": "Manufactured", "amount": 12}, {"name": "Explosive Shielding", "category": "Manufactured", "amount": 8}, {"name": "Mechanical Components", "category": "Manufactured", "amount": 8}, {"name": "Rhenium", "category": "Raw", "amount": 10}]},
    {"id": "remote_release_flak_fixed_medium", "name": "Remote Release Flak Launcher (Fixed/Medium)", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Thargoid Sensor", "category": "Commodity", "amount": 3}, {"name": "Thargoid Resin", "category": "Commodity", "amount": 10}, {"name": "Mechanical Components", "category": "Manufactured", "amount": 9}, {"name": "Conductive Polymers", "category": "Manufactured", "amount": 7}, {"name": "Arsenic", "category": "Raw", "amount": 8}]},
    {"id": "caustic_sink_launcher_utility", "name": "Caustic Sink Launcher (Utility)", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Caustic Tissue Sample", "category": "Commodity", "amount": 5}, {"name": "Thargoid Resin", "category": "Commodity", "amount": 10}, {"name": "Mechanical Components", "category": "Manufactured", "amount": 8}, {"name": "Tin", "category": "Raw", "amount": 6}]},
    {"id": "xeno_scanner_utility", "name": "Xeno Scanner (Utility)", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Thargoid Sensor", "category": "Commodity", "amount": 4}, {"name": "Thargoid Biological Matter", "category": "Commodity", "amount": 8}, {"name": "Conductive Polymers", "category": "Manufactured", "amount": 6}, {"name": "Polo Ytterbium", "category": "Raw", "amount": 4}]},
    {"id": "pulse_wave_xeno_scanner_utility", "name": "Pulse Wave Xeno Scanner (Utility)", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Thargoid Sensor", "category": "Commodity", "amount": 4}, {"name": "Thargoid Technology Samples", "category": "Commodity", "amount": 6}, {"name": "Conductive Polymers", "category": "Manufactured", "amount": 8}, {"name": "Yttrium", "category": "Raw", "amount": 4}]},
    {"id": "nanite_torpedo_pylon", "name": "Nanite Torpedo Pylon", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Titan Tissue Sample", "category": "Commodity", "amount": 2}, {"name": "Titan Drive Component", "category": "Commodity", "amount": 2}, {"name": "Pharmaceutical Isolators", "category": "Encoded", "amount": 10}, {"name": "Conductive Polymers", "category": "Manufactured", "amount": 8}, {"name": "Antimony", "category": "Raw", "amount": 8}]},
    {"id": "thargoid_pulse_neutraliser", "name": "Thargoid Pulse Neutraliser (Utility)", "type": "Human", "cost_credits": 0,
     "materials": [{"name": "Titan Deep Tissue Sample", "category": "Commodity", "amount": 1}, {"name": "Caustic Tissue Sample", "category": "Commodity", "amount": 8}, {"name": "Compound Shielding", "category": "Manufactured", "amount": 8}, {"name": "Niobium", "category": "Raw", "amount": 6}]},
]

def build_tech_brokers():
    print("\n[5/5] Building tech_brokers.json …")
    out = {"_source": "Community data / Inara / EDCD", "items": TECH_BROKER_ITEMS}
    (DATA_DIR / "tech_brokers.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  OK  {len(TECH_BROKER_ITEMS)} tech broker items")


# ── Ships ────────────────────────────────────────────────────────────────────

SHIPS_TREE_URL = "https://api.github.com/repos/EDCD/coriolis-data/contents/ships"
SHIP_RAW_BASE = "https://raw.githubusercontent.com/EDCD/coriolis-data/master/ships/"

# coriolis-data slots.standard is a fixed-order array of the 7 core internals.
CORE_SLOT_NAMES = [
    "Power Plant", "Thrusters", "Frame Shift Drive", "Life Support",
    "Power Distributor", "Sensors", "Fuel Tank",
]
# hardpoint slot size codes (0 = utility mount)
HARDPOINT_SIZE_NAMES = {1: "Small", 2: "Medium", 3: "Large", 4: "Huge"}


def _internal_class(entry):
    """internal slot entry is either an int size or a {class, name} object."""
    if isinstance(entry, dict):
        return int(entry.get("class", 0)), entry.get("name", "")
    return int(entry), ""


def build_ships():
    print("\n[6/7] Building ships.json …")
    listing = json.loads(fetch(SHIPS_TREE_URL))
    files = sorted(it["name"] for it in listing
                   if it["name"].endswith(".json") and it["name"] != "index.js")

    ships = []
    for fname in files:
        raw = json.loads(fetch(SHIP_RAW_BASE + fname))
        # each file is {"<id>": {...}}
        ship_id, s = next(iter(raw.items()))
        p = s.get("properties", {}) or {}
        slots = s.get("slots", {}) or {}

        hp_raw = [_internal_class(h)[0] for h in (slots.get("hardpoints", []) or [])]
        hardpoint_sizes = sorted((h for h in hp_raw if h > 0), reverse=True)
        utility_slots = sum(1 for h in hp_raw if h == 0)
        hp_counts = {"Huge": 0, "Large": 0, "Medium": 0, "Small": 0}
        for h in hardpoint_sizes:
            hp_counts[HARDPOINT_SIZE_NAMES[h]] += 1

        optional, military, planetary = [], [], []
        for entry in slots.get("internal", []) or []:
            cls, name = _internal_class(entry)
            if name == "Military":
                military.append(cls)
            elif name == "PlanetaryApproachSuite":
                planetary.append(cls)
            else:
                optional.append(cls)

        # 5 armour grades (Lightweight → Reactive). hullboost: armour =
        # baseArmour × (1 + hullboost). Resistances are fractions (-0.4 = -40%).
        bulkheads = []
        for i, b in enumerate(s.get("bulkheads", []) or []):
            bulkheads.append({
                "index": i,
                "name": b.get("name", f"Bulkhead {i}"),
                "cost": b.get("cost", 0),
                "mass": b.get("mass", 0),
                "hullboost": b.get("hullboost", 0),
                "kinres": b.get("kinres", 0),
                "thermres": b.get("thermres", 0),
                "explres": b.get("explres", 0),
                "causres": b.get("causres", 0),
            })

        ships.append({
            "id": ship_id,
            "name": p.get("name", ship_id),
            "manufacturer": p.get("manufacturer", ""),
            "pad_size": int(p.get("class", 0)),          # 1=S 2=M 3=L landing pad
            "crew": p.get("crew", 1),
            "cost": s.get("retailCost") or p.get("hullCost", 0),
            "hull_mass": p.get("hullMass", 0),
            "speed": p.get("speed", 0),
            "boost": p.get("boost", 0),
            "shields": p.get("baseShieldStrength", 0),
            "armour": p.get("baseArmour", 0),
            "hardness": p.get("hardness", 0),
            "masslock": p.get("masslock", 0),
            "pitch": p.get("pitch", 0),
            "roll": p.get("roll", 0),
            "yaw": p.get("yaw", 0),
            "boost_energy": p.get("boostEnergy", 0),
            "heat_capacity": p.get("heatCapacity", 0),
            "reserve_fuel": p.get("reserveFuelCapacity", 0),
            "bulkheads": bulkheads,
            "core_slots": [int(x) for x in slots.get("standard", [])],
            "hardpoint_sizes": hardpoint_sizes,
            "hardpoint_counts": hp_counts,
            "utility_slots": utility_slots,
            "optional_slots": sorted(optional, reverse=True),
            "military_slots": sorted(military, reverse=True),
            "planetary_slots": sorted(planetary, reverse=True),
        })

    ships.sort(key=lambda x: x["name"])
    out = {"_source": "github.com/EDCD/coriolis-data (ships/)", "ships": ships}
    (DATA_DIR / "ships.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  OK  {len(ships)} ships")


# ── Outfitting modules ───────────────────────────────────────────────────────

MODULES_TREE_URL = "https://api.github.com/repos/EDCD/coriolis-data/contents/modules/{}"
MODULE_RAW_BASE = "https://raw.githubusercontent.com/EDCD/coriolis-data/master/modules/{}/{}"

# coriolis group code (grp) → friendly display name. Falls back to ukName/grp.
GROUP_NAMES = {
    # core / standard
    "pp": "Power Plant", "t": "Thrusters", "fsd": "Frame Shift Drive",
    "ls": "Life Support", "pd": "Power Distributor", "s": "Sensors", "ft": "Fuel Tank",
    # optional internals
    "cr": "Cargo Rack", "sg": "Shield Generator", "psg": "Prismatic Shield Generator",
    "bsg": "Bi-Weave Shield Generator", "hr": "Hull Reinforcement Package",
    "mrp": "Module Reinforcement Package", "scb": "Shield Cell Bank",
    "fsi": "FSD Interdictor", "dss": "Detailed Surface Scanner", "fs": "Fuel Scoop",
    "rf": "Refinery", "am": "Auto Field-Maintenance Unit", "fh": "Fighter Hangar",
    "pv": "Planetary Vehicle Hangar", "pce": "Economy Class Passenger Cabin",
    "pci": "Business Class Passenger Cabin", "pcm": "First Class Passenger Cabin",
    "pcq": "Luxury Class Passenger Cabin", "dc": "Docking Computer",
    "sua": "Supercruise Assist", "gfsb": "Guardian FSD Booster",
    "ghrp": "Guardian Hull Reinforcement", "gmrp": "Guardian Module Reinforcement",
    "gsrp": "Guardian Shield Reinforcement", "mahr": "Meta Alloy Hull Reinforcement",
    "cc": "Collector Limpet Controller", "fx": "Fuel Transfer Limpet Controller",
    "pc": "Prospector Limpet Controller", "hb": "Hatch Breaker Limpet Controller",
    "rpl": "Recon Limpet Controller", "rsl": "Research Limpet Controller",
    "dtc": "Decontamination Limpet Controller", "mrl": "Multi Limpet Controller",
    # hardpoints (weapons)
    "bl": "Beam Laser", "pl": "Pulse Laser", "ul": "Burst Laser", "mc": "Multi-cannon",
    "c": "Cannon", "fc": "Fragment Cannon", "rg": "Rail Gun", "pa": "Plasma Accelerator",
    "mr": "Missile Rack", "dtt": "Dumbfire Missile Rack", "tp": "Torpedo Pylon",
    "nl": "Mine Launcher", "rfl": "Remote Release Flak Launcher", "axmc": "AX Multi-cannon",
    "axmr": "AX Missile Rack", "rcpl": "Retributor Beam Laser", "gc": "Guardian Gauss Cannon",
    "gpc": "Guardian Plasma Charger", "gsc": "Guardian Shard Cannon",
    "scan": "Pulse Wave Analyser", "sfn": "Shock Cannon",
    # utility mounts
    "ch": "Chaff Launcher", "hs": "Heat Sink Launcher", "po": "Point Defence",
    "ec": "Electronic Countermeasure", "sb": "Shield Booster", "kw": "Kill Warrant Scanner",
    "cs": "Manifest Scanner", "ss": "Frame Shift Wake Scanner", "xs": "Xeno Scanner",
    "pwa": "Pulse Wave Xeno Scanner", "csl": "Caustic Sink Launcher",
    "tbrp": "Shutdown Field Neutraliser",
}

# core-slot ordering (matches ships.json core_slots order — see CORE_SLOT_NAMES)
CORE_GROUP_ORDER = ["pp", "t", "fsd", "ls", "pd", "s", "ft"]

# verbose source fields we don't need at runtime
_DROP_FIELDS = {"ukDiscript", "edID", "eddbID"}


def _clean_module(entry: dict, group: str, family: str, military_ok: bool) -> dict:
    m = {k: v for k, v in entry.items() if k not in _DROP_FIELDS}
    m["grp"] = group
    m["family"] = family                     # core | hardpoint | utility | optional
    m["group_name"] = GROUP_NAMES.get(group, entry.get("ukName") or group)
    # variant label (e.g. "Bi-Weave", "Enhanced Low Power") — coriolis 'name' field
    variant = entry.get("name")
    base = m["group_name"]
    m["display"] = f"{base} ({variant})" if variant and variant not in base else base
    if military_ok:
        m["military_ok"] = True
    return m


def _fetch_module_dir(subdir: str) -> list:
    """Every module file in modules/<subdir>/, flattened to entry dicts with grp."""
    listing = json.loads(fetch(MODULES_TREE_URL.format(subdir)))
    files = sorted(it["name"] for it in listing
                   if it["name"].endswith(".json"))
    entries = []
    for fname in files:
        raw = json.loads(fetch(MODULE_RAW_BASE.format(subdir, fname)))
        # module files are {"<grp>": [ {entry}, ... ]}; be defensive about shape
        blocks = raw.values() if isinstance(raw, dict) else [raw]
        for block in blocks:
            if isinstance(block, list):
                entries.extend(e for e in block if isinstance(e, dict))
    return entries


def build_modules():
    print("\n[7/7] Building modules.json …")
    core, hardpoint, utility, optional = {}, {}, {}, {}

    # standard/ → core internals
    for e in _fetch_module_dir("standard"):
        grp = e.get("grp", "")
        core.setdefault(grp, []).append(_clean_module(e, grp, "core", False))

    # hardpoints/ → weapon (has a mount) or utility mount (no mount)
    for e in _fetch_module_dir("hardpoints"):
        grp = e.get("grp", "")
        if e.get("mount") and int(e.get("class", 0)) >= 1:
            hardpoint.setdefault(grp, []).append(_clean_module(e, grp, "hardpoint", False))
        else:
            utility.setdefault(grp, []).append(_clean_module(e, grp, "utility", False))

    # internal/ → optional; tag military-slot eligibility by name
    for e in _fetch_module_dir("internal"):
        grp = e.get("grp", "")
        name = f"{GROUP_NAMES.get(grp, '')} {e.get('ukName','')} {e.get('name','')}".lower()
        mil = "reinforcement" in name
        optional.setdefault(grp, []).append(_clean_module(e, grp, "optional", mil))

    def _sort(groups):
        for g in groups.values():
            g.sort(key=lambda m: (int(m.get("class", 0)), m.get("rating", "Z")))
        return groups

    out = {
        "_source": "github.com/EDCD/coriolis-data (modules/)",
        "core_group_order": CORE_GROUP_ORDER,
        "group_names": GROUP_NAMES,
        "modules": {
            "core": _sort(core),
            "hardpoint": _sort(hardpoint),
            "utility": _sort(utility),
            "optional": _sort(optional),
        },
    }
    (DATA_DIR / "modules.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    counts = {k: sum(len(v) for v in out["modules"][k].values())
              for k in out["modules"]}
    print(f"  OK  modules — core {counts['core']}, hardpoint {counts['hardpoint']}, "
          f"utility {counts['utility']}, optional {counts['optional']}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("EDTC data builder")
    print("=" * 40)

    build_commodities()

    print("\n[fetching engineering entry data] …")
    entry_raw = fetch(ENTRY_DATA_URL)
    entry_data = json.loads(entry_raw)
    mat_cat = build_material_category_map(entry_data)
    print(f"  material category map: {len(mat_cat)} entries")

    build_blueprints(mat_cat)
    build_engineers()
    build_synthesis()
    build_tech_brokers()
    build_ships()
    build_modules()

    print("\n" + "=" * 40)
    print("Done! All data files written to data/")


if __name__ == "__main__":
    main()
