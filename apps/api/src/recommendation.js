// RFC-0002: Recommendation engine used by the ordering API service.

const SPICY_LEVELS = {
  none: 0,
  mild: 1,
  medium: 2,
  hot: 3,
};

const INGREDIENT_ALIASES = {
  peanut: ['花生'],
  pork: ['猪肉', '肉'],
  beef: ['牛肉'],
  egg: ['鸡蛋'],
  tomato: ['番茄'],
  rice: ['米饭'],
  noodles: ['面条', '面'],
};

function normalizeSpicyLevel(level) {
  const value = String(level || 'none').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(SPICY_LEVELS, value)) {
    return value;
  }
  if (value === '低' || value === '微辣') return 'mild';
  if (value === '中' || value === '中辣') return 'medium';
  if (value === '高' || value === '重辣') return 'hot';
  if (value === '不辣' || value === '无') return 'none';
  return 'none';
}

function getTagValue(attributes, key) {
  if (!attributes || typeof attributes !== 'object') return undefined;
  return attributes[key];
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function expandAlias(value) {
  const normalized = normalizeText(value);
  const aliases = INGREDIENT_ALIASES[normalized] || [];
  return [normalized, ...aliases].map((item) => normalizeText(item));
}

function getSpicyLevelFromItem(item) {
  const attributes = item.attributes || {};
  const spicyFromAttributes = getTagValue(attributes, 'spicy_level') || getTagValue(attributes, 'spicyLevel');
  if (spicyFromAttributes) return normalizeSpicyLevel(spicyFromAttributes);

  const tags = Array.isArray(item.tags) ? item.tags : [];
  for (const tag of tags) {
    const tagText = normalizeText(tag);
    if (tagText.includes('不辣') || tagText.includes('无辣') || tagText === 'none') return 'none';
    if (tagText.includes('微辣') || tagText.includes('低')) return 'mild';
    if (tagText.includes('中辣') || tagText.includes('中')) return 'medium';
    if (tagText.includes('重辣') || tagText.includes('高') || tagText.includes('hot')) return 'hot';
  }

  return 'none';
}

function itemMatchesConstraints(item, memberConstraints) {
  const conflicts = [];
  const constraints = Array.isArray(memberConstraints) ? memberConstraints : [];

  for (const constraint of constraints) {
    if (!constraint || typeof constraint !== 'object') continue;

    const allergies = Array.isArray(constraint.allergies) ? constraint.allergies : [];
    const dislikes = Array.isArray(constraint.dislikes) ? constraint.dislikes : [];
    const spicyTolerance = normalizeSpicyLevel(constraint.spicy_tolerance || constraint.spicyTolerance);
    const hasSpicyTolerance = Object.prototype.hasOwnProperty.call(constraint, 'spicy_tolerance') || Object.prototype.hasOwnProperty.call(constraint, 'spicyTolerance');

    const ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const spicyLevel = getSpicyLevelFromItem(item);
    const spicyToleranceValue = SPICY_LEVELS[spicyTolerance] ?? 0;
    const itemSpicyValue = SPICY_LEVELS[spicyLevel] ?? 0;

    for (const allergy of allergies) {
      const allergyTokens = expandAlias(allergy);
      if (ingredients.some((ingredient) => allergyTokens.includes(normalizeText(ingredient))) || tags.some((tag) => allergyTokens.includes(normalizeText(tag)))) {
        conflicts.push(`成员 ${constraint.member_id || 'unknown'} 对 ${allergy} 过敏，菜品包含相关食材或标签。`);
      }
    }

    for (const dislike of dislikes) {
      const dislikeTokens = expandAlias(dislike);
      if (ingredients.some((ingredient) => dislikeTokens.includes(normalizeText(ingredient))) || tags.some((tag) => dislikeTokens.includes(normalizeText(tag)))) {
        conflicts.push(`成员 ${constraint.member_id || 'unknown'} 忌口 ${dislike}，菜品包含相关食材或标签。`);
      }
    }

    if (hasSpicyTolerance && itemSpicyValue > spicyToleranceValue) {
      conflicts.push(`成员 ${constraint.member_id || 'unknown'} 辣度容忍度为 ${spicyTolerance}，菜品辣度为 ${spicyLevel}。`);
    }
  }

  return {
    compatible: conflicts.length === 0,
    conflicts,
  };
}

function buildRecommendation(request, items) {
  const budgetCents = Number(request.budget_cents !== undefined ? request.budget_cents : request.budget);
  const personCount = Number(request.person_count !== undefined ? request.person_count : request.people);
  const memberConstraints = Array.isArray(request.member_constraints) ? request.member_constraints : [];
  const hasTopLevelConstraints = Object.prototype.hasOwnProperty.call(request, 'allergies')
    || Object.prototype.hasOwnProperty.call(request, 'dislikes')
    || Object.prototype.hasOwnProperty.call(request, 'spicy_tolerance')
    || Object.prototype.hasOwnProperty.call(request, 'spicyTolerance');

  if (hasTopLevelConstraints) {
    memberConstraints.push({
      member_id: 'request',
      allergies: Array.isArray(request.allergies) ? request.allergies.map(String) : [],
      dislikes: Array.isArray(request.dislikes) ? request.dislikes.map(String) : [],
      spicy_tolerance: Object.prototype.hasOwnProperty.call(request, 'spicy_tolerance') ? request.spicy_tolerance : request.spicyTolerance,
    });
  }

  const reasons = [];

  if (!Number.isFinite(budgetCents) || budgetCents <= 0) {
    return {
      total_price_cents: 0,
      items: [],
      reasons: ['预算必须大于 0。'],
      conflicts: ['预算无效。'],
    };
  }

  if (!Number.isInteger(personCount) || personCount <= 0) {
    return {
      total_price_cents: 0,
      items: [],
      reasons: ['人数必须为正整数。'],
      conflicts: ['人数无效。'],
    };
  }

  const compatibleItems = [];
  const rejectedItems = [];

  for (const item of items) {
    const assessment = itemMatchesConstraints(item, memberConstraints);
    if (assessment.compatible) {
      compatibleItems.push(item);
    } else {
      rejectedItems.push({
        menu_item_id: item.id,
        name: item.name,
        reasons: assessment.conflicts,
      });
    }
  }

  compatibleItems.sort((a, b) => a.price_cents - b.price_cents);

  let totalPriceCents = 0;
  const selectedItems = [];
  const selectedCounts = {};

  for (let index = 0; index < personCount; index += 1) {
    const affordableItems = compatibleItems.filter((item) => totalPriceCents + item.price_cents <= budgetCents);
    if (affordableItems.length === 0) break;

    affordableItems.sort((a, b) => {
      const aCount = selectedCounts[a.id] || 0;
      const bCount = selectedCounts[b.id] || 0;
      if (aCount !== bCount) return aCount - bCount;
      return b.price_cents - a.price_cents;
    });

    const selected = affordableItems[0];
    selectedCounts[selected.id] = (selectedCounts[selected.id] || 0) + 1;

    const existing = selectedItems.find((entry) => entry.menu_item_id === selected.id);
    if (existing) {
      existing.quantity += 1;
      existing.subtotal_cents += selected.price_cents;
    } else {
      selectedItems.push({
        menu_item_id: selected.id,
        name: selected.name,
        quantity: 1,
        unit_price_cents: selected.price_cents,
        subtotal_cents: selected.price_cents,
      });
    }

    totalPriceCents += selected.price_cents;
  }

  reasons.push(`总价 ${totalPriceCents} 分未超过预算 ${budgetCents} 分。`);
  reasons.push(`已为 ${personCount} 人选择 ${selectedItems.length} 个菜品。`);

  const allergyMentioned = memberConstraints.some((constraint) => Array.isArray(constraint.allergies) && constraint.allergies.length > 0);
  const dislikeMentioned = memberConstraints.some((constraint) => Array.isArray(constraint.dislikes) && constraint.dislikes.length > 0);
  const spicyMentioned = memberConstraints.some((constraint) => constraint.spicy_tolerance || constraint.spicyTolerance);

  if (allergyMentioned) reasons.push('已避开成员声明的过敏食材或标签。');
  if (dislikeMentioned) reasons.push('已避开成员声明的忌口食材或标签。');
  if (spicyMentioned) reasons.push('已根据成员辣度容忍度过滤菜品。');
  if (rejectedItems.length > 0) reasons.push(`${rejectedItems.length} 个菜品因约束冲突被排除。`);
  if (totalPriceCents === 0) reasons.push('预算不足以选择任何符合约束的菜品。');

  return {
    total_price_cents: totalPriceCents,
    items: selectedItems,
    reasons,
    conflicts: rejectedItems.flatMap((item) => item.reasons),
  };
}

module.exports = {
  buildRecommendation,
  normalizeSpicyLevel,
};
