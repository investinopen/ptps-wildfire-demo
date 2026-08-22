"""
mitmproxy addon that replaces 404 and server error (5xx) response bodies
with a custom message.

https://docs.mitmproxy.org/stable/addons/overview/
"""

from mitmproxy import http

from proxy.resolver import Resolver

NOT_FOUND_MESSAGE = "Oops! The page you're looking for could not be found. -proxy\n"
SERVER_ERROR_MESSAGE = (
    "Something went wrong on the server. Please try again later. -proxy\n"
)


class CustomErrorMessages:
    """https://docs.mitmproxy.org/stable/api/events.html"""

    resolver: Resolver

    def __init__(self) -> None:
        self.resolver = Resolver()

    def response(self, flow: http.HTTPFlow):
        if flow.response is None:
            return

        status_code = flow.response.status_code
        if status_code == 404:
            fallback = self.resolver.find_fallback_url(flow.request.url)
            if fallback:
                flow.response.text = (
                    f"That site is no longer available. Try {fallback}."
                )
            else:
                flow.response.text = NOT_FOUND_MESSAGE
        elif status_code >= 500:
            flow.response.text = SERVER_ERROR_MESSAGE
        else:
            return

        flow.response.headers["content-type"] = "text/plain; charset=utf-8"

    def error(self, flow: http.HTTPFlow):
        if flow.response is None:
            flow.response = http.Response.make(502)
        if flow.error:
            flow.error.msg = "Error with error. -proxy"
        self.response(flow)

    def http_connect_error(self, flow: http.HTTPFlow):
        self.error(flow)


addons = [CustomErrorMessages()]
