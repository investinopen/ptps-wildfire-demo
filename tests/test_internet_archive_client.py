import httpx
import pytest
from pytest_httpx import HTTPXMock

from ptps_wildfire_demo.internet_archive_client import InternetArchiveClient


@pytest.fixture
async def client(httpx_client):
    return InternetArchiveClient(httpx_client)


async def test_save(client):
    response = await client.save("https://investinopen.org/")
    assert 200 <= response.status_code < 400


async def test_get_match_500(client, httpx_mock: HTTPXMock):
    """Imagining that the Resolver isn't able to reach the Internet Archive sometimes"""

    httpx_mock.add_response(status_code=500)

    match = await client.get_match("https://investinopen.org/")
    assert match is None


async def test_get_match_timeout(client, httpx_mock: HTTPXMock):
    httpx_mock.add_exception(httpx.TimeoutException("Timed out"))

    match = await client.get_match("https://investinopen.org/")
    assert match is None
