import re

import pytest
from pytest_httpx import HTTPXMock

from ptps_wildfire_demo.proxy.resolver import Resolver


@pytest.fixture
async def resolver(httpx_client):
    return Resolver(httpx_client)


async def test_get_rescue_match(resolver):
    rescue = await resolver.get_rescue(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )

    # exact URL can change, so match flexibly
    assert re.search(
        r"http://web\.archive\.org/web/\d+/https://www\.fema\.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants",
        rescue.wayback_newest_url,
    )
    assert rescue.drp_download_location.startswith(
        "https://www.datalumos.org/datalumos/project/"
    )


async def test_get_rescue_partial_match(resolver):
    rescue = await resolver.get_rescue(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants?some=params"
    )

    assert rescue.drp_download_location.startswith(
        "https://www.datalumos.org/datalumos/project/"
    )


async def test_get_rescue_no_match(resolver):
    rescue = await resolver.get_rescue("http://nota.realdomainname")
    assert rescue.wayback_newest_url is None
    assert rescue.drp_metadata_url is None
    assert rescue.drp_download_location is None


async def test_get_rescue_no_connection(resolver, httpx_mock: HTTPXMock):
    """Imagining that the Resolver isn't able to reach the Internet Archive sometimes"""

    httpx_mock.add_response(status_code=404)

    rescue = await resolver.get_rescue("https://investinopen.org/")
    assert rescue.wayback_newest_url is None
    assert rescue.drp_metadata_url is None
    assert rescue.drp_download_location is None
