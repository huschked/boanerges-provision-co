import test from 'node:test';
import assert from 'node:assert/strict';
import { mayActivateMarketing, validPreferenceToken, preferenceAction } from './marketingConsent.js';

test('old signups and checkout consent cannot reverse an opt-out', () => {
  assert.equal(mayActivateMarketing({ status: 'unsubscribed' }), false);
  assert.equal(mayActivateMarketing({ status: 'active', unsubscribedAt: 123 }), false);
  assert.equal(mayActivateMarketing({ status: 'unsubscribed' }, true), true);
  assert.equal(mayActivateMarketing({}), true);
});
test('preference tokens reject malformed and oversized input', () => {
  assert.equal(validPreferenceToken('a'.repeat(64)), true);
  for (const value of [null, {}, '../abc', 'a'.repeat(65), '']) assert.equal(validPreferenceToken(value), false);
});

test('a consumed confirmation cannot reactivate after a later opt-out', () => {
  const token = { action: 'subscribe', version: 1, usedAt: 10 };
  assert.equal(preferenceAction(token, { status: 'active', preferenceVersion: 2 }, true), 'subscribe');
  assert.equal(preferenceAction(token, { status: 'unsubscribed', preferenceVersion: 3 }, true), 'unsubscribe');
});
test('fresh confirmation requires consent, current version, and an unexpired token', () => {
  const token = { action: 'subscribe', version: 1, expiresAtMs: 100 };
  assert.equal(preferenceAction(token, { preferenceVersion: 1 }, true, 50), 'subscribe');
  assert.throws(() => preferenceAction(token, { preferenceVersion: 1 }, false, 50));
  assert.throws(() => preferenceAction(token, { preferenceVersion: 2 }, true, 50));
  assert.throws(() => preferenceAction(token, { preferenceVersion: 1 }, true, 101));
});
test('old unsubscribe links remain usable across preference changes', () => {
  assert.equal(preferenceAction({ action: 'unsubscribe', version: 0, usedAt: 1 }, { status: 'active', preferenceVersion: 5 }, false), 'unsubscribe');
});

test('deletion suppression blocks old signup and confirmation but permits fresh confirmed consent', () => {
  const deleted = { status: 'unsubscribed', unsubscribedAt: 123, preferenceVersion: 4 };
  assert.equal(mayActivateMarketing(deleted), false);
  assert.throws(() => preferenceAction({ action: 'subscribe', version: 3 }, deleted, true));
  assert.equal(preferenceAction({ action: 'subscribe', version: 4 }, deleted, true), 'subscribe');
});
