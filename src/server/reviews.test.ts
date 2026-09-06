import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { registerReviewRoutes } from './reviews.js';
import { REVIEW_DELAY_MS } from '../lib/reviews.js';

// In-memory adapter: route tests exercise real HTTP and handlers without Firebase or email credentials.
function memoryDb() {
  const rows = new Map<string, any>();
  let serial = 0;
  const apply = (path: string, value: any, merge = false) => {
    const next = merge ? { ...rows.get(path) } : {};
    for (const [key, v] of Object.entries(value)) {
      if ((v as any)?.isEqual?.(FieldValue.delete())) delete next[key];
      else next[key] = (v as any)?.isEqual?.(FieldValue.serverTimestamp()) ? Timestamp.now() : v;
    }
    rows.set(path, next);
  };
  const ref = (path: string): any => ({ id: path.split('/').at(-1), path,
    get: async () => ({ id: path.split('/').at(-1), exists: rows.has(path), data: () => rows.get(path), ref: ref(path) }),
    set: async (v: any, opts: any) => apply(path, v, opts?.merge), update: async (v: any) => apply(path, v, true),
  });
  const collection = (name: string, filters: any[] = [], max = Infinity, after?: string): any => ({
    doc: (id = String(++serial)) => ref(`${name}/${id}`),
    where: (field: string, op: string, value: any) => collection(name, [...filters, [field, op, value]], max, after),
    orderBy: () => collection(name, filters, max, after),
    startAfter: (id: string) => collection(name, filters, max, id),
    limit: (n: number) => collection(name, filters, n, after),
    get: async () => {
      const paths = [...rows.keys()].filter(path => path.startsWith(`${name}/`) && (!after || path.split('/').at(-1)! > after)
        && filters.every(([field, op, value]) => op === '==' ? rows.get(path)[field] === value : op === 'in' ? value.includes(rows.get(path)[field]) : rows.get(path)[field] <= value)).sort().slice(0, max);
      return { docs: await Promise.all(paths.map(p => ref(p).get())), empty: paths.length === 0, size: paths.length };
    },
  });
  let queue: Promise<any> = Promise.resolve();
  const db: any = { collection, runTransaction: (fn: any) => {
    const run = queue.then(async () => {
      const writes: (() => void)[] = [];
      const result = await fn({ get: (target: any) => target.get(),
        create: (r: any, v: any) => writes.push(() => { if (rows.has(r.path)) throw new Error('already exists'); apply(r.path, v); }),
        update: (r: any, v: any) => writes.push(() => apply(r.path, v, true)),
      });
      writes.forEach(fn => fn()); return result;
    });
    queue = run.catch(() => {}); return run;
  } };
  return { db, rows };
}

