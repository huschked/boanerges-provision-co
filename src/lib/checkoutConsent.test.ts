import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldActivateCheckoutNewsletter } from './checkoutConsent.ts';

test('activates checkout newsletter consent only after successful payment', () => {
  assert.equal(shouldActivateCheckoutNewsletter({ newsletterOptIn: true, paymentStatus: 'paid', customerEmail: 'buyer@example.com' }), true);
  assert.equal(shouldActivateCheckoutNewsletter({ newsletterOptIn: false, paymentStatus: 'paid', customerEmail: 'buyer@example.com' }), false);
  assert.equal(shouldActivateCheckoutNewsletter({ newsletterOptIn: true, paymentStatus: 'pending', customerEmail: 'buyer@example.com' }), false);
  assert.equal(shouldActivateCheckoutNewsletter({ newsletterOptIn: true, paymentStatus: 'failed', customerEmail: 'buyer@example.com' }), false);
  assert.equal(shouldActivateCheckoutNewsletter({ newsletterOptIn: true, paymentStatus: 'paid', customerEmail: '' }), false);
});
