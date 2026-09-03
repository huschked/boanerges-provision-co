import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicOrderStatus } from './orderStatusView.ts';

const baseOrder = {
  paymentStatus: 'paid', fulfillmentStatus: 'pending', shipmentStatus: 'not_shipped',
  customerName: 'Private Customer', customerEmail: 'private@example.com', customerPhone: '555-555-5555',
  shippingAddress: { line1: 'Private street' }, adminNotes: 'Never expose this',
  stripePaymentIntentId: 'pi_secret', stripeSessionId: 'cs_test_status_order',
  items: [{ productId: 'internal-product-id', name: 'Ghost Salt', quantity: 2, price: 9.5, sizeOz: 3 }],
  subtotalAmount: 19, shippingAmount: 5.99, taxAmount: 1.5, totalAmount: 26.49,
};

test('public order status uses an explicit privacy-safe response', () => {
  const view = buildPublicOrderStatus('cs_test_status_order', baseOrder, Date.parse('2026-12-01T00:00:00Z'));
  const serialized = JSON.stringify(view);
  for (const privateValue of ['Private Customer', 'private@example.com', 'Private street', 'Never expose this', 'pi_secret', 'internal-product-id', 'cs_test_status_order']) {
    assert.equal(serialized.includes(privateValue), false);
  }
  assert.equal(view.items[0].name, 'Ghost Salt');
  assert.equal(view.actions.canRequestAddressChange, true);
  assert.equal(view.actions.canRequestCancellation, true);
});

test('change requests disappear after label creation or carrier movement', () => {
  const labeled = buildPublicOrderStatus('cs_test_status_order', { ...baseOrder, fulfillmentStatus: 'packed', shipmentStatus: 'pre_transit', shippoTransactionId: 'tx_123' }, Date.now() + 1000);
  assert.equal(labeled.actions.canRequestAddressChange, false);
  assert.equal(labeled.actions.canRequestCancellation, true);

  const shipped = buildPublicOrderStatus('cs_test_status_order', { ...baseOrder, fulfillmentStatus: 'shipped', shipmentStatus: 'in_transit' }, Date.now() + 1000);
  assert.deepEqual(shipped.actions, { canRequestAddressChange: false, canRequestCancellation: false });
});

test('unsafe tracking URLs are removed', () => {
  const view = buildPublicOrderStatus('cs_test_status_order', { ...baseOrder, trackingUrl: 'javascript:alert(1)' }, Date.now() + 1000);
  assert.equal(view.shipping.trackingUrl, '');
});
