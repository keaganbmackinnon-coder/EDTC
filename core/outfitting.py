"""
Outfitting stat engine — coriolis-style ship stat computation.

Given a ship (from data/ships.json) and a loadout (a list of fitted modules
from data/modules.json, each optionally carrying engineering modifiers), compute
the headline stats the game shows: mass, power balance, jump range, shields,
armour, speed/boost, DPS, cargo, fuel and rebuy.

Engineering is applied as an *effective-field overlay*: every modifier is a
journal/EDEngineer property Label mapped to a coriolis module field. Imported
builds carry the game's own absolute modifier Values (exact); from-scratch builds
carry values derived from blueprint grade multipliers. Either way the engine only
ever reads effective fields, so both paths share one code path.

All formulas follow the community/coriolis conventions. Absolute parity with the
in-game panel is not guaranteed for every derived stat, but jump range, mass,
power and cargo match closely, and imported ships use the game's real numbers.
"""

from __future__ import annotations
import math

# journal / EDEngineer modifier Label → coriolis-data module field
LABEL_TO_FIELD = {
    "Mass": "mass",
    "Integrity": "integrity",
    "PowerDraw": "power",
    "BootTime": "boot",
    "PowerCapacity": "pgen",            # power plant output
    "HeatEfficiency": "eff",
    "WeaponCapacity": "wepcap",
    "WeaponRechargeRate": "weprate",
    "EngineCapacity": "engcap",
    "SystemsCapacity": "syscap",
    "FSDOptimalMass": "optmass",        # on the fsd
    "MaxFuelPerJump": "maxfuel",
    "EngineOptimalMass": "optmass",     # on thrusters
    "EngineOptPerformance": "optmul",   # thruster performance multiplier
    "ShieldGenOptimalMass": "optmass",  # on shield generator
    "ShieldGenStrength": "optmul",      # shield generator strength multiplier
    "ShieldGenMinimumMass": "minmass",
    "ShieldGenMaximumMass": "maxmass",
    "KineticResistance": "kinres",
    "ThermicResistance": "thermres",
    "ExplosiveResistance": "explres",
    "CausticResistance": "causres",
    "DefenceModifierShieldMultiplier": "shieldboost",   # shield booster
    "DefenceModifierHealthAddition": "hullreinforcement",  # HRP flat
    "Damage": "damage",
    "RateOfFire": "_rof",               # rounds/sec → we store fireint = 1/rof
    "DamagePerSecond": "_dps",
    "AmmoClipSize": "clip",
    "AmmoMaximum": "ammo",
    "ThermalLoad": "thermload",
}

CORE_SLOT_NAMES = [
    "Power Plant", "Thrusters", "Frame Shift Drive", "Life Support",
    "Power Distributor", "Sensors", "Fuel Tank",
]
CORE_GROUP_ORDER = ["pp", "t", "fsd", "ls", "pd", "s", "ft"]

SHIELD_GROUPS = {"sg", "bsg", "psg"}

# Journal modifier Values that are expressed as PERCENT while coriolis stores a
# fraction/multiplier. Divide by 100 before overlaying. (e.g. EngineOptPerformance
# 133 → 1.33; DefenceModifierShieldMultiplier 26 → 0.26; KineticResistance 49.8 → 0.498)
PERCENT_LABELS = {
    "EngineOptPerformance", "ShieldGenStrength", "DefenceModifierShieldMultiplier",
    "KineticResistance", "ThermicResistance", "ExplosiveResistance", "CausticResistance",
}


