import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRefundWorkflowPlan, isLabelRefundComplete } from './refundWorkflow.ts';

const order = { totalAmount: 30, refundedAmount: 0, fulfillmentStatus: 'packed', shipmentStatus: 'not_shipped', items: [{ productId: 'salt', name: 'Salt', quantity: 3 }] };

test('plans a pre-shipment full cancellation and inventory restoration', () => {
  const plan = buildRefundWorkflowPlan(order, { amount: 30, cancelOrder: true, voidLabel: false, acknowledgeShipped: false, cancelQuantities: { salt: 3 } });
  assert.equal(plan.fullRemainingRefund, true);
  assert.deepEqual(plan.inventoryAdjustments, [{ productId: 'salt', name: 'Salt', quantity: 3 }]);
});

test('allows a partial refund with selected unshipped quantities', () => {
  const plan = buildRefundWorkflowPlan(order, { amount: 10, cancelOrder: false, voidLabel: false, acknowledgeShipped: false, cancelQuantities: { salt: 1 } });
  assert.equal(plan.fullRemainingRefund, false);
  assert.equal(plan.inventoryAdjustments[0].quantity, 1);
});

test('never restores shipped products and requires acknowledgement', () => {
  const shipped = { ...order, fulfillmentStatus: 'shipped', shipmentStatus: 'in_transit' };
  assert.throws(() => buildRefundWorkflowPlan(shipped, { amount: 10, cancelOrder: false, voidLabel: false, acknowledgeShipped: false, cancelQuantities: {} }), /Acknowledge/);
  assert.throws(() => buildRefundWorkflowPlan(shipped, { amount: 10, cancelOrder: false, voidLabel: false, acknowledgeShipped: true, cancelQuantities: { salt: 1 } }), /cannot be canceled/);
});

test('requires a pre-transit label refund for whole-order cancellation', () => {
  const labeled = { ...order, fulfillmentStatus: 'shipped', shipmentStatus: 'pre_transit', shippoTransactionId: 'tx_1' };
  assert.throws(() => buildRefundWorkflowPlan(labeled, { amount: 30, cancelOrder: true, voidLabel: false, acknowledgeShipped: false, cancelQuantities: { salt: 3 } }), /shipping label/);
});

test('requires a pre-transit label refund before any item is restored', () => {
  const labeled = { ...order, fulfillmentStatus: 'shipped', shipmentStatus: 'pre_transit', shippoTransactionId: 'tx_1' };
  assert.throws(() => buildRefundWorkflowPlan(labeled, { amount: 10, cancelOrder: false, voidLabel: false, acknowledgeShipped: false, cancelQuantities: { salt: 1 } }), /restoring canceled items/);
});

test('prevents repeated inventory restoration and over-refunds', () => {
  const partiallyHandled = { ...order, refundedAmount: 10, items: [{ ...order.items[0], cancelledQuantity: 1 }] };
  assert.throws(() => buildRefundWorkflowPlan(partiallyHandled, { amount: 21, cancelOrder: false, voidLabel: false, acknowledgeShipped: false, cancelQuantities: {} }), /between/);
  assert.throws(() => buildRefundWorkflowPlan(partiallyHandled, { amount: 5, cancelOrder: false, voidLabel: false, acknowledgeShipped: false, cancelQuantities: { salt: 3 } }), /between 0 and 2/);
});

test('restores inventory only after Shippo confirms the label refund', () => {
  assert.equal(isLabelRefundComplete('SUCCESS'), true);
  assert.equal(isLabelRefundComplete('PENDING'), false);
  assert.equal(isLabelRefundComplete('QUEUED'), false);
  assert.equal(isLabelRefundComplete('ERROR'), false);
});
