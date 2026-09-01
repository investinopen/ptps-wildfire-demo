import pandas as pd
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


def str_or_none(val):
    """Converts pandas NA types to None, otherwise returns the string as is."""

    if pd.isna(val):
        return None
    return val
