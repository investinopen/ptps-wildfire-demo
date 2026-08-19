import requests

from proxy.constants import CERT_PATH, PROXY_URL


def test_404():
    proxies = {"http": PROXY_URL, "https": PROXY_URL}
    resp = requests.get(
        "https://investinopen.org/non/existent/page",
        proxies=proxies,
        verify=str(CERT_PATH),
        timeout=10,
    )

    assert resp.status_code == 404
    assert " -proxy" in resp.text
