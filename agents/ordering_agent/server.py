"""Lightweight HTTP mock service for the ordering-agent IO contract.

RFC-0001: This service is intentionally dependency-free and deterministic. It is
meant for demos and smoke tests before wiring the same tools into a NexAU Agent.
"""

from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from agents.ordering_agent.workflow import load_and_run, run_ordering_mock


class OrderingMockHandler(BaseHTTPRequestHandler):
    """HTTP handler exposing the ordering mock as JSON endpoints."""

    server_version = "OrderingMock/0.1"

    def do_GET(self) -> None:  # noqa: N802 - stdlib HTTP handler API
        """Return service health for smoke tests."""

        if urlparse(self.path).path != "/health":
            self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)
            return
        self._send_json({"status": "ok", "service": "ordering-mock"})

    def do_POST(self) -> None:  # noqa: N802 - stdlib HTTP handler API
        """Run recommendation from JSON input and return the mock output."""

        if urlparse(self.path).path != "/recommend":
            self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            result = _run_from_request(body)
        except Exception as exc:  # pragma: no cover - exercised by manual smoke tests
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        self._send_json(result.to_dict())

    def log_message(self, format: str, *args: Any) -> None:
        """Keep smoke-test logs quiet unless debugging is enabled."""

        return

    def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def create_server(host: str = "127.0.0.1", port: int = 8000) -> ThreadingHTTPServer:
    """Create a local ordering mock server."""

    return ThreadingHTTPServer((host, port), OrderingMockHandler)


def _run_from_request(body: dict[str, Any]):
    menu_text = body.get("menu_text")
    request_text = body.get("request_text")

    if menu_text is not None and request_text is not None:
        return run_ordering_mock(str(menu_text), str(request_text))

    menu_path = body.get("menu_path", "agents/ordering_agent/data/sample_menu.txt")
    request_path = body.get("request_path", "agents/ordering_agent/data/sample_request.txt")
    return load_and_run(Path(menu_path), Path(request_path))


def main() -> None:
    server = create_server()
    try:
        print(f"Ordering mock service listening on http://{server.server_address[0]}:{server.server_address[1]}")
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
