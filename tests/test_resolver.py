import re

import pytest

from ptps_wildfire_demo.proxy.resolver import Resolver


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
        == "https://portal.datarescueproject.org/datasets/declaration-denials/"
    )


async def test_get_rescue_no_match(resolver):
    rescue = await resolver.get_rescue("http://nota.realdomainname")
    assert rescue.wayback_newest_url is None
    assert rescue.drp_url is None
