import React, { useEffect, useState } from 'react';

export function Review() {
  const [params] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const token = params.get('token') || '';
  const optOut = params.get('unsubscribe') === '1';
  const [data, setData] = useState<{ productName: string; submitted: boolean } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (optOut) return;
    const controller = new AbortController();
    fetch(`/api/reviews/access?token=${encodeURIComponent(token)}`, { signal: controller.signal }).then(async r => {
      const body = await r.json(); if (!r.ok) throw new Error(body.error); setData(body);
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [token, optOut]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const r = await fetch(`/api/reviews/${optOut ? 'unsubscribe' : 'submit'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, rating: Number(form.get('rating')), displayName: form.get('displayName'), text: form.get('text'), consent: form.get('consent') === 'on', website: form.get('website') }) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Please try again.'); setDone(true);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const field = 'block w-full mt-2 p-3 border border-white/20 bg-white/5 text-brand-parchment';
  return <div className="bg-brand-black text-brand-parchment min-h-screen px-6 pt-40 pb-20"><div className="max-w-2xl mx-auto">
    <h1 className="font-serif text-4xl mb-6">{optOut ? 'Review email preferences' : 'Review your purchase'}</h1>
    {error && <p role="alert" className="p-4 border border-red-400/40 text-red-200 mb-6">{error}</p>}
    {done ? <p role="status">{optOut ? 'You will no longer receive review invitations. Order and subscription service emails are unchanged.' : 'Thank you! Your review is awaiting moderation and is not public yet.'}</p> : data?.submitted ? <p>You have already submitted a review for this product.</p> : (optOut || data) && <form onSubmit={submit} className="space-y-6">
      {optOut ? <p>Stop future product-review invitations? This does not cancel a product subscription or stop order updates.</p> : <>
        <h2 className="text-2xl font-serif">{data!.productName}</h2>
        <p>Share your honest experience. All ratings are welcome. Use a first name or nickname and do not include personal contact information.</p>
        <label className="block">Rating<select name="rating" required defaultValue="" className={field}><option value="" disabled>Select a rating</option>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n} className="bg-brand-black">{n} out of 5</option>)}</select></label>
        <label className="block">Public display name<input name="displayName" required maxLength={60} className={field} /></label>
        <label className="block">Your review<textarea name="text" required minLength={10} maxLength={2000} rows={6} className={field} /></label>
        <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
        <label className="flex gap-3 items-start"><input name="consent" type="checkbox" required className="mt-1" /><span>I agree to publish my rating, review, and chosen display name after moderation. I have not been offered an incentive for this review.</span></label>
      </>}
      <button disabled={busy} className="px-6 py-4 bg-brand-gold text-brand-black font-black text-xs uppercase tracking-widest disabled:opacity-50">{busy ? 'Saving…' : optOut ? 'Unsubscribe from review emails' : 'Submit review'}</button>
    </form>}
    {!data && !error && !optOut && !done && <p role="status">Checking your private invitation…</p>}
    <p className="mt-8 text-brand-parchment/70">For an expired link, correction, or removal request, contact <a href="mailto:support@boanergesprovisions.com" className="text-brand-gold underline">support@boanergesprovisions.com</a>. We verify ownership before changing a review; edits require your approval and a new moderation check.</p>
  </div></div>;
}
