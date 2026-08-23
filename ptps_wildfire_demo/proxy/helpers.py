import requests

from ptps_wildfire_demo.proxy.constants import CERT_PATH, PROXY_URL


def requests_get(url: str):
    resp = requests.get(
        url,
        proxies={"all": PROXY_URL},
        verify=str(CERT_PATH),
        timeout=10,
    )
    return resp
