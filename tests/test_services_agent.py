"""Tests for the RFC-0002 services/agent NexAU skill boundary."""

from __future__ import annotations

import httpx

import pytest

from services.agent.config import create_agent, load_agent_config
from services.agent.skills import api_client


class FakeResponse:
    def __init__(self, payload: object, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        request = httpx.Request("GET", "http://localhost")
        response = httpx.Response(self.status_code, request=request, json=self._payload)
        response.raise_for_status()

    def json(self) -> object:
        return self._payload


class FakeClient:
    def __init__(self, menu_payload: object, recommendation_payload: object) -> None:
        self.menu_payload = menu_payload
        self.recommendation_payload = recommendation_payload
        self.requests: list[tuple[str, dict[str, object]]] = []

    def __enter__(self) -> "FakeClient":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def get(self, path: str, **kwargs: object) -> FakeResponse:
        self.requests.append(("get", {"path": path, **kwargs}))
        return FakeResponse(self.menu_payload)

    def post(self, path: str, **kwargs: object) -> FakeResponse:
        self.requests.append(("post", {"path": path, **kwargs}))
        return FakeResponse(self.recommendation_payload)


def test_agent_config_loads_native_and_ordering_skill_tools() -> None:
    config = load_agent_config()

    assert config.name == "ordering-system-agent"
    assert [tool.name for tool in config.tools] == [
        "read_file",
        "read_many_files",
        "list_directory",
        "glob",
        "read_visual_file",
        "get_menu_items",
        "create_recommendation",
    ]
    assert config.system_prompt.endswith("services/agent/systemprompt.md")


def test_create_agent_loads_rfc0002_agent_yaml() -> None:
    agent = create_agent()

    assert agent.config.name == "ordering-system-agent"
    assert [tool.name for tool in agent.config.tools][-2:] == ["get_menu_items", "create_recommendation"]


def test_get_menu_items_tool_calls_api_without_local_fallback(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    client = FakeClient({"items": [{"id": "rice", "name": "牛肉饭", "price_cents": 4800}]}, {})
    monkeypatch.setattr(api_client, "build_client", lambda *_args, **_kwargs: client)

    payload = api_client.get_menu_items_tool(limit=3, status="active")

    assert payload["items"][0]["price_cents"] == 4800
    assert client.requests == [
        ("get", {"path": "/api/menu-items", "params": {"limit": 3, "status": "active"}})
    ]


def test_create_recommendation_tool_posts_structured_request(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    recommendation = {
        "items": [{"name": "番茄鸡蛋饭", "quantity": 5}],
        "total_price_cents": 14000,
        "remaining_budget_cents": 11000,
    }
    client = FakeClient({}, recommendation)
    monkeypatch.setattr(api_client, "build_client", lambda *_args, **_kwargs: client)
    constraints = [
        {"member_id": "A", "spicy_tolerance": "none"},
        {"member_id": "B", "dislikes": ["pork"], "spicy_tolerance": "mild"},
        {"member_id": "C", "allergies": ["peanut"]},
    ]

    payload = api_client.create_recommendation_tool(
        budget_cents=25000,
        person_count=5,
        member_constraints=constraints,
    )

    assert payload["items"] == recommendation["items"]
    assert client.requests == [
        (
            "post",
            {
                "path": "/api/recommendations",
                "json": {
                    "budget_cents": 25000,
                    "person_count": 5,
                    "member_constraints": constraints,
                },
            },
        )
    ]


def test_placeholder_api_response_is_not_silently_replaced(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    client = FakeClient({"status": "placeholder", "message": "placeholder"}, {})
    monkeypatch.setattr(api_client, "build_client", lambda *_args, **_kwargs: client)

    with pytest.raises(RuntimeError, match="menu API returned a placeholder"):
        api_client.get_menu_items_tool(limit=2)
