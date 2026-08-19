import requests

# https://docs.python-requests.org/en/latest/user/advanced/#proxies

PROXY = "http://localhost:8080/"

proxies = {"http": PROXY, "https": PROXY}
resp = requests.get("https://httpbin.org/ip", proxies=proxies, timeout=10)
print(resp.json())
