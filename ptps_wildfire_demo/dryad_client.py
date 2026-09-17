from urllib.parse import quote

import httpx


class DryadClient:
    """Minimal client for the parts of Dryad's REST API this project needs: trading an
    API account's credentials for a bearer token, then resolving a dataset file's
    current presigned download URL.

    https://datadryad.org/api
    https://github.com/datadryad/dryad-app/blob/main/documentation/apis/api_accounts.md
    """

    base_url = "https://datadryad.org"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        http_client: httpx.Client | None = None,
    ) -> None:
        self.http_client = http_client or httpx.Client(timeout=30)
        self.token = self._get_token(client_id, client_secret)

    def _get_token(self, client_id: str, client_secret: str) -> str:
        response = self.http_client.post(
            f"{self.base_url}/oauth/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "client_credentials",
            },
        )
        response.raise_for_status()
        return response.json()["access_token"]

    @property
    def _auth_header(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def resolve_download_url(self, doi: str, filename: str) -> str:
        """The current presigned URL for `filename` in the latest version of `doi`,
        looked up by DOI rather than a hardcoded file ID so a new dataset version
        doesn't break it."""

        dataset = self.http_client.get(
            f"{self.base_url}/api/v2/datasets/{quote(doi, safe='')}",
            headers=self._auth_header,
        ).json()
        version_href = dataset["_links"]["stash:version"]["href"]

        files = self.http_client.get(
            f"{self.base_url}{version_href}/files", headers=self._auth_header
        ).json()
        matches = [
            f for f in files["_embedded"]["stash:files"] if f["path"] == filename
        ]
        if not matches:
            available = [f["path"] for f in files["_embedded"]["stash:files"]]
            raise ValueError(f"{filename!r} not found in {doi} -- have {available}")
        download_href = matches[0]["_links"]["stash:download"]["href"]

        # a HEAD-sized Range request is enough to follow the redirect to the presigned
        # URL without pulling any of the file itself
        response = self.http_client.get(
            f"{self.base_url}{download_href}",
            headers={**self._auth_header, "Range": "bytes=0-0"},
            follow_redirects=True,
        )
        response.raise_for_status()
        return str(response.url)
