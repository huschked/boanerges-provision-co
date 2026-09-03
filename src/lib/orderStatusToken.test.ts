import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderStatusToken, verifyOrderStatusToken } from './orderStatusToken.ts';

const SECRET = 'test-secret-with-at-least-thirty-two-characters';
const NOW = Date.parse('2026-09-03T12:00:00Z');

test('accepts a valid signed order-status token', () => {
  const token = createOrderStatusToken('cs_test_order_one', SECRET, NOW, 3600);
  assert.deepEqual(verifyOrderStatusToken(token, SECRET, NOW + 1000), {
    valid: true,
    orderId: 'cs_test_order_one',
    expiresAt: NOW + 3600_000,
  });
});

test('rejects expired and modified order-status tokens', () => {
  const token = createOrderStatusToken('cs_test_order_one', SECRET, NOW, 60);
  assert.deepEqual(verifyOrderStatusToken(token, SECRET, NOW + 60_000), { valid: false, reason: 'expired' });

  const [payload, signature] = token.split('.');
  const otherPayload = Buffer.from(JSON.stringify({ v: 1, orderId: 'cs_test_order_two', iat: NOW / 1000, exp: NOW / 1000 + 3600 })).toString('base64url');
  assert.deepEqual(verifyOrderStatusToken(`${otherPayload}.${signature}`, SECRET, NOW), { valid: false, reason: 'invalid' });
  assert.deepEqual(verifyOrderStatusToken(`${payload}.${signature.slice(0, -1)}x`, SECRET, NOW), { valid: false, reason: 'invalid' });
});

test('requires a strong configured signing secret', () => {
  assert.throws(() => createOrderStatusToken('cs_test_order', 'too-short'), /at least 32/);
  assert.deepEqual(verifyOrderStatusToken('anything', 'too-short', NOW), { valid: false, reason: 'invalid' });
});
