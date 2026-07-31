"""Configuration helpers for the NexAU ordering-system Agent runtime."""

from __future__ import annotations

import os
from pathlib import Path

from nexau import Agent, AgentConfig

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "agent.yaml"


def _apply_local_defaults() -> None:
    """Apply offline defaults required by NexAU YAML env placeholders."""

    os.environ.setdefault("LLM_MODEL", "openai/gpt-4o-mini")
    os.environ.setdefault("LLM_BASE_URL", "http://127.0.0.1:8000")
    os.environ.setdefault("LLM_API_KEY", "nexau-local-key")
    os.environ.setdefault("SANDBOX_WORK_DIR", ".")


def load_agent_config(config_path: str | Path = DEFAULT_CONFIG_PATH) -> AgentConfig:
    """Load the NexAU AgentConfig from YAML."""

    _apply_local_defaults()
    return AgentConfig.from_yaml(Path(config_path))


def create_agent(config_path: str | Path = DEFAULT_CONFIG_PATH) -> Agent:
    """Create the NexAU Agent from YAML with RFC-0002 API skill tools.

    NexAU YAML declares tool schemas; Python injection keeps the runtime flexible
    when the local API service is unavailable and runtime configuration is supplied explicitly.
    """

    _apply_local_defaults()
    return Agent.from_yaml(Path(config_path))


def ensure_runtime_env() -> None:
    """Validate that required runtime environment variables are present."""

    from nexau import LLMConfig

    try:
        LLMConfig.from_env()
    except Exception as exc:  # pragma: no cover - exact error type depends on NexAU version.
        raise RuntimeError(
            "缺少 NexAU LLM 环境变量：LLM_MODEL、LLM_BASE_URL、LLM_API_KEY。"
            "可复制 services/agent/.env.example 后在本地运行。"
        ) from exc
