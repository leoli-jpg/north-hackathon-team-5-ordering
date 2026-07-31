"""Structured data models used by the ordering agent mock.

The models mirror RFC-0001 so the deterministic mock can be swapped behind the
future NexAU Agent tools without changing the integration contract.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class MenuItem:
    """One dish parsed from a text menu or visual-menu transcription.

    RFC-0001 line: MenuItem. Tags are intentionally conservative and derived from
    menu names in this MVP mock; human correction can update these fields later.
    """

    name: str
    price: int
    tags: list[str] = field(default_factory=list)
    spicy_level: str = "none"
    source_line: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        return {
            "name": self.name,
            "price": self.price,
            "tags": list(self.tags),
            "spicy_level": self.spicy_level,
            "source_line": self.source_line,
        }


@dataclass(frozen=True)
class MenuCorrection:
    """Human correction for a parsed or visually recognized menu item.

    The correction is keyed by menu item name. It intentionally does not include
    persistence semantics; callers can pass it through CLI/HTTP/mock inputs and
    re-run the deterministic workflow.
    """

    name: str
    price: int | None = None
    tags: list[str] | None = None
    spicy_level: str | None = None
    source_line: str | None = None

    def apply(self, item: MenuItem) -> MenuItem:
        """Return a new MenuItem with corrected fields applied."""

        return MenuItem(
            name=self.name,
            price=item.price if self.price is None else self.price,
            tags=item.tags if self.tags is None else list(self.tags),
            spicy_level=item.spicy_level if self.spicy_level is None else self.spicy_level,
            source_line=item.source_line if self.source_line is None else self.source_line,
        )


@dataclass(frozen=True)
class MemberConstraint:
    """Structured constraints extracted from one member's natural language text.

    RFC-0001 line: MemberConstraint. Hard constraints are allergies, dislikes and
    spicy tolerance; preferences remain soft signals for scoring.
    """

    member_id: str
    raw_text: str
    preferences: list[str] = field(default_factory=list)
    dislikes: list[str] = field(default_factory=list)
    allergies: list[str] = field(default_factory=list)
    spicy_tolerance: str = "unspecified"
    sweet_tolerance: str = "unspecified"
    dietary_restrictions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        return {
            "member_id": self.member_id,
            "raw_text": self.raw_text,
            "preferences": list(self.preferences),
            "dislikes": list(self.dislikes),
            "allergies": list(self.allergies),
            "spicy_tolerance": self.spicy_tolerance,
            "sweet_tolerance": self.sweet_tolerance,
            "dietary_restrictions": list(self.dietary_restrictions),
        }


@dataclass(frozen=True)
class RecommendationItem:
    """One recommended menu item with quantity."""

    name: str
    quantity: int
    price: int
    tags: list[str] = field(default_factory=list)
    spicy_level: str = "none"

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        return {
            "name": self.name,
            "quantity": self.quantity,
            "price": self.price,
            "tags": list(self.tags),
            "spicy_level": self.spicy_level,
        }


@dataclass(frozen=True)
class RecommendationPlan:
    """Recommended order plan and its constraint status."""

    items: list[RecommendationItem]
    total_price: int
    budget: int
    remaining_budget: int
    satisfied_constraints: list[str] = field(default_factory=list)
    conflicts_or_unmet: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        return {
            "items": [item.to_dict() for item in self.items],
            "total_price": self.total_price,
            "budget": self.budget,
            "remaining_budget": self.remaining_budget,
            "satisfied_constraints": list(self.satisfied_constraints),
            "conflicts_or_unmet": list(self.conflicts_or_unmet),
            "warnings": list(self.warnings),
        }


@dataclass(frozen=True)
class RecommendationResult:
    """Full output of the mock ordering workflow."""

    menu_items: list[MenuItem]
    menu_warnings: list[str]
    members: list[MemberConstraint]
    recommendation: RecommendationPlan
    reason: str

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        return {
            "menu_items": [item.to_dict() for item in self.menu_items],
            "menu_warnings": list(self.menu_warnings),
            "members": [member.to_dict() for member in self.members],
            "recommendation": self.recommendation.to_dict(),
            "reason": self.reason,
        }
