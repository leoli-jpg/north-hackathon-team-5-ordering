"""Parse text menus into structured menu items for the ordering mock."""

from __future__ import annotations

import re

from agents.ordering_agent.models import MenuItem

_PRICE_RE = re.compile(r"(?P<price>\d+(?:\.\d+)?)\s*(?:元|￥|¥|RMB|rmb)?")
_SPICY_KEYWORDS = ("辣", "香辣", "麻辣", "宫保", "麻婆", "酸菜鱼")
_PEANUT_KEYWORDS = ("花生", "花生酱")
_PORK_KEYWORDS = ("猪", "猪蹄", "肉丝", "鱼香")
_BEEF_KEYWORDS = ("牛", "牛肉")
_CHICKEN_KEYWORDS = ("鸡肉", "鸡腿", "鸡丁", "宫保鸡丁", "照烧鸡腿")
_FISH_KEYWORDS = ("酸菜鱼", "鱼饭", "鱼排", "烤鱼", "水煮鱼")
_EGG_KEYWORDS = ("蛋", "鸡蛋")
_VEGETABLE_KEYWORDS = ("蔬菜", "时蔬", "番茄", "豆腐")


def parse_menu_text(menu_text: str) -> tuple[list[MenuItem], list[str]]:
    """Parse a multiline text menu into menu items.

    Supported lines look like ``招牌牛肉饭 48元``. Unparseable non-empty lines are
    returned as warnings so callers can expose them for human correction.
    """

    items: list[MenuItem] = []
    warnings: list[str] = []

    for line_number, raw_line in enumerate(menu_text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        match = _PRICE_RE.search(line)
        if not match:
            warnings.append(f"第 {line_number} 行无法解析价格：{line}")
            continue

        price_text = match.group("price")
        try:
            price = int(float(price_text))
        except ValueError:
            warnings.append(f"第 {line_number} 行价格非法：{line}")
            continue

        name = line[: match.start()].strip() or line[match.end() :].strip()
        name = name.replace("￥", "").replace("¥", "").replace("RMB", "").replace("rmb", "").strip()
        if not name:
            warnings.append(f"第 {line_number} 行缺少菜名：{line}")
            continue

        tags, spicy_level = infer_menu_tags(name)
        items.append(
            MenuItem(
                name=name,
                price=price,
                tags=tags,
                spicy_level=spicy_level,
                source_line=line,
            )
        )

    return items, warnings


def infer_menu_tags(name: str) -> tuple[list[str], str]:
    """Infer coarse tags from a dish name.

    This is a deterministic placeholder for the future visual/LLM correction
    layer. It is intentionally conservative: unknown dishes stay ``none`` spicy
    and receive no protein/allergy tags unless keywords are obvious.
    """

    tags: list[str] = []
    spicy_level = "none"

    lowered = name.lower()
    if any(keyword in lowered for keyword in _SPICY_KEYWORDS):
        tags.append("spicy")
        spicy_level = "mild"
        if any(keyword in lowered for keyword in ("麻辣", "香辣", "宫保", "麻婆")):
            spicy_level = "medium"

    if any(keyword in lowered for keyword in _PEANUT_KEYWORDS):
        tags.append("peanut")
    if any(keyword in lowered for keyword in _PORK_KEYWORDS):
        tags.append("pork")
    if any(keyword in lowered for keyword in _BEEF_KEYWORDS):
        tags.append("beef")
    if any(keyword in lowered for keyword in _CHICKEN_KEYWORDS):
        tags.append("chicken")
    if any(keyword in lowered for keyword in _FISH_KEYWORDS):
        tags.append("fish")
    if any(keyword in lowered for keyword in _EGG_KEYWORDS):
        tags.append("egg")
    if any(keyword in lowered for keyword in _VEGETABLE_KEYWORDS):
        tags.append("vegetarian")
    if "饭" in lowered or "面" in lowered or "炒饭" in lowered:
        tags.append("staple")
    if not tags:
        tags.append("unknown")

    return tags, spicy_level
