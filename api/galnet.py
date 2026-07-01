"""
GalNet news — Frontier's own CMS, not EDSM. EDSM has no news endpoint
(the old EdsmAPI.get_news() call to /api-v1/news 404'd — that path never existed).
Public, no auth required; same JSON:API backing community.elitedangerous.com/galnet.
"""
from .base import BaseAPI


class GalnetAPI(BaseAPI):
    BASE_URL = "https://cms.zaonce.net"

    async def get_news(self, limit: int = 15) -> list:
        data = await self.get("/en-GB/jsonapi/node/galnet_article", {
            "sort": "-published_at",
            "page[limit]": limit,
        })
        items = data.get("data", []) if isinstance(data, dict) else []
        articles = []
        for item in items:
            attrs = item.get("attributes", {})
            body = attrs.get("body") or {}
            articles.append({
                "id": item.get("id"),
                "title": attrs.get("title", ""),
                "date": attrs.get("published_at") or attrs.get("created", ""),
                "content": body.get("value", ""),
            })
        return articles
