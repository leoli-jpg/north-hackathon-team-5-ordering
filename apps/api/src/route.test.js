// RFC-0002: Route-level smoke tests for T3 API handlers without requiring a live database.
const assert = require('assert');
const { EventEmitter } = require('events');
const { buildRecommendation } = require('./recommendation');

function makeRequest(method, url, body) {
  const emitter = new EventEmitter();
  emitter.method = method;
  emitter.url = url;
  emitter.headers = { 'content-type': 'application/json' };
  emitter.setEncoding = () => {};
  process.nextTick(() => {
    if (body !== undefined) emitter.emit('data', JSON.stringify(body));
    emitter.emit('end');
  });
  return emitter;
}

function makeResponse() {
  const response = new EventEmitter();
  response.statusCode = undefined;
  response.headers = {};
  response.body = '';
  response.writeHead = (statusCode, headers = {}) => {
    response.statusCode = statusCode;
    response.headers = headers;
  };
  response.setHeader = (name, value) => {
    response.headers[name.toLowerCase()] = value;
  };
  response.end = (chunk = '') => {
    response.body += chunk;
    response.emit('finish');
  };
  return response;
}

const { routeRequest } = require('./server');

(async () => {
  const recommendationResponse = makeResponse();
  await routeRequest(
    makeRequest('POST', '/api/recommendations', {
      budget_cents: 12000,
      person_count: 3,
      member_constraints: [{ member_id: 'A', allergies: ['peanut'], spicy_tolerance: 'none' }],
    }),
    recommendationResponse
  );
  assert.ok([400, 500].includes(recommendationResponse.statusCode));
  assert.ok(recommendationResponse.body.includes('DATABASE_URL'));

  const createResponse = makeResponse();
  await routeRequest(
    makeRequest('POST', '/api/menu-items', {
      name: '番茄鸡蛋饭',
      description: '鸡蛋 + 番茄 + 米饭',
      price_cents: 2800,
      category: '主食',
      tags: ['辣度:无'],
      ingredients: ['鸡蛋', '番茄', '米饭'],
      attributes: { spicy_level: 'none' },
    }),
    createResponse
  );
  assert.ok([400, 500].includes(createResponse.statusCode));
  assert.ok(createResponse.body.includes('DATABASE_URL'));

  const imageResponse = makeResponse();
  await routeRequest(
    makeRequest('POST', '/api/menu-images', {
      file_name: 'menu.jpg',
      storage_path: 'local/menu.jpg',
      mime_type: 'image/jpeg',
    }),
    imageResponse
  );
  assert.ok([400, 500].includes(imageResponse.statusCode));
  assert.ok(imageResponse.body.includes('DATABASE_URL'));

  const invalidRecommendation = buildRecommendation(
    {
      budget_cents: 0,
      person_count: 3,
      member_constraints: [{ member_id: 'A', allergies: ['peanut'], spicy_tolerance: 'none' }],
    },
    []
  );
  assert.strictEqual(invalidRecommendation.total_price_cents, 0);
  assert.ok(invalidRecommendation.conflicts.some((conflict) => conflict.includes('预算')));

  console.log('api route smoke tests passed');
})();
