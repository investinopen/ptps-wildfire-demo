import httpx
import pandas as pd


class Resolver:
    client: httpx.AsyncClient | None
    drp_rescues: pd.DataFrame

    def __init__(self) -> None:
        self.client = None
        self.refresh()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self.client is not None:
            await self.client.aclose()
            self.client = None

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

        # Lazily create the client. Did it this way so that the client can be used synchronously or asynchronously.
        if self.client is None:
            self.client = httpx.AsyncClient()

        response = await self.client.get(
            "https://archive.org/wayback/available", params={"url": url}
        )
        results = response.json()["archived_snapshots"]
        return results.get("closest", {}).get("url")

    async def get_fallback_urls(self, url: str) -> list[str]:
        wayback_match = await self.get_wayback_machine_match(url)
        drp_match = self.get_drp_exact_match(url) or self.get_drp_partial_match(url)
        urls = [wayback_match, drp_match]
        return [url for url in urls if url]
