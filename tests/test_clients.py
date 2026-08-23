import ssl
import subprocess
import urllib.request

import pytest
import requests

from ptps_wildfire_demo.proxy.constants import CERT_PATH, PROXY_ORIGIN, PROXY_URL
from ptps_wildfire_demo.proxy.helpers import requests_get


@pytest.fixture(
    params=[
        pytest.param("http://mitm.it/", id="HTTP"),
        pytest.param("https://mitm.it/", id="HTTPS"),
        # pytest.param("https://httpbin.org/ip", id="HTTPS third-party"),
    ]
)
def url(request):
    return request.param


def test_requests_pkg(url):
    """
    - https://docs.python-requests.org/en/latest/user/advanced/#proxies
    - https://docs.python-requests.org/en/latest/user/advanced/#ssl-cert-verification
    """

    resp = requests_get(url)
    print(resp.text)


def test_requests_pkg_env_vars(monkeypatch, url):
    monkeypatch.setenv("ALL_PROXY", PROXY_URL)
    monkeypatch.setenv("REQUESTS_CA_BUNDLE", str(CERT_PATH))

    assert requests.utils.getproxies() == {"all": PROXY_URL}  # pyright: ignore[reportPrivateImportUsage]

    resp = requests.get(url, timeout=10)
    print(resp.text)


def run_cmd(cmd: list[str]):
    print("Running:\n\n$", " ".join(cmd), "\n")
    subprocess.run(cmd, check=True)


def test_curl(url):
    """https://everything.curl.dev/usingcurl/proxies/http.html"""

    run_cmd(
        [
            "curl",
            "-i",
            "--proxy",
            PROXY_ORIGIN,
            "--cacert",
            str(CERT_PATH),
            url,
        ]
    )


def test_curl_env_vars(monkeypatch, url):
    """
    - https://curl.se/docs/manpage.html -> Environment
    - https://curl.se/docs/sslcerts.html#use-a-custom-ca-store
    """

    monkeypatch.setenv("ALL_PROXY", PROXY_URL)
    monkeypatch.setenv("CURL_CA_BUNDLE", str(CERT_PATH))

    run_cmd(["curl", "-i", url])


def test_urllib(monkeypatch, url):
    monkeypatch.setenv("ALL_PROXY", PROXY_URL)

    assert urllib.request.getproxies() == {"all": PROXY_URL}

    # Source - https://stackoverflow.com/a/75248628
    # Posted by PatheticCoder, modified by community. See post 'Timeline' for change history
    # Retrieved 2026-08-19, License - CC BY-SA 4.0

    # add self_signed cert
    myssl = ssl.create_default_context()
    myssl.load_verify_locations(CERT_PATH)
    # send request
    response = urllib.request.urlopen(url, context=myssl)
    assert response.status == 200
