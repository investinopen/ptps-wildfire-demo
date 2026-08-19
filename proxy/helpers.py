import requests

from proxy.constants import CERT_PATH, PROXY_URL


def requests_get(url: str):
    proxies = {"http": PROXY_URL, "https": PROXY_URL}
    resp = requests.get(url, proxies=proxies, verify=str(CERT_PATH), timeout=10)
    return resp
