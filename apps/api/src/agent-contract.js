// RFC-0002: Structured contract helpers for API-Agent recommendation orchestration.
// The API keeps the final validation and persistence boundary; these helpers make the
// Agent response contract explicit and testable without depending on a live Agent service.

function normalizeAgentRequest(request, menuItems) {
  const items = Array.isArray(menuItems) ? menuItems : [];
  return {
    budget_cents: request.budget_cents,
    person_count: request.person_count,
    member_constraints: Array.isArray(request.member_constraints) ? request.member_constraints : [],
    menu_items: items.map((item) => ({
      id: item.id,
      name: item.name,
      price_cents: item.price_cents,
      category: item.category || null,
      attributes: item.attributes && typeof item.attributes === 'object' ? item.attributes : {},
      ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
    })),
  };
}

function validateAgentRecommendationContract(payload, menuItems, budgetCents) {
  const errors = [];
  const itemsById = new Map();

  if (!Array.isArray(menuItems)) {
    errors.push('menuItems must be an array.');
  } else {
    for (const item of menuItems) {
      if (item && typeof item.id === 'string') itemsById.set(item.id, item);
    }
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      valid: false,
      errors: ['Agent recommendation response must be a JSON object.'],
      normalized: null,
    };
  }

  const total = Number(payload.total_price_cents);
  if (!Number.isInteger(total) || total < 0) {
    errors.push('total_price_cents must be a non-negative integer.');
  } else if (Number.isInteger(budgetCents) && total > budgetCents) {
    errors.push('total_price_cents must not exceed budget_cents.');
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (rawItems.length === 0) {
    errors.push('items must not be empty.');
  }

  const normalizedItems = [];
  for (const [index, item] of rawItems.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`items[${index}] must be an object.`);
      continue;
    }

    const menuItemId = typeof item.menu_item_id === 'string' ? item.menu_item_id : '';
    const quantity = Number(item.quantity);
    const unitPriceCents = Number(item.unit_price_cents);
    const subtotalCents = Number(item.subtotal_cents);

    if (!menuItemId) {
      errors.push(`items[${index}].menu_item_id must be a non-empty string.`);
    } else if (!itemsById.has(menuItemId)) {
      errors.push(`items[${index}].menu_item_id is not present in the active menu.`);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push(`items[${index}].quantity must be a positive integer.`);
    }

    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
      errors.push(`items[${index}].unit_price_cents must be a non-negative integer.`);
    } else {
      const menuItem = itemsById.get(menuItemId);
      if (menuItem && menuItem.price_cents !== unitPriceCents) {
        errors.push(`items[${index}].unit_price_cents does not match the current menu price.`);
      }
    }

    if (!Number.isInteger(subtotalCents) || subtotalCents < 0) {
      errors.push(`items[${index}].subtotal_cents must be a non-negative integer.`);
    } else if (Number.isInteger(quantity) && Number.isInteger(unitPriceCents) && subtotalCents !== quantity * unitPriceCents) {
      errors.push(`items[${index}].subtotal_cents must equal quantity * unit_price_cents.`);
    }

    if (Number.isInteger(total) && Number.isInteger(subtotalCents)) {
      // The API sums persisted recommendation_items later; this keeps Agent totals auditable.
      // No action needed here beyond validating the individual item subtotal.
    }

    normalizedItems.push({
      menu_item_id: menuItemId,
      quantity: Number.isInteger(quantity) ? quantity : 0,
      unit_price_cents: Number.isInteger(unitPriceCents) ? unitPriceCents : 0,
      subtotal_cents: Number.isInteger(subtotalCents) ? subtotalCents : 0,
    });
  }

  if (Number.isInteger(total) && normalizedItems.length > 0) {
    const summedSubtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal_cents, 0);
    if (summedSubtotal !== total) {
      errors.push('total_price_cents must equal the sum of item subtotal_cents.');
    }
  }

  if (payload.reasons !== undefined && !Array.isArray(payload.reasons)) {
    errors.push('reasons must be an array when provided.');
  }
  if (payload.conflicts !== undefined && !Array.isArray(payload.conflicts)) {
    errors.push('conflicts must be an array when provided.');
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? {
      total_price_cents: total,
      items: normalizedItems,
      reasons: Array.isArray(payload.reasons) ? payload.reasons : [],
      conflicts: Array.isArray(payload.conflicts) ? payload.conflicts : [],
    } : null,
  };
}

module.exports = {
  normalizeAgentRequest,
  validateAgentRecommendationContract,
};
