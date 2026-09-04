import React, { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { CreditCard, Loader2, RefreshCw } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import toast from 'react-hot-toast';

type SubscriptionRecord = { id: string; customerEmail?: string; customerName?: string; status?: string; cadence?: string; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: any; lastOrderId?: string; inventoryError?: string; lastFailedInvoiceId?: string };
const date = (value: any) => value?.toDate?.().toLocaleDateString() || 'Not available';

export const SubscriptionsView: React.FC = () => {
  const [records, setRecords] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const snapshot = await getDocs(query(collection(db, 'subscriptions'), orderBy('updatedAt', 'desc'), limit(200))); setRecords(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))); } catch (error) { console.error(error); toast.error('Unable to load subscriptions. Deploy the latest Firestore rules and try again.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-brand-gold" /></div>;
  return <div className="space-y-8"><div className="flex items-start justify-between gap-5"><div><h3 className="text-3xl font-serif text-brand-parchment">Subscriptions</h3><p className="mt-2 text-sm text-brand-parchment/45">Stripe Billing status, renewal exceptions, and customer cadence.</p></div><button onClick={() => void load()} className="p-3 border border-white/10 text-brand-gold" aria-label="Refresh subscriptions"><RefreshCw size={16} /></button></div>
    {records.length === 0 ? <div className="card-premium p-12 text-center"><CreditCard className="mx-auto text-brand-gold/35" /><p className="mt-4 text-brand-parchment/50">No subscriptions have been created yet.</p></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{records.map(record => <article key={record.id} className={`card-premium p-6 space-y-4 ${record.inventoryError || record.status === 'payment_failed' ? 'border-red-400/30' : ''}`}><div className="flex justify-between gap-4"><div><p className="font-black text-brand-parchment">{record.customerName || record.customerEmail || 'Customer'}</p><p className="text-xs text-brand-parchment/40">{record.customerEmail}</p></div><span className="text-[9px] uppercase tracking-widest text-brand-gold font-black">{record.cancelAtPeriodEnd ? 'Cancelling' : (record.status || 'unknown').replaceAll('_', ' ')}</span></div><div className="text-xs text-brand-parchment/50 space-y-1"><p>Cadence: {(record.cadence || 'unknown').replaceAll('_', ' ')}</p><p>Current period ends: {date(record.currentPeriodEnd)}</p>{record.lastOrderId && <p>Latest order: {record.lastOrderId}</p>}</div>{record.inventoryError && <p className="border border-red-400/20 p-3 text-xs text-red-300">{record.inventoryError}</p>}<details><summary className="cursor-pointer text-[9px] uppercase tracking-widest text-brand-parchment/30">Stripe details</summary><p className="mt-2 text-xs font-mono break-all text-brand-parchment/40">{record.id}</p>{record.lastFailedInvoiceId && <p className="mt-1 text-xs font-mono break-all text-red-300/60">Failed invoice: {record.lastFailedInvoiceId}</p>}</details></article>)}</div>}
  </div>;
};
