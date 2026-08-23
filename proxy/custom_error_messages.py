"""
mitmproxy addon that replaces 404 and server error (5xx) response bodies
with a custom message.

https://docs.mitmproxy.org/stable/addons/overview/
"""

from mitmproxy import http

from proxy.resolver import Resolver


class CustomErrorMessages:
    """https://docs.mitmproxy.org/stable/api/events.html"""

    resolver: Resolver

    def __init__(self) -> None:
        self.resolver = Resolver()

    # https://docs.mitmproxy.org/stable/addons/examples/#nonblocking
    async def response(self, flow: http.HTTPFlow):
        if flow.response is None:
            return

        status_code = flow.response.status_code
        if status_code == 404 or status_code >= 500:
            fallbacks = await self.resolver.get_fallback_urls(flow.request.url)
            if fallbacks:
                flow.response.headers["content-type"] = "text/plain; charset=utf-8"

                if status_code == 404:
                    msg = "That URL is no longer available."
                else:
                    msg = "Unable to load that URL."

                fallbacks_str = "\n\n".join(fallbacks)
                flow.response.text = f"{msg} Try:\n{fallbacks_str}."

        return

    async def error(self, flow: http.HTTPFlow):
        if flow.response is None:
            flow.response = http.Response.make(502)
        if flow.error:
            flow.error.msg = "Error with error. -proxy"
        await self.response(flow)

    async def http_connect_error(self, flow: http.HTTPFlow):
        await self.error(flow)


addons = [CustomErrorMessages()]
