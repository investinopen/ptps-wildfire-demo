import socket
import subprocess
import time
from pathlib import Path

import pytest


@pytest.fixture(scope="session", autouse=True)
def mitmproxy_server():
    project_root = Path(__file__).parent.parent
    process = subprocess.Popen(
        [
            str(project_root / ".venv" / "bin" / "mitmdump"),
            "-s",
            str(project_root / "proxy" / "custom_error_messages.py"),
        ],
        cwd=project_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if process.poll() is not None:
                output = process.stdout.read() if process.stdout else ""
                raise RuntimeError(
                    f"mitmproxy exited with code {process.returncode}:\n{output}"
                )

            try:
                with socket.create_connection(("127.0.0.1", 8080), timeout=0.1):
                    break
            except OSError:
                time.sleep(0.1)
                continue
        else:
            process.terminate()
            output = process.stdout.read() if process.stdout else ""
            raise RuntimeError(f"mitmproxy did not start listening:\n{output}")

        yield
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
        if process.stdout:
            process.stdout.close()
