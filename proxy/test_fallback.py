import pytest

from proxy.helpers import requests_get


def test_404():
    resp = requests_get("https://investinopen.org/non/existent/page")
    assert resp.status_code == 404
    assert "-proxy" in resp.text


def test_404_fallback():
    resp = requests_get("https://www.epa.gov/ejscreen")
    assert resp.status_code == 404
    assert "Harvard" in resp.text


@pytest.mark.xfail(reason="https://github.com/mitmproxy/mitmproxy/pull/7999")
def test_no_server():
    resp = requests_get("http://nota.realdomainname")
    assert resp.status_code == 502
    assert "-proxy" in resp.text
