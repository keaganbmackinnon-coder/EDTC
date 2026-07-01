"""
EDSM API — https://www.edsm.net/en/api
All public, no auth required.
"""
from dataclasses import dataclass
from typing import Any

from .base import BaseAPI


@dataclass
class SystemInfo:
    name: str
    coords: dict
    id64: int | None = None
    allegiance: str | None = None
    government: str | None = None
    economy: str | None = None
    population: int | None = None
    security: str | None = None


@dataclass
class Body:
    name: str
    type: str
    sub_type: str | None = None
    distance_to_arrival: float | None = None
    is_main_star: bool = False
    spectral_class: str | None = None
    earth_masses: float | None = None
    radius: float | None = None


class EdsmAPI(BaseAPI):
    BASE_URL = "https://www.edsm.net"

    # --- Systems ---

    async def get_system(self, name: str) -> SystemInfo | None:
        data = await self.get("/api-v1/system", {
            "systemName": name,
            "showInformation": 1,
            "showCoordinates": 1,
            "showId": 1,
        })
        if not data:
            return None
        return SystemInfo(
            name=data.get("name", name),
            coords=data.get("coords", {}),
            id64=data.get("id64"),
            allegiance=data.get("information", {}).get("allegiance"),
            government=data.get("information", {}).get("government"),
            economy=data.get("information", {}).get("economy"),
            population=data.get("information", {}).get("population"),
            security=data.get("information", {}).get("security"),
        )

    async def get_systems_in_sphere(
        self, system_name: str, radius: float = 50
    ) -> list[dict]:
        return await self.get("/api-v1/sphere-systems", {
            "systemName": system_name,
            "radius": radius,
            "showCoordinates": 1,
            "showInformation": 1,
        })

    async def get_systems_in_cube(
        self, system_name: str, size: float = 100
    ) -> list[dict]:
        return await self.get("/api-v1/cube-systems", {
            "systemName": system_name,
            "size": size,
            "showCoordinates": 1,
        })

    async def find_nearest_system(self, x: float, y: float, z: float) -> dict | None:
        results = await self.get("/api-v1/sphere-systems", {
            "x": x, "y": y, "z": z,
            "radius": 50,
            "showCoordinates": 1,
        })
        return results[0] if results else None

    # --- Bodies ---

    async def get_bodies(self, system_name: str) -> list[Body]:
        data = await self.get("/api-system-v0/bodies", {"systemName": system_name})
        bodies = data.get("bodies", []) if data else []
        return [
            Body(
                name=b.get("name", ""),
                type=b.get("type", "Unknown"),
                sub_type=b.get("subType"),
                distance_to_arrival=b.get("distanceToArrival"),
                is_main_star=b.get("isMainStar", False),
                spectral_class=b.get("spectralClass"),
                earth_masses=b.get("earthMasses"),
                radius=b.get("radius"),
            )
            for b in bodies
        ]

    # --- Commander ---

    async def get_commander(self, cmdr_name: str) -> dict | None:
        data = await self.get("/api-logs-v1/get-position", {
            "commanderName": cmdr_name,
            "showCoordinates": 1,
        })
        return data if data.get("msgnum") == 100 else None

    # --- Traffic ---

    async def get_traffic(self, system_name: str) -> dict:
        return await self.get("/api-system-v0/traffic", {"systemName": system_name})

    # --- Galaxy ---

    async def get_news(self) -> list:
        data = await self.get("/api-v1/news", {})
        return data if isinstance(data, list) else []

    async def get_factions(self, system_name: str) -> dict:
        return await self.get("/api-system-v1/factions", {"systemName": system_name}) or {}

    async def get_community_goals(self) -> list:
        data = await self.get("/api-v1/community-goals", {})
        return data if isinstance(data, list) else []

    async def get_system_thargoid(self, system_name: str) -> dict:
        return await self.get("/api-v1/system", {
            "systemName": system_name,
            "showInformation": 1,
            "showFactions": 1,
            "showThargoids": 1,
        }) or {}

    async def get_system_power(self, system_name: str) -> dict:
        data = await self.get("/api-v1/system", {
            "systemName": system_name,
            "showPowerplay": 1,
            "showInformation": 1,
        })
        if not data:
            return {}
        return {
            "name": data.get("name", system_name),
            "power": data.get("power", ""),
            "powerState": data.get("powerState", ""),
            "allegiance": data.get("information", {}).get("allegiance", ""),
            "government": data.get("information", {}).get("government", ""),
        }
