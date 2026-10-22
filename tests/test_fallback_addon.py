import re
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from mitmproxy import http
from pytest_httpx import HTTPXMock

from ptps_wildfire_demo.helpers import requests_get
from ptps_wildfire_demo.proxy.fallback_addon import wants_json


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


@pytest.fixture
def gone_server():
    """A stand-in for a site like FEMA's that has taken a page down, so the test doesn't depend on that site being reachable."""

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_error(404)

        def do_HEAD(self):
            self.send_error(404)

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    thread.join(timeout=10)


@pytest.mark.httpx_mock(should_mock=lambda request: request.url.host == "archive.org")
def test_404_fallback(gone_server, httpx_mock: HTTPXMock):
    url = f"{gone_server}/about/openfema/data-sets/firefighter-grants"
    wayback_url = f"http://web.archive.org/web/20250101000000/{url}"
    httpx_mock.add_response(
        url=re.compile(r"https://archive\.org/wayback/available\?.*"),
        json={"archived_snapshots": {"closest": {"url": wayback_url}}},
    )

    resp = requests_get(url)

    assert resp.status_code == 404
    assert "no longer available" in resp.text
    assert wayback_url in resp.text


@pytest.mark.xfail(reason="https://github.com/mitmproxy/mitmproxy/pull/7999")
def test_no_server():
    resp = requests_get("http://nota.realdomainname")
    assert resp.status_code == 502
    assert "-proxy" in resp.text
