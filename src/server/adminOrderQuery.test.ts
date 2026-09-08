import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_ORDER_CURSOR_TTL_MS,
  AdminOrderCursorError,
  buildAdminOrderSummary,
  createAdminOrderCursor,
  matchesAdminOrderSearch,
  normalizeAdminOrderSearch,
  parseAdminOrderCursor,
} from './adminOrderQuery.js';

test('normalizes and searches all supported order identity fields', () => {
  const order = {
    id: 'cs_test_older_301',
    orderReference: 'BP-A1B2C3',
    customerEmail: 'Customer+Salt@Example.com',
    customerName: 'José Rivera',
    trackingNumber: '1Z 999 AA1 01 2345 6784',
  };

  assert.equal(normalizeAdminOrderSearch('  JOSÉ   RIVERA '), 'jose rivera');
  assert.equal(matchesAdminOrderSearch(order, 'a1b2c3'), true);
  assert.equal(matchesAdminOrderSearch(order, 'customer+salt@example.com'), true);
  assert.equal(matchesAdminOrderSearch(order, 'jose'), true);
  assert.equal(matchesAdminOrderSearch(order, '1Z999AA10123456784'), true);
  assert.equal(matchesAdminOrderSearch(order, 'not present'), false);
});

test('an order older than the former 300-result cap remains discoverable', () => {
  const orders = Array.from({ length: 350 }, (_, index) => ({
    id: `order-${String(index + 1).padStart(3, '0')}`,
    orderReference: `BP-${String(index + 1).padStart(6, '0')}`,
    customerEmail: `customer-${index + 1}@example.com`,
    customerName: `Customer ${index + 1}`,
    trackingNumber: `TRACK-${index + 1}`,
  }));

  assert.equal(orders.slice(0, 300).some(order => matchesAdminOrderSearch(order, 'BP-000350')), false);
  assert.equal(orders.filter(order => matchesAdminOrderSearch(order, 'BP-000350'))[0]?.id, 'order-350');
});

test('cursor round-trips and explicitly expires', () => {
  const now = 1_000;
  const cursor = createAdminOrderCursor('order-301', now);
  assert.equal(parseAdminOrderCursor(cursor, now + ADMIN_ORDER_CURSOR_TTL_MS - 1).orderId, 'order-301');
  assert.throws(
    () => parseAdminOrderCursor(cursor, now + ADMIN_ORDER_CURSOR_TTL_MS),
    (error: unknown) => error instanceof AdminOrderCursorError && error.code === 'expired_cursor',
  );
});

test('maps known lifetime and period aggregate fixture totals', () => {
  assert.deepEqual(
    buildAdminOrderSummary({ orderCount: 350, revenue: 4832.75 }, { orderCount: 42, revenue: 619.25 }),
    {
      lifetime: { orderCount: 350, revenue: 4832.75 },
      period: { days: 30, orderCount: 42, revenue: 619.25 },
    },
  );
});
