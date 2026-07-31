"""Tests for the deterministic ordering-agent mock."""

from __future__ import annotations

import json
import threading
import urllib.request

from agents.ordering_agent.models import RecommendationResult
from agents.ordering_agent.server import create_server
from agents.ordering_agent.tools.menu_parser import infer_menu_tags, parse_menu_text
from agents.ordering_agent.tools.preference_extractor import extract_member_constraints
from agents.ordering_agent.tools.recommendation_engine import generate_recommendation, is_item_safe_for_all
from agents.ordering_agent.workflow import load_and_run, run_ordering_mock

SAMPLE_MENU = """
招牌牛肉饭 48元
宫保鸡丁饭 36元
鱼香肉丝饭 34元
番茄鸡蛋饭 28元
麻婆豆腐饭 32元
酸菜鱼饭 42元
黑椒牛柳饭 46元
照烧鸡腿饭 39元
清炒时蔬饭 26元
花生酱拌面 30元
扬州炒饭 33元
香辣猪蹄饭 45元
"""

SAMPLE_REQUEST = """
这次一共 5 个人，总预算 250 元。

成员 A：我完全不吃辣。
成员 B：我可以吃微辣，但不吃猪肉。
成员 C：我对花生过敏。
"""


def test_parse_sample_menu_extracts_names_prices_and_tags() -> None:
    items, warnings = parse_menu_text(SAMPLE_MENU)

    assert warnings == []
    assert len(items) == 12
    assert items[0].name == "招牌牛肉饭"
    assert items[0].price == 48
    assert "beef" in items[0].tags
    assert "staple" in items[0].tags

    peanut_noodle = next(item for item in items if item.name == "花生酱拌面")
    assert peanut_noodle.price == 30
    assert "peanut" in peanut_noodle.tags

    spicy_pork = next(item for item in items if item.name == "香辣猪蹄饭")
    assert spicy_pork.spicy_level == "medium"
    assert "pork" in spicy_pork.tags


def test_preference_extractor_keeps_each_member_raw_text_and_hard_constraints() -> None:
    members = extract_member_constraints(SAMPLE_REQUEST)

    assert [member.member_id for member in members] == ["A", "B", "C"]
    assert members[0].raw_text == "我完全不吃辣。"
    assert members[0].spicy_tolerance == "none"
    assert members[1].spicy_tolerance == "mild"
    assert members[1].dislikes == ["pork"]
    assert members[2].allergies == ["peanut"]


def test_recommendation_respects_budget_people_and_personal_constraints() -> None:
    items, _ = parse_menu_text(SAMPLE_MENU)
    members = extract_member_constraints(SAMPLE_REQUEST)

    plan = generate_recommendation(items, members, person_count=5, budget=250)

    assert plan.total_price <= 250
    assert plan.remaining_budget >= 0
    assert sum(item.quantity for item in plan.items) >= 5
    assert not any(item.spicy_level in {"medium", "hot"} for item in plan.items)
    assert not any("peanut" in item.tags for item in plan.items)
    assert not any("pork" in item.tags for item in plan.items)
    assert any("预算" in constraint for constraint in plan.satisfied_constraints)
    assert any("花生" in constraint for constraint in plan.satisfied_constraints)
    assert any("猪肉" in constraint for constraint in plan.satisfied_constraints)


def test_item_safety_rejects_spicy_peanut_and_pork_violations() -> None:
    items, _ = parse_menu_text(SAMPLE_MENU)
    members = extract_member_constraints(SAMPLE_REQUEST)

    spicy_item = next(item for item in items if item.name == "麻婆豆腐饭")
    peanut_item = next(item for item in items if item.name == "花生酱拌面")
    pork_item = next(item for item in items if item.name == "香辣猪蹄饭")
    safe_item = next(item for item in items if item.name == "番茄鸡蛋饭")

    assert not is_item_safe_for_all(spicy_item, members)
    assert not is_item_safe_for_all(peanut_item, members)
    assert not is_item_safe_for_all(pork_item, members)
    assert is_item_safe_for_all(safe_item, members)


def test_end_to_end_mock_exposes_menu_correction_warnings_and_rerun_output() -> None:
    corrected_menu = SAMPLE_MENU.strip() + "\n今日例汤 需要人工补充价格\n"
    result = run_ordering_mock(corrected_menu, SAMPLE_REQUEST)

    assert result.menu_warnings == ["第 13 行无法解析价格：今日例汤 需要人工补充价格"]
    assert result.recommendation.total_price <= 250
    assert result.recommendation.conflicts_or_unmet == []

    modified_request = SAMPLE_REQUEST + "\n成员 D：我喜欢吃牛肉。"
    rerun = run_ordering_mock(SAMPLE_MENU, modified_request)
    assert rerun.members[-1].member_id == "D"
    assert rerun.members[-1].preferences == ["beef"]
    assert rerun.recommendation.total_price <= 250


def test_json_output_is_serializable_for_mock_io_contract() -> None:
    result: RecommendationResult = load_and_run()

    payload = json.dumps(result.to_dict(), ensure_ascii=False)
    data = json.loads(payload)

    assert len(data["menu_items"]) == 12
    assert [member["member_id"] for member in data["members"]] == ["A", "B", "C"]
    assert data["recommendation"]["total_price"] <= data["recommendation"]["budget"]


def test_http_mock_service_starts_and_recommends() -> None:
    server = create_server(port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"
        with urllib.request.urlopen(base_url + "/health", timeout=5) as response:
            assert response.status == 200
            assert json.loads(response.read().decode("utf-8"))["service"] == "ordering-mock"

        payload = json.dumps(
            {
                "menu_text": "招牌牛肉饭 48元\n番茄鸡蛋饭 28元",
                "request_text": "这次一共 2 个人，总预算 100 元。\n成员 A：我完全不吃辣。",
            },
            ensure_ascii=False,
        ).encode("utf-8")
        request = urllib.request.Request(
            base_url + "/recommend",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            assert response.status == 200
            assert data["recommendation"]["total_price"] <= 100
            assert data["recommendation"]["conflicts_or_unmet"] == []
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_tag_inference_maps_common_chinese_keywords() -> None:
    assert infer_menu_tags("宫保鸡丁饭") == (["spicy", "chicken", "staple"], "medium")
    assert infer_menu_tags("清炒时蔬饭") == (["vegetarian", "staple"], "none")
    assert infer_menu_tags("未知甜品") == (["unknown"], "none")
