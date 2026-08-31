import httpx
import pandas as pd

from ptps_wildfire_demo.proxy.helpers import str_or_none
from ptps_wildfire_demo.proxy.internet_archive_client import InternetArchiveClient
from ptps_wildfire_demo.proxy.rescue import Rescue


class Resolver:
    httpx_client: httpx.AsyncClient
    internet_archive_client: InternetArchiveClient
    drp_rescues: pd.DataFrame

    def __init__(self, httpx_client: httpx.AsyncClient) -> None:
        self.httpx_client = httpx_client
        self.internet_archive_client = InternetArchiveClient(httpx_client)
        self.refresh()

    def refresh(self):
        # This is the data behind https://portal.datarescueproject.org/datasets/.
        self.drp_rescues = pd.read_json(
            "https://portal.datarescueproject.org/datasets-full.json",
            dtype_backend="pyarrow",
        )

    async def resolve(self, url: str):
        """Gets the URL after following any redirects"""

        try:
            response = await self.httpx_client.head(
                url, timeout=5, follow_redirects=True
            )
            return str(response.url)
        except (httpx.ConnectError, httpx.ReadTimeout):
            return url

    def _get_drp_match(self, boolean_index: pd.Series[bool]) -> pd.Series | None:
        matches = self.drp_rescues[boolean_index]
        if len(matches) > 0:
            row = matches.iloc[0]
            return row

        return None

    def get_drp_exact_match(self, url: str) -> pd.Series | None:
        is_exact_match = self.drp_rescues["data_source"] == url
        return self._get_drp_match(is_exact_match)

    def get_drp_partial_match(self, url: str) -> pd.Series | None:
        """Look for record where the provided URL is based on the record's URL. This is intended to catch request URLs that are a sub-path, have parameters, etc. (The matching could be even more robust.)"""

        is_partial_match = self.drp_rescues["data_source"].apply(
            lambda original_url: pd.notna(original_url) and url.startswith(original_url)
        )
        return self._get_drp_match(is_partial_match)

    def get_drp_match(self, url: str) -> pd.Series | None:
        """Gets the match from the Data Rescue Portal, favoring exact matches but allowing for partial matches."""

        drp_match = self.get_drp_exact_match(url)
        if drp_match is None:
            # try a partial match
            drp_match = self.get_drp_partial_match(url)

        return drp_match

    def get_drp_url(self, url: str) -> str | None:
        drp_match = self.get_drp_match(url)
        if drp_match is not None:
            drp_path = str_or_none(drp_match["url"])
            if drp_path:
                return f"https://portal.datarescueproject.org{drp_path}"

        return None

    async def get_rescue(self, url: str) -> Rescue:
        resolved_url = await self.resolve(url)

        wayback_match = await self.internet_archive_client.get_match(url)
        if wayback_match is None and resolved_url != url:
            wayback_match = await self.internet_archive_client.get_match(resolved_url)

        drp_url = self.get_drp_url(url)
        if drp_url is None and resolved_url != url:
            drp_url = self.get_drp_url(resolved_url)

        return Rescue(
            original_url=url,
            resolved_url=resolved_url,
            wayback_newest_url=wayback_match,
            drp_url=drp_url,
        )
