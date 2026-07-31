// RFC-0002: Lightweight contract smoke tests for T3 API service exports.
const assert = require('assert');

const serverModule = require('./server');

assert.ok(typeof serverModule.routeRequest === 'function');
assert.strictEqual(typeof serverModule.buildRecommendation, 'function');

console.log('server smoke tests passed');
