import os

import httpx
from dotenv import load_dotenv

from ptps_wildfire_demo.proxy.constants import USER_AGENT

load_dotenv()


class InternetArchiveClient:
    httpx_client: httpx.AsyncClient
    access_key: str | None
    secret_key: str | None

    def __init__(self, httpx_client: httpx.AsyncClient) -> None:
        self.httpx_client = httpx_client
        self.access_key = os.environ.get("INTERNET_ARCHIVE_ACCESS_KEY")
        self.secret_key = os.environ.get("INTERNET_ARCHIVE_SECRET_KEY")

    async def request(
        self, url: str, *, method="GET", timeout=5, params: dict | None = None
    ):
        # not using the official package because we want async support
        # https://archive.org/developers/internetarchive/index.html

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

        response = await self.request(
            "https://archive.org/wayback/available", params={"url": url}
        )
        results = response.json()["archived_snapshots"]
        return results.get("closest", {}).get("url")

    async def save(self, url: str):
        """https://help.archive.org/help/save-pages-in-the-wayback-machine/"""

        await self.request(f"https://web.archive.org/save/{url}", timeout=20)
