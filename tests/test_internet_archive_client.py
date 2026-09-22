import asyncio
import time

import httpx
import pytest
from cachetools import TTLCache
from pytest_httpx import HTTPXMock

from ptps_wildfire_demo.internet_archive_client import InternetArchiveClient


@pytest.fixture
async def client(httpx_client):
    return InternetArchiveClient(httpx_client)


@pytest.mark.xfail(
    reason="The live Save Page Now endpoint is flaky (429s/500s), especially from CI"
)
async def test_save(client):
    response = await client.save("https://investinopen.org/")
    assert response is not None
    assert 200 <= response.status_code < 400


async def test_save_skips_recent_duplicates(client, httpx_mock: HTTPXMock):
    httpx_mock.add_response(is_reusable=True)

    first, second, other = await asyncio.gather(
        client.save("https://example.com/a"),
        client.save("https://example.com/a"),
        client.save("https://example.com/b"),
    )

    assert first is not None
    assert second is None
    assert other is not None
    assert len(httpx_mock.get_requests()) == 2


async def test_save_allows_resubmitting_after_interval(
    client, httpx_mock: HTTPXMock, monkeypatch
):
    now = 0.0
    monkeypatch.setattr(
        client, "_recent_saves", TTLCache(maxsize=10, ttl=60, timer=lambda: now)
    )
    httpx_mock.add_response(is_reusable=True)

    assert await client.save("https://example.com/a") is not None
    now = 59
    assert await client.save("https://example.com/a") is None
    now = 60
    assert await client.save("https://example.com/a") is not None


async def test_get_match_500(client, httpx_mock: HTTPXMock):
    """Imagining that the Resolver isn't able to reach the Internet Archive sometimes"""

    httpx_mock.add_response(status_code=500)

    match = await client.get_match("https://investinopen.org/")
    assert match is None


async def test_get_match_timeout(client, httpx_mock: HTTPXMock):
    httpx_mock.add_exception(httpx.TimeoutException("Timed out"))

    match = await client.get_match("https://investinopen.org/")
    assert match is None


async def test_requests_are_throttled(client, httpx_mock: HTTPXMock, monkeypatch):
    """Concurrent callers should be spaced out by request_interval."""

    monkeypatch.setattr(client, "request_interval", 0.1)
    httpx_mock.add_response(is_reusable=True)

    start = time.monotonic()
    await asyncio.gather(*(client.request("https://archive.org/") for _ in range(4)))
    elapsed = time.monotonic() - start

    # 4 requests, 0.1s apart => at least ~0.3s for the gaps between them
    assert elapsed >= 0.3
