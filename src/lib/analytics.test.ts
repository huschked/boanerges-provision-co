import assert from 'node:assert/strict';
import test from 'node:test';
import { googleConsentParameters, isSensitiveTrackingPath, normalizeTrackingConsent, providerEventsFor, sanitizeAnalyticsEvent, sanitizeAnalyticsPath, TRACKING_CONSENT_STORAGE_KEY } from './analytics.ts';

test('tracking consent accepts only the current explicit preference shape', () => {
  assert.equal(TRACKING_CONSENT_STORAGE_KEY, 'boanerges-tracking-consent-v2');
  assert.equal(normalizeTrackingConsent(null), null);
  assert.equal(normalizeTrackingConsent({ version: 1, analytics: true, advertising: true, updatedAt: 'old' }), null);
  assert.equal(normalizeTrackingConsent({ version: 2, analytics: true }), null);
  assert.deepEqual(normalizeTrackingConsent({ version: 2, analytics: true, advertising: false, updatedAt: 'now' }), {
    version: 2, analytics: true, advertising: false, updatedAt: 'now',
  });
});

test('Google advertising signals require the separate advertising choice', () => {
  assert.deepEqual(googleConsentParameters({ version: 2, analytics: true, advertising: false, updatedAt: 'now' }), {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  assert.deepEqual(googleConsentParameters({ version: 2, analytics: true, advertising: true, updatedAt: 'now' }), {
    analytics_storage: 'granted',
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  });
});

test('analytics sanitization removes likely personal data and normalizes commerce values', () => {
  const event = sanitizeAnalyticsEvent({
    type: 'checkout_start', value: 12.345, currency: 'usd',
    metadata: { customerEmail: 'buyer@example.com', newsletterOptIn: true, note: 'safe' },
    items: [{ id: 'salt-1', name: 'Salt', price: 5.999, quantity: 2 }],
  });
  assert.equal(event.value, 12.35);
  assert.equal(event.currency, 'USD');
  assert.deepEqual(event.metadata, { newsletterOptIn: true, note: 'safe' });
  assert.equal(event.items?.[0].price, 6);
});

test('commerce events map to provider-standard event names', () => {
  const event = { type: 'purchase' as const, transactionId: 'order-1', value: 18, currency: 'USD', items: [{ id: 'salt-1', name: 'Salt', price: 9, quantity: 2 }] };
  const providers = providerEventsFor(event);
  assert.equal(providers.google?.name, 'purchase');
  assert.equal(providers.google?.parameters.transaction_id, 'order-1');
  assert.equal(providers.meta?.name, 'Purchase');
  assert.deepEqual(providers.meta?.parameters.content_ids, ['salt-1']);
});

test('analytics paths retain campaign context without leaking private tokens', () => {
  assert.equal(sanitizeAnalyticsPath('/shop?category=Spicy&utm_source=instagram&token=private'), '/shop?category=Spicy&utm_source=instagram');
  assert.equal(sanitizeAnalyticsPath('/order-status?token=private'), '/order-status');
  assert.equal(isSensitiveTrackingPath('/order-status'), true);
  assert.equal(isSensitiveTrackingPath('/shop?category=Spicy'), false);
});
