"""
mitmproxy addon that replaces 404 and server error (5xx) response bodies
with a custom message.

https://docs.mitmproxy.org/stable/addons/overview/
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

import httpx
from mitmproxy import http

from ptps_wildfire_demo.proxy.rescue import Rescue

try:
    from ptps_wildfire_demo.proxy.resolver import Resolver
except ModuleNotFoundError:
    # Support loading this file directly via: mitmdump -s ptps_wildfire_demo/proxy/fallback.py
    repo_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repo_root))
    from ptps_wildfire_demo.proxy.resolver import Resolver


logger = logging.getLogger(__name__)


def wants_json(request: http.Request) -> bool:
    return (
        "application/json" in request.headers.get("accept", "").lower()
        or request.path.split("?", 1)[0].endswith(".json")
        or request.query.get("format") == "json"
    )


def replace_error_response(flow: http.HTTPFlow, rescue: Rescue) -> None:
    if flow.response is None:
        return

    msg = (
        "That URL is no longer available."
        if flow.response.status_code == 404
        else "Unable to load that URL."
    )
    fallback_urls: list[str] = [
        url for url in (rescue.wayback_newest_url, rescue.drp_url) if url is not None
    ]
    if wants_json(flow.request):
        flow.response.headers["content-type"] = "application/json"
        flow.response.text = json.dumps(
            {"message": msg, "fallback_urls": fallback_urls}
        )
    else:
        flow.response.headers["content-type"] = "text/plain; charset=utf-8"
        fallbacks = "\n\n".join(fallback_urls)
        flow.response.text = f"{msg} Try:\n\n{fallbacks}"


class FallbackAddon:
    """https://docs.mitmproxy.org/stable/api/events.html"""

    resolver: Resolver

    def __init__(self) -> None:
        # not worrying about closing the client, since it'll be cleaned up at process exit
        client = httpx.AsyncClient()
        self.resolver = Resolver(client)

    def save_to_internet_archive(self, original_url: str) -> None:
        logger.info(f"{original_url} doesn't exist in the Internet Archive — saving")
        loop = asyncio.get_event_loop()
        loop.create_task(self.resolver.internet_archive_client.save(original_url))

    # https://docs.mitmproxy.org/stable/addons/examples/#nonblocking
    async def response(self, flow: http.HTTPFlow):
        if flow.response is None:
            return

        original_url = flow.request.url
        rescue = await self.resolver.get_rescue(original_url)

        if flow.response.status_code == 404 or flow.response.status_code >= 500:
            replace_error_response(flow, rescue)
        elif not rescue.wayback_newest_url:
            self.save_to_internet_archive(original_url)

        return

    async def error(self, flow: http.HTTPFlow):
        if flow.response is None:
            flow.response = http.Response.make(502)
        if flow.error:
            flow.error.msg = "Error with error. -proxy"
        await self.response(flow)

    async def http_connect_error(self, flow: http.HTTPFlow):
        await self.error(flow)


addons = [FallbackAddon()]
