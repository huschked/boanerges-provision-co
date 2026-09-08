import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, PackageCheck, X } from 'lucide-react';
import { AdminOrderApiError, purchaseShippingLabel, requestShippingQuote, type ShippingAddress, type ShippingQuote } from '@/src/lib/adminOrders';
import type { Order } from './DashboardView';
import { orderReference } from '@/src/lib/orderReference';

type QuoteResult = {
  order: Order;
  quote?: ShippingQuote;
  selectedRateId?: string;
  acceptedCorrection?: boolean;
  status: 'ready' | 'quoting' | 'quoted' | 'purchasing' | 'purchased' | 'failed' | 'skipped';
  message?: string;
};

const addressFromOrder = (order: Order): ShippingAddress => ({
  name: order.shippingAddress?.name || order.customerName || '',
  street1: order.shippingAddress?.line1 || '',
  street2: order.shippingAddress?.line2 || '',
  city: order.shippingAddress?.city || '',
  state: order.shippingAddress?.state || '',
  zip: order.shippingAddress?.postalCode || '',
  country: order.shippingAddress?.country || 'US',
});

const eligibleForLabel = (order: Order) => ['paid', 'partially_refunded'].includes(order.paymentStatus || '')
  && order.fulfillmentStatus === 'packed' && !order.labelUrl && !order.shippoTransactionId;

