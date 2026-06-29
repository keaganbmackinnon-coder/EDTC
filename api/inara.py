"""Inara API — https://inara.cz/inapi/v1/"""
import logging
from datetime import datetime, timezone

import httpx

INARA_URL = "https://inara.cz/inapi/v1/"
TIMEOUT = 15.0
PLANETARY_TYPES = {"Planetary Outpost", "Planetary Port", "Odyssey Settlement"}


class InaraAPI:
    def __init__(self, api_key: str, app_version: str = "0.3.17"):
        self._api_key = api_key
        self._app_version = app_version

    def _header(self) -> dict:
        return {
            "appName": "EDTC",
            "appVersion": self._app_version,
            "isBeingDeveloped": False,
            "isDeveloperModeOn": False,
            "APIkey": self._api_key,
        }

    async def commodity_markets(
        self,
        commodity_name: str,
        ref_x: float,
        ref_y: float,
        ref_z: float,
        limit: int = 50,
        max_age_days: int = 7,
    ) -> list[dict]:
        payload = {
            "header": self._header(),
            "events": [{
                "eventName": "getCommoditiesStations",
                "eventTimestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "eventData": {
                    "commodityName": commodity_name,
                    "refSystemX": ref_x,
                    "refSystemY": ref_y,
                    "refSystemZ": ref_z,
                    "maxAgeofPriceDataInDays": max_age_days,
                    "pagingLimit": limit,
                    "pagingOffset": 0,
                },
            }],
        }
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(INARA_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()

        events = data.get("events", [])
        if not events:
            return []
        event = events[0]
        status = event.get("eventStatus", 0)
        if status != 200:
            logging.warning(f"Inara API status {status}: {event.get('eventStatusText', '')}")
            return []

        return event.get("eventData") or []

    @staticmethod
    def format_result(entry: dict) -> dict:
        station_type = entry.get("stationType", "")
        return {
            "station":             entry.get("stationName", ""),
            "system":              entry.get("systemName", ""),
            "distance":            round(entry.get("stationDistance") or 0, 1),
            "distance_to_arrival": round(entry.get("stationDistancefromStar") or 0),
            "has_large_pad":       entry.get("stationMaxLandingPadSize") == "L",
            "is_planetary":        station_type in PLANETARY_TYPES,
            "updated_at":          entry.get("priceUpdateTimestamp", ""),
            "buy_price":           entry.get("commodityBuyPrice") or 0,
            "sell_price":          entry.get("commoditySellPrice") or 0,
            "supply":              entry.get("commodityStock") or 0,
            "demand":              entry.get("commodityDemand") or 0,
            "source":              "inara",
        }
