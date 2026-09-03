import { createHmac, timingSafeEqual } from 'node:crypto';

type OrderStatusPayload = { v: 1; orderId: string; iat: number; exp: number };
export type OrderStatusTokenResult =
  | { valid: true; orderId: string; expiresAt: number }
  | { valid: false; reason: 'invalid' | 'expired' };

const signatureFor = (encodedPayload: string, secret: string) =>
  createHmac('sha256', secret).update(encodedPayload).digest('base64url');

export function createOrderStatusToken(orderId: string, secret: string, nowMs = Date.now(), lifetimeSeconds = 90 * 24 * 60 * 60) {
  if (secret.length < 32) throw new Error('ORDER_STATUS_SECRET must contain at least 32 characters.');
  if (!/^cs_[A-Za-z0-9_]+$/.test(orderId) || orderId.length > 200) throw new Error('Order id cannot be signed.');
  const issuedAt = Math.floor(nowMs / 1000);
  const payload: OrderStatusPayload = { v: 1, orderId, iat: issuedAt, exp: issuedAt + Math.max(1, Math.floor(lifetimeSeconds)) };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${signatureFor(encodedPayload, secret)}`;
}

export function verifyOrderStatusToken(token: string, secret: string, nowMs = Date.now()): OrderStatusTokenResult {
  if (secret.length < 32 || !token || token.length > 1000) return { valid: false, reason: 'invalid' };
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { valid: false, reason: 'invalid' };

  const expected = Buffer.from(signatureFor(parts[0], secret));
  const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return { valid: false, reason: 'invalid' };

  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Partial<OrderStatusPayload>;
    if (payload.v !== 1 || !payload.orderId || !/^cs_[A-Za-z0-9_]+$/.test(payload.orderId) || !Number.isInteger(payload.exp)) {
      return { valid: false, reason: 'invalid' };
    }
    if (payload.exp! <= Math.floor(nowMs / 1000)) return { valid: false, reason: 'expired' };
    return { valid: true, orderId: payload.orderId, expiresAt: payload.exp! * 1000 };
  } catch {
    return { valid: false, reason: 'invalid' };
  }
}
