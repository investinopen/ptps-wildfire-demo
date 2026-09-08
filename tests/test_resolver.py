import re
from unittest.mock import AsyncMock

import httpx
import pandas as pd
import pytest
from pytest_httpx import HTTPXMock

from ptps_wildfire_demo import Resolver


@pytest.fixture
async def resolver(httpx_client):
    return Resolver(httpx_client)


async def test_resolve_self(resolver):
    url = "https://www.ncei.noaa.gov/access/storm-events-database/"
    resolved_url = await resolver.resolve(url)
    assert resolved_url == url


async def test_resolve_redirect(resolver):
    resolved_url = await resolver.resolve("https://www.ncdc.noaa.gov/stormevents/")
    assert resolved_url == "https://www.ncei.noaa.gov/access/storm-events-database/"


async def test_get_rescue_match(resolver):
    rescue = await resolver.get_rescue(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )

    assert rescue.wayback_newest_url
    # exact URL can change, so match flexibly
    is_archive_url = bool(
        re.search(
            r"^http://web\.archive\.org/web/\d+/https://www\.fema\.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants$",
            rescue.wayback_newest_url,
        )
    )
    assert is_archive_url
    assert (
        rescue.drp_url
        == "https://portal.datarescueproject.org/datasets/non-disaster-and-assistance-to-firefighter-grants/"
    )


async def test_get_rescue_partial_match(resolver):
    rescue = await resolver.get_rescue(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants?some=params"
    )

    assert (
        rescue.drp_url
        == "https://portal.datarescueproject.org/datasets/non-disaster-and-assistance-to-firefighter-grants/"
    )


def test_get_drp_match_prefers_longest_common_prefix():
    resolver = Resolver.__new__(Resolver)
    resolver.drp_rescues = pd.DataFrame(
        {
            "data_source": [
                "https://example.com/",
                "https://example.com/datasets/",
                "https://example.com/datasets/forest",
                "https://example.com/datasets/forest-floods",
            ],
            "url": [
                "/",
                "/datasets/",
                "/datasets/other/",
                "/datasets/specific/",
            ],
        }
    )

    match = resolver.get_drp_match(
        "https://example.com/datasets/forest-floods?year=2026"
    )

    assert match is not None
    assert match["url"] == "/datasets/specific/"


def test_get_drp_match_prefers_no_common_prefix():
    resolver = Resolver.__new__(Resolver)
    resolver.drp_rescues = pd.DataFrame(
        {
            "data_source": [
                "https://example.com/",
                "https://example.com/datasets/",
                "https://example.com/datasets/forest-cover",
            ],
            "url": [
                "/",
                "/datasets/",
                "/datasets/other/",
            ],
        }
    )

    match = resolver.get_drp_match(
        "https://example.com/datasets/forest-floods?year=2026"
    )

    assert match is not None
    assert match["url"] == "/datasets/"


async def test_get_rescue_no_match(resolver):
    rescue = await resolver.get_rescue("http://nota.realdomainname")
    assert rescue.wayback_newest_url is None
    assert rescue.common_crawl_url is None
    assert rescue.drp_url is None


async def test_get_rescue_timeout(resolver, httpx_mock: HTTPXMock):
    """Imagining that the Resolver isn't able to reach the upstream servers sometimes"""

    httpx_mock.add_exception(
        httpx.ReadTimeout("Unable to read within timeout"), is_reusable=True
    )

    rescue = await resolver.get_rescue("https://investinopen.org/")
    assert rescue.wayback_newest_url is None
    assert rescue.common_crawl_url is None
    assert rescue.drp_url is None


async def test_get_rescue_common_crawl_falls_back_to_resolved_url():
    class StubArchiveClient:
        def __init__(self, matches):
            self.matches = matches
            self.calls = []

        async def get_match(self, url: str):
            self.calls.append(url)
            return self.matches.get(url)

    original_url = "https://example.com/old"
    resolved_url = "https://example.com/new"
    common_crawl_url = (
        "https://index.commoncrawl.org/CC-MAIN-2026-10/20260202020202/"
        "https://example.com/new"
    )

    resolver = Resolver.__new__(Resolver)
    resolver.resolve = AsyncMock(return_value=resolved_url)
    resolver.internet_archive_client = StubArchiveClient({})
    resolver.common_crawl_client = StubArchiveClient({resolved_url: common_crawl_url})
    resolver.get_drp_url = lambda url: None

    rescue = await resolver.get_rescue(original_url)

    assert rescue.common_crawl_url == common_crawl_url
    assert resolver.common_crawl_client.calls == [original_url, resolved_url]
