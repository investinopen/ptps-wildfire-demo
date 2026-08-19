from proxy.helpers import requests_get


def test_404():
    resp = requests_get("https://investinopen.org/non/existent/page")

    assert resp.status_code == 404
    assert "-proxy" in resp.text
