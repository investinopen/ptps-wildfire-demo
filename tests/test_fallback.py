import re

import pytest
from mitmproxy import http

from ptps_wildfire_demo.proxy.fallback import wants_json
from ptps_wildfire_demo.proxy.helpers import requests_get


@pytest.mark.parametrize(
    ("url", "headers"),
    [
        ("https://example.com/page", {"Accept": "application/json"}),
        ("https://example.com/page.json", {}),
        ("https://example.com/page.json?cache=true", {}),
        ("https://example.com/page?format=json", {}),
    ],
)
def test_wants_json(url, headers):
    request = http.Request.make("GET", url, headers=headers)

    assert wants_json(request)


def test_wants_json_defaults_to_plain_text():
    request = http.Request.make("GET", "https://example.com/page", headers={})

    assert not wants_json(request)


def test_404():
    resp = requests_get("https://investinopen.org/non/existent/page")
    assert resp.status_code == 404


def test_404_fallback():
    resp = requests_get(
        "https://www.fema.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants"
    )
    assert resp.status_code == 404
    assert resp.text
    has_wayback_url = bool(
        re.search(
            r"http://web\.archive\.org/web/\d+/https://www\.fema\.gov/about/openfema/data-sets/grant-programs-directorate-preparedness-non-disasterassistance-firefighter-grants",
            resp.text,
        )
    )
    assert has_wayback_url


@pytest.mark.xfail(reason="https://github.com/mitmproxy/mitmproxy/pull/7999")
def test_no_server():
    resp = requests_get("http://nota.realdomainname")
    assert resp.status_code == 502
    assert "-proxy" in resp.text
