from pathlib import Path

PROXY_ORIGIN = "localhost:8080"
PROXY_URL = f"http://{PROXY_ORIGIN}/"
# https://docs.mitmproxy.org/stable/concepts/certificates/#using-a-custom-certificate-authority
CERT_PATH = Path("~/.mitmproxy/mitmproxy-ca-cert.pem").expanduser()

USER_AGENT = (
    "ptps-wildfire-demo/0.1.0 (+https://github.com/investinopen/ptps-wildfire-demo)"
)
