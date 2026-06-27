import asyncio
import time
from typing import Any

import httpx

DEFAULT_TIMEOUT = 15.0
DEFAULT_RATE_LIMIT = 0.5  # seconds between requests per host


class RateLimiter:
    def __init__(self, min_interval: float = DEFAULT_RATE_LIMIT):
        self._min_interval = min_interval
        self._last_call: float = 0.0

    async def wait(self):
        now = time.monotonic()
        elapsed = now - self._last_call
        if elapsed < self._min_interval:
            await asyncio.sleep(self._min_interval - elapsed)
        self._last_call = time.monotonic()


class BaseAPI:
    BASE_URL = ""
    RATE_LIMIT = DEFAULT_RATE_LIMIT

    def __init__(self):
        self._limiter = RateLimiter(self.RATE_LIMIT)
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                timeout=DEFAULT_TIMEOUT,
                headers={"User-Agent": "EDTC/0.1 (Elite Dangerous Tools & Companion)"},
            )
        return self._client

    async def get(self, path: str, params: dict | None = None) -> Any:
        await self._limiter.wait()
        client = await self._get_client()
        resp = await client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
