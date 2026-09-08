import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrderReference, isOrderReference, orderReference } from './orderReference.ts';

test('creates an unambiguous Boanerges order reference', () => {
  assert.equal(createOrderReference([0, 1, 2, 3, 4, 5]), 'BP-234567');
  assert.equal(isOrderReference('BP-7K4M2Q'), true);
  assert.equal(isOrderReference('BP-7K4MIQ'), false);
});

test('uses a normalized stored reference on every surface', () => {
  assert.equal(orderReference('cs_test_order', 'bp-7k4m2q'), 'BP-7K4M2Q');
});

test('gives historical orders a stable customer-friendly fallback', () => {
  const first = orderReference('cs_test_legacy_order');
  assert.match(first, /^BP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  assert.equal(orderReference('cs_test_legacy_order'), first);
  assert.notEqual(orderReference('cs_test_other_order'), first);
});
