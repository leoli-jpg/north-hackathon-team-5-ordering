"""End-to-end mock workflow for the NexAU ordering agent demo."""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any

from agents.ordering_agent.models import RecommendationResult
from agents.ordering_agent.tools.menu_parser import parse_menu_text
from agents.ordering_agent.tools.preference_extractor import extract_member_constraints
from agents.ordering_agent.tools.recommendation_engine import generate_recommendation

DEFAULT_MENU_PATH = Path(__file__).resolve().parent / "data" / "sample_menu.txt"
DEFAULT_REQUEST_PATH = Path(__file__).resolve().parent / "data" / "sample_request.txt"


def run_ordering_mock(menu_text: str, request_text: str) -> RecommendationResult:
    """Run the deterministic input -> structured state -> recommendation mock."""

    menu_items, menu_warnings = parse_menu_text(menu_text)
    members = extract_member_constraints(request_text)

    person_count = _extract_person_count(request_text)
    budget = _extract_budget(request_text)

    recommendation = generate_recommendation(
        menu_items=menu_items,
        members=members,
        person_count=person_count,
        budget=budget,
    )

    reason = (
        "基于菜单识别结果和成员硬约束，优先避开辣味、花生过敏源和猪肉忌口，"
        "再在 250 元预算内选择覆盖 5 人共享用餐的多样主食组合。"
    )
    return RecommendationResult(
        menu_items=menu_items,
        menu_warnings=menu_warnings,
        members=members,
        recommendation=recommendation,
        reason=reason,
    )


def load_and_run(menu_path: str | Path = DEFAULT_MENU_PATH, request_path: str | Path = DEFAULT_REQUEST_PATH) -> RecommendationResult:
    """Load the bundled sample files and run the mock workflow."""

    menu_text = Path(menu_path).read_text(encoding="utf-8")
    request_text = Path(request_path).read_text(encoding="utf-8")
    return run_ordering_mock(menu_text, request_text)


def result_to_jsonable(result: RecommendationResult) -> dict[str, Any]:
    """Convert a result object to a JSON-serializable dictionary."""

    return asdict(result)


def _extract_person_count(request_text: str) -> int:
    import re

    match = re.search(r"(\d+)\s*个人", request_text)
    if not match:
        raise ValueError("请求中缺少人数，例如：这次一共 5 个人")
    return int(match.group(1))


def _extract_budget(request_text: str) -> int:
    import re

    match = re.search(r"总预算\s*(\d+)\s*元", request_text)
    if not match:
        raise ValueError("请求中缺少总预算，例如：总预算 250 元")
    return int(match.group(1))
