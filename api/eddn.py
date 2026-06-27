"""
EDDN relay — wss://eddn.edcd.io:4430/subscribe
Live commodity, outfitting, shipyard, journal data from the community.
"""
import asyncio
import json
import zlib
from typing import Callable

import websockets

EDDN_URL = "wss://eddn.edcd.io:4430/subscribe"

SCHEMAS = {
    "commodity": "https://eddn.edcd.io/schemas/commodity/3",
    "journal": "https://eddn.edcd.io/schemas/journal/1",
    "outfitting": "https://eddn.edcd.io/schemas/outfitting/2",
    "shipyard": "https://eddn.edcd.io/schemas/shipyard/2",
}


class EddnListener:
    def __init__(self, on_message: Callable[[dict], None]):
        self._on_message = on_message
        self._running = False
        self._schemas: set[str] | None = None

    def filter_schemas(self, *schema_keys: str):
        self._schemas = {SCHEMAS[k] for k in schema_keys if k in SCHEMAS}

    async def run(self):
        self._running = True
        while self._running:
            try:
                async with websockets.connect(
                    EDDN_URL,
                    ping_interval=20,
                    ping_timeout=60,
                ) as ws:
                    async for raw in ws:
                        if not self._running:
                            break
                        try:
                            msg = json.loads(zlib.decompress(raw))
                            schema = msg.get("$schemaRef", "")
                            if self._schemas and schema not in self._schemas:
                                continue
                            self._on_message(msg)
                        except Exception:
                            pass
            except Exception:
                if self._running:
                    await asyncio.sleep(5)

    def stop(self):
        self._running = False


class CommodityTracker:
    """Keeps a live in-memory cache of commodity prices from EDDN."""

    def __init__(self):
        self._markets: dict[str, dict] = {}
        self._listener = EddnListener(self._handle)
        self._listener.filter_schemas("commodity")

    def _handle(self, msg: dict):
        payload = msg.get("message", {})
        station = payload.get("stationName", "")
        system = payload.get("systemName", "")
        key = f"{system}/{station}"
        self._markets[key] = {
            "system": system,
            "station": station,
            "timestamp": payload.get("timestamp"),
            "commodities": payload.get("commodities", []),
        }

    def get_market(self, system: str, station: str) -> dict | None:
        return self._markets.get(f"{system}/{station}")

    def find_best_buy(self, commodity: str) -> list[dict]:
        results = []
        for key, market in self._markets.items():
            for c in market.get("commodities", []):
                if c.get("name", "").lower() == commodity.lower() and c.get("stock", 0) > 0:
                    results.append({**market, "price": c.get("buyPrice", 0), "stock": c.get("stock", 0)})
        return sorted(results, key=lambda x: x["price"])

    def find_best_sell(self, commodity: str) -> list[dict]:
        results = []
        for key, market in self._markets.items():
            for c in market.get("commodities", []):
                if c.get("name", "").lower() == commodity.lower() and c.get("demand", 0) > 0:
                    results.append({**market, "price": c.get("sellPrice", 0), "demand": c.get("demand", 0)})
        return sorted(results, key=lambda x: x["price"], reverse=True)

    async def start(self):
        await self._listener.run()

    def stop(self):
        self._listener.stop()
