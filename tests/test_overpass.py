import osmnx as ox
import pytest
import requests
from osmnx._errors import ResponseStatusCodeError

from ptps_wildfire_demo.simplified_map.overpass import (
    OVERPASS_URLS,
    from_overpass,
    raise_if_overloaded,
)


@pytest.fixture(autouse=True)
def restore_osmnx_settings(monkeypatch: pytest.MonkeyPatch):
    for name in (
        "overpass_url",
        "overpass_rate_limit",
        "requests_timeout",
        "requests_kwargs",
    ):
        monkeypatch.setattr(ox.settings, name, getattr(ox.settings, name))


def test_from_overpass_uses_first_server():
    tried = []

    def fetch():
        tried.append(ox.settings.overpass_url)
        return "roads"

    assert from_overpass(fetch) == "roads"
    assert tried == OVERPASS_URLS[:1]


def test_from_overpass_skips_status_check():
    """OSMnx otherwise checks each server's /status first, and pauses for 60 seconds when it can't make sense of the reply (e.g. a 502 page), or until a busy server has a free slot."""

    def fetch():
        return ox.settings.overpass_rate_limit

    assert from_overpass(fetch) is False


@pytest.mark.parametrize(
    "error",
    [
        ResponseStatusCodeError("'overpass-api.de' responded: 502 Bad Gateway"),
        requests.ReadTimeout(),
    ],
)
def test_from_overpass_falls_back_to_next_server(error: Exception):
    tried = []

    def fetch():
        tried.append(ox.settings.overpass_url)
        if len(tried) == 1:
            raise error
        return "roads"

    assert from_overpass(fetch) == "roads"
    assert tried == OVERPASS_URLS[:2]


def test_from_overpass_raises_when_every_server_fails():
    tried = []

    def fetch():
        tried.append(ox.settings.overpass_url)
        raise ResponseStatusCodeError("down")

    with pytest.raises(ResponseStatusCodeError):
        from_overpass(fetch)
    assert tried == OVERPASS_URLS


@pytest.mark.parametrize("status_code", [429, 504])
def test_raise_if_overloaded(status_code: int):
    response = requests.Response()
    response.status_code = status_code

    with pytest.raises(requests.HTTPError):
        raise_if_overloaded(response)


def test_raise_if_overloaded_lets_other_errors_through():
    """OSMnx turns the rest into a ResponseStatusCodeError itself."""
    response = requests.Response()
    response.status_code = 502

    raise_if_overloaded(response)
