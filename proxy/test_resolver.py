import pytest

from proxy.resolver import Resolver


@pytest.fixture(scope="module")
def resolver():
    return Resolver()


def test_fallback_match(resolver):
    result = resolver.find_fallback_url(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )
    assert (
        result == "https://www.datalumos.org/datalumos/project/218702/version/V1/view"
    )


def test_fallback_partial(resolver):
    result = resolver.find_fallback_url(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants?some=params"
    )
    assert (
        result == "https://www.datalumos.org/datalumos/project/218702/version/V1/view"
    )
