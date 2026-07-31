"""Generate and validate deterministic group-ordering recommendations.

RFC-0001: This module implements the T4/T5 local mock for budget, allergy,
dislike and spicy-tolerance checks before the future NexAU Agent delegates to it.
"""

from __future__ import annotations

from collections import Counter
from itertools import combinations_with_replacement

from agents.ordering_agent.models import (
    MemberConstraint,
    MenuItem,
    RecommendationItem,
    RecommendationPlan,
)

_SPICY_RANK = {
    "none": 0,
    "mild": 1,
    "medium": 2,
    "hot": 3,
    "unknown": 4,
    "unspecified": 4,
}
_MEMBER_SPICY_RANK = {
    "none": 0,
    "mild": 1,
    "medium": 2,
    "hot": 3,
    "unspecified": 4,
}
_TAG_ALIASES = {
    "peanut": "peanut",
    "花生": "peanut",
    "花生酱": "peanut",
    "pork": "pork",
    "猪": "pork",
    "猪肉": "pork",
    "猪蹄": "pork",
    "beef": "beef",
    "牛": "beef",
    "牛肉": "beef",
    "chicken": "chicken",
    "鸡": "chicken",
    "鸡肉": "chicken",
    "fish": "fish",
    "鱼": "fish",
    "egg": "egg",
    "鸡蛋": "egg",
    "vegetarian": "vegetarian",
    "蔬菜": "vegetarian",
    "时蔬": "vegetarian",
}
_TAG_LABELS = {
    "peanut": "花生",
    "pork": "猪肉",
    "beef": "牛肉",
    "chicken": "鸡肉",
    "fish": "鱼",
    "egg": "鸡蛋",
    "vegetarian": "素食",
}


def generate_recommendation(
    menu_items: list[MenuItem],
    members: list[MemberConstraint],
    person_count: int,
    budget: int,
) -> RecommendationPlan:
    """Generate a feasible recommendation plan from structured inputs.

    The mock enumerates small shared-order combinations, rejects hard-constraint
    violations, then chooses the highest-scoring plan under budget. This keeps the
    output reproducible for tests and demo runs.
    """

    if not menu_items:
        return RecommendationPlan(
            items=[],
            total_price=0,
            budget=budget,
            remaining_budget=budget,
            satisfied_constraints=[],
            conflicts_or_unmet=["菜单为空，无法生成点餐方案"],
        )
    if person_count <= 0:
        return RecommendationPlan(
            items=[],
            total_price=0,
            budget=budget,
            remaining_budget=budget,
            satisfied_constraints=[],
            conflicts_or_unmet=["人数必须大于 0"],
        )
    if budget <= 0:
        return RecommendationPlan(
            items=[],
            total_price=0,
            budget=budget,
            remaining_budget=budget,
            satisfied_constraints=[],
            conflicts_or_unmet=["预算必须大于 0"],
        )

    feasible_items = [item for item in menu_items if is_item_safe_for_all(item, members)]
    if not feasible_items:
        return RecommendationPlan(
            items=[],
            total_price=0,
            budget=budget,
            remaining_budget=budget,
            satisfied_constraints=["已根据成员约束过滤菜品"],
            conflicts_or_unmet=["没有同时满足所有成员硬约束的菜品"],
        )

    min_item = min(feasible_items, key=lambda item: item.price)
    if min_item.price * person_count > budget:
        return RecommendationPlan(
            items=[],
            total_price=0,
            budget=budget,
            remaining_budget=budget,
            satisfied_constraints=["已根据成员约束过滤菜品"],
            conflicts_or_unmet=[f"预算不足：最低可选菜品 {min_item.name} 需要 {min_item.price * person_count} 元"],
        )

    best_plan: RecommendationPlan | None = None
    best_score = -1.0
    for quantity in range(person_count, min(person_count + 3, 8) + 1):
        for candidate_names in combinations_with_replacement(feasible_items, quantity):
            counter = Counter(candidate.name for candidate in candidate_names)
            items = [
                RecommendationItem(
                    name=name,
                    quantity=count,
                    price=next(item.price for item in feasible_items if item.name == name),
                    tags=next(item.tags for item in feasible_items if item.name == name),
                    spicy_level=next(item.spicy_level for item in feasible_items if item.name == name),
                )
                for name, count in sorted(counter.items())
            ]
            total_price = sum(item.price * item.quantity for item in items)
            if total_price > budget:
                continue

            plan = RecommendationPlan(
                items=items,
                total_price=total_price,
                budget=budget,
                remaining_budget=budget - total_price,
                satisfied_constraints=build_satisfied_constraints(items, members, budget, total_price, person_count),
                conflicts_or_unmet=[],
                warnings=[],
            )
            score = score_plan(items, members, budget, total_price, person_count)
            if score > best_score:
                best_score = score
                best_plan = plan

    if best_plan is None:
        return RecommendationPlan(
            items=[],
            total_price=0,
            budget=budget,
            remaining_budget=budget,
            satisfied_constraints=["已根据成员约束过滤菜品"],
            conflicts_or_unmet=["预算内无法找到满足所有成员硬约束的组合"],
        )

    if len(best_plan.items) < person_count:
        best_plan.warnings.append("当前方案采用共享菜品，建议根据实际饭量再确认份量")

    return best_plan


