import httpx
import pytest
from pytest_httpx import HTTPXMock

from ptps_wildfire_demo.common_crawl_client import CommonCrawlClient


@pytest.fixture
async def client():
    async with httpx.AsyncClient() as httpx_client:
        yield CommonCrawlClient(httpx_client)


async def test_get_match(client, httpx_mock: HTTPXMock):
    client.latest_crawl_id = "CC-MAIN-2026-10"
    httpx_mock.add_response(
        text=(
            '{"timestamp":"20260101010101"}\n'
            '{"timestamp":"20260202020202"}\n'
        )
    )

    match = await client.get_match("https://investinopen.org/")

    assert (
        match
        == "https://index.commoncrawl.org/CC-MAIN-2026-10/20260202020202/https://investinopen.org/"
    )


async def test_get_match_404(client, httpx_mock: HTTPXMock):
    client.latest_crawl_id = "CC-MAIN-2026-10"
    httpx_mock.add_response(status_code=404)

    match = await client.get_match("https://investinopen.org/")
    assert match is None


async def test_get_match_timeout(client, httpx_mock: HTTPXMock):
    client.latest_crawl_id = "CC-MAIN-2026-10"
    httpx_mock.add_exception(httpx.TimeoutException("Timed out"))

    match = await client.get_match("https://investinopen.org/")
    assert match is None


async def test_get_latest_crawl_id(client, httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        json=[
            {"id": "CC-MAIN-2026-06"},
            {"id": "CC-MAIN-2026-10"},
            {"id": "CC-MAIN-2025-51"},
        ]
    )

    crawl_id = await client.get_latest_crawl_id()

    assert crawl_id == "CC-MAIN-2026-10"
