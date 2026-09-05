import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function EmailPreferences() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [action, setAction] = useState('');
  const [message, setMessage] = useState('Loading email preferences…');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let current = true;
    fetch(`/api/email-preferences?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (current) { setAction(data.action); setMessage(data.action === 'subscribe' ? 'Confirm that you want to receive our marketing emails again.' : 'You can stop marketing emails without signing in.'); } })
      .catch(() => { if (current) setMessage('This link is unavailable or expired. Try again, or contact support@boanergesprovisions.com for help.'); });
    return () => { current = false; };
  }, [token]);
  async function save() {
    setBusy(true);
    try {
      const response = await fetch('/api/email-preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, consent: action === 'subscribe' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save. Please try again.');
      setDone(true);
      setMessage(data.action === 'subscribe' ? 'Your newsletter signup is confirmed.' : 'You are unsubscribed from marketing emails.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="pt-44 pb-24 px-6 min-h-screen editorial-surface-dark text-brand-parchment">
    <section className="max-w-xl mx-auto card-premium p-8 space-y-6">
      <h1 className="text-3xl font-serif">Email preferences</h1>
      <p role="status" aria-live="polite">{message}</p>
      <p>Order receipts, shipping updates, and subscription service messages will continue when needed. Unsubscribing from marketing does not cancel a product subscription.</p>
      {action && !done && <button onClick={save} disabled={busy} className="bg-brand-gold text-brand-black px-6 py-4 font-bold disabled:opacity-50">{busy ? 'Saving…' : action === 'subscribe' ? 'Yes, subscribe me to marketing emails' : 'Unsubscribe from marketing'}</button>}
      <a className="block underline text-brand-gold" href="mailto:support@boanergesprovisions.com">Contact support</a>
    </section>
  </div>;
}
