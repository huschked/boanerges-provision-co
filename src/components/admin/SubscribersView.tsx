import React from 'react';

export interface Subscriber {
  id: string;
  email: string;
  source?: string;
  subscribedAt?: any;
  createdAt?: any;
  status: string;
}

interface SubscribersViewProps {
  subscribers: Subscriber[];
}

export const SubscribersView: React.FC<SubscribersViewProps> = ({ subscribers }) => {
  const getJoinedDate = (subscriber: Subscriber) => subscriber.subscribedAt || subscriber.createdAt;

  return (
    <div className="space-y-10">
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
            {subscribers.map((sub) => (
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
                  <span className="px-4 py-1.5 rounded-full bg-green-400/5 text-green-400 text-[8px] uppercase tracking-[0.2em] font-black border border-green-400/10">
                    Active
                  </span>
                </td>
              </tr>
            ))}
            {subscribers.length === 0 && (
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
