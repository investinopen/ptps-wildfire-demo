from pathlib import Path

PROXY_ORIGIN = "localhost:8080"
PROXY_URL = f"http://{PROXY_ORIGIN}/"
# https://docs.mitmproxy.org/stable/concepts/certificates/#using-a-custom-certificate-authority
CERT_PATH = Path("~/.mitmproxy/mitmproxy-ca-cert.pem").expanduser()
