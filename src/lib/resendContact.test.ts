import test from 'node:test';
import assert from 'node:assert/strict';
import { isMissingResendContact } from './resendContact.js';

test('missing contacts allow deletion to finish across provider error formats', () => {
  assert.equal(isMissingResendContact({ name: 'not_found' }), true);
  assert.equal(isMissingResendContact({ statusCode: 404 }), true);
  assert.equal(isMissingResendContact({ name: 'validation_error', message: 'Contact with this email does not exist.' }), true);
});
test('real provider failures do not count as successful removal', () => {
  for (const error of [null, { name: 'invalid_api_key' }, { statusCode: 429 }, { statusCode: 500 }, { name: 'validation_error', message: 'Invalid email address' }]) {
    assert.equal(isMissingResendContact(error), false);
  }
});
