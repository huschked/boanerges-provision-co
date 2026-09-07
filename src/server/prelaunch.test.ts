import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createPrelaunchToken, isPrelaunchEnabled, PRELAUNCH_SESSION_MS, registerPrelaunchProtection, securePasswordMatch, verifyPrelaunchToken } from './prelaunch.js';

test('prelaunch mode requires an explicit true value', () => {
  assert.equal(isPrelaunchEnabled({ PRELAUNCH_MODE: 'true' } as NodeJS.ProcessEnv), true);
  assert.equal(isPrelaunchEnabled({ PRELAUNCH_MODE: 'false' } as NodeJS.ProcessEnv), false);
  assert.equal(isPrelaunchEnabled({} as NodeJS.ProcessEnv), false);
});

test('prelaunch passwords are compared without length timing differences', () => {
  assert.equal(securePasswordMatch('correct horse battery', 'correct horse battery'), true);
  assert.equal(securePasswordMatch('wrong', 'correct horse battery'), false);
});

test('prelaunch access tokens are signed, expiring, and invalidated by password changes', () => {
  const now = Date.UTC(2026, 8, 7, 12);
  const password = 'preview-password-123';
  const token = createPrelaunchToken(password, now);
  assert.equal(verifyPrelaunchToken(token, password, now + PRELAUNCH_SESSION_MS - 1), true);
  assert.equal(verifyPrelaunchToken(token, password, now + PRELAUNCH_SESSION_MS), false);
  assert.equal(verifyPrelaunchToken(token, 'different-password', now), false);
  assert.equal(verifyPrelaunchToken(`${token}x`, password, now), false);
});

test('prelaunch HTTP guard blocks storefront APIs and unlocks with an HttpOnly cookie', async () => {
  const originalMode = process.env.PRELAUNCH_MODE;
  const originalPassword = process.env.PRELAUNCH_PASSWORD;
  process.env.PRELAUNCH_MODE = 'true';
  process.env.PRELAUNCH_PASSWORD = 'approved-preview-password';
  const app = express();
  app.use(express.json());
  registerPrelaunchProtection(app);
  app.get('/api/products', (_request, response) => response.json([{ id: 'salt' }]));
  app.post('/api/subscribers', (_request, response) => response.status(201).json({ success: true }));
  app.get('/api/subscribers-private', (_request, response) => response.json({ exposed: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    assert.deepEqual(await (await fetch(`${base}/api/prelaunch/status`)).json(), { enabled: true, unlocked: false });
    assert.equal((await fetch(`${base}/api/products`)).status, 423);
    assert.equal((await fetch(`${base}/api/subscribers`, { method: 'POST' })).status, 201, 'coming-soon signup remains available');
    assert.equal((await fetch(`${base}/api/subscribers-private`)).status, 423, 'allowlisted paths require an exact match');
    assert.equal((await fetch(`${base}/api/prelaunch/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) })).status, 401);
    const unlocked = await fetch(`${base}/api/prelaunch/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: process.env.PRELAUNCH_PASSWORD }) });
    assert.equal(unlocked.status, 200);
    const cookie = unlocked.headers.get('set-cookie') || '';
    assert.match(cookie, /boanerges_prelaunch_access=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    const cookieHeader = cookie.split(';')[0];
    assert.equal((await fetch(`${base}/api/products`, { headers: { Cookie: cookieHeader } })).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (originalMode === undefined) delete process.env.PRELAUNCH_MODE; else process.env.PRELAUNCH_MODE = originalMode;
    if (originalPassword === undefined) delete process.env.PRELAUNCH_PASSWORD; else process.env.PRELAUNCH_PASSWORD = originalPassword;
  }
});
