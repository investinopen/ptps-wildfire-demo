import os

import httpx
import pandas as pd
from dotenv import load_dotenv

from ptps_wildfire_demo.proxy.constants import USER_AGENT
from ptps_wildfire_demo.proxy.rescue import Rescue

load_dotenv()


def str_or_none(val):
    """Converts pandas NA types to None, otherwise returns the string as is."""

    if pd.isna(val):
        return None
    return val


class Resolver:
    internet_archive_access_key: str | None
    internet_archive_secret_key: str | None
    client: httpx.AsyncClient
    drp_rescues: pd.DataFrame

    def __init__(self, client: httpx.AsyncClient) -> None:
        self.internet_archive_access_key = os.environ.get("INTERNET_ARCHIVE_ACCESS_KEY")
        self.internet_archive_secret_key = os.environ.get("INTERNET_ARCHIVE_SECRET_KEY")

        self.client = client
        self.refresh()

    def refresh(self):
        # This is the data behind https://portal.datarescueproject.org/datasets/. We'll use https://github.com/datarescueproject/portal/pull/26 if/when it's merged.
        self.drp_rescues = pd.read_csv(
            "https://raw.githubusercontent.com/datarescueproject/portal/refs/heads/main/baserow_exports/datarescue_backups.csv",
            dtype_backend="pyarrow",
        )

    def _get_drp_match(self, boolean_index: pd.Series[bool]) -> pd.Series | None:
        matches = self.drp_rescues[boolean_index]
        if len(matches) > 0:
            row = matches.iloc[0]
            return row

        return None

    def get_drp_exact_match(self, url: str) -> pd.Series | None:
        is_exact_match = self.drp_rescues["url"] == url
        return self._get_drp_match(is_exact_match)

    def get_drp_partial_match(self, url: str) -> pd.Series | None:
        """Look for record where the provided URL is based on the record's URL. This is intended to catch request URLs that are a sub-path, have parameters, etc. The matching could be even more robust."""

        is_partial_match = self.drp_rescues["url"].apply(
            lambda original_url: pd.notna(original_url) and url.startswith(original_url)
        )
        return self._get_drp_match(is_partial_match)

    async def get_wayback_machine_match(self, url: str) -> str | None:
        """https://archive.org/help/wayback_api.php"""

        # not using the official package because we want async support
        # https://archive.org/developers/internetarchive/index.html

        headers = {"User-Agent": USER_AGENT}

        if self.internet_archive_access_key and self.internet_archive_secret_key:
            # https://archive.org/developers/iarest.html#iarest-authentication
            headers["Authorization"] = (
                f"LOW {self.internet_archive_access_key}:{self.internet_archive_secret_key}"
            )

        response = await self.client.get(
            "https://archive.org/wayback/available",
            params={"url": url},
            headers=headers,
            timeout=5,
        )
        results = response.json()["archived_snapshots"]
        return results.get("closest", {}).get("url")

    async def get_rescue(self, url: str) -> Rescue:
        wayback_match = await self.get_wayback_machine_match(url)
        drp_metadata_url: str | None = None
        drp_download_location: str | None = None

        drp_match = self.get_drp_exact_match(url)
        if drp_match is None:
            # try a partial match
            drp_match = self.get_drp_partial_match(url)

        if drp_match is not None:
            drp_metadata_url = str_or_none(drp_match["metadata_url"])
            drp_download_location = str_or_none(drp_match["download_location"])

        return Rescue(
            original_url=url,
            wayback_newest_url=wayback_match,
            drp_metadata_url=drp_metadata_url,
            drp_download_location=drp_download_location,
        )
