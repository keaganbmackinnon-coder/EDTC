import asyncio
import threading
import time
from typing import Any

import httpx

DEFAULT_TIMEOUT = 15.0
DEFAULT_RATE_LIMIT = 0.5  # seconds between requests per host


class RateLimiter:
    """Last-call timestamps are shared per scope (API class name) at class
    level: callers create short-lived API instances inside per-call event
    loops, so instance state would reset on every request and never limit.
    The lock makes it safe across the app's many calling threads."""
    _last: dict[str, float] = {}
    _lock = threading.Lock()

    def __init__(self, min_interval: float = DEFAULT_RATE_LIMIT, scope: str = "default"):
        self._min_interval = min_interval
        self._scope = scope

    async def wait(self):
        while True:
            with RateLimiter._lock:
                now = time.monotonic()
                delay = self._min_interval - (now - RateLimiter._last.get(self._scope, 0.0))
                if delay <= 0:
                    RateLimiter._last[self._scope] = now
                    return
            await asyncio.sleep(delay)


class BaseAPI:
    BASE_URL = ""
    RATE_LIMIT = DEFAULT_RATE_LIMIT

    def __init__(self):
        self._limiter = RateLimiter(self.RATE_LIMIT, scope=type(self).__name__)
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
