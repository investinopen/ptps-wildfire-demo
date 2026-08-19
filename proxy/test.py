import requests

# https://docs.python-requests.org/en/latest/user/advanced/#proxies

PROXY = "http://localhost:8080/"
# URL = "https://httpbin.org/ip"
# URL = "https://mitm.it/"
URL = "http://mitm.it/"

proxies = {"http": PROXY, "https": PROXY}
resp = requests.get(URL, proxies=proxies, timeout=10)
print(resp.text)
