import pytest

from ptps_wildfire_demo.proxy.internet_archive_client import InternetArchiveClient


@pytest.fixture
async def client(httpx_client):
    return InternetArchiveClient(httpx_client)


async def test_save(client):
    response = await client.save("https://investinopen.org/")
    assert 200 <= response.status_code < 400
