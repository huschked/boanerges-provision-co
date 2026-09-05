import React from 'react';
import { auth } from '@/src/lib/firebase';
import toast from 'react-hot-toast';

export interface Subscriber {
  id: string;
  email: string;
  source?: string;
  subscribedAt?: any;
  createdAt?: any;
  status: string;
  resendSyncStatus?: string;
  welcomeEmailStatus?: string;
  deletionState?: string;
}

interface SubscribersViewProps {
  subscribers: Subscriber[];
}

export const SubscribersView: React.FC<SubscribersViewProps> = ({ subscribers }) => {
  const [retrying, setRetrying] = React.useState('');
  const [removed, setRemoved] = React.useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = React.useState<Subscriber | null>(null);
  const visibleSubscribers = subscribers.filter(sub => sub.deletionState !== 'deleted' && !removed.includes(sub.id));
  async function deleteSubscriber(sub: Subscriber) {
    setRetrying(sub.email);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/marketing/delete-subscriber', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ email: sub.email, confirmed: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Deletion failed. Please retry.');
      setRemoved(previous => [...previous, sub.id]);
      setDeleteTarget(null);
      toast.success('Subscriber removed from Audience and Resend.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Deletion failed. Please retry.'); }
    finally { setRetrying(''); }
  }
  async function retry(email: string) {
    setRetrying(email);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/marketing/retry-sync', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success('Preference synchronized. Refresh to update the table.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Sync failed.'); }
    finally { setRetrying(''); }
  }
  const getJoinedDate = (subscriber: Subscriber) => subscriber.subscribedAt || subscriber.createdAt;

  return (
    <div className="space-y-10">
      {deleteTarget && <section role="region" aria-label="Confirm subscriber deletion" className="card-premium p-6 space-y-4 border border-red-400/30">
        <h2 className="text-xl text-brand-parchment">Delete {deleteTarget.email}?</h2>
        <p className="text-brand-parchment/80">This removes their Audience entry and Resend contact. A minimal opt-out record and preference audit history remain to prevent old events from subscribing them again. Orders and product subscriptions are unaffected. Restoring marketing access requires a new signup and email confirmation.</p>
        <button disabled={!!retrying} onClick={() => deleteSubscriber(deleteTarget)} className="px-5 py-3 bg-red-400/15 text-red-300 border border-red-400/30">{retrying ? 'Deleting…' : 'Delete from Audience and Resend'}</button>
        <button disabled={!!retrying} onClick={() => setDeleteTarget(null)} className="px-5 py-3 text-brand-parchment">Cancel</button>
      </section>}
      <div className="card-premium overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.01]">
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Email Address</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Source</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Joined Date</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visibleSubscribers.map((sub) => (
              <tr key={sub.id} className="hover:bg-white/[0.02] transition-all group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-brand-gold/5 border border-brand-gold/10 flex items-center justify-center text-brand-gold text-[10px] font-black">
                      {sub.email[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-brand-parchment font-black">{sub.email}</span>
                  </div>
                </td>
                <td className="px-10 py-8">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">{sub.source || 'Direct Storefront'}</span>
                </td>
                <td className="px-10 py-8">
                  <span className="text-xs text-brand-parchment/60 font-medium">
                    {getJoinedDate(sub)?.toDate ? getJoinedDate(sub).toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </span>
                </td>
                <td className="px-10 py-8 text-right">
                  <span className={`px-4 py-1.5 rounded-full text-[8px] uppercase tracking-[0.2em] font-black border ${sub.status === 'active' ? 'bg-green-400/5 text-green-400 border-green-400/10' : sub.status === 'pending' ? 'bg-amber-400/10 text-amber-300 border-amber-400/25' : 'bg-slate-400/10 text-slate-300 border-slate-400/25'}`}>
                    {sub.status || 'Unknown'}
                  </span>
                  <p className="mt-3 text-xs text-brand-parchment/70">Email sync: {sub.resendSyncStatus || 'Not synced'}</p>
                  <p className="mt-1 text-xs text-brand-parchment/70">Welcome: {sub.welcomeEmailStatus || 'Not sent'}</p>
                  {sub.deletionState && <p className="mt-2 text-sm text-red-300">Deletion: {sub.deletionState}. Retry to finish removal.</p>}
                  <button disabled={!!retrying} onClick={() => setDeleteTarget(sub)} className="mt-2 p-3 underline text-red-300">{sub.deletionState ? 'Retry deletion' : 'Delete subscriber'}</button>
                  {['failed', 'pending'].includes(sub.resendSyncStatus || '') && <button className="mt-2 underline text-brand-gold p-3" disabled={!!retrying} onClick={() => retry(sub.email)}>{retrying === sub.email ? 'Retrying…' : 'Retry email sync'}</button>}
                </td>
              </tr>
            ))}
            {visibleSubscribers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-10 py-20 text-center text-brand-parchment/30 text-sm">
                  No subscribers found yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