def _effective(module: dict, engineering: dict | None) -> dict:
    """Base module fields overlaid with engineering. `modifiers` are journal/
    EDEngineer property Labels → the game's absolute Value (percent labels are
    normalised to fractions). `blueprint_effects` are {coriolis_field: multiplier}
    used by from-scratch builds (base × multiplier)."""
    eff = dict(module)
    if not engineering:
        return eff
    base_optmul = module.get("optmul")

    for label, value in (engineering.get("modifiers") or {}).items():
        if value is None:
            continue
        field = LABEL_TO_FIELD.get(label)
        if not field:
            continue
        v = float(value)
        if label in PERCENT_LABELS:
            v /= 100.0
        if field == "_rof":
            eff["fireint"] = 1.0 / v if v else eff.get("fireint")
        elif field == "_dps":
            eff["_dps"] = v
        elif field == "optmul" and module.get("grp") in SHIELD_GROUPS and base_optmul:
            # scale all three shield mass-curve multipliers proportionally
            ratio = v / base_optmul
            eff["optmul"] = module.get("optmul", 0) * ratio
            eff["minmul"] = module.get("minmul", 0) * ratio
            eff["maxmul"] = module.get("maxmul", 0) * ratio
        else:
            eff[field] = v

    # from-scratch engineering: multiply coriolis fields directly
    for field, mult in (engineering.get("blueprint_effects") or {}).items():
        if mult is None or field not in eff or not isinstance(eff.get(field), (int, float)):
            continue
        eff[field] = eff[field] * float(mult)

    return eff


def _mass_curve_mul(mass: float, mn, opt, mx, minmul, optmul, maxmul) -> float:
    """Piecewise-linear multiplier used by shield generators and thrusters:
    interpolate minmul→optmul over [minmass, optmass], optmul→maxmul over
    [optmass, maxmass]; clamp outside."""
    try:
        if mass <= mn:
            return minmul
        if mass >= mx:
            return maxmul
        if mass <= opt:
            return minmul + (optmul - minmul) * (mass - mn) / (opt - mn)
        return optmul + (maxmul - optmul) * (mass - opt) / (mx - opt)
    except (TypeError, ZeroDivisionError):
        return optmul or 1.0


