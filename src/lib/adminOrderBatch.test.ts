import assert from 'node:assert/strict';
import test from 'node:test';
import { canBatchPack, summarizeOrderBatch } from './adminOrderBatch.js';

test('batch packing eligibility excludes unpaid and already processed orders', () => {
  assert.equal(canBatchPack({ id: 'one', paymentStatus: 'paid', fulfillmentStatus: 'pending' }), true);
  assert.equal(canBatchPack({ id: 'two', paymentStatus: 'partially_refunded', fulfillmentStatus: 'requires_attention' }), true);
  assert.equal(canBatchPack({ id: 'three', paymentStatus: 'failed', fulfillmentStatus: 'pending' }), false);
  assert.equal(canBatchPack({ id: 'four', paymentStatus: 'paid', fulfillmentStatus: 'shipped' }), false);
});

test('partial batch failures preserve successes and never include untouched orders', () => {
  const attempted = [{ id: 'success' }, { id: 'failure' }];
  const summary = summarizeOrderBatch(attempted, [
    { status: 'fulfilled', value: {} },
    { status: 'rejected', reason: new Error('invalid transition') },
  ], error => error instanceof Error ? error.message : 'failed');

  assert.deepEqual(summary, {
    succeeded: ['success'],
    failed: [{ id: 'failure', message: 'invalid transition' }],
  });
  assert.equal(summary.succeeded.includes('untouched'), false);
  assert.equal(summary.failed.some(item => item.id === 'untouched'), false);
});

