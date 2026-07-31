"""Local ordering mock tool bound through the NexAU SDK."""

from __future__ import annotations

from nexau import Tool

from agents.ordering_agent.workflow import run_ordering_mock


def run_ordering_tool(menu_text: str, request_text: str):
    """Run the deterministic ordering-agent mock for NexAU tool calls."""

    return run_ordering_mock(menu_text, request_text)


def build_tool() -> Tool:
    """Build the NexAU Tool object using the official SDK Tool.from_yaml API."""

    return Tool.from_yaml(
        yaml_path="agents/ordering_agent/tools/local/run_ordering_mock.yaml",
        binding=__name__ + ":run_ordering_tool",
    )
