import re

import pytest

from ptps_wildfire_demo.proxy.resolver import Resolver


@pytest.fixture
async def resolver():
    async with Resolver() as resolver:
        yield resolver


async def test_get_fallback_urls_match(resolver):
    results = await resolver.get_fallback_urls(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )

    assert len(results) == 2
    assert re.search(
        r"http://web\.archive\.org/web/\d+/https://www\.fema\.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants",
        results[0],
    )
    assert (
        results[1]
        == "https://www.datalumos.org/datalumos/project/218702/version/V1/view"
    )


async def test_get_fallback_urls_partial_match(resolver):
    results = await resolver.get_fallback_urls(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants?some=params"
    )

    assert results == [
        "https://www.datalumos.org/datalumos/project/218702/version/V1/view"
    ]


async def test_get_fallback_urls_no_match(resolver):
    results = await resolver.get_fallback_urls("http://nota.realdomainname")
    assert results == []
