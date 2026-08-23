import pandas as pd


class Resolver:
    drp_rescues: pd.DataFrame

    def __init__(self) -> None:
        self.refresh()

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

    def _get_drp_exact_match(self, url: str) -> str | None:
        is_exact_match = self.drp_rescues["url"] == url
        return self._get_drp_match(is_exact_match)

    def _get_drp_partial_match(self, url: str) -> str | None:
        """Look for record where the provided URL is based on the record's URL. This is intended to catch request URLs that are a sub-path, have parameters, etc. The matching could be even more robust."""

        is_partial_match = self.drp_rescues["url"].apply(
            lambda original_url: pd.notna(original_url) and url.startswith(original_url)
        )
        return self._get_drp_match(is_partial_match)

    def find_fallback_url(self, url: str) -> str | None:
        return self._get_drp_exact_match(url) or self._get_drp_partial_match(url)
