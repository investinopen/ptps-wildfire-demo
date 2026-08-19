"""
mitmproxy addon that replaces 404 and server error (5xx) response bodies
with a custom message.

https://docs.mitmproxy.org/stable/addons/overview/
"""

from mitmproxy import http

NOT_FOUND_MESSAGE = "Oops! The page you're looking for could not be found. -proxy\n"
SERVER_ERROR_MESSAGE = (
    "Something went wrong on the server. Please try again later. -proxy\n"
)


class CustomErrorMessages:
    def response(self, flow: http.HTTPFlow) -> None:
        if flow.response is None:
            return

        status_code = flow.response.status_code
        if status_code == 404:
            flow.response.text = NOT_FOUND_MESSAGE
        elif status_code >= 500:
            flow.response.text = SERVER_ERROR_MESSAGE
        else:
            return

        flow.response.headers["content-type"] = "text/plain; charset=utf-8"


addons = [CustomErrorMessages()]
