import asyncio
import socket
import threading
import time

import httpx
import pytest
from mitmproxy.options import Options
from mitmproxy.tools.dump import DumpMaster

from ptps_wildfire_demo.proxy.fallback_addon import addons


@pytest.fixture(scope="session", autouse=True)
def mitmproxy_server():
    """Run in the same process as the tests so that we can debug"""

    master = None
    errors = []

    def run_server():
        async def run():
            nonlocal master
            master = DumpMaster(
                Options(listen_host="127.0.0.1", listen_port=8080),
                with_termlog=False,
                with_dumper=False,
            )
            master.addons.add(*addons)
            await master.run()

        try:
            asyncio.run(run())
        except Exception as error:  # noqa: BLE001
            errors.append(error)

    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()

    try:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if errors:
                raise RuntimeError("mitmproxy failed to start") from errors[0]

            try:
                with socket.create_connection(("127.0.0.1", 8080), timeout=0.1):
                    break
            except OSError:
                time.sleep(0.1)
                continue
        else:
            raise RuntimeError("mitmproxy did not start listening")

        yield
    finally:
        if master is not None:
            master.shutdown()
        thread.join(timeout=10)


@pytest.fixture(scope="session")
async def httpx_client():
    async with httpx.AsyncClient() as client:
        yield client
