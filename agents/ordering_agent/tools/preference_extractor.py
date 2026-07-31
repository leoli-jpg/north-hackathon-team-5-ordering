"""Extract structured member constraints from natural language requests."""

from __future__ import annotations

import re

from agents.ordering_agent.models import MemberConstraint

_SPICY_NONE_PATTERNS = (
    r"不吃辣",
    r"完全不吃辣",
    r"一点辣.*不",
    r"不能.*辣",
)
_SPICY_MILD_PATTERNS = (r"微辣", r"一点点辣", r"少辣")
_SPICY_MEDIUM_PATTERNS = (r"中辣", r"正常辣")
_SPICY_HOT_PATTERNS = (r"特辣", r"很辣", r"重辣")
_PEANUT_PATTERNS = (r"花生", r"花生酱")
_PORK_PATTERNS = (r"猪肉", r"猪", r"猪蹄")
_SWEET_NONE_PATTERNS = (r"不吃甜", r"不要甜", r"不甜")
_SWEET_MILD_PATTERNS = (r"少甜", r"微甜", r"不太甜")
_PREFERENCE_KEYWORDS = ("喜欢", "爱吃", "想吃", "偏好")
_PREFERENCE_FOOD_PATTERNS = (
    ("牛肉", "beef"),
    ("牛柳", "beef"),
    ("鸡肉", "chicken"),
    ("鸡腿", "chicken"),
    ("鱼", "fish"),
    ("酸菜鱼", "fish"),
    ("鸡蛋", "egg"),
    ("蔬菜", "vegetarian"),
    ("时蔬", "vegetarian"),
)


def extract_member_constraints(request_text: str) -> list[MemberConstraint]:
    """Parse member requests such as ``成员 A：我完全不吃辣。``.

    The parser handles the RFC-0001 sample scenario and common variants. It keeps
    raw text so the Agent can display the original natural-language demand for
    each member.
    """

    members: list[MemberConstraint] = []
    for member_id, raw_text in _split_member_requests(request_text):
        text = raw_text.strip()
        lowered = text.lower()

        spicy_tolerance = "unspecified"
        if any(re.search(pattern, lowered) for pattern in _SPICY_NONE_PATTERNS):
            spicy_tolerance = "none"
        elif any(re.search(pattern, lowered) for pattern in _SPICY_MILD_PATTERNS):
            spicy_tolerance = "mild"
        elif any(re.search(pattern, lowered) for pattern in _SPICY_MEDIUM_PATTERNS):
            spicy_tolerance = "medium"
        elif any(re.search(pattern, lowered) for pattern in _SPICY_HOT_PATTERNS):
            spicy_tolerance = "hot"

        sweet_tolerance = "unspecified"
        if any(re.search(pattern, lowered) for pattern in _SWEET_NONE_PATTERNS):
            sweet_tolerance = "none"
        elif any(re.search(pattern, lowered) for pattern in _SWEET_MILD_PATTERNS):
            sweet_tolerance = "mild"

        allergies: list[str] = []
        dislikes: list[str] = []
        preferences: list[str] = []
        dietary_restrictions: list[str] = []

        if any(re.search(pattern, lowered) for pattern in _PEANUT_PATTERNS):
            if "过敏" in lowered or "过敏原" in lowered:
                allergies.append("peanut")
            elif any(negation in lowered for negation in ("不吃", "不要", "不碰")):
                dislikes.append("peanut")
            else:
                preferences.append("peanut")

        if any(re.search(pattern, lowered) for pattern in _PORK_PATTERNS):
            if any(negation in lowered for negation in ("不吃", "不要", "不碰", "忌")):
                dislikes.append("pork")
            else:
                preferences.append("pork")

        if any(keyword in lowered for keyword in _PREFERENCE_KEYWORDS):
            for keyword, tag in _PREFERENCE_FOOD_PATTERNS:
                if keyword in lowered and tag not in preferences:
                    preferences.append(tag)

        if "素食" in lowered or "不吃肉" in lowered:
            dietary_restrictions.append("vegetarian")
        if "清真" in lowered:
            dietary_restrictions.append("halal")
        if "海鲜" in lowered and any(negation in lowered for negation in ("不吃", "不要", "过敏")):
            dislikes.append("seafood")

        members.append(
            MemberConstraint(
                member_id=member_id,
                raw_text=text,
                preferences=preferences,
                dislikes=dislikes,
                allergies=allergies,
                spicy_tolerance=spicy_tolerance,
                sweet_tolerance=sweet_tolerance,
                dietary_restrictions=dietary_restrictions,
            )
        )

    return members


def _split_member_requests(request_text: str) -> list[tuple[str, str]]:
    """Split request text into member sections."""

    pattern = re.compile(r"(?:^|\n)\s*成员\s*(?P<id>[A-Za-z0-9_-]+)\s*[:：]\s*(?P<text>[^\n]*)")
    matches = list(pattern.finditer(request_text))
    if not matches:
        return []

    sections: list[tuple[str, str]] = []
    for match in matches:
        sections.append((match.group("id"), match.group("text").strip()))
    return sections