test('HTTP review workflow: delayed sending, replay, buyer uniqueness, opt-out, moderation and privacy', async () => {
  const original = { ...process.env };
  process.env.REVIEW_LINK_SECRET = 'review-test-key-'.repeat(4);
  process.env.CRON_SECRET = 'cron-test-key-'.repeat(4);
  process.env.REVIEW_REQUESTS_ENABLED = 'true';
  process.env.MARKETING_POSTAL_ADDRESS = 'Test mailbox (not a real mailing address)';
  const { db, rows } = memoryDb();
  const emails: any[] = [];
  let failSend = false;
  const order = { shipmentStatus: 'delivered', fulfillmentStatus: 'shipped', paymentStatus: 'paid', deliveredAt: Timestamp.fromMillis(Date.now() - REVIEW_DELAY_MS - 1000), customerEmail: 'buyer@example.com', items: [{ productId: 'salt', name: 'Salt', quantity: 1 }] };
  rows.set('orders/order-1', order);
  rows.set('orders/too-soon', { ...order, deliveredAt: Timestamp.now() });
  rows.set('orders/not-delivered', { ...order, shipmentStatus: 'in_transit' });
  const app = express(); app.use(express.json());
  registerReviewRoutes(app, { db, appUrl: () => 'https://example.com', authenticateAdmin: async req => {
    if (req.get('authorization') !== 'Bearer admin-test') throw Object.assign(new Error('Unauthorized'), { status: 401 });
    return { uid: 'admin', email: null };
  }, send: async (message, key) => { emails.push({ ...message, key }); if (failSend) throw new Error('Ambiguous provider timeout'); return 'email-1'; } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (path: string, body?: any, authorization?: string) => {
    const r = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, body: await r.json() };
  };
  try {
    assert.equal((await request('/api/cron/review-requests')).status, 401);
    assert.equal((await request('/api/admin/reviews')).status, 401);
    const cron = `Bearer ${process.env.CRON_SECRET}`;
    await request('/api/cron/review-requests', undefined, cron);
    await request('/api/cron/review-requests', undefined, cron);
    assert.equal(emails.length, 1, 'cron replay must not send again');
    const token = new URL(emails[0].text.match(/https:\/\/example.com\/review#[^\s]+/)[0]).hash.slice('#token='.length);
    assert.equal((await request(`/api/reviews/access?token=${token}`)).body.productName, 'Salt');
    assert.equal((await request(`/api/reviews/access?token=${token}x`)).status, 410);
    const content = { token, rating: 1, displayName: 'Verified buyer', text: 'Not the flavor for me.', consent: true, productId: 'forged-product' };
    const results = await Promise.all([request('/api/reviews/submit', content), request('/api/reviews/submit', content)]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    assert.equal((await request('/api/reviews/product/salt')).body.count, 0);
    const admin = (await request('/api/admin/reviews', undefined, 'Bearer admin-test')).body;
    const review = admin.reviews[0];
    assert.equal(review.productId, 'salt', 'product is taken from invitation, not supplied input');
    assert.equal((await request(`/api/admin/reviews/${review.id}/moderate`, { status: 'published', reason: 'Relevant honest feedback', expectedStatus: 'pending', text: 'Changed!' }, 'Bearer admin-test')).status, 200);
    let published = (await request('/api/reviews/product/salt')).body;
    assert.equal(published.count, 1); assert.equal(published.average, 1);
    const summaryUrl = `/api/reviews/summaries?ids=${encodeURIComponent(JSON.stringify(['salt', 'no-reviews']))}`;
    assert.deepEqual((await request(summaryUrl)).body, { summaries: { salt: { count: 1, average: 1 }, 'no-reviews': { count: 0, average: null } } });
    assert.equal((await request('/api/reviews/summaries?ids=invalid')).status, 400);
    assert.equal(published.reviews[0].text, content.text);
    assert.notEqual(published.reviews[0].id, review.id, 'public identifiers must not expose buyer-derived dedupe keys');
    assert.equal(JSON.stringify(published).includes('buyer@example.com'), false);
    assert.equal(JSON.stringify(published).includes('order-1'), false);
    await request(`/api/admin/reviews/${review.id}/moderate`, { status: 'rejected', reason: 'Buyer requested removal', expectedStatus: 'published' }, 'Bearer admin-test');
    assert.equal((await request('/api/reviews/product/salt')).body.count, 0);
    assert.equal([...rows.keys()].filter(k => k.startsWith('review_audit/')).length, 3);
    assert.equal((await request(summaryUrl)).body.summaries.salt.count, 0);
    await request('/api/reviews/unsubscribe', { token });
    rows.set('orders/order-2', { ...order, items: [{ productId: 'pepper', name: 'Pepper', quantity: 1 }] });
    await request('/api/cron/review-requests', undefined, cron);
    assert.equal(emails.length, 1, 'opt-out suppresses future product invitations');
    assert.equal([...rows.values()].some(v => v.status === 'suppressed'), true);
    failSend = true;
    rows.set('orders/order-3', { ...order, customerEmail: 'another@example.com' });
    await request('/api/cron/review-requests', undefined, cron);
    await request('/api/cron/review-requests', undefined, cron);
    assert.equal(emails.length, 2, 'uncertain provider sends are not replayed');
    assert.equal([...rows.values()].some(v => v.status === 'needs_attention'), true);
    process.env.REVIEW_REQUESTS_ENABLED = 'false';
    assert.match((await request('/api/cron/review-requests', undefined, cron)).body.skipped, /disabled/);
    let limited = 0;
    for (let i = 0; i < 31; i++) limited = (await fetch(`${base}/api/reviews/product/salt`)).status;
    assert.equal(limited, 429);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    for (const key of ['REVIEW_LINK_SECRET', 'CRON_SECRET', 'REVIEW_REQUESTS_ENABLED', 'MARKETING_POSTAL_ADDRESS']) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
  }
});
