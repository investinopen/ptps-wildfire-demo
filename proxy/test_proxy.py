import subprocess
from pathlib import Path

import pytest
import requests

PROXY_ORIGIN = "localhost:8080"
PROXY_URL = f"http://{PROXY_ORIGIN}/"
# https://docs.mitmproxy.org/stable/concepts/certificates/#using-a-custom-certificate-authority
CERT_PATH = Path("~/.mitmproxy/mitmproxy-ca-cert.pem").expanduser()


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
    """
    - https://docs.python-requests.org/en/latest/user/advanced/#proxies
    - https://docs.python-requests.org/en/latest/user/advanced/#ssl-cert-verification
    """

    proxies = {"http": PROXY_URL, "https": PROXY_URL}
    resp = requests.get(url, proxies=proxies, verify=str(CERT_PATH), timeout=10)
    print(resp.text)


def test_curl(url):
    """https://everything.curl.dev/usingcurl/proxies/http.html"""

    cmd = ["curl", "-i", "--proxy", PROXY_ORIGIN, "--cacert", str(CERT_PATH), url]
    print("Running:\n\n\t", " ".join(cmd))

    subprocess.run(
        cmd,
        check=True,
    )
