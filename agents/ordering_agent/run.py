"""CLI entry point for the local ordering mock."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from agents.ordering_agent.workflow import load_and_run, result_to_jsonable


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the deterministic ordering-agent mock.")
    parser.add_argument("--menu", default="agents/ordering_agent/data/sample_menu.txt", help="Path to text menu file.")
    parser.add_argument("--request", default="agents/ordering_agent/data/sample_request.txt", help="Path to request text file.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    args = parser.parse_args()

    result = load_and_run(Path(args.menu), Path(args.request))
    print(json.dumps(result_to_jsonable(result), ensure_ascii=False, indent=2 if args.pretty else None))


if __name__ == "__main__":
    main()
