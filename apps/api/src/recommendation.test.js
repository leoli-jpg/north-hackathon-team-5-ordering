// RFC-0002: Unit tests for the recommendation engine used by T3 API endpoints.
const assert = require('assert');
const { buildRecommendation } = require('./recommendation');

const items = [
  {
    id: 'rice',
    name: '番茄鸡蛋饭',
    price_cents: 2800,
    ingredients: ['鸡蛋', '番茄'],
    tags: [],
    attributes: { spicy_level: 'none' },
  },
  {
    id: 'beef',
    name: '招牌牛肉饭',
    price_cents: 4800,
    ingredients: ['牛肉', '米饭'],
    tags: ['辣度:中'],
    attributes: { spicy_level: 'medium' },
  },
  {
    id: 'peanut',
    name: '花生拌面',
    price_cents: 3000,
    ingredients: ['花生', '面条'],
    tags: [],
    attributes: { spicy_level: 'none' },
  },
];

const recommendation = buildRecommendation(
  {
    budget_cents: 12000,
    person_count: 3,
    member_constraints: [
      { member_id: 'A', allergies: ['peanut'], spicy_tolerance: 'none' },
    ],
  },
  items
);

assert.strictEqual(recommendation.total_price_cents, 8400);
assert.deepStrictEqual(
  recommendation.items.map((item) => item.menu_item_id),
  ['rice']
);
assert.strictEqual(recommendation.items[0].quantity, 3);
assert.ok(recommendation.conflicts.some((conflict) => conflict.includes('peanut')));
assert.ok(recommendation.reasons.some((reason) => reason.includes('过敏')));

const aliasRecommendation = buildRecommendation(
  {
    budget_cents: 12000,
    people: 3,
    allergies: ['peanut'],
    spicyTolerance: 'none',
  },
  items
);

assert.strictEqual(aliasRecommendation.total_price_cents, 8400);
assert.deepStrictEqual(
  aliasRecommendation.items.map((item) => item.menu_item_id),
  ['rice']
);
assert.ok(aliasRecommendation.conflicts.some((conflict) => conflict.includes('peanut') || conflict.includes('花生')));
assert.ok(aliasRecommendation.reasons.some((reason) => reason.includes('辣度')));

console.log('recommendation unit tests passed');
