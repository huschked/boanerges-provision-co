import test from 'node:test';
import assert from 'node:assert/strict';
import { readReviewToken, reviewToken, reviewProducts, reviewEligible, validateReview, reviewAggregate, REVIEW_DELAY_MS } from './reviews.js';

const secret = 'test-only-review-secret-'.repeat(3);
const id = 'a'.repeat(64);
const now = 1800000000000;
test('review links are opaque, signed, expiring and purpose-specific', () => {
  const token = reviewToken(id, now + 1000, secret);
  assert.equal(readReviewToken(token, secret, now), id);
  assert.equal(readReviewToken(token, secret, now + 1000), null);
  assert.equal(readReviewToken(token, secret, now + 1000, true), id);
  assert.equal(readReviewToken(token.replace(/^a/, 'b'), secret, now), null);
  assert.equal(readReviewToken(token.replace(String(now + 1000), String(now + 9000)), secret, now), null);
  assert.equal(readReviewToken(token, 'other'.repeat(10), now), null);
  for (const value of [null, {}, '', '../orders', token + 'x']) assert.equal(readReviewToken(value, secret, now), null);
  assert.throws(() => reviewToken(id, now, 'short'));
});
test('only paid, delivered, uncancelled orders are eligible after seven days', () => {
  const order = { shipmentStatus: 'delivered', paymentStatus: 'paid', fulfillmentStatus: 'shipped', customerEmail: 'buyer@example.com', deliveredAt: { toMillis: () => now - REVIEW_DELAY_MS } };
  assert.equal(reviewEligible(order, now), true);
  assert.equal(reviewEligible(order, now - 1), false);
  for (const change of [{ shipmentStatus: 'in_transit' }, { paymentStatus: 'refunded' }, { paymentStatus: 'partially_refunded' }, { fulfillmentStatus: 'cancelled' }, { deliveredAt: null }, { customerEmail: '' }]) assert.equal(reviewEligible({ ...order, ...change }, now), false);
});
test('purchased-product eligibility deduplicates products and expands bundle snapshots', () => {
  assert.deepEqual(reviewProducts({ items: [
    { productId: 'salt', name: 'Salt', quantity: 2 },
    { kind: 'bundle', quantity: 1, components: [{ productId: 'salt', name: 'Salt' }, { productId: 'pepper', name: 'Pepper' }] },
    { productId: 'cancelled', name: 'Cancelled', quantity: 1, cancelledQuantity: 1 },
  ] }), [{ productId: 'salt', name: 'Salt' }, { productId: 'pepper', name: 'Pepper' }]);
});
test('review validation requires bounded text, integer rating, explicit public consent and empty honeypot', () => {
  const valid = { displayName: 'Buyer', text: 'A delicious seasoning.', rating: 4, consent: true };
  assert.equal(validateReview(valid).status, 'pending');
  for (const change of [{ rating: 0 }, { rating: 6 }, { rating: 1.5 }, { consent: false }, { text: 'short' }, { text: 'a'.repeat(2001) }, { displayName: 'a'.repeat(61) }, { website: 'spam' }]) assert.throws(() => validateReview({ ...valid, ...change }));
});
test('aggregates include only published verified reviews and recompute after unpublishing', () => {
  const rows = [{ status: 'published', verified: true, rating: 5 }, { status: 'published', verified: true, rating: 1 }, { status: 'pending', verified: true, rating: 5 }, { status: 'rejected', verified: true, rating: 5 }, { status: 'published', verified: false, rating: 5 }];
  assert.deepEqual(reviewAggregate(rows), { count: 2, average: 3 });
  rows[0].status = 'rejected';
  assert.deepEqual(reviewAggregate(rows), { count: 1, average: 1 });
  assert.deepEqual(reviewAggregate([]), { count: 0, average: null });
});