def compute_stats(ship: dict, fitted: list[dict], unladen_override: float | None = None) -> dict:
    """`ship`: a data/ships.json entry. `fitted`: list of
    {family, grp, module, engineering} — module is a data/modules.json entry.
    `unladen_override`: when set (imported builds pass the game's real UnladenMass),
    use it instead of the summed mass — accounts for bulkhead mass not in the
    module DB, so jump range matches the game exactly."""
    hull_mass = float(ship.get("hull_mass") or 0)

    # resolve effective modules once
    parts = []
    for f in fitted:
        mod = f.get("module")
        if not mod:
            continue
        parts.append({
            "family": f.get("family") or mod.get("family"),
            "grp": mod.get("grp"),
            "eff": _effective(mod, f.get("engineering")),
            "raw": mod,
        })

    def by_grp(*grps):
        return [p for p in parts if p["grp"] in grps]

    # ── mass ────────────────────────────────────────────────────────────────
    module_mass = sum(float(p["eff"].get("mass") or 0) for p in parts)
    fuel_cap = sum(float(p["eff"].get("fuel") or 0)
                   for p in parts if p["grp"] == "ft")
    cargo_cap = sum(float(p["eff"].get("cargo") or 0)
                    for p in parts if p["grp"] in ("cr", "crl"))
    unladen = float(unladen_override) if unladen_override else hull_mass + module_mass
    laden = unladen + fuel_cap + cargo_cap

    # ── power ───────────────────────────────────────────────────────────────
    pp = next((p for p in by_grp("pp")), None)
    power_capacity = float(pp["eff"].get("pgen") or 0) if pp else 0.0
    draw_retracted = 0.0
    draw_deployed = 0.0
    for p in parts:
        pw = float(p["eff"].get("power") or 0)
        if p["grp"] == "pp":
            continue
        if p["family"] == "hardpoint":
            draw_deployed += pw
        else:
            draw_retracted += pw
            draw_deployed += pw

    # ── jump range ──────────────────────────────────────────────────────────
    fsd = next((p for p in by_grp("fsd")), None)
    jumpboost = sum(float(p["eff"].get("jumpboost") or 0)
                    for p in by_grp("gfsb"))
    jump_laden = jump_unladen = 0.0
    if fsd:
        e = fsd["eff"]
        optmass = float(e.get("optmass") or 0)
        maxfuel = float(e.get("maxfuel") or 0)
        fuelmul = float(e.get("fuelmul") or 0)
        fuelpow = float(e.get("fuelpower") or 0)
        if optmass and maxfuel and fuelmul and fuelpow:
            def _range(mass):
                return optmass / mass * (maxfuel / fuelmul) ** (1.0 / fuelpow) + jumpboost
            jump_unladen = _range(unladen + maxfuel)
            jump_laden = _range(laden)

    # ── shields ─────────────────────────────────────────────────────────────
    base_shield = float(ship.get("shields") or 0)
    gen = next((p for p in by_grp(*SHIELD_GROUPS)), None)
    shield_mj = 0.0
    if gen and base_shield:
        e = gen["eff"]
        mul = _mass_curve_mul(
            hull_mass, e.get("minmass"), e.get("optmass"), e.get("maxmass"),
            e.get("minmul", 1), e.get("optmul", 1), e.get("maxmul", 1))
        shield_mj = base_shield * mul
        boost = sum(float(p["eff"].get("shieldboost") or 0) for p in by_grp("sb"))
        shield_mj *= (1.0 + boost)
        shield_mj += sum(float(p["eff"].get("shieldaddition") or 0)
                         for p in by_grp("gsrp"))

    # ── armour ──────────────────────────────────────────────────────────────
    base_armour = float(ship.get("armour") or 0)
    hrp = sum(float(p["eff"].get("hullreinforcement") or 0)
              for p in by_grp("hr", "ghrp"))
    armour = base_armour + hrp   # bulkhead multiplier ~1 (Lightweight); refine later

    # ── speed / boost ─────────────────────────────────────────────────────────
    thr = next((p for p in by_grp("t")), None)
    base_speed = float(ship.get("speed") or 0)
    base_boost = float(ship.get("boost") or 0)
    speed = base_speed
    boost_speed = base_boost
    if thr:
        e = thr["eff"]
        tmul = _mass_curve_mul(
            laden, e.get("minmass"), e.get("optmass"), e.get("maxmass"),
            e.get("minmul", 1), e.get("optmul", 1), e.get("maxmul", 1))
        speed = base_speed * tmul
        boost_speed = base_boost * tmul

    # ── DPS ───────────────────────────────────────────────────────────────────
    dps = 0.0
    for p in parts:
        if p["family"] != "hardpoint":
            continue
        e = p["eff"]
        if e.get("_dps"):
            dps += float(e["_dps"]); continue
        dmg = float(e.get("damage") or 0)
        fireint = float(e.get("fireint") or 0)
        dps += dmg / fireint if fireint else dmg   # beams: damage already ≈ dps

    # ── cost / rebuy ────────────────────────────────────────────────────────
    total_cost = float(ship.get("cost") or 0) + sum(
        float(p["eff"].get("cost") or 0) for p in parts)
    rebuy = total_cost * 0.05

    return {
        "mass_hull": round(hull_mass, 1),
        "mass_modules": round(module_mass, 1),
        "mass_unladen": round(unladen, 1),
        "mass_laden": round(laden, 1),
        "power_capacity": round(power_capacity, 2),
        "power_retracted": round(draw_retracted, 2),
        "power_deployed": round(draw_deployed, 2),
        "power_ok": draw_deployed <= power_capacity + 1e-6,
        "jump_range_laden": round(jump_laden, 2),
        "jump_range_max": round(jump_unladen, 2),
        "shield_mj": round(shield_mj),
        "armour": round(armour),
        "speed": round(speed),
        "boost": round(boost_speed),
        "dps": round(dps, 1),
        "cargo_capacity": int(cargo_cap),
        "fuel_capacity": round(fuel_cap, 1),
        "total_cost": int(total_cost),
        "rebuy": int(rebuy),
        "module_count": len(parts),
    }
