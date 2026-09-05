import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeOrderLifecycle } from './orderLifecycle.js';

export const REVIEW_DELAY_MS = 7 * 86400000;
export const REVIEW_LIFETIME_MS = 60 * 86400000;
export function reviewToken(id: string, expires: number, secret: string) {
  if (secret.length < 32) throw new Error('REVIEW_LINK_SECRET must contain at least 32 characters.');
  const body = `${id}.${expires}`;
  return `${body}.${createHmac('sha256', secret).update(`product-review:${body}`).digest('hex')}`;
}
export function readReviewToken(token: unknown, secret: string, now = Date.now(), optOut = false) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}\.\d{13}\.[a-f0-9]{64}$/.test(token) || secret.length < 32) return null;
  const [id, expiry] = token.split('.');
  if (!optOut && Number(expiry) <= now) return null;
  const expected = reviewToken(id, Number(expiry), secret);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token)) ? id : null;
}
export function reviewProducts(order: Record<string, any>): { productId: string; name: string }[] {
  const products = new Map<string, string>();
  for (const item of Array.isArray(order.items) ? order.items : []) {
    if (!(Number(item.quantity) - Number(item.cancelledQuantity || 0) > 0)) continue;
    const components = item.kind === 'bundle' || item.components?.length ? item.components || [] : [item];
    for (const part of components) {
      if (typeof part.productId === 'string' && part.productId && !part.productId.includes('/') && typeof part.name === 'string') products.set(part.productId, part.name);
    }
  }
  return Array.from(products, ([productId, name]) => ({ productId, name }));
}
export function reviewEligible(order: Record<string, any>, now = Date.now()) {
  const life = normalizeOrderLifecycle(order);
  const delivered = order.deliveredAt?.toMillis?.() ?? 0;
  return life.shipmentStatus === 'delivered' && life.paymentStatus === 'paid' && life.fulfillmentStatus !== 'cancelled'
    && delivered > 0 && delivered + REVIEW_DELAY_MS <= now && typeof order.customerEmail === 'string' && /.+@.+\..+/.test(order.customerEmail);
}
export function validateReview(input: any) {
  if (!input || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5 || input.consent !== true) throw new Error('Choose a rating and consent to public display.');
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (displayName.length < 1 || displayName.length > 60 || text.length < 10 || text.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(displayName + text)) throw new Error('Use a display name (1–60 characters) and review (10–2,000 characters).');
  if (input.website) throw new Error('Unable to submit this review.');
  return { rating: input.rating as number, displayName, text, consent: true, verified: true, status: 'pending' };
}
export function reviewAggregate(reviews: { status: string; verified: boolean; rating: number }[]) {
  const published = reviews.filter(r => r.status === 'published' && r.verified && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5);
  return { count: published.length, average: published.length ? published.reduce((sum, r) => sum + r.rating, 0) / published.length : null };
}