def is_item_safe_for_all(item: MenuItem, members: list[MemberConstraint]) -> bool:
    """Return whether one menu item satisfies all hard member constraints."""

    for member in members:
        if violates_member_constraints(item, member):
            return False
    return True


def violates_member_constraints(item: MenuItem, member: MemberConstraint) -> bool:
    """Check allergy, dislike, dietary and spicy hard constraints for one member."""

    if any(allergy in item.tags for allergy in member.allergies):
        return True
    if any(dislike in item.tags for dislike in member.dislikes):
        return True

    if member.spicy_tolerance != "unspecified":
        item_rank = _SPICY_RANK.get(item.spicy_level, 0)
        member_rank = _MEMBER_SPICY_RANK.get(member.spicy_tolerance, 0)
        if item_rank > member_rank:
            return True

    if "vegetarian" in member.dietary_restrictions and any(tag in item.tags for tag in ("pork", "beef", "chicken", "fish", "egg")):
        return True
    if "halal" in member.dietary_restrictions and any(tag in item.tags for tag in ("pork", "fish")):
        return True

    return False


def build_satisfied_constraints(
    items: list[RecommendationItem],
    members: list[MemberConstraint],
    budget: int,
    total_price: int,
    person_count: int,
) -> list[str]:
    """Build human-readable constraint messages for a valid plan."""

    constraints = [f"总价 {total_price} 元未超过预算 {budget} 元"]
    quantity = sum(item.quantity for item in items)
    constraints.append(f"推荐 {quantity} 份主食，覆盖 {person_count} 人共享用餐")

    for member in members:
        if member.spicy_tolerance == "none":
            constraints.append(f"{member.member_id} 不吃辣：未选择中辣/香辣类菜品")
        elif member.spicy_tolerance == "mild":
            constraints.append(f"{member.member_id} 可微辣：未选择超过微辣的菜品")
        for allergy in member.allergies:
            label = _TAG_LABELS.get(allergy, allergy)
            constraints.append(f"{member.member_id} {label}过敏：已避开含 {label} 标签菜品")
        for dislike in member.dislikes:
            label = _TAG_LABELS.get(dislike, dislike)
            constraints.append(f"{member.member_id} 不吃 {label}：已避开相关菜品")
        for restriction in member.dietary_restrictions:
            constraints.append(f"{member.member_id} {restriction}：已按饮食限制过滤")

    return constraints


def score_plan(
    items: list[RecommendationItem],
    members: list[MemberConstraint],
    budget: int,
    total_price: int,
    person_count: int,
) -> float:
    """Score feasible plans for budget use, diversity and soft preferences."""

    diversity = len(items)
    budget_use = total_price / budget if budget else 0
    preference_score = 0.0
    for item in items:
        for member in members:
            for preference in member.preferences:
                if preference in item.name or preference in item.tags:
                    preference_score += 1

    hard_constraint_bonus = 100 if total_price <= budget else -1000
    return hard_constraint_bonus + budget_use * 20 + diversity * 3 + preference_score * 5


def normalize_tag(token: str) -> str | None:
    """Normalize a Chinese or English tag token to an internal tag name."""

    return _TAG_ALIASES.get(token)
