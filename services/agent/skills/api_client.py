"""HTTP client and NexAU tool wrappers for the ordering API.

RFC-0002: T5 Agent skill 包装层。Agent 通过这里的工具调用结构化接口；
接口服务不可用时由调用方显式处理错误，不内置本地兜底数据。
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx


DEFAULT_API_BASE_URL = "http://localhost:3001"
DEFAULT_TIMEOUT_SECONDS = 30.0


@dataclass(frozen=True)
class ApiClientConfig:
    """Runtime configuration for the Agent skill API client."""

    base_url: str
    timeout_seconds: float


def get_config() -> ApiClientConfig:
    """Resolve API client configuration from environment variables."""

    return ApiClientConfig(
        base_url=os.getenv("ORDERING_API_BASE_URL", DEFAULT_API_BASE_URL).rstrip("/"),
        timeout_seconds=float(os.getenv("ORDERING_API_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS))),
    )


def build_client(config: ApiClientConfig | None = None) -> httpx.Client:
    """Create an HTTP client for the ordering API."""

    resolved_config = config or get_config()
    return httpx.Client(base_url=resolved_config.base_url, timeout=resolved_config.timeout_seconds, trust_env=False)


def get_menu_items(limit: int = 100, status: str = "active") -> dict[str, Any]:
    """Fetch menu items from the ordering API.

    The RFC-0002 API contract is `GET /api/menu-items`. The wrapper intentionally
    fails on unavailable or placeholder API responses instead of substituting
    local data.
    """

    config = get_config()
    with build_client(config) as client:
        response = client.get("/api/menu-items", params={"limit": limit, "status": status})
        payload = _decode_json(response)
        _ensure_not_placeholder(payload, "menu API")
        return _normalize_menu_items(payload)


def create_recommendation(
    budget_cents: int,
    person_count: int,
    member_constraints: list[dict[str, Any]],
) -> dict[str, Any]:
    """Create a recommendation through the ordering API.

    The RFC-0002 API contract is `POST /api/recommendations`. The wrapper passes
    the structured request to the API and returns the normalized response shape.
    """

    config = get_config()
    request_payload = {
        "budget_cents": budget_cents,
        "person_count": person_count,
        "member_constraints": member_constraints,
    }
    with build_client(config) as client:
        response = client.post("/api/recommendations", json=request_payload)
        payload = _decode_json(response)
        _ensure_not_placeholder(payload, "recommendation API")
        return _normalize_recommendation(payload)


def get_menu_items_tool(limit: int = 100, status: str = "active") -> dict[str, Any]:
    """NexAU tool wrapper for fetching menu items."""

    return get_menu_items(limit=limit, status=status)


def create_recommendation_tool(
    budget_cents: int,
    person_count: int,
    member_constraints: list[dict[str, Any]],
) -> dict[str, Any]:
    """NexAU tool wrapper for creating a recommendation."""

    return create_recommendation(
        budget_cents=budget_cents,
        person_count=person_count,
        member_constraints=member_constraints,
    )


def _decode_json(response: httpx.Response) -> Any:
    response.raise_for_status()
    return response.json()


def _ensure_not_placeholder(payload: Any, api_name: str) -> None:
    if _is_placeholder(payload):
        raise RuntimeError(f"{api_name} returned a placeholder response; start the real ordering API before using this tool")


def _is_placeholder(payload: Any) -> bool:
    return isinstance(payload, dict) and payload.get("status") == "placeholder"


def _normalize_menu_items(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict) and isinstance(payload.get("items"), list):
        return payload
    if isinstance(payload, list):
        return {"items": payload}
    return {"items": [], "message": "unexpected menu API response", "raw": payload}


def _normalize_recommendation(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    return {"items": [], "reasons": [], "message": "unexpected recommendation API response", "raw": payload}
