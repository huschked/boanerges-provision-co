import assert from 'node:assert/strict';
import test from 'node:test';
import { firebaseAuthErrorMessage } from './firebaseAuthError.ts';

test('unauthorized-domain errors identify the exact hostname to configure', () => {
  assert.equal(
    firebaseAuthErrorMessage({ code: 'auth/unauthorized-domain' }, 'www.boanergesprovisions.com'),
    'Google sign-in is not authorized for www.boanergesprovisions.com. Add this exact hostname in Firebase Authentication → Settings → Authorized domains, then retry.',
  );
});

test('common popup and network errors have actionable messages', () => {
  assert.match(firebaseAuthErrorMessage({ code: 'auth/popup-blocked' }), /Allow pop-ups/);
  assert.match(firebaseAuthErrorMessage({ code: 'auth/network-request-failed' }), /connection/);
  assert.match(firebaseAuthErrorMessage({ code: 'auth/operation-not-allowed' }), /not enabled/);
});