export function BatchShippingLabels({ orders, onClose, onComplete }: { orders: Order[]; onClose: () => void; onComplete: () => void | Promise<void> }) {
  const [parcel, setParcel] = useState({ length: '8', width: '6', height: '4', weight: '1', distanceUnit: 'in', massUnit: 'lb' });
  const [results, setResults] = useState<QuoteResult[]>(() => orders.map(order => eligibleForLabel(order)
    ? { order, status: 'ready' }
    : { order, status: 'skipped', message: 'Requires a paid, packed order without an existing label.' }));
  const [authorised, setAuthorised] = useState(false);
  const [busy, setBusy] = useState(false);
  const quoted = results.filter(result => result.status === 'quoted');
  const total = useMemo(() => quoted.reduce((sum, result) => sum + Number(result.quote?.rates.find(rate => rate.id === result.selectedRateId)?.amount || 0), 0), [quoted]);

  const updateResult = (orderId: string, changes: Partial<QuoteResult>) => setResults(current => current.map(result => result.order.id === orderId ? { ...result, ...changes } : result));

  const getRates = async () => {
    setBusy(true);
    setAuthorised(false);
    const candidates = results.filter(result => result.status === 'ready' || result.status === 'failed');
    setResults(current => current.map(result => candidates.some(candidate => candidate.order.id === result.order.id) ? { ...result, status: 'quoting', message: undefined } : result));
    await Promise.all(candidates.map(async result => {
      try {
        const quote = await requestShippingQuote(result.order.id, parcel, addressFromOrder(result.order));
        updateResult(result.order.id, { quote, selectedRateId: quote.rates[0]?.id || '', acceptedCorrection: !quote.addressChanged, status: 'quoted' });
      } catch (error) {
        updateResult(result.order.id, { status: 'failed', message: error instanceof AdminOrderApiError ? error.message : 'Rates could not be loaded.' });
      }
    }));
    setBusy(false);
  };

  const purchaseLabels = async () => {
    if (!authorised) return;
    setBusy(true);
    const candidates = results.filter(result => result.status === 'quoted' && result.quote && result.selectedRateId);
    setResults(current => current.map(result => candidates.some(candidate => candidate.order.id === result.order.id) ? { ...result, status: 'purchasing', message: undefined } : result));
    await Promise.all(candidates.map(async result => {
      try {
        await purchaseShippingLabel(result.order.id, {
          quoteId: result.quote!.quoteId,
          rateId: result.selectedRateId!,
          acceptCorrectedAddress: Boolean(result.acceptedCorrection),
        });
        updateResult(result.order.id, { status: 'purchased', message: 'Label purchased and shipment started.' });
      } catch (error) {
        updateResult(result.order.id, { status: 'failed', message: error instanceof AdminOrderApiError ? error.message : 'Label purchase failed.' });
      }
    }));
    setBusy(false);
    await onComplete();
  };

  const correctionOutstanding = quoted.some(result => result.quote?.addressChanged && !result.acceptedCorrection);
  const finished = results.some(result => result.status === 'purchased');

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="batch-label-title">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto border border-brand-gold/25 bg-[#11100e] p-6 shadow-2xl lg:p-10">
        <div className="flex items-start justify-between gap-5">
          <div><p className="text-[9px] font-black uppercase tracking-[0.22em] text-brand-gold">Batch fulfillment</p><h2 id="batch-label-title" className="mt-2 text-3xl font-serif text-brand-parchment">Create shipping labels</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-brand-parchment/55">One parcel configuration is applied to every eligible order. Review every validated address, carrier service, and price before authorizing the purchases.</p></div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close batch labels" className="p-3 text-brand-parchment/50 hover:text-brand-gold disabled:opacity-30"><X /></button>
        </div>

        {!quoted.length && !finished && <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {(['length', 'width', 'height', 'weight'] as const).map(field => <label key={field} className="text-[9px] font-black uppercase tracking-[0.16em] text-brand-parchment/40">{field}<input type="number" min="0.01" step="0.01" value={parcel[field]} onChange={event => setParcel(current => ({ ...current, [field]: event.target.value }))} className="input-premium mt-2 py-3" /></label>)}
          <label className="text-[9px] font-black uppercase tracking-[0.16em] text-brand-parchment/40">Dimensions<select value={parcel.distanceUnit} onChange={event => setParcel(current => ({ ...current, distanceUnit: event.target.value }))} className="input-premium mt-2 py-3"><option value="in">Inches</option><option value="cm">Centimeters</option></select></label>
          <label className="text-[9px] font-black uppercase tracking-[0.16em] text-brand-parchment/40">Weight unit<select value={parcel.massUnit} onChange={event => setParcel(current => ({ ...current, massUnit: event.target.value }))} className="input-premium mt-2 py-3"><option value="lb">Pounds</option><option value="oz">Ounces</option><option value="kg">Kilograms</option></select></label>
        </div>}

        <div className="mt-8 divide-y divide-white/5 border border-white/10">
          {results.map(result => {
            const selectedRate = result.quote?.rates.find(rate => rate.id === result.selectedRateId);
            return <div key={result.order.id} className="p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><p className="font-mono text-xs text-brand-gold">{orderReference(result.order.id, result.order.orderReference)}</p><p className="mt-1 text-sm font-black text-brand-parchment">{result.order.customerName || result.order.customerEmail}</p></div><span className={result.status === 'failed' ? 'text-red-300' : result.status === 'purchased' ? 'text-green-300' : 'text-brand-parchment/45'}>{result.status.replaceAll('_', ' ')}</span></div>
              {result.message && <p className="mt-3 text-xs text-brand-parchment/50">{result.message}</p>}
              {result.quote && ['quoted', 'purchasing'].includes(result.status) && <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="text-[9px] font-black uppercase tracking-[0.16em] text-brand-parchment/40">Carrier service<select value={result.selectedRateId} onChange={event => updateResult(result.order.id, { selectedRateId: event.target.value })} className="input-premium mt-2 py-3">{result.quote.rates.map(rate => <option key={rate.id} value={rate.id}>{rate.carrier} {rate.service} — ${rate.amount.toFixed(2)}</option>)}</select></label>
                {result.quote.addressChanged && <label className="flex items-start gap-3 border border-amber-400/20 bg-amber-400/[0.04] p-4 text-xs leading-5 text-amber-100"><input type="checkbox" checked={Boolean(result.acceptedCorrection)} onChange={event => updateResult(result.order.id, { acceptedCorrection: event.target.checked })} className="mt-1" /><span><strong>Accept Shippo’s corrected address</strong><br />{result.quote.correctedAddress.street1}, {result.quote.correctedAddress.city}, {result.quote.correctedAddress.state} {result.quote.correctedAddress.zip}</span></label>}
                {selectedRate && <p className="text-xs text-brand-parchment/40">Selected: {selectedRate.carrier} {selectedRate.service}, ${selectedRate.amount.toFixed(2)}.</p>}
              </div>}
            </div>;
          })}
        </div>

        {quoted.length > 0 && <label className="mt-6 flex items-start gap-3 border border-red-400/20 bg-red-400/[0.04] p-5 text-sm text-brand-parchment/70"><input type="checkbox" className="mt-1" checked={authorised} onChange={event => setAuthorised(event.target.checked)} /><span><strong className="text-red-200">Authorize {quoted.length} carrier {quoted.length === 1 ? 'charge' : 'charges'} totaling approximately ${total.toFixed(2)}.</strong><br />I reviewed the parcel measurements, addresses, and selected services. Successful purchases cannot be rolled back by a failed order in this batch.</span></label>}
        {correctionOutstanding && <p role="alert" className="mt-4 flex items-center gap-2 text-xs text-amber-200"><AlertTriangle size={15} /> Accept every corrected address before purchasing.</p>}

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 border border-white/15 px-6 text-[9px] font-black uppercase tracking-[0.18em] text-brand-parchment/65">{finished ? 'Done' : 'Cancel'}</button>
          {!quoted.length && !finished && <button type="button" onClick={getRates} disabled={busy || !results.some(result => ['ready', 'failed'].includes(result.status))} className="inline-flex min-h-11 items-center gap-2 bg-brand-gold px-6 text-[9px] font-black uppercase tracking-[0.18em] text-brand-black disabled:opacity-40">{busy && <Loader2 size={14} className="animate-spin" />} Validate & get rates</button>}
          {quoted.length > 0 && <button type="button" onClick={purchaseLabels} disabled={busy || !authorised || correctionOutstanding} className="inline-flex min-h-11 items-center gap-2 bg-red-300 px-6 text-[9px] font-black uppercase tracking-[0.18em] text-brand-black disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />} Purchase labels</button>}
        </div>
      </div>
    </div>, document.body,
  );
}
