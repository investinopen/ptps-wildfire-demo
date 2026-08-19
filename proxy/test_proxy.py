import pytest
import requests

# https://docs.python-requests.org/en/latest/user/advanced/#proxies

PROXY = "http://localhost:8080/"
PROXIES = {"http": PROXY, "https": PROXY}


@pytest.mark.parametrize(
    "url",
    [
        pytest.param("http://mitm.it/", id="HTTP"),
        pytest.param("https://mitm.it/", id="HTTPS"),
        pytest.param("https://httpbin.org/ip", id="HTTPS third-party"),
    ],
)
def test_proxy(url):
    resp = requests.get(url, proxies=PROXIES, timeout=10)
    print(resp.text)
