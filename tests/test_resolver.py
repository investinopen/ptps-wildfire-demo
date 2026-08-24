import re

import httpx
import pytest

from ptps_wildfire_demo.proxy.resolver import Resolver


@pytest.fixture
async def resolver():
    async with httpx.AsyncClient() as client:
        yield Resolver(client)


async def test_get_rescue_match(resolver):
    rescue = await resolver.get_rescue(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )

    assert re.search(
        r"http://web\.archive\.org/web/\d+/https://www\.fema\.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants",
        rescue.wayback_newest_url,
    )
    assert (
        rescue.drp_download_location
        == "https://www.datalumos.org/datalumos/project/218702/version/V1/view"
    )


async def test_get_rescue_partial_match(resolver):
    rescue = await resolver.get_rescue(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants?some=params"
    )

    assert (
        rescue.drp_download_location
        == "https://www.datalumos.org/datalumos/project/218702/version/V1/view"
    )


async def test_get_rescue_no_match(resolver):
    rescue = await resolver.get_rescue("http://nota.realdomainname")
    assert rescue.wayback_newest_url is None
    assert rescue.drp_metadata_url is None
    assert rescue.drp_download_location is None
