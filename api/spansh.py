"""
Spansh API — https://spansh.co.uk/api
All public, no auth required. Route jobs are async — poll until done.
"""
import asyncio
import logging
from dataclasses import dataclass

from .base import BaseAPI

log = logging.getLogger(__name__)

POLL_INTERVAL = 2.0
POLL_TIMEOUT = 120.0


@dataclass
class RouteSystem:
    system: str
    distance: float
    distance_jumped: float
    jumps: int
    neutron_star: bool = False


class SpanshAPI(BaseAPI):
    BASE_URL = "https://spansh.co.uk/api"

    async def resolve_system_name(self, name: str) -> str | None:
        """Resolve a user-typed system name to Spansh's canonical casing.
        `reference_system` on the search endpoints is EXACT-match — 'kuk',
        'Kuk ' and carrier callsigns all 400 (Session 52, verified live).
        The typeahead endpoint matches case-insensitively and trims, so it
        recovers the proper casing. Returns None if Spansh doesn't know the
        name at all (e.g. a fleet-carrier callsign)."""
        q = name.strip()
        if not q:
            return None
        data = await self.get("/systems/field_values/system_names", {"q": q})
        for v in data.get("values", []):
            if v.strip().lower() == q.lower():
                return v
        return None

    async def _post(self, path: str, *, json: dict | None = None,
                    data: dict | None = None, _retried: bool = False):
        """All Spansh POSTs go through here: rate-limit, log payload + body on
        any error (a 400 here is just 'Invalid request' — useless without the
        payload), and self-heal exact-match `reference_system` rejections by
        resolving the typed name to canonical casing and retrying once."""
        await self._limiter.wait()
        client = await self._get_client()
        resp = await client.post(path, json=json, data=data)
        if (resp.status_code == 400 and not _retried
                and json and json.get("reference_system")):
            ref = json["reference_system"]
            canonical = await self.resolve_system_name(ref)
            if canonical and canonical != ref:
                log.info("Spansh reference_system %r resolved to %r — retrying",
                         ref, canonical)
                return await self._post(
                    path, json={**json, "reference_system": canonical},
                    _retried=True)
            if not canonical:
                raise RuntimeError(
                    f'System "{ref.strip()}" not recognised — check the '
                    f"spelling (fleet carrier callsigns can't be used here)."
                )
        if resp.status_code >= 400:
            log.warning("Spansh POST %s -> %s | payload=%s | body=%s",
                        path, resp.status_code, json or data, resp.text[:500])
        resp.raise_for_status()
        return resp

    async def _poll_job(self, job_id: str) -> dict:
        deadline = asyncio.get_event_loop().time() + POLL_TIMEOUT
        while True:
            result = await self.get(f"/results/{job_id}")
            if result.get("status") == "ok":
                return result.get("result", {})
            # A failed job never becomes "ok" — surface the real error instead
            # of polling to the deadline and reporting a misleading timeout.
            err = result.get("error")
            if err:
                raise RuntimeError(f"Spansh: {err}")
            if asyncio.get_event_loop().time() > deadline:
                raise TimeoutError(f"Spansh job {job_id} timed out")
            await asyncio.sleep(POLL_INTERVAL)

    # --- Neutron plotter ---

    async def neutron_route(
        self,
        origin: str,
        destination: str,
        range_ly: float,
        efficiency: int = 60,
    ) -> list[RouteSystem]:
        data = await self.get("/route", {
            "from": origin,
            "to": destination,
            "range": range_ly,
            "efficiency": efficiency,
        })
        job_id = data.get("job")
        if not job_id:
            return []
        result = await self._poll_job(job_id)
        return [
            RouteSystem(
                system=s.get("system", ""),
                distance=s.get("distance_left", 0),
                distance_jumped=s.get("distance_jumped", 0),
                jumps=s.get("jumps", 1),
                neutron_star=s.get("neutron_star", False),
            )
            for s in result.get("system_jumps", [])
        ]

    # --- Galaxy plotter (every jump) ---

    async def galaxy_route(self, params: dict) -> list[dict]:
        """Spansh Galaxy Plotter (/generic/route) — unlike the neutron plotter,
        this returns EVERY individual jump. Needs a full FSD fuel model in
        `params` (field names per Auto_Neutron's ExactTab: source, destination,
        fuel_power, fuel_multiplier, optimal_mass, base_mass, tank_size,
        internal_tank_size, max_fuel_per_jump, range_boost, cargo,
        is_supercharged/use_supercharge/use_injections/exclude_secondary).
        Returns result['jumps']: dicts with name/distance/distance_to_destination/
        fuel_used/fuel_in_tank/is_scoopable/has_neutron/must_refuel (verified live)."""
        resp = await self._post("/generic/route", data=params)
        job_id = resp.json().get("job")
        if not job_id:
            return []
        result = await self._poll_job(job_id)
        return result.get("jumps", [])

    # --- Road to Riches ---

    async def road_to_riches(
        self,
        origin: str,
        destination: str = "",
        range_ly: float = 30,
        max_systems: int = 100,
        max_distance: float = 500,
        radius: float = 200,
        min_value: int = 300_000,
    ) -> list[dict]:
        """Form POST — the endpoint requires from/range/radius/max_results and
        rejects GET (verified live: the old GET with max_systems/buffer always
        400'd). Result is a list of {name, jumps, bodies[]} where bodies use
        snake_case keys (estimated_mapping_value, distance_to_arrival, ...).
        Destination is optional — omit for a loop around the origin."""
        form = {
            "from": origin,
            "range": range_ly,
            "radius": radius,
            "max_results": max_systems,
            "max_distance": max_distance,
            "min_value": min_value,
            "use_mapping_value": "true",
            "loop": "false",
        }
        if destination:
            form["to"] = destination
        resp = await self._post("/riches/route", data=form)
        job_id = resp.json().get("job")
        if not job_id:
            return []
        return await self._poll_job(job_id)

    # --- Fleet carrier planner ---

    async def fleet_carrier_route(
        self, origin: str, destination: str
    ) -> list[dict]:
        data = await self.get("/fleetcarrier/route", {
            "from": origin,
            "to": destination,
        })
        job_id = data.get("job")
        if not job_id:
            return []
        result = await self._poll_job(job_id)
        return result.get("jumps", [])

    # --- Tourist route ---

    async def tourist_route(
        self, origin: str, waypoints: list[str], range_ly: float
    ) -> list[dict]:
        data = await self.get("/tourist/route", {
            "from": origin,
            "to": ",".join(waypoints),
            "range": range_ly,
        })
        job_id = data.get("job")
        if not job_id:
            return []
        result = await self._poll_job(job_id)
        return result.get("system_jumps", [])

    # --- Nearest ---

    async def stations_near(self, system: str, size: int = 200) -> list[dict]:
        """Stations sorted nearest-first to `system`. The API's `services` filter
        param is silently ignored (verified: identical results with/without it),
        so service matching is done client-side against each station's own
        `services` list instead — see core/database.py or main.py callers."""
        resp = await self._post("/stations/search", json={
            "reference_system": system,
            "sort": [{"distance": {"direction": "asc"}}],
            "size": size,
        })
        return resp.json().get("results", [])

    # --- Material traders / tech brokers ---

    async def _filtered_stations(self, system: str, filters: dict, size: int = 30) -> list[dict]:
        """Nearest-first station search with a nested filter dict (Session 32:
        filters MUST be nested and sort must be the array form — top-level
        variants are silently ignored)."""
        resp = await self._post("/stations/search", json={
            "reference_system": system,
            "filters": filters,
            "sort": [{"distance": {"direction": "asc"}}],
            "size": size,
        })
        return resp.json().get("results", [])

    async def material_traders(
        self, system: str, trader_type: str | None = None, size: int = 30
    ) -> list[dict]:
        """Stations with a material trader, nearest-first. trader_type: 'Raw' |
        'Manufactured' | 'Encoded' — SERVER-side via {"material_trader":
        {"value": [...]}} (the [{"name": ...}] shape used by services/market
        400s on this field; verified live: Raw=372 vs 1633 any). None = all."""
        filters = (
            {"material_trader": {"value": [trader_type]}}
            if trader_type
            else {"services": [{"name": "Material Trader"}]}
        )
        return await self._filtered_stations(system, filters, size)

    async def tech_brokers(
        self, system: str, broker_type: str | None = None, size: int = 30
    ) -> list[dict]:
        """Stations with a technology broker, nearest-first. broker_type:
        'Guardian' | 'Human' — same {"value": [...]} filter shape as
        material_trader (verified live: Guardian=808, Human=1532). None = all
        (service filter; note some stations report broker type None)."""
        filters = (
            {"technology_broker": {"value": [broker_type]}}
            if broker_type
            else {"services": [{"name": "Technology Broker"}]}
        )
        return await self._filtered_stations(system, filters, size)

    # --- Exobiology route ---

    async def exobiology_route(
        self,
        origin: str,
        range_ly: float,
        radius: float = 10000,
        max_results: int = 20,
    ) -> list[dict]:
        resp = await self._post(
            "/exobiology/route",
            data={
                "from": origin,
                "range": range_ly,
                "radius": radius,
                "max_results": max_results,
            },
        )
        job_id = resp.json().get("job")
        if not job_id:
            return []
        return await self._poll_job(job_id)

    # --- Mining: ring hotspots + sell stations ---

    async def ring_hotspots(
        self,
        system: str,
        commodity: str,
        ring_types: list[str] | None = None,
        reserve_levels: list[str] | None = None,
        controlling_powers: list[str] | None = None,
        power_states: list[str] | None = None,
        size: int = 40,
    ) -> list[dict]:
        """Bodies whose rings have a `commodity` hotspot, nearest-first (POST
        /bodies/search). Verified live: ring_signals takes the [{"name": ...}]
        shape; ring_type / reserve_level / system_controlling_power /
        system_power_state all take {"value": [...]}. Results carry rings[]
        (signals + type + name), reserve_level, distance, and the system's
        controlling power + power state."""
        filters: dict = {"ring_signals": [{"name": commodity}]}
        if ring_types and len(ring_types) == 1:
            # {"ring_type": {...}} is silently IGNORED by /bodies/search — the
            # working shape is {"rings": [{"type": ...}]} (verified live: a
            # bogus type returns count=0 this way, 10000 the other way).
            # Multiple entries' semantics are unverified, so only one type is
            # filtered server-side; callers narrow per-ring client-side anyway.
            filters["rings"] = [{"type": ring_types[0]}]
        if reserve_levels:
            filters["reserve_level"] = {"value": reserve_levels}
        if controlling_powers:
            filters["system_controlling_power"] = {"value": controlling_powers}
        if power_states:
            filters["system_power_state"] = {"value": power_states}
        resp = await self._post("/bodies/search", json={
            "reference_system": system,
            "filters": filters,
            "sort": [{"distance": {"direction": "asc"}}],
            "size": size,
        })
        return resp.json().get("results", [])

    async def mining_sell_stations(
        self,
        system: str,
        commodity: str,
        min_demand: int = 1,
        max_distance: float | None = None,
        controlling_powers: list[str] | None = None,
        power_states: list[str] | None = None,
        size: int = 40,
    ) -> list[dict]:
        """Stations buying `commodity`, best sell price first. Verified live:
        the market entry's demand filter is {"comparison": ">=", "value":
        [lo, hi]}, distance is {"min": .., "max": ..}, and per-commodity price
        sort is the [{"market_sell_price": [{"name", "direction"}]}] form."""
        market: dict = {"name": commodity}
        if min_demand > 0:
            market["demand"] = {"comparison": ">=", "value": [min_demand, 10_000_000]}
        filters: dict = {"market": [market]}
        if max_distance:
            filters["distance"] = {"min": 0, "max": max_distance}
        if controlling_powers:
            filters["system_controlling_power"] = {"value": controlling_powers}
        if power_states:
            filters["system_power_state"] = {"value": power_states}
        resp = await self._post("/stations/search", json={
            "reference_system": system,
            "filters": filters,
            "sort": [{"market_sell_price": [{"name": commodity, "direction": "desc"}]}],
            "size": size,
        })
        return resp.json().get("results", [])

    # --- Star system search (attribute filters) ---

    async def systems_search(
        self,
        reference: str,
        max_distance: float | None = None,
        name: str | None = None,
        allegiances: list[str] | None = None,
        governments: list[str] | None = None,
        securities: list[str] | None = None,
        primary_economies: list[str] | None = None,
        min_population: int | None = None,
        max_population: int | None = None,
        needs_permit: bool | None = None,
        controlling_powers: list[str] | None = None,
        power_states: list[str] | None = None,
        main_star_subtypes: list[str] | None = None,
        sort_by: str = "distance",
        sort_dir: str = "asc",
        size: int = 50,
        page: int = 0,
    ) -> dict:
        """POST /systems/search. Verified live (2026-07-19):
        - allegiance / government / security / primary_economy /
          controlling_power / power_state / needs_permit take {"value": [...]}.
        - population MUST use {"comparison": "<=>", "value": [lo, hi]} — the
          {"min","max"} shape is silently IGNORED and {"value": [lo, hi]}
          returns count=0.
        - There is NO working top-level main-star filter (main_star & friends
          are all silently ignored) — the working form is the nested bodies
          filter {"bodies": [{"subtype": {"value": [...]},
          "is_main_star": {"value": true}}]} (neutron→0 near Sol, G→Sol).
        - name takes a string, '*' wildcard supported ("Taurus Dark Region*")
          — covers boxel/sector-prefix searching.
        Returns {"count": total, "results": [...]} — rows carry allegiance,
        government, security, primary_economy, population, body_count,
        controlling_power, power_state, region, known_permit, estimated scan
        values, bodies[] and stations[]."""
        filters: dict = {}
        if max_distance:
            filters["distance"] = {"min": "0", "max": str(max_distance)}
        if name:
            filters["name"] = {"value": name}
        if allegiances:
            filters["allegiance"] = {"value": allegiances}
        if governments:
            filters["government"] = {"value": governments}
        if securities:
            filters["security"] = {"value": securities}
        if primary_economies:
            filters["primary_economy"] = {"value": primary_economies}
        if min_population is not None or max_population is not None:
            filters["population"] = {"comparison": "<=>", "value": [
                int(min_population or 0),
                int(max_population or 100_000_000_000_000),
            ]}
        if needs_permit is not None:
            filters["needs_permit"] = {"value": needs_permit}
        if controlling_powers:
            filters["controlling_power"] = {"value": controlling_powers}
        if power_states:
            filters["power_state"] = {"value": power_states}
        if main_star_subtypes:
            filters["bodies"] = [{"subtype": {"value": main_star_subtypes},
                                  "is_main_star": {"value": True}}]
        resp = await self._post("/systems/search", json={
            "reference_system": reference,
            "filters": filters,
            "sort": [{sort_by: {"direction": sort_dir}}],
            "size": size,
            "page": page,
        })
        data = resp.json()
        return {"count": data.get("count", 0), "results": data.get("results", [])}

    # --- Commodity market search ---

    async def commodity_markets(self, system: str, commodity: str) -> list[dict]:
        resp = await self._post("/stations/search", json={
            "reference_system": system,
            # top-level "market" and bare "sort": "distance" are both silently
            # ignored by Spansh — filters must be nested and sort must be the
            # array form (verified: fake commodity returns count=0 this way)
            "filters": {"market": [{"name": commodity}]},
            "sort": [{"distance": {"direction": "asc"}}],
            "size": 100,
        })
        return resp.json().get("results", [])
