import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrderExceptions } from './orderExceptions.ts';

const NOW = Date.parse('2026-09-03T18:00:00Z');
const hoursAgo = (hours: number) => NOW - hours * 60 * 60 * 1000;

test('does not flag a normal paid order before its handling deadline', () => {
  assert.deepEqual(getOrderExceptions({ paymentStatus: 'paid', fulfillmentStatus: 'pending', paidAt: hoursAgo(12) }, NOW), []);
});

test('identifies every WEB-013 exception category and orders by severity then age', () => {
  const exceptions = getOrderExceptions({
    paymentStatus: 'paid', fulfillmentStatus: 'pending', paidAt: hoursAgo(72),
    inventoryConflict: { message: 'Reserved inventory exceeds available stock', occurredAt: hoursAgo(4) },
    shippingAddressException: { status: 'requires_review', message: 'Apartment missing', occurredAt: hoursAgo(3) },
    stripeDisputeId: 'dp_123', disputeStatus: 'needs_response', disputeReason: 'fraudulent',
    shipmentEmailStatus: 'failed', shipmentEmailError: 'Mailbox rejected',
    shipmentException: { status: 'requires_review', type: 'label_purchase', message: 'Purchase timed out', occurredAt: hoursAgo(2) },
    shipmentStatus: 'exception', trackingNumber: '',
    refundRequestStatus: 'requested', refundRequestedAt: hoursAgo(1),
    createdAt: hoursAgo(96), updatedAt: hoursAgo(5),
  }, NOW);

  assert.deepEqual(new Set(exceptions.map(item => item.kind)), new Set([
    'overdue_fulfillment', 'inventory_conflict', 'invalid_address', 'payment_dispute',
    'email_failure', 'label_failure', 'carrier_exception', 'refund_request',
  ]));
  assert.equal(exceptions[0].severity, 'critical');
  assert.ok(exceptions.every(item => item.ageMs >= 0 && item.reason && item.recommendedAction));

  const tracking = getOrderExceptions({ fulfillmentStatus: 'shipped', shipmentStatus: 'pre_transit', shippedAt: hoursAgo(2) }, NOW);
  assert.equal(tracking[0].kind, 'tracking_gap');
});

test('resolved underlying state removes exceptions without manual dismissal', () => {
  const order = { shipmentEmailStatus: 'sent', disputeStatus: 'won', stripeDisputeId: 'dp_123', fulfillmentStatus: 'shipped', trackingNumber: '9400', shipmentStatus: 'delivered' };
  assert.deepEqual(getOrderExceptions(order, NOW), []);
});

test('surfaces refund email and label-refund failures', () => {
  const exceptions = getOrderExceptions({
    createdAt: hoursAgo(1),
    updatedAt: hoursAgo(1),
    refundEmailStatus: 'failed',
    refundEmailError: 'Resend rejected the message.',
    shipmentException: { status: 'requires_review', type: 'label_refund', message: 'Shippo could not void the label.' },
  }, NOW);

  assert.equal(exceptions.some(exception => exception.kind === 'email_failure' && exception.reason.includes('Resend')), true);
  assert.equal(exceptions.some(exception => exception.kind === 'label_failure' && exception.recommendedAction.includes('Shippo')), true);
});
