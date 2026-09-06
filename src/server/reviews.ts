import type { Express, Request, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, FieldPath } from 'firebase-admin/firestore';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { readReviewToken, reviewToken, reviewProducts, reviewEligible, validateReview, reviewAggregate, REVIEW_LIFETIME_MS } from '../lib/reviews.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const emailKey = (email: string) => hash(email.trim().toLowerCase());
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const secret = () => process.env.REVIEW_LINK_SECRET || '';
type Dependencies = {
  db: Firestore;
  authenticateAdmin: (req: Request) => Promise<{ uid: string; email: string | null }>;
  appUrl: () => string;
  send: (message: { to: string; subject: string; html: string; text: string }, key: string) => Promise<string>;
};

export function registerReviewRoutes(app: Express, deps: Dependencies) {
  const { db } = deps;
  const wrap = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    try { await fn(req, res); }
    catch (error: any) {
      console.error('Review operation failed:', error.message);
      res.status(error.status || error.statusCode || 500).json({ error: error.status || error.statusCode ? error.message : 'Reviews are temporarily unavailable. Please try again.' });
    }
  };
  const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
  const limit = rateLimit({ windowMs: 15 * 60000, max: 30, standardHeaders: true, legacyHeaders: false });
  const access = async (token: unknown, optOut = false) => {
    const id = readReviewToken(token, secret(), Date.now(), optOut);
    if (!id) return fail('This review link is invalid or expired. Contact support for help.', 410);
    const snap = await db.collection('review_invitations').doc(id).get();
    if (!snap.exists) return fail('This review link is invalid or expired.', 410);
    return { ref: snap.ref, data: snap.data()!, id };
  };

  app.get('/api/reviews/access', limit, wrap(async (req, res) => {
    const invite = await access(req.query.token);
    const existing = await db.collection('reviews').doc(invite.data.reviewId).get();
    res.json({ productName: invite.data.productName, submitted: existing.exists });
  }));
  app.post('/api/reviews/submit', limit, wrap(async (req, res) => {
    const invite = await access(req.body?.token);
    let content: ReturnType<typeof validateReview>;
    try { content = validateReview(req.body); } catch (e: any) { return fail(e.message); }
    await db.runTransaction(async tx => {
      const ref = db.collection('reviews').doc(invite.data.reviewId);
      const [prior, order] = await Promise.all([tx.get(ref), tx.get(db.collection('orders').doc(invite.data.orderId))]);
      if (prior.exists) return fail('A review has already been submitted for this product. Contact support to edit or remove it.', 409);
      if (!order.exists || !reviewEligible(order.data()!) || !reviewProducts(order.data()!).some(p => p.productId === invite.data.productId)) return fail('This purchase is no longer eligible for a review.', 409);
      tx.create(ref, { ...content, publicId: randomUUID(), productId: invite.data.productId, productName: invite.data.productName, buyerKey: emailKey(invite.data.email), orderId: invite.data.orderId, createdAt: FieldValue.serverTimestamp(), consentAt: FieldValue.serverTimestamp() });
      tx.update(invite.ref, { submittedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection('review_audit').doc(), { reviewId: ref.id, action: 'submitted', at: FieldValue.serverTimestamp() });
    });
    res.status(201).json({ submitted: true });
  }));
  app.post('/api/reviews/unsubscribe', limit, wrap(async (req, res) => {
    const invite = await access(req.body?.token, true);
    await db.collection('review_preferences').doc(emailKey(invite.data.email)).set({ unsubscribed: true, updatedAt: FieldValue.serverTimestamp() });
    res.json({ unsubscribed: true });
  }));

  app.get('/api/reviews/product/:productId', limit, wrap(async (req, res) => {
    const productId = String(req.params.productId);
    if (productId.length > 200 || productId.includes('/')) return fail('Invalid product.');
    // Single equality query needs no composite index. Never expose private review fields.
    const snap = await db.collection('reviews').where('productId', '==', productId).get();
    const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    const aggregate = reviewAggregate(rows);
    const reviews = rows.filter(r => r.status === 'published' && r.verified === true && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5)
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).slice(0, 50)
      .map((r, index) => ({ id: r.publicId || String(index), displayName: r.displayName, rating: r.rating, text: r.text, date: r.createdAt?.toDate().toISOString().slice(0, 10) || '' }));
    res.json({ ...aggregate, reviews });
  }));
  app.get('/api/reviews/summaries', limit, wrap(async (req, res) => {
    let ids: unknown;
    try { ids = JSON.parse(String(req.query.ids || '')); } catch { return fail('Invalid product list.'); }
    if (!Array.isArray(ids) || !ids.length || ids.length > 30 || ids.some(id => typeof id !== 'string' || !id || id.length > 200 || id.includes('/'))) return fail('Choose between 1 and 30 valid products.');
    const productIds = [...new Set(ids)] as string[];
    const snap = await db.collection('reviews').where('productId', 'in', productIds).get();
    const rows = snap.docs.map(d => d.data());
    res.json({ summaries: Object.fromEntries(productIds.map(id => [id, reviewAggregate(rows.filter(r => r.productId === id) as any[])])) });
  }));
  app.get('/api/admin/reviews', wrap(async (req, res) => {
    await deps.authenticateAdmin(req);
    const status = String(req.query.status || 'pending');
    if (!['pending', 'published', 'rejected'].includes(status)) return fail('Invalid status.');
    const snap = await db.collection('reviews').where('status', '==', status).limit(100).get();
    const invitations = await db.collection('review_invitations').orderBy('createdAt', 'desc').limit(25).get();
    res.json({ reviews: snap.docs.map(d => ({ ...d.data(), id: d.id })), sendingEnabled: process.env.REVIEW_REQUESTS_ENABLED === 'true' && !!process.env.MARKETING_POSTAL_ADDRESS?.trim() && secret().length >= 32 && (process.env.CRON_SECRET?.length || 0) >= 32,
      invitations: invitations.docs.map(d => ({ id: d.id, productName: d.data().productName, status: d.data().status, email: d.data().email })) });
  }));
  app.post('/api/admin/reviews/:id/moderate', wrap(async (req, res) => {
    const actor = await deps.authenticateAdmin(req);
    const { status, reason, expectedStatus } = req.body || {};
    if (!['published', 'rejected'].includes(status) || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500) return fail('Choose publish or reject and provide a moderation reason (3–500 characters).');
    const id = String(req.params.id);
    if (!/^[a-f0-9]{64}$/.test(id)) return fail('Invalid review.');
    await db.runTransaction(async tx => {
      const ref = db.collection('reviews').doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()?.verified !== true) return fail('Verified review not found.', 404);
      if (snap.data()?.status !== expectedStatus) return fail('This review changed. Refresh before moderating.', 409);
      // No customer-content fields may be changed by moderation.
      tx.update(ref, { status, moderatedAt: FieldValue.serverTimestamp(), moderationReason: reason.trim() });
      tx.create(db.collection('review_audit').doc(), { reviewId: id, from: snap.data()?.status, to: status, reason: reason.trim(), actorUid: actor.uid, at: FieldValue.serverTimestamp() });
    });
    res.json({ updated: true });
  }));

  app.get('/api/cron/review-requests', wrap(async (req, res) => {
    const cronSecret = process.env.CRON_SECRET || '';
    const supplied = req.get('authorization') || '';
    const expected = `Bearer ${cronSecret}`;
    if (cronSecret.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return fail('Unauthorized.', 401);
    if (process.env.REVIEW_REQUESTS_ENABLED !== 'true' || !process.env.MARKETING_POSTAL_ADDRESS?.trim() || secret().length < 32) return res.json({ skipped: 'Review sending is disabled or configuration is incomplete.' });
    const started = Date.now();
    // Persisted scan cursor covers old delivered orders without re-scanning an unbounded collection.
    const cursorRef = db.collection('review_jobs').doc('scan');
    const cursor = (await cursorRef.get()).data()?.after;
    let query = db.collection('orders').where('shipmentStatus', '==', 'delivered').orderBy(FieldPath.documentId()).limit(50);
    if (cursor) query = query.startAfter(cursor);
    const orders = await query.get();
    let lastProcessed = cursor || null;
    for (const order of orders.docs) {
      const data = order.data();
      for (const product of reviewEligible(data) ? reviewProducts(data) : []) {
        const id = hash(`${order.id}:${product.productId}`);
        const ref = db.collection('review_invitations').doc(id);
        await db.runTransaction(async tx => {
          if ((await tx.get(ref)).exists) return;
          tx.create(ref, { orderId: order.id, productId: product.productId, productName: product.name, email: data.customerEmail.trim().toLowerCase(), reviewId: hash(`${emailKey(data.customerEmail)}:${product.productId}`), status: 'pending', dueAtMs: Date.now(), createdAt: FieldValue.serverTimestamp() });
        });
      }
      lastProcessed = order.id;
      if (Date.now() - started > 12000) break;
    }
    // Save only the last processed order when time-budgeting a page.
    // Discovery is safe to repeat: each invitation has a deterministic id.
    await cursorRef.set({ after: orders.size < 50 && lastProcessed === orders.docs.at(-1)?.id || orders.empty ? null : lastProcessed });
    let sent = 0;
    const pending = await db.collection('review_invitations').where('dueAtMs', '<=', Date.now()).limit(10).get();
    for (const invite of pending.docs) {
      if (Date.now() - started > 23000) break;
      const data = invite.data();
      const expiresAtMs = Date.now() + REVIEW_LIFETIME_MS;
      const claimed = await db.runTransaction(async tx => {
        const [current, order, preferences, subscriber, prior, legacySubscribers] = await Promise.all([
          tx.get(invite.ref), tx.get(db.collection('orders').doc(data.orderId)),
          tx.get(db.collection('review_preferences').doc(emailKey(data.email))),
          tx.get(db.collection('subscribers').doc(data.email)), tx.get(db.collection('reviews').doc(data.reviewId)),
          tx.get(db.collection('subscribers').where('email', '==', data.email)),
        ]);
        if (current.data()?.status !== 'pending') return false;
        const optedOut = (s: any) => s?.status === 'unsubscribed' || s?.deletionState || s?.unsubscribedAt;
        const suppress = !order.exists || !reviewEligible(order.data()!) || !reviewProducts(order.data()!).some(p => p.productId === data.productId)
          || preferences.data()?.unsubscribed || optedOut(subscriber.data()) || legacySubscribers.docs.some(d => optedOut(d.data())) || prior.exists;
        tx.update(invite.ref, { status: suppress ? 'suppressed' : 'sending', expiresAtMs, dueAtMs: FieldValue.delete(), attemptedAt: FieldValue.serverTimestamp() });
        return !suppress;
      });
      if (!claimed) continue;
      try {
        const token = reviewToken(invite.id, expiresAtMs, secret());
        const url = `${deps.appUrl()}/review#token=${encodeURIComponent(token)}`;
        const optOut = `${deps.appUrl()}/review#token=${encodeURIComponent(token)}&unsubscribe=1`;
        const postal = process.env.MARKETING_POSTAL_ADDRESS!.trim();
        const text = `How was ${data.productName}?\nShare your honest experience: ${url}\nYour review is optional, not incentivized, and will be moderated before publication. All ratings are welcome.\nStop review invitations: ${optOut}\n${postal}\nQuestions or edits: support@boanergesprovisions.com`;
        const providerId = await deps.send({ to: data.email, subject: `How was your ${data.productName}?`, text, html: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:auto"><h1>How was ${escape(data.productName)}?</h1><p>We would love your honest feedback. All ratings are welcome. Reviews are optional, not incentivized, and moderated before publication.</p><p><a href="${escape(url)}">Review your purchase</a></p><p>Please do not forward this private link. It expires in 60 days.</p><hr><p><a href="${escape(optOut)}">Unsubscribe from review invitations</a></p><p>${escape(postal)}</p><p>Questions or edits: support@boanergesprovisions.com</p></div>` }, `review-request-${invite.id}`);
        await invite.ref.update({ status: 'sent', providerId, sentAt: FieldValue.serverTimestamp() });
        sent++;
      } catch {
        // A timeout could mean the provider accepted the message. Never blindly resend.
        await invite.ref.update({ status: 'needs_attention', error: 'Check provider delivery before any manual retry.' });
      }
    }
    res.json({ scanned: orders.size, sent });
  }));
}
