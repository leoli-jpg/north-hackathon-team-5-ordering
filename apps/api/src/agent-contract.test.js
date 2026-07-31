// RFC-0002: API-Agent recommendation contract mock tests.
const assert = require('assert');
const {
  normalizeAgentRequest,
  validateAgentRecommendationContract,
} = require('./agent-contract');

const menuItems = [
  {
    id: 'rice',
    name: '番茄鸡蛋饭',
    price_cents: 2800,
    category: '主食',
    attributes: { spicy_level: 'none' },
    ingredients: ['鸡蛋', '番茄', '米饭'],
  },
  {
    id: 'beef',
    name: '招牌牛肉饭',
    price_cents: 4800,
    category: '主食',
    attributes: { spicy_level: 'medium' },
    ingredients: ['牛肉', '米饭'],
  },
];

const request = normalizeAgentRequest(
  {
    budget_cents: 12000,
    person_count: 3,
    member_constraints: [{ member_id: 'A', allergies: ['peanut'], spicy_tolerance: 'none' }],
  },
  menuItems
);

assert.deepStrictEqual(request, {
  budget_cents: 12000,
  person_count: 3,
  member_constraints: [{ member_id: 'A', allergies: ['peanut'], spicy_tolerance: 'none' }],
  menu_items: [
    {
      id: 'rice',
      name: '番茄鸡蛋饭',
      price_cents: 2800,
      category: '主食',
      attributes: { spicy_level: 'none' },
      ingredients: ['鸡蛋', '番茄', '米饭'],
    },
    {
      id: 'beef',
      name: '招牌牛肉饭',
      price_cents: 4800,
      category: '主食',
      attributes: { spicy_level: 'medium' },
      ingredients: ['牛肉', '米饭'],
    },
  ],
});

const validAgentResponse = validateAgentRecommendationContract(
  {
    total_price_cents: 7600,
    items: [
      { menu_item_id: 'rice', quantity: 1, unit_price_cents: 2800, subtotal_cents: 2800 },
      { menu_item_id: 'beef', quantity: 1, unit_price_cents: 4800, subtotal_cents: 4800 },
    ],
    reasons: ['总价未超过预算'],
    conflicts: [],
  },
  menuItems,
  12000
);

assert.strictEqual(validAgentResponse.valid, true);
assert.deepStrictEqual(validAgentResponse.normalized.total_price_cents, 7600);
assert.strictEqual(validAgentResponse.normalized.items.length, 2);
assert.deepStrictEqual(validAgentResponse.normalized.reasons, ['总价未超过预算']);

const overBudgetResponse = validateAgentRecommendationContract(
  {
    total_price_cents: 15000,
    items: [{ menu_item_id: 'rice', quantity: 1, unit_price_cents: 2800, subtotal_cents: 2800 }],
    reasons: [],
    conflicts: [],
  },
  menuItems,
  12000
);

assert.strictEqual(overBudgetResponse.valid, false);
assert.ok(overBudgetResponse.errors.some((error) => error.includes('budget_cents')));

const unknownItemResponse = validateAgentRecommendationContract(
  {
    total_price_cents: 2800,
    items: [{ menu_item_id: 'unknown', quantity: 1, unit_price_cents: 2800, subtotal_cents: 2800 }],
    reasons: [],
    conflicts: [],
  },
  menuItems,
  12000
);

assert.strictEqual(unknownItemResponse.valid, false);
assert.ok(unknownItemResponse.errors.some((error) => error.includes('active menu')));

const invalidPriceResponse = validateAgentRecommendationContract(
  {
    total_price_cents: 4800,
    items: [{ menu_item_id: 'beef', quantity: 1, unit_price_cents: 5000, subtotal_cents: 5000 }],
    reasons: [],
    conflicts: [],
  },
  menuItems,
  12000
);

assert.strictEqual(invalidPriceResponse.valid, false);
assert.ok(invalidPriceResponse.errors.some((error) => error.includes('current menu price')));

console.log('API-Agent recommendation contract tests passed');
