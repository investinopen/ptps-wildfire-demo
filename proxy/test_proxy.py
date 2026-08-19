import subprocess

import pytest
import requests

PROXY_ORIGIN = "localhost:8080"
PROXY_URL = f"http://{PROXY_ORIGIN}/"


@pytest.fixture(
    params=[
        pytest.param("http://mitm.it/", id="HTTP"),
        pytest.param("https://mitm.it/", id="HTTPS"),
        pytest.param("https://httpbin.org/ip", id="HTTPS third-party"),
    ]
)
def url(request):
    return request.param


def test_requests_pkg(url):
    """https://docs.python-requests.org/en/latest/user/advanced/#proxies"""

    proxies = {"http": PROXY_URL, "https": PROXY_URL}
    resp = requests.get(url, proxies=proxies, timeout=10)
    print(resp.text)


def test_curl(url):
    """https://everything.curl.dev/usingcurl/proxies/http.html"""
    subprocess.run(
        ["curl", "-i", "--proxy", PROXY_ORIGIN, url],
        check=True,
    )
