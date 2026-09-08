import json
import logging

import httpx

from ptps_wildfire_demo.constants import USER_AGENT

logger = logging.getLogger(__name__)

INDEX_SERVER = "https://index.commoncrawl.org"


class CommonCrawlClient:
    httpx_client: httpx.AsyncClient
    latest_crawl_id: str | None

    def __init__(self, httpx_client: httpx.AsyncClient) -> None:
        self.httpx_client = httpx_client
        self.latest_crawl_id = None

    async def request(self, url: str, *, timeout=10, params: dict | None = None):
        return await self.httpx_client.get(
            url,
            params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=timeout,
        )

    async def get_latest_crawl_id(self) -> str | None:
        if self.latest_crawl_id is not None:
            return self.latest_crawl_id

        try:
            response = await self.request(f"{INDEX_SERVER}/collinfo.json")
            response.raise_for_status()
            crawls = response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as error:
            logger.warning("Unable to retrieve the Common Crawl index metadata", exc_info=error)
            return None

        crawl_ids = [crawl["id"] for crawl in crawls if "id" in crawl]
        if not crawl_ids:
            return None

        self.latest_crawl_id = max(crawl_ids)
        return self.latest_crawl_id

    async def get_match(self, url: str) -> str | None:
        crawl_id = await self.get_latest_crawl_id()
        if crawl_id is None:
            return None

        try:
            response = await self.request(
                f"{INDEX_SERVER}/{crawl_id}-index",
                params={"url": url, "output": "json"},
            )
            if response.status_code == 404 or not response.text.strip():
                return None
            response.raise_for_status()
        except httpx.HTTPError as error:
            logger.warning("Unable to reach the Common Crawl index", exc_info=error)
            return None

        try:
            records = [
                json.loads(line) for line in response.text.strip().splitlines() if line
            ]
        except json.JSONDecodeError:
            return None

        if not records:
            return None

        latest_record = max(records, key=lambda record: record["timestamp"])
        return f"{INDEX_SERVER}/{crawl_id}/{latest_record['timestamp']}/{url}"
