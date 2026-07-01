"""
Spansh API — https://spansh.co.uk/api
All public, no auth required. Route jobs are async — poll until done.
"""
import asyncio
from dataclasses import dataclass

from .base import BaseAPI

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

    async def _poll_job(self, job_id: str) -> dict:
        deadline = asyncio.get_event_loop().time() + POLL_TIMEOUT
        while True:
            result = await self.get(f"/results/{job_id}")
            if result.get("status") == "ok":
                return result.get("result", {})
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

    # --- Road to Riches ---

    async def road_to_riches(
        self,
        origin: str,
        destination: str,
        range_ly: float,
        max_systems: int = 100,
        max_distance: float = 500,
    ) -> list[dict]:
        data = await self.get("/riches/route", {
            "from": origin,
            "to": destination,
            "range": range_ly,
            "max_systems": max_systems,
            "max_distance": max_distance,
            "buffer": 1000,
        })
        job_id = data.get("job")
        if not job_id:
            return []
        result = await self._poll_job(job_id)
        return result.get("system_jumps", [])

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
        await self._limiter.wait()
        client = await self._get_client()
        resp = await client.post("/stations/search", json={
            "reference_system": system,
            "sort": [{"distance": {"direction": "asc"}}],
            "size": size,
        })
        resp.raise_for_status()
        return resp.json().get("results", [])

    # --- Exobiology route ---

    async def exobiology_route(
        self,
        origin: str,
        range_ly: float,
        radius: float = 10000,
        max_results: int = 20,
    ) -> list[dict]:
        client = await self._get_client()
        await self._limiter.wait()
        resp = await client.post(
            "/exobiology/route",
            data={
                "from": origin,
                "range": range_ly,
                "radius": radius,
                "max_results": max_results,
            },
        )
        resp.raise_for_status()
        job_id = resp.json().get("job")
        if not job_id:
            return []
        return await self._poll_job(job_id)

    # --- Commodity market search ---

    async def commodity_markets(self, system: str, commodity: str) -> list[dict]:
        await self._limiter.wait()
        client = await self._get_client()
        resp = await client.post("/stations/search", json={
            "reference_system": system,
            "market": [{"name": commodity}],
            "sort": "distance",
            "size": 100,
        })
        resp.raise_for_status()
        return resp.json().get("results", [])
