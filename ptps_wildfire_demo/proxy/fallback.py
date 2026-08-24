"""
mitmproxy addon that replaces 404 and server error (5xx) response bodies
with a custom message.

https://docs.mitmproxy.org/stable/addons/overview/
"""

import asyncio
import sys
from pathlib import Path

import httpx
from mitmproxy import http

try:
    from ptps_wildfire_demo.proxy.resolver import Resolver
except ModuleNotFoundError:
    # Support loading this file directly via: mitmdump -s ptps_wildfire_demo/proxy/fallback.py
    repo_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repo_root))
    from ptps_wildfire_demo.proxy.resolver import Resolver


class Fallback:
    """https://docs.mitmproxy.org/stable/api/events.html"""

    resolver: Resolver

    def __init__(self) -> None:
        # not worrying about closing the client, since it'll be cleaned up at process exit
        client = httpx.AsyncClient()
        self.resolver = Resolver(client)

    # https://docs.mitmproxy.org/stable/addons/examples/#nonblocking
    async def response(self, flow: http.HTTPFlow):
        if flow.response is None:
            return

        status_code = flow.response.status_code
        original_url = flow.request.url
        rescue = await self.resolver.get_rescue(original_url)

        if status_code == 404 or status_code >= 500:
            flow.response.headers["content-type"] = "text/plain; charset=utf-8"

            if status_code == 404:
                msg = "That URL is no longer available."
            else:
                msg = "Unable to load that URL."

            fallback_urls = [
                rescue.wayback_newest_url,
                rescue.drp_metadata_url,
                rescue.drp_download_location,
            ]

            fallbacks = "\n\n".join(url for url in fallback_urls if url)
            flow.response.text = f"{msg} Try:\n\n{fallbacks}"
        elif not rescue.wayback_newest_url:
            print(f"{original_url} doesn't exist in the Internet Archive — saving")
            loop = asyncio.get_event_loop()
            loop.create_task(
                self.resolver.internet_archive_client.save(flow.request.url)
            )

        return

    async def error(self, flow: http.HTTPFlow):
        if flow.response is None:
            flow.response = http.Response.make(502)
        if flow.error:
            flow.error.msg = "Error with error. -proxy"
        await self.response(flow)

    async def http_connect_error(self, flow: http.HTTPFlow):
        await self.error(flow)


addons = [Fallback()]
