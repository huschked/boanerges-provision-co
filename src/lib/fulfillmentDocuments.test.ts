import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConsolidatedPickList, canIncludeInPickList, getPackingSlipItems, quantityToFulfill } from './fulfillmentDocuments.ts';

test('packing slips exclude fully cancelled lines and subtract partial cancellations', () => {
  const items = getPackingSlipItems({ id: 'one', items: [
    { productId: 'ghost', name: 'Ghost Salt', quantity: 4, cancelledQuantity: 1 },
    { productId: 'garlic', name: 'Garlic Salt', quantity: 2, cancelledQuantity: 2 },
  ] });

  assert.equal(quantityToFulfill({ quantity: 3, cancelledQuantity: 1 }), 2);
  assert.deepEqual(items.map(item => [item.productId, item.fulfillQuantity]), [['ghost', 3]]);
});

test('pick lists group repeated products across lines and orders', () => {
  const list = buildConsolidatedPickList([
    { id: 'one', items: [
      { productId: 'ghost', name: 'Ghost Salt', sizeOz: 3, quantity: 2 },
      { productId: 'ghost', name: 'Ghost Salt', sizeOz: 3, quantity: 1 },
    ] },
    { id: 'two', items: [
      { productId: 'ghost', name: 'Ghost Salt', sizeOz: 3, quantity: 4, cancelledQuantity: 1 },
      { productId: 'garlic', name: 'Garlic Salt', sizeOz: 3, quantity: 2 },
    ] },
  ]);

  assert.deepEqual(list, [
    { productId: 'garlic', name: 'Garlic Salt', sizeOz: 3, quantity: 2, orderCount: 1 },
    { productId: 'ghost', name: 'Ghost Salt', sizeOz: 3, quantity: 6, orderCount: 2 },
  ]);
});

test('pick-list selection allows only paid orders still awaiting fulfillment', () => {
  const item = { productId: 'ghost', name: 'Ghost Salt', quantity: 1 };
  assert.equal(canIncludeInPickList({ id: 'ready', paymentStatus: 'paid', fulfillmentStatus: 'pending', items: [item] }), true);
  assert.equal(canIncludeInPickList({ id: 'packed', paymentStatus: 'partially_refunded', fulfillmentStatus: 'packed', items: [item] }), true);
  assert.equal(canIncludeInPickList({ id: 'shipped', paymentStatus: 'paid', fulfillmentStatus: 'shipped', items: [item] }), false);
  assert.equal(canIncludeInPickList({ id: 'unpaid', paymentStatus: 'unpaid', fulfillmentStatus: 'pending', items: [item] }), false);
});
