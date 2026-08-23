import re

import pytest
import pytest_asyncio

from proxy.resolver import Resolver


@pytest.fixture(scope="module")
def resolver():
    return Resolver()


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def async_resolver():
    async with Resolver() as resolver:
        yield resolver


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


@pytest.mark.asyncio(loop_scope="module")
async def test_wayback(async_resolver):
    result = await async_resolver.get_wayback_machine_match(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )
    assert result
    assert re.search(
        r"http://web\.archive\.org/web/\d+/https://www\.fema\.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants",
        result,
    )


@pytest.mark.asyncio(loop_scope="module")
async def test_find_fallback_url_match(async_resolver):
    result = await async_resolver.find_fallback_url(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )
    assert result
    assert re.search(
        r"http://web\.archive\.org/web/\d+/https://www\.fema\.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants",
        result,
    )


@pytest.mark.asyncio(loop_scope="module")
async def test_find_fallback_url_no_match(async_resolver):
    result = await async_resolver.find_fallback_url("http://nota.realdomainname")
    assert result is None
