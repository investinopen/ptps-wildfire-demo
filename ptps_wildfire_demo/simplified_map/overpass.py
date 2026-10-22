"""Falls back to other public Overpass instances when one is down or at capacity, like the detailed firefighter map does."""

import logging
from collections.abc import Callable
from typing import TypeVar

import osmnx as ox
import requests
from osmnx._errors import InsufficientResponseError, ResponseStatusCodeError

logger = logging.getLogger(__name__)

T = TypeVar("T")

# the same servers, in the same order, as OVERPASS_URLS in site/firefighter-maps/detailed/scripts/overpass.js, minus the "/interpreter" that OSMnx adds
# https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
OVERPASS_URLS = [
    "https://overpass-api.de/api",
    "https://overpass.private.coffee/api",
    "https://maps.mail.ru/osm/tools/overpass/api",
]
# how long to wait on one server, rather than OSMnx's default of 180 seconds, so one that's hanging doesn't hold up the others. OSMnx also uses it as the queries' own [timeout:...].
REQUEST_TIMEOUT = 60


def raise_if_overloaded(response: requests.Response, *args, **kwargs) -> None:
    """A requests hook that raises on a 429 or 504, rather than letting OSMnx wait and retry the same server, which it does with no limit."""
    if response.status_code in {429, 504}:
        raise requests.HTTPError(
            f"{response.status_code} {response.reason}", response=response
        )


def from_overpass(fetch: Callable[[], T]) -> T:
    """The result of `fetch` (an OSMnx call that queries Overpass), trying each of OVERPASS_URLS in turn until one responds."""
    # skips OSMnx's check of each server's /status before querying it, which it follows with a 60-second pause when it can't parse the reply (e.g. a 502 page), or a wait for a busy server's next slot. A server that's at capacity says so with a 429 anyway, which raise_if_overloaded() turns into moving on.
    ox.settings.overpass_rate_limit = False
    ox.settings.requests_timeout = REQUEST_TIMEOUT
    ox.settings.requests_kwargs = {"hooks": {"response": raise_if_overloaded}}
    for url in OVERPASS_URLS[:-1]:
        ox.settings.overpass_url = url
        try:
            return fetch()
        except (
            ResponseStatusCodeError,
            InsufficientResponseError,
            requests.RequestException,
        ) as error:
            logger.warning(f"Overpass at {url} failed, trying the next one: {error}")

    ox.settings.overpass_url = OVERPASS_URLS[-1]
    return fetch()
