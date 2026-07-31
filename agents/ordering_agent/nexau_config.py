"""NexAU Ordering Agent bootstrap and configuration loader.

RFC-0001: T1 project skeleton. This module exposes the NexAU Agent configuration
entry point and keeps the deterministic mock available for local verification
before LLM-backed ordering tools are implemented in later subtasks.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from nexau import Agent, AgentConfig

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "ordering_agent.yaml"


def load_agent_config(config_path: str | Path = DEFAULT_CONFIG_PATH) -> AgentConfig:
    """Load the NexAU AgentConfig from the T1 YAML configuration."""

    return AgentConfig.from_yaml(Path(config_path))


def create_ordering_agent(config_path: str | Path = DEFAULT_CONFIG_PATH, **kwargs: Any) -> Agent:
    """Create the NexAU Ordering Agent with configured native and local tools."""

    return Agent.from_yaml(Path(config_path), **kwargs)


def create_mock_ordering_agent() -> Agent:
    """Create an Agent backed by the deterministic mock for smoke tests.

    RFC-0001 T1 only wires the skeleton and tool binding contract. The mock keeps
    local runs usable without requiring LLM credentials.
    """

    from nexau import LLMConfig, Tool

    from agents.ordering_agent.tools.mock_ordering import run_ordering_tool

    config = AgentConfig(
        name="ordering-agent-mock",
        description="RFC-0001 deterministic mock Ordering Agent for local smoke tests.",
        system_prompt=(
            "你是 NexAU 多人点餐推荐 Agent 的本地 mock。读取用户请求后，"
            "调用 run_ordering_tool 返回结构化推荐结果；不要编造 LLM 推荐。"
        ),
        llm_config=LLMConfig(
            model=os.getenv("LLM_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini")),
            base_url=os.getenv("LLM_BASE_URL", os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8000")),
            api_key=os.getenv("LLM_API_KEY", os.getenv("OPENAI_API_KEY", "mock-api-key")),
            temperature=0,
        ),
        tools=[
            Tool(
                name="run_ordering_tool",
                description="Run the deterministic ordering-agent mock against menu text and member request text.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "menu_text": {"type": "string", "description": "Text menu content."},
                        "request_text": {"type": "string", "description": "Budget, people count and member constraints."},
                    },
                    "required": ["menu_text", "request_text"],
                },
                implementation=run_ordering_tool,
            )
        ],
    )
    return Agent(config=config)
