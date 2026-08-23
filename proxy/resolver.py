import httpx
import pandas as pd


class Resolver:
    client: httpx.AsyncClient
    drp_rescues: pd.DataFrame

    def __init__(self) -> None:
        self.client = httpx.AsyncClient()
        self.refresh()

    async def __exit__(self, exc_type, exc, tb):
        await self.client.aclose()

    def refresh(self):
        # This is the data behind https://portal.datarescueproject.org/datasets/. We'll use https://github.com/datarescueproject/portal/pull/26 if/when it's merged.
        self.drp_rescues = pd.read_csv(
            "https://raw.githubusercontent.com/datarescueproject/portal/refs/heads/main/baserow_exports/datarescue_backups.csv",
            dtype_backend="pyarrow",
        )

    def _get_drp_match(self, boolean_index: pd.Series[bool]) -> str | None:
        matches = self.drp_rescues[boolean_index]
        if len(matches) > 0:
            row = matches.iloc[0]
            if pd.notna(row["download_location"]):
                return row["download_location"]

        return None

    def get_drp_exact_match(self, url: str) -> str | None:
        is_exact_match = self.drp_rescues["url"] == url
        return self._get_drp_match(is_exact_match)

    def get_drp_partial_match(self, url: str) -> str | None:
        """Look for record where the provided URL is based on the record's URL. This is intended to catch request URLs that are a sub-path, have parameters, etc. The matching could be even more robust."""

        is_partial_match = self.drp_rescues["url"].apply(
            lambda original_url: pd.notna(original_url) and url.startswith(original_url)
        )
        return self._get_drp_match(is_partial_match)

    async def get_wayback_machine_match(self, url: str) -> str | None:
        """https://archive.org/help/wayback_api.php"""

        response = await self.client.get(
            "https://archive.org/wayback/available", params={"url": url}
        )
        results = response.json()["archived_snapshots"]
        return results.get("closest", {}).get("url")

    async def find_fallback_url(self, url: str) -> str | None:
        return (
            (await self.get_wayback_machine_match(url))
            or self.get_drp_exact_match(url)
            or self.get_drp_partial_match(url)
        )
