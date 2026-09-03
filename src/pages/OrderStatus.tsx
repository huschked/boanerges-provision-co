import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock3, ExternalLink, Loader2, Mail, MapPin, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/src/lib/utils';

type OrderStatusData = {
  reference: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  shipmentStatus: string;
  items: Array<{ name: string; imageUrl: string; sizeOz: number; unitPrice: number; quantity: number; cancelledQuantity: number }>;
  amounts: { subtotal: number; shipping: number; tax: number; total: number; refunded: number; currency: string };
  shipping: { method: string; carrier: string; service: string; trackingNumber: string; trackingUrl: string; estimatedDelivery: string; latestDetails: string; latestStatusDate: string };
  actions: { canRequestAddressChange: boolean; canRequestCancellation: boolean };
  supportEmail: string;
};

const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const formatDate = (value: string, includeTime = false) => value
  ? new Date(value).toLocaleString('en-US', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
  : 'Not available';

export const OrderStatus: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<OrderStatusData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/order-status?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Order tracking is temporarily unavailable.');
      setStatus(data);
    } catch (requestError) {
      setStatus(null);
      setError(requestError instanceof Error ? requestError.message : 'Order tracking is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const activeStage = useMemo(() => {
    if (!status) return 0;
    if (status.fulfillmentStatus === 'delivered' || status.shipmentStatus === 'delivered') return 3;
    if (status.fulfillmentStatus === 'shipped' || !['not_shipped', 'unknown'].includes(status.shipmentStatus)) return 2;
    if (status.fulfillmentStatus === 'packed') return 1;
    return 0;
  }, [status]);

  if (loading) return <div className="min-h-screen pt-44 editorial-surface-dark text-brand-parchment flex justify-center"><div className="text-center space-y-4"><Loader2 className="mx-auto animate-spin text-brand-gold" size={38} /><p className="text-xs uppercase tracking-[0.25em] text-brand-gold">Loading order status</p></div></div>;

  if (!status) return (
    <div className="min-h-screen pt-44 pb-24 editorial-surface-dark text-brand-parchment">
      <div className="max-w-xl mx-auto px-6 text-center space-y-7"><AlertTriangle className="mx-auto text-amber-300" size={42} /><h1 className="text-4xl font-serif">Status link unavailable</h1><p className="text-brand-parchment/60 leading-7">{error || 'This secure link is missing, invalid, or expired.'}</p><p className="text-sm text-brand-parchment/45">For your privacy, order details cannot be displayed without a valid link.</p><a href="mailto:support@boanergesprovisions.com" className="inline-flex items-center gap-2 px-6 py-4 bg-brand-gold text-brand-black text-[10px] uppercase tracking-[0.2em] font-black"><Mail size={14} /> Contact Support</a></div>
    </div>
  );

  const cancelled = status.fulfillmentStatus === 'cancelled';
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: status.amounts.currency || 'USD' });
  const supportSubject = encodeURIComponent(`Order ${status.reference} assistance`);
  const stages = [{ label: 'Confirmed', icon: Check }, { label: 'Preparing', icon: PackageCheck }, { label: 'Shipped', icon: Truck }, { label: 'Delivered', icon: Check }];

  return (
    <div className="pt-40 pb-28 min-h-screen editorial-surface-dark relative overflow-hidden">
      <div className="absolute inset-0 surface-vignette-dark opacity-70" />
      <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10 space-y-8">
        <header className="card-premium p-8 md:p-12 space-y-5">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div><p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold font-black">Secure Order Status</p><h1 className="mt-3 text-4xl md:text-6xl font-serif text-brand-parchment">Order #{status.reference}</h1><p className="mt-3 text-brand-parchment/50">Placed {formatDate(status.createdAt)}</p></div>
            <button onClick={() => void loadStatus()} className="inline-flex items-center gap-2 self-start px-4 py-3 border border-white/10 text-brand-parchment/60 hover:text-brand-gold hover:border-brand-gold/30 text-[9px] uppercase tracking-[0.18em] font-black"><RefreshCw size={13} /> Refresh</button>
          </div>
          {cancelled ? <div className="border border-red-400/25 bg-red-400/[0.05] p-5"><p className="font-black text-red-300">This order was cancelled.</p>{status.amounts.refunded > 0 && <p className="mt-1 text-sm text-brand-parchment/55">Refunded: {currency.format(status.amounts.refunded)}</p>}</div> : (
            <div className="grid grid-cols-4 gap-2 pt-5">
              {stages.map((stage, index) => <div key={stage.label} className="space-y-3"><div className={cn('h-1', index <= activeStage ? 'bg-brand-gold' : 'bg-white/10')} /><div className={cn('flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] font-black', index <= activeStage ? 'text-brand-gold' : 'text-brand-parchment/25')}><stage.icon size={13} /><span className="hidden sm:inline">{stage.label}</span></div></div>)}
            </div>
          )}
        </header>

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8">
          <section className="card-premium p-7 md:p-9 space-y-6"><div><p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/60 font-black">Purchased Items</p><h2 className="mt-2 text-2xl font-serif text-brand-parchment">Order summary</h2></div><div className="divide-y divide-white/5">{status.items.map((item, index) => <div key={`${item.name}-${index}`} className="py-4 flex items-center justify-between gap-5"><div className="flex items-center gap-4">{item.imageUrl && <img src={item.imageUrl} alt={item.name} className="h-14 w-14 object-cover border border-white/10" />}<div><p className="text-brand-parchment font-black">{item.name}</p><p className="mt-1 text-xs text-brand-parchment/40">Qty {item.quantity}{item.sizeOz ? ` · ${item.sizeOz} oz` : ''}{item.cancelledQuantity ? ` · ${item.cancelledQuantity} cancelled` : ''}</p></div></div><p className="text-brand-gold font-black">{currency.format(item.unitPrice * item.quantity)}</p></div>)}</div><div className="pt-4 border-t border-white/10 space-y-2 text-sm"><div className="flex justify-between text-brand-parchment/50"><span>Subtotal</span><span>{currency.format(status.amounts.subtotal)}</span></div><div className="flex justify-between text-brand-parchment/50"><span>Shipping</span><span>{currency.format(status.amounts.shipping)}</span></div><div className="flex justify-between text-brand-parchment/50"><span>Tax</span><span>{currency.format(status.amounts.tax)}</span></div>{status.amounts.refunded > 0 && <div className="flex justify-between text-red-300"><span>Refunded</span><span>−{currency.format(status.amounts.refunded)}</span></div>}<div className="flex justify-between pt-3 border-t border-white/10 text-lg font-black text-brand-gold"><span>Total</span><span>{currency.format(status.amounts.total)}</span></div></div></section>

          <div className="space-y-8"><section className="card-premium p-7 space-y-5"><div className="flex items-center gap-3"><Truck className="text-brand-gold" size={20} /><h2 className="text-2xl font-serif text-brand-parchment">Shipping</h2></div><div className="space-y-3 text-sm"><div><p className="text-[9px] uppercase tracking-[0.18em] text-brand-parchment/30 font-black">Current status</p><p className="mt-1 text-brand-parchment">{humanize(status.shipmentStatus === 'not_shipped' ? status.fulfillmentStatus : status.shipmentStatus)}</p></div><div><p className="text-[9px] uppercase tracking-[0.18em] text-brand-parchment/30 font-black">Method</p><p className="mt-1 text-brand-parchment/70">{[status.shipping.carrier, status.shipping.service || status.shipping.method].filter(Boolean).join(' · ') || 'Standard Shipping'}</p></div>{status.shipping.estimatedDelivery && <div><p className="text-[9px] uppercase tracking-[0.18em] text-brand-parchment/30 font-black">Estimated delivery</p><p className="mt-1 text-brand-parchment/70">{formatDate(status.shipping.estimatedDelivery)}</p></div>}{status.shipping.latestDetails && <div className="border-l-2 border-brand-gold/40 pl-4 text-brand-parchment/60">{status.shipping.latestDetails}</div>}{status.shipping.trackingNumber && <p className="font-mono text-xs text-brand-parchment/50 break-all">{status.shipping.trackingNumber}</p>}</div>{status.shipping.trackingUrl && <a href={status.shipping.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 bg-brand-gold text-brand-black text-[9px] uppercase tracking-[0.18em] font-black">Track with Carrier <ExternalLink size={12} /></a>}</section>

            {(status.actions.canRequestAddressChange || status.actions.canRequestCancellation) && <section className="card-premium p-7 space-y-4"><div className="flex items-center gap-3"><Clock3 className="text-brand-gold" size={20} /><h2 className="text-xl font-serif text-brand-parchment">Need a change?</h2></div><p className="text-sm text-brand-parchment/50 leading-6">Requests are reviewed by our team and are not guaranteed until confirmed.</p><div className="flex flex-col gap-2">{status.actions.canRequestAddressChange && <a href={`mailto:${status.supportEmail}?subject=${supportSubject}&body=${encodeURIComponent('Please review an address change for this order before fulfillment begins.')}`} className="inline-flex items-center gap-2 text-sm text-brand-gold hover:text-brand-parchment"><MapPin size={14} /> Request address change</a>}{status.actions.canRequestCancellation && <a href={`mailto:${status.supportEmail}?subject=${supportSubject}&body=${encodeURIComponent('Please review a cancellation request for this order before shipment.')}`} className="inline-flex items-center gap-2 text-sm text-brand-gold hover:text-brand-parchment"><Mail size={14} /> Request cancellation</a>}</div></section>}
          </div>
        </div>

        <footer className="border border-white/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"><div><p className="text-brand-parchment font-black">Need help with this order?</p><p className="mt-1 text-sm text-brand-parchment/45">Contact support and include reference #{status.reference}.</p></div><div className="flex gap-4"><a href={`mailto:${status.supportEmail}?subject=${supportSubject}`} className="text-brand-gold text-sm hover:text-brand-parchment">{status.supportEmail}</a><Link to="/returns" className="text-brand-parchment/45 text-sm hover:text-brand-gold">Refund policy</Link></div></footer>
      </div>
    </div>
  );
};
