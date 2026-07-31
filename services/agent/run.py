"""NexAU runtime entrypoint for the ordering-system Agent.

RFC-0002: T5 Agent skill 包装层。该模块启动 NexAU Agent，并通过
services.agent.skills 暴露结构化 API 工具，而不是让 Agent 直连数据库。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from nexau import Agent

from services.agent.config import create_agent


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "agent.yaml"


def create_agent(config_path: str | Path = DEFAULT_CONFIG_PATH) -> Agent:
    """Create the NexAU Ordering System Agent from YAML."""

    return Agent.from_yaml(Path(config_path))


def main() -> None:
    """Run a one-shot chat request against the NexAU Agent."""

    parser = argparse.ArgumentParser(description="Run the RFC-0002 NexAU ordering Agent")
    parser.add_argument("message", nargs="*", help="Natural-language request to send to the Agent")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to NexAU agent YAML")
    parser.add_argument("--json", action="store_true", help="Print a structured JSON result")
    parser.add_argument("--history", help="Optional conversation history JSON file")
    parser.add_argument("--session-id", help="Optional stable session id copied from NAC-style chat flows")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    args = parser.parse_args()

    message = " ".join(args.message).strip()
    if not message:
        message = "请用当前菜单和默认预算为 5 个人生成一份点餐推荐。"

    history: list[dict[str, object]] | None = None
    if args.history:
        history = json.loads(Path(args.history).read_text(encoding="utf-8"))

    agent = create_agent(args.config)
    result = agent.run(
        message=message,
        history=history,
        context={"session_id": args.session_id} if args.session_id else None,
    )

    if args.json:
        payload: dict[str, object]
        if isinstance(result, tuple):
            payload = {"content": result[0], "state": result[1]}
        else:
            payload = {"content": result}
        print(json.dumps(payload, ensure_ascii=False, indent=2 if args.pretty else None))
    else:
        print(result if isinstance(result, str) else result[0])


if __name__ == "__main__":
    main()
