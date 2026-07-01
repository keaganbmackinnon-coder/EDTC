"""
Community Goals — like GalNet, this isn't EDSM either. EdsmAPI.get_community_goals()
called /api-v1/community-goals, which 404's (no such EDSM endpoint exists). The real,
public, unauthenticated source is Frontier's own initiatives API.
"""
import re

from .base import BaseAPI

_PLACEHOLDER_RE = re.compile(r"\{\{.*?\}\}")


def _to_number(raw) -> float:
    try:
        return float(raw)
    except (TypeError, ValueError):
        return 0.0


def _to_iso(raw: str) -> str:
    """'2025-08-21 10:00:00' -> '2025-08-21T10:00:00Z' (game times are UTC)."""
    if not raw:
        return ""
    return raw.replace(" ", "T") + "Z"


class CommunityGoalsAPI(BaseAPI):
    BASE_URL = "https://api.orerve.net"

    async def get_active(self) -> list:
        data = await self.get("/2.0/website/initiatives/list", {"lang": "en"})
        items = (data or {}).get("activeInitiatives", []) if isinstance(data, dict) else []
        goals = []
        for item in items:
            target_qty = _to_number(item.get("target_qty"))
            qty = _to_number(item.get("qty"))
            news = _PLACEHOLDER_RE.sub("", item.get("news") or item.get("bulletin") or "").strip()
            goals.append({
                "id": item.get("id"),
                "title": item.get("title", ""),
                "system": item.get("starsystem_name", ""),
                "station": item.get("market_name", ""),
                "commodity": {"name": item.get("target_commodity_list", "")},
                "objective": item.get("objective", ""),
                "description": news,
                "tierCapacity": target_qty,
                "tierProgress": qty,
                "isCompleted": target_qty > 0 and qty >= target_qty,
                "expiry": _to_iso(item.get("expiry", "")),
            })
        return goals
