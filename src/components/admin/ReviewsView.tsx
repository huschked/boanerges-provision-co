import React, { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';

type Review = { id: string; productName: string; displayName: string; text: string; rating: number; status: string; moderationReason?: string };
export function ReviewsView({ refreshRevision = 0 }: { refreshRevision?: number }) {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Review[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [invitations, setInvitations] = useState<{ id: string; productName: string; status: string; email: string }[]>([]);
  const [sendingEnabled, setSendingEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setRows([]);
    (async () => {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch(`/api/admin/reviews?status=${status}`, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json(); if (!r.ok) throw new Error(data.error); setRows(data.reviews); setInvitations(data.invitations); setSendingEnabled(data.sendingEnabled);
    })().catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, revision, refreshRevision]);
  const moderate = async (review: Review, next: string) => {
    setBusy(true); setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch(`/api/admin/reviews/${review.id}/moderate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: next, reason: reasons[review.id], expectedStatus: review.status }) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error);
      setRevision(v => v + 1);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const button = 'border border-brand-gold/40 px-4 py-3 text-xs font-black uppercase tracking-widest text-brand-gold disabled:opacity-40';
  return <section className="space-y-6 text-brand-parchment">
    <h2 className="text-3xl font-serif">Verified Buyer Reviews</h2>
    <p className="text-brand-parchment/70">Publish honest positive and negative feedback alike. Reject only for spam, private information, abuse, or irrelevant content. Customer wording and ratings cannot be edited here. Every moderation decision is audited.</p>
    <details className="border border-white/10 p-5"><summary className="cursor-pointer text-brand-gold">Review invitations · {sendingEnabled ? 'Sending enabled' : 'Sending disabled / configuration incomplete'}</summary>
      <p className="my-4 text-brand-parchment/70">The daily job sends eligible requests at least seven days after delivery. A stuck “sending” or “needs_attention” request requires checking Resend before retrying. Never reset it blindly.</p>
      {invitations.length ? invitations.map(i => <p key={i.id} className="py-2 border-t border-white/10 break-words">{i.productName} · {i.email} · {i.status}</p>) : <p>No invitations scheduled yet.</p>}
      <p className="mt-4 text-sm text-brand-parchment/60">Latest 25 invitations. Full history is in Firestore review_invitations.</p>
    </details>
    <div className="flex flex-wrap gap-3">{['pending', 'published', 'rejected'].map(value => <button key={value} className={`${button} ${value === status ? 'bg-brand-gold/10' : ''}`} aria-pressed={status === value} disabled={busy} onClick={() => setStatus(value)}>{value}</button>)}<button className={button} disabled={busy} onClick={() => setRevision(v => v + 1)}>Refresh</button></div>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {loading ? <p role="status">Loading reviews…</p> : !rows.length && !error ? <p>No {status} reviews.</p> : rows.map(review => <article key={review.id} className="border border-white/10 p-6 space-y-4 bg-brand-black">
      <h3 className="text-xl font-bold">{review.productName}</h3>
      <p>{review.displayName} · {review.rating}/5 · Verified buyer</p>
      <p className="whitespace-pre-wrap break-words">{review.text}</p>
      {review.moderationReason && <p className="text-brand-parchment/60">Last decision: {review.moderationReason}</p>}
      <label className="block">Moderation reason<input maxLength={500} value={reasons[review.id] || ''} onChange={e => setReasons(prev => ({ ...prev, [review.id]: e.target.value }))} className="block w-full mt-2 p-3 bg-white/5 border border-white/20" placeholder="Required; explain the decision without altering the review" /></label>
      <div className="flex flex-wrap gap-3">{review.status !== 'published' && <button className={button} disabled={busy || (reasons[review.id]?.trim().length || 0) < 3} onClick={() => moderate(review, 'published')}>Publish review</button>}{review.status !== 'rejected' && <button className={`${button} text-red-300 border-red-400/40`} disabled={busy || (reasons[review.id]?.trim().length || 0) < 3} onClick={() => moderate(review, 'rejected')}>{review.status === 'published' ? 'Unpublish review' : 'Reject review'}</button>}</div>
    </article>)}
    {rows.length === 100 && <p>Showing 100 reviews in this status. Processing these reviews makes room for the next batch.</p>}
  </section>;
}
