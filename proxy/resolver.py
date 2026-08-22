import pandas as pd


class Resolver:
    rescued_data: pd.DataFrame

    def __init__(self) -> None:
        self.refresh()

    def refresh(self):
        # this is the data behind https://portal.datarescueproject.org/datasets/
        self.rescued_data = pd.read_csv(
            "https://raw.githubusercontent.com/datarescueproject/portal/refs/heads/main/baserow_exports/datarescue_backups.csv",
            dtype_backend="pyarrow",
        )

    def _get_match(self, boolean_index: pd.Series[bool]) -> str | None:
        matches = self.rescued_data[boolean_index]
        if len(matches) > 0:
            row = matches.iloc[0]
            if pd.notna(row["metadata_url"]):
                return row["metadata_url"]
            if pd.notna(row["download_location"]):
                return row["download_location"]

        return None

    def find_fallback_url(self, url: str) -> str | None:
        is_exact_match = self.rescued_data["url"] == url
        # look for record where the provided URL is based on the record's URL
        is_partial_match = self.rescued_data["url"].apply(
            lambda original_url: pd.notna(original_url) and url.startswith(original_url)
        )
        return self._get_match(is_exact_match) or self._get_match(is_partial_match)
