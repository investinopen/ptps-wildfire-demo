import asyncio
import logging
import os
import time
from json.decoder import JSONDecodeError

import httpx
from cachetools import TTLCache
from dotenv import load_dotenv

from ptps_wildfire_demo.constants import USER_AGENT

load_dotenv()

logger = logging.getLogger(__name__)

# The Internet Archive rate-limits aggressively and asks clients to be gentle. Serialize our requests and keep a minimum gap between them.
DEFAULT_REQUEST_INTERVAL = 1.0
# Don't ask the Wayback Machine to re-capture the same URL more often than this.
SAVE_INTERVAL = 24 * 60 * 60
# Bounds memory in a long-running proxy; if exceeded, the oldest entries are evicted early.
MAX_TRACKED_SAVES = 10_000


class InternetArchiveClient:
    httpx_client: httpx.AsyncClient

    access_key: str | None
    secret_key: str | None

    request_interval = DEFAULT_REQUEST_INTERVAL
    _throttle_lock: asyncio.Lock
    _last_request_at: float

    _recent_saves: TTLCache[str, bool]

    def __init__(self, httpx_client: httpx.AsyncClient) -> None:
        self.httpx_client = httpx_client

        self.access_key = os.environ.get("INTERNET_ARCHIVE_ACCESS_KEY")
        self.secret_key = os.environ.get("INTERNET_ARCHIVE_SECRET_KEY")

        self._last_request_at = 0.0
        self._throttle_lock = asyncio.Lock()
        self._recent_saves = TTLCache(
            maxsize=MAX_TRACKED_SAVES, ttl=SAVE_INTERVAL, timer=time.monotonic
        )

    async def _throttle(self) -> None:
        """Block until at least `request_interval` seconds have passed since the
        previous request, so concurrent callers don't hammer the Internet Archive."""

        async with self._throttle_lock:
            wait = self._last_request_at + self.request_interval - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_request_at = time.monotonic()

    async def request(
        self, url: str, *, method="GET", timeout=10, params: dict | None = None
    ):
        # not using the official package because we want async support
        # https://archive.org/developers/internetarchive/index.html

        await self._throttle()

        headers = {"User-Agent": USER_AGENT}

        if self.access_key and self.secret_key:
            # https://archive.org/developers/iarest.html#iarest-authentication
            headers["Authorization"] = f"LOW {self.access_key}:{self.secret_key}"

        response = await self.httpx_client.request(
            method=method,
            url=url,
            params=params,
            headers=headers,
            timeout=timeout,
        )
        return response

    async def get_match(self, url: str) -> str | None:
        """https://archive.org/help/wayback_api.php"""

        try:
            response = await self.request(
                "https://archive.org/wayback/available", params={"url": url}
            )
        except httpx.RequestError as e:
            logger.warning("Unable to reach the Internet Archive", exc_info=e)
            return None

        try:
            results = response.json()["archived_snapshots"]
        except JSONDecodeError:
            return None

        return results.get("closest", {}).get("url")

    async def save(self, url: str) -> httpx.Response | None:
        """https://help.archive.org/help/save-pages-in-the-wayback-machine/

        Returns None without making a request if the URL was submitted recently."""

        # checked before the request (rather than after) so concurrent calls for the same URL are deduplicated too
        if url in self._recent_saves:
            logger.info(
                f"{url} was submitted to the Internet Archive recently — skipping"
            )
            return None
        self._recent_saves[url] = True

        # this endpoint waits for the page to be archived, so use a longer timeout
        return await self.request(f"https://web.archive.org/save/{url}", timeout=20)
