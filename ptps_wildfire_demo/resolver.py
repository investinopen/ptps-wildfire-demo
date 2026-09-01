from typing import cast

import httpx
import pandas as pd

from ptps_wildfire_demo.helpers import str_or_none
from ptps_wildfire_demo.internet_archive_client import InternetArchiveClient
from ptps_wildfire_demo.rescue import Rescue


class Resolver:
    httpx_client: httpx.AsyncClient
    internet_archive_client: InternetArchiveClient
    drp_rescues: pd.DataFrame

    def __init__(self, httpx_client: httpx.AsyncClient) -> None:
        self.httpx_client = httpx_client
        self.internet_archive_client = InternetArchiveClient(httpx_client)
        self.refresh()

    def refresh(self):
        """Retrieve the data behind https://portal.datarescueproject.org/datasets/"""
        self.drp_rescues = pd.read_json(
            "https://portal.datarescueproject.org/datasets-full.json",
            dtype_backend="pyarrow",
        )

    async def resolve(self, url: str):
        """Gets the URL after following any redirects"""

        try:
            response = await self.httpx_client.head(
                url, timeout=20, follow_redirects=True
            )
            return str(response.url)
        except httpx.HTTPError:
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
        """Find the longest complete data source contained in the provided URL."""

        source_urls = self.drp_rescues["data_source"]
        is_partial_match = source_urls.apply(
            lambda original_url: pd.notna(original_url) and original_url in url
        )
        matches = self.drp_rescues[is_partial_match]
        if not matches.empty:
            match_idx = matches["data_source"].str.len().idxmax()
            match = cast(pd.Series, matches.loc[match_idx])
            return match

        return None

    def get_drp_match(self, url: str) -> pd.Series | None:
        """Gets the match from the Data Rescue Project, favoring exact matches but allowing for partial matches."""

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
