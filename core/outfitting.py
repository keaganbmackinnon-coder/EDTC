"""
Outfitting stat engine — coriolis-style ship stat computation.

Given a ship (from data/ships.json), a bulkhead grade, and a loadout (a list of
fitted modules from data/modules.json, each optionally carrying engineering
modifiers, a power priority and an enabled flag), compute the full stat sheet
Coriolis shows: mass, power balance by priority, jump range, shields with
kinetic/thermal/explosive resistances, armour with resistances, module
protection, offence (DPS by damage type, EPS, HPS, sustained DPS), movement
(speed/boost/pitch/roll/yaw) and cost/rebuy.

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
    "DefenceModifierHealthMultiplier": "hullboost",     # bulkhead armour boost
    "ModuleDefenceAbsorption": "protection",            # MRP
    "RegenRate": "regen",
    "BrokenRegenRate": "brokenregen",
    "ShieldBankReinforcement": "shieldreinforcement",
    "ShieldBankDuration": "duration",
    "ShieldBankSpinUp": "spinup",
    "ShieldBankHeat": "thermload",
    "DistributorDraw": "distdraw",
    "Damage": "damage",
    "RateOfFire": "_rof",               # rounds/sec → we store fireint = 1/rof
    "DamagePerSecond": "_dps",
    "AmmoClipSize": "clip",
    "AmmoMaximum": "ammo",
    "ThermalLoad": "thermload",
    "FSDJumpRangeBoost": "jumpboost",   # guardian FSD booster (flat ly)
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
    "DefenceModifierHealthMultiplier", "ModuleDefenceAbsorption",
}

# damagedist keys → damage type name
DAMAGE_TYPES = {"K": "kinetic", "T": "thermal", "E": "explosive", "A": "absolute",
                "C": "caustic"}


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


def _stacked_resistance(intrinsic: float, contributions: list[float]) -> float:
    """Game resistance stacking: multiply damage multipliers, with diminishing
    returns on the stacked (non-intrinsic) contribution — any stacked resistance
    beyond 30% is half effective (the 0.7-multiplier breakpoint).
    Returns the total resistance as a fraction (may be negative)."""
    stack_mult = 1.0
    for r in contributions:
        stack_mult *= (1.0 - (r or 0.0))
    if stack_mult < 0.7:
        stack_mult = 0.7 - (0.7 - stack_mult) / 2.0
    return 1.0 - (1.0 - (intrinsic or 0.0)) * stack_mult


def compute_stats(ship: dict, fitted: list[dict], unladen_override: float | None = None,
                  bulkhead: dict | None = None, fuel_t: float | None = None,
                  cargo_t: float | None = None) -> dict:
    """`ship`: a data/ships.json entry. `fitted`: list of
    {family, grp, module, engineering, priority, enabled} — module is a
    data/modules.json entry. `bulkhead`: a ship["bulkheads"] entry (may carry
    "engineering"); None means Lightweight Alloy (index 0) when available.
    `unladen_override`: when set (imported builds pass the game's real
    UnladenMass), use it instead of the summed mass — accounts for any module
    mass not in the DB, so jump range matches the game exactly.
    `fuel_t`/`cargo_t`: current tonnage for the "current" stat set (sliders);
    None = full."""
    hull_mass = float(ship.get("hull_mass") or 0)

    # ── bulkheads ───────────────────────────────────────────────────────────
    if bulkhead is None:
        bhs = ship.get("bulkheads") or []
        bulkhead = bhs[0] if bhs else {}
    bh_eff = _effective(bulkhead, bulkhead.get("engineering")) if bulkhead else {}

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
            "priority": int(f.get("priority") or 1),
            "enabled": f.get("enabled", True) is not False,
            "slot": f.get("slot", ""),
        })

    def by_grp(*grps, active_only=True):
        return [p for p in parts if p["grp"] in grps
                and (p["enabled"] or not active_only)]

    def active(p):
        return p["enabled"]

    # ── mass (disabled modules still weigh) ─────────────────────────────────
    module_mass = sum(float(p["eff"].get("mass") or 0) for p in parts)
    bh_mass = float(bh_eff.get("mass") or 0)
    fuel_cap = sum(float(p["eff"].get("fuel") or 0)
                   for p in parts if p["grp"] == "ft")
    cargo_cap = sum(float(p["eff"].get("cargo") or 0)
                    for p in parts if p["grp"] in ("cr", "crl") and p["enabled"])
    unladen = (float(unladen_override) if unladen_override
               else hull_mass + module_mass + bh_mass)
    laden = unladen + fuel_cap + cargo_cap
    cur_fuel = fuel_cap if fuel_t is None else max(0.0, min(float(fuel_t), fuel_cap))
    cur_cargo = cargo_cap if cargo_t is None else max(0.0, min(float(cargo_t), cargo_cap))
    cur_mass = unladen + cur_fuel + cur_cargo

    # ── power (enabled modules only), split by priority group 1..5 ──────────
    pp = next((p for p in by_grp("pp", active_only=False)), None)
    power_capacity = float(pp["eff"].get("pgen") or 0) if pp else 0.0
    draw_retracted = 0.0
    draw_deployed = 0.0
    prio = {i: {"retracted": 0.0, "deployed": 0.0} for i in range(1, 6)}
    for p in parts:
        if p["grp"] == "pp" or not p["enabled"]:
            continue
        pw = float(p["eff"].get("power") or 0)
        g = prio[max(1, min(5, p["priority"]))]
        if p["family"] == "hardpoint":
            draw_deployed += pw
            g["deployed"] += pw
        else:
            draw_retracted += pw
            draw_deployed += pw
            g["retracted"] += pw
            g["deployed"] += pw

    # ── jump range ──────────────────────────────────────────────────────────
    fsd = next((p for p in by_grp("fsd")), None)
    jumpboost = sum(float(p["eff"].get("jumpboost") or 0) for p in by_grp("gfsb"))
    jump_laden = jump_unladen = jump_current = jump_total = 0.0
    if fsd:
        e = fsd["eff"]
        optmass = float(e.get("optmass") or 0)
        maxfuel = float(e.get("maxfuel") or 0)
        fuelmul = float(e.get("fuelmul") or 0)
        fuelpow = float(e.get("fuelpower") or 0)
        if optmass and maxfuel and fuelmul and fuelpow:
            def _range(mass, fuel_avail=None):
                f = maxfuel if fuel_avail is None else min(fuel_avail, maxfuel)
                if f <= 0:
                    return 0.0
                return optmass / mass * (f / fuelmul) ** (1.0 / fuelpow) + jumpboost
            jump_unladen = _range(unladen + maxfuel)
            jump_laden = _range(laden)
            jump_current = _range(cur_mass, cur_fuel)
            # total range: successive max-fuel jumps until the tank runs dry
            fuel_left = fuel_cap
            while fuel_left > 0.01:
                burn = min(maxfuel, fuel_left)
                jump_total += _range(unladen + fuel_left + cargo_cap, burn)
                fuel_left -= burn

    # ── shields ─────────────────────────────────────────────────────────────
    base_shield = float(ship.get("shields") or 0)
    gen = next((p for p in by_grp(*SHIELD_GROUPS)), None)
    shield_mj = 0.0
    shield_res = {"kinetic": 0.0, "thermal": 0.0, "explosive": 0.0}
    regen = brokenregen = 0.0
    if gen and base_shield:
        e = gen["eff"]
        mul = _mass_curve_mul(
            hull_mass, e.get("minmass"), e.get("optmass"), e.get("maxmass"),
            e.get("minmul", 1), e.get("optmul", 1), e.get("maxmul", 1))
        shield_mj = base_shield * mul
        boosters = by_grp("sb")
        boost = sum(float(p["eff"].get("shieldboost") or 0) for p in boosters)
        shield_mj *= (1.0 + boost)
        shield_mj += sum(float(p["eff"].get("shieldaddition") or 0)
                         for p in by_grp("gsrp"))
        regen = float(e.get("regen") or 0)
        brokenregen = float(e.get("brokenregen") or 0)
        for typ, field in (("kinetic", "kinres"), ("thermal", "thermres"),
                           ("explosive", "explres")):
            shield_res[typ] = _stacked_resistance(
                float(e.get(field) or 0),
                [float(p["eff"].get(field) or 0) for p in boosters],
            )
    # SCB reinforcement: per cell = reinforcement/s × duration; cells = clip+ammo
    scb_total = 0.0
    for p in by_grp("scb"):
        e = p["eff"]
        per_cell = float(e.get("shieldreinforcement") or 0) * float(e.get("duration") or 0)
        cells = int(e.get("clip") or 0) + int(e.get("ammo") or 0)
        scb_total += per_cell * max(1, cells)

    # ── armour ──────────────────────────────────────────────────────────────
    base_armour = float(ship.get("armour") or 0)
    hullboost = float(bh_eff.get("hullboost") or 0)
    hrps = by_grp("hr", "ghrp", "mahr")
    hrp = sum(float(p["eff"].get("hullreinforcement") or 0) for p in hrps)
    armour = base_armour * (1.0 + hullboost) + hrp
    armour_res = {}
    for typ, field in (("kinetic", "kinres"), ("thermal", "thermres"),
                       ("explosive", "explres"), ("caustic", "causres")):
        armour_res[typ] = _stacked_resistance(
            float(bh_eff.get(field) or 0),
            [float(p["eff"].get(field) or 0) for p in hrps],
        )
    # module protection (MRPs stack, capped at 60%)
    mrp_mult = 1.0
    for p in by_grp("mrp", "gmrp"):
        mrp_mult *= (1.0 - float(p["eff"].get("protection") or 0))
    module_protection = min(0.6, 1.0 - mrp_mult)

    # ── speed / boost / agility ──────────────────────────────────────────────
    thr = next((p for p in by_grp("t")), None)
    base_speed = float(ship.get("speed") or 0)
    base_boost = float(ship.get("boost") or 0)
    speed, boost_speed, tmul = base_speed, base_boost, 1.0
    if thr:
        e = thr["eff"]
        tmul = _mass_curve_mul(
            cur_mass, e.get("minmass"), e.get("optmass"), e.get("maxmass"),
            e.get("minmul", 1), e.get("optmul", 1), e.get("maxmul", 1))
        speed = base_speed * tmul
        boost_speed = base_boost * tmul
    pitch = float(ship.get("pitch") or 0) * tmul
    roll = float(ship.get("roll") or 0) * tmul
    yaw = float(ship.get("yaw") or 0) * tmul
    pd = next((p for p in by_grp("pd")), None)
    boost_energy = float(ship.get("boost_energy") or 0)
    engcap = float(pd["eff"].get("engcap") or 0) if pd else 0.0
    can_boost = engcap >= boost_energy > 0 or boost_energy == 0

    # ── offence ───────────────────────────────────────────────────────────────
    dps = eps = hps = 0.0
    dps_by_type = {}
    weapons = []
    for p in parts:
        if p["family"] != "hardpoint" or not p["enabled"]:
            continue
        e = p["eff"]
        fireint = float(e.get("fireint") or 0)

        def per_sec(x):
            return x / fireint if fireint else x  # beams: values already per-sec

        if e.get("_dps"):
            w_dps = float(e["_dps"])
        else:
            w_dps = per_sec(float(e.get("damage") or 0))
        w_eps = per_sec(float(e.get("distdraw") or 0))
        w_hps = per_sec(float(e.get("thermload") or 0))
        dps += w_dps
        eps += w_eps
        hps += w_hps
        dist = e.get("damagedist") or {}
        if not dist:
            dist = {"A": 1}
        for k, frac in dist.items():
            typ = DAMAGE_TYPES.get(k, "other")
            dps_by_type[typ] = dps_by_type.get(typ, 0.0) + w_dps * float(frac)
        weapons.append({
            "name": e.get("display") or e.get("group_name") or "",
            "mount": e.get("mount", ""),
            "class": e.get("class"),
            "rating": e.get("rating"),
            "dps": round(w_dps, 1),
            "eps": round(w_eps, 2),
            "hps": round(w_hps, 2),
        })
    # sustained DPS at 4 pips WEP: capacitor recharge caps the duty cycle
    wepcap = float(pd["eff"].get("wepcap") or 0) if pd else 0.0
    weprate = float(pd["eff"].get("weprate") or 0) if pd else 0.0
    if eps > weprate > 0:
        sustained_dps = dps * weprate / eps
        drain_time = wepcap / (eps - weprate) if wepcap else 0.0
    else:
        sustained_dps = dps
        drain_time = None  # capacitor never drains

    # ── cost / rebuy ────────────────────────────────────────────────────────
    total_cost = float(ship.get("cost") or 0) + float(bh_eff.get("cost") or 0) + sum(
        float(p["eff"].get("cost") or 0) for p in parts)
    rebuy = total_cost * 0.05

    return {
        "mass_hull": round(hull_mass, 1),
        "mass_modules": round(module_mass + bh_mass, 1),
        "mass_unladen": round(unladen, 1),
        "mass_laden": round(laden, 1),
        "mass_current": round(cur_mass, 1),
        "power_capacity": round(power_capacity, 2),
        "power_retracted": round(draw_retracted, 2),
        "power_deployed": round(draw_deployed, 2),
        "power_ok": draw_deployed <= power_capacity + 1e-6,
        "power_priorities": {str(i): {"retracted": round(g["retracted"], 2),
                                      "deployed": round(g["deployed"], 2)}
                             for i, g in prio.items()},
        "jump_range_laden": round(jump_laden, 2),
        "jump_range_max": round(jump_unladen, 2),
        "jump_range_current": round(jump_current, 2),
        "jump_range_total": round(jump_total, 1),
        "shield_mj": round(shield_mj),
        "shield_res": {k: round(v, 3) for k, v in shield_res.items()},
        "shield_effective": {k: round(shield_mj / (1.0 - v)) if v < 1 else 0
                             for k, v in shield_res.items()},
        "shield_regen": round(regen, 2),
        "shield_regen_time": round(shield_mj * 0.5 / regen, 1) if regen else None,
        "shield_broken_time": round(shield_mj * 0.5 / brokenregen + 16, 1) if brokenregen else None,
        "scb_total": round(scb_total),
        "armour": round(armour),
        "armour_res": {k: round(v, 3) for k, v in armour_res.items()},
        "armour_effective": {k: round(armour / (1.0 - v)) if v < 1 else 0
                             for k, v in armour_res.items()},
        "module_protection": round(module_protection, 3),
        "hardness": ship.get("hardness", 0),
        "masslock": ship.get("masslock", 0),
        "bulkhead_name": bh_eff.get("name", ""),
        "speed": round(speed),
        "boost": round(boost_speed),
        "pitch": round(pitch, 1),
        "roll": round(roll, 1),
        "yaw": round(yaw, 1),
        "can_boost": can_boost,
        "boost_energy": boost_energy,
        "dps": round(dps, 1),
        "eps": round(eps, 2),
        "hps": round(hps, 2),
        "dps_by_type": {k: round(v, 1) for k, v in dps_by_type.items()},
        "sustained_dps": round(sustained_dps, 1),
        "wep_drain_time": round(drain_time, 1) if drain_time else None,
        "weapons": weapons,
        "cargo_capacity": int(cargo_cap),
        "fuel_capacity": round(fuel_cap, 1),
        "total_cost": int(total_cost),
        "rebuy": int(rebuy),
        "module_count": len(parts),
    }
