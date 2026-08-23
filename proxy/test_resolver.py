import re

import pytest

from proxy.resolver import Resolver


@pytest.fixture(scope="module")
def resolver():
    return Resolver()


def test_get_drp_exact(resolver):
    result = resolver.get_drp_exact_match(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )
    assert (
        result == "https://www.datalumos.org/datalumos/project/218702/version/V1/view"
    )


def test_get_drp_partial(resolver):
    result = resolver.get_drp_partial_match(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants?some=params"
    )
    assert (
        result == "https://www.datalumos.org/datalumos/project/218702/version/V1/view"
    )


@pytest.mark.asyncio
async def test_wayback(resolver):
    result = await resolver.get_wayback_machine_match(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )
    assert result
    assert re.search(
        r"http://web\.archive\.org/web/\d+/https://www\.fema\.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants",
        result,
    )


@pytest.mark.asyncio
async def test_find_fallback_url_match(resolver):
    result = await resolver.find_fallback_url(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )
    assert result
    assert re.search(
        r"http://web\.archive\.org/web/\d+/https://www\.fema\.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants",
        result,
    )


@pytest.mark.asyncio
async def test_find_fallback_url_no_match(resolver):
    result = await resolver.find_fallback_url("http://nota.realdomainname")
    assert result is None
