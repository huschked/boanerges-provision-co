import type { Express, NextFunction, Request, Response } from 'express';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';

export const PRELAUNCH_COOKIE_NAME = 'boanerges_prelaunch_access';
export const PRELAUNCH_SESSION_MS = 12 * 60 * 60 * 1000;

const publicApiPaths = new Set([
  '/api/order-status',
  '/api/email-preferences',
  '/api/checkout/session-status',
  '/api/subscriptions/portal',
  '/api/subscribers',
]);

const publicApiPrefixes = [
  '/api/prelaunch/',
  '/api/webhooks/',
  '/api/cron/',
  '/api/admin/',
  '/api/reviews/',
];

export function isPrelaunchEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return environment.PRELAUNCH_MODE === 'true';
}

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

function signingKey(password: string) {
  return createHash('sha256').update(`boanerges-prelaunch-session:${password}`).digest();
}

export function securePasswordMatch(candidate: string, expected: string) {
  return timingSafeEqual(digest(candidate), digest(expected));
}

export function createPrelaunchToken(password: string, nowMs = Date.now()) {
  const expiresAt = Math.floor((nowMs + PRELAUNCH_SESSION_MS) / 1000);
  const payload = `v1.${expiresAt}`;
  const signature = createHmac('sha256', signingKey(password)).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyPrelaunchToken(token: string, password: string, nowMs = Date.now()) {
  const [version, rawExpiry, signature, ...extra] = token.split('.');
  if (version !== 'v1' || extra.length || !/^\d+$/.test(rawExpiry || '') || !signature) return false;
  const expiresAt = Number(rawExpiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= nowMs) return false;
  const expected = createHmac('sha256', signingKey(password)).update(`${version}.${rawExpiry}`).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return false; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function cookieValue(request: Request, name: string) {
  const header = request.headers.cookie || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return ''; }
  }
  return '';
}

function isSecureRequest(request: Request) {
  return process.env.VERCEL === '1' || request.secure || request.get('x-forwarded-proto') === 'https';
}

function canEnterStorefront(request: Request, password: string) {
  return verifyPrelaunchToken(cookieValue(request, PRELAUNCH_COOKIE_NAME), password);
}

function isPublicDuringPrelaunch(pathname: string) {
  return publicApiPaths.has(pathname)
    || publicApiPrefixes.some(prefix => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix));
}

export function registerPrelaunchProtection(app: Express) {
  const unlockLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many preview attempts. Please wait and try again.', code: 'rate_limited' },
  });

  app.get('/api/prelaunch/status', (request, response) => {
    response.set('Cache-Control', 'private, no-store, max-age=0');
    const enabled = isPrelaunchEnabled();
    const password = process.env.PRELAUNCH_PASSWORD || '';
    response.json({ enabled, unlocked: !enabled || (password.length >= 12 && canEnterStorefront(request, password)) });
  });

  app.post('/api/prelaunch/unlock', unlockLimiter, (request, response) => {
    response.set('Cache-Control', 'private, no-store, max-age=0');
    if (!isPrelaunchEnabled()) return response.json({ success: true, unlocked: true });
    const password = process.env.PRELAUNCH_PASSWORD || '';
    if (password.length < 12) return response.status(503).json({ error: 'Preview access is not configured.', code: 'prelaunch_not_configured' });
    const candidate = typeof request.body?.password === 'string' ? request.body.password.slice(0, 200) : '';
    if (!securePasswordMatch(candidate, password)) return response.status(401).json({ error: 'That preview password is not valid.', code: 'invalid_password' });
    response.cookie(PRELAUNCH_COOKIE_NAME, createPrelaunchToken(password), {
      httpOnly: true,
      secure: isSecureRequest(request),
      sameSite: 'strict',
      maxAge: PRELAUNCH_SESSION_MS,
      path: '/',
    });
    return response.json({ success: true, unlocked: true });
  });

  app.post('/api/prelaunch/lock', (request, response) => {
    response.clearCookie(PRELAUNCH_COOKIE_NAME, { httpOnly: true, secure: isSecureRequest(request), sameSite: 'strict', path: '/' });
    response.json({ success: true, unlocked: false });
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    if (!isPrelaunchEnabled() || !request.path.startsWith('/api/') || isPublicDuringPrelaunch(request.path)) return next();
    const password = process.env.PRELAUNCH_PASSWORD || '';
    if (password.length >= 12 && canEnterStorefront(request, password)) return next();
    response.set('Cache-Control', 'private, no-store, max-age=0');
    return response.status(423).json({ error: 'The storefront is not open yet.', code: 'prelaunch_locked' });
  });
}
