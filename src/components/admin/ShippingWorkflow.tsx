import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ExternalLink, PackageCheck, Pencil, RotateCcw, Truck } from 'lucide-react';
import { AdminOrderApiError, purchaseShippingLabel, requestShippingQuote, type ShippingAddress, type ShippingQuote } from '@/src/lib/adminOrders';
import type { Order } from './DashboardView';

const displayAddress = (address: ShippingAddress) => [address.name, address.street1, address.street2, `${address.city}, ${address.state} ${address.zip}`, address.country].filter(Boolean).join('\n');

const addressFromOrder = (order: Order): ShippingAddress => ({
  name: order.shippingAddress?.name || order.customerName || '',
  street1: order.shippingAddress?.line1 || '',
  street2: order.shippingAddress?.line2 || '',
  city: order.shippingAddress?.city || '',
  state: order.shippingAddress?.state || '',
  zip: order.shippingAddress?.postalCode || '',
  country: order.shippingAddress?.country || 'US',
});

const addressFields: Array<{ key: keyof ShippingAddress; label: string; required?: boolean; className?: string }> = [
  { key: 'name', label: 'Recipient name', required: true, className: 'md:col-span-2' },
  { key: 'street1', label: 'Address line 1', required: true, className: 'md:col-span-2' },
  { key: 'street2', label: 'Address line 2' },
  { key: 'city', label: 'City', required: true },
  { key: 'state', label: 'State', required: true },
  { key: 'zip', label: 'Postal code', required: true },
  { key: 'country', label: 'Country code', required: true },
];

type ShippingDiagnostic = { source?: string; code?: string; text?: string; type?: string };
type ShippingWorkflowError = { message: string; code?: string; diagnostics: ShippingDiagnostic[] };

export function ShippingWorkflow({ order, onComplete }: { order: Order; onComplete: () => void | Promise<void> }) {
  const [parcel, setParcel] = useState({ length: '8', width: '6', height: '4', weight: '1', distanceUnit: 'in', massUnit: 'lb' });
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [selectedRateId, setSelectedRateId] = useState('');
  const [acceptedCorrection, setAcceptedCorrection] = useState(false);
  const [loading, setLoading] = useState<'quote' | 'purchase' | null>(null);
  const [addressDraft, setAddressDraft] = useState<ShippingAddress>(() => addressFromOrder(order));
  const [editingAddress, setEditingAddress] = useState(false);
  const [validationError, setValidationError] = useState<ShippingWorkflowError | null>(null);

  useEffect(() => {
    setQuote(null);
    setSelectedRateId('');
    setAcceptedCorrection(false);
    setAddressDraft(addressFromOrder(order));
    setEditingAddress(false);
    setValidationError(null);
  }, [order.id]);

  const errorMessage = (error: unknown) => error instanceof AdminOrderApiError ? error.message : 'Shipping operation failed. Please retry.';
  const updateParcel = (field: keyof typeof parcel, value: string) => setParcel(current => ({ ...current, [field]: value }));
  const updateAddress = (field: keyof ShippingAddress, value: string) => {
    setAddressDraft(current => ({ ...current, [field]: value }));
    setQuote(null);
    setSelectedRateId('');
    setAcceptedCorrection(false);
    setValidationError(null);
  };
  const resetAddress = () => {
    setAddressDraft(addressFromOrder(order));
    setQuote(null);
    setSelectedRateId('');
    setAcceptedCorrection(false);
    setValidationError(null);
  };

  const loadRates = async () => {
    setLoading('quote');
    try {
      const nextQuote = await requestShippingQuote(order.id, parcel, addressDraft);
      setQuote(nextQuote);
      setSelectedRateId(nextQuote.rates[0]?.id || '');
      setAcceptedCorrection(!nextQuote.addressChanged);
      setValidationError(null);
      setEditingAddress(false);
    } catch (error) {
      const message = errorMessage(error);
      if (error instanceof AdminOrderApiError && ['invalid_address', 'shipping_address_incomplete', 'validation_error', 'invalid_sender_address', 'no_shipping_rates'].includes(error.code || '')) {
        const detailKey = error.code === 'no_shipping_rates' ? 'carrierMessages' : 'validationMessages';
        const rawDiagnostics = error.details?.[detailKey];
        setValidationError({
          message,
          code: error.code,
          diagnostics: Array.isArray(rawDiagnostics) ? rawDiagnostics as ShippingDiagnostic[] : [],
        });
        if (['invalid_address', 'shipping_address_incomplete', 'validation_error'].includes(error.code || '')) {
          setEditingAddress(true);
        }
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(null);
    }
  };

  const purchase = async () => {
    if (!quote || !selectedRateId) return;
    setLoading('purchase');
    try {
      const result = await purchaseShippingLabel(order.id, { quoteId: quote.quoteId, rateId: selectedRateId, acceptCorrectedAddress: acceptedCorrection });
      if (result.partialFailure) toast.error(result.partialFailure, { duration: 7000 });
      else toast.success('Label created and shipment notification sent.');
      setQuote(null);
      await onComplete();
    } catch (error) {
      toast.error(errorMessage(error), { duration: 7000 });
    } finally {
      setLoading(null);
    }
  };

  if (order.labelUrl) {
    return (
      <div className="p-10 border-b border-white/5 space-y-5">
        <div className="flex items-center gap-3"><PackageCheck className="text-green-400" size={20} /><p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/50 font-black">Shipment Ready</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm text-brand-parchment/70">
          <p><span className="block text-[9px] uppercase text-brand-parchment/30">Service</span>{order.carrier} {order.shippingService}</p>
          <p><span className="block text-[9px] uppercase text-brand-parchment/30">Tracking</span>{order.trackingNumber}</p>
          <p><span className="block text-[9px] uppercase text-brand-parchment/30">Cost</span>${(order.shipmentCost || 0).toFixed(2)}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={order.labelUrl} target="_blank" rel="noreferrer" className="px-5 py-3 bg-brand-gold text-brand-black text-[10px] uppercase tracking-[0.2em] font-black inline-flex items-center gap-2">Print Label <ExternalLink size={13} /></a>
          {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="px-5 py-3 border border-brand-gold/30 text-brand-gold text-[10px] uppercase tracking-[0.2em] font-black inline-flex items-center gap-2">Track <ExternalLink size={13} /></a>}
        </div>
      </div>
    );
  }

  const fulfillmentStatus = order.fulfillmentStatus || order.status || 'pending';
  if (fulfillmentStatus !== 'packed') {
    return (
      <div className="p-10 border-b border-white/5 space-y-3">
        <div className="flex items-center gap-3"><PackageCheck className="text-brand-gold/60" size={20} /><p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/50 font-black">Pack Before Shipping</p></div>
        <p className="text-sm text-brand-parchment/50">Mark this order as packed before validating its address, requesting Shippo rates, or purchasing a label.</p>
      </div>
    );
  }

  return (
    <div className="p-10 border-b border-white/5 space-y-6">
      <div className="flex items-center gap-3"><Truck className="text-brand-gold" size={20} /><div><p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/50 font-black">Create Shippo Label</p><p className="text-sm text-brand-parchment/40">Validate the address, compare live services, then purchase once.</p></div></div>
      {order.shipmentException && <div className="border border-red-400/30 bg-red-400/5 p-5 text-sm text-red-200"><p className="font-black">Label purchase requires review</p><p className="mt-2">{order.shipmentException.message}</p><p className="mt-2 text-xs text-red-200/60">Quote {order.shipmentException.quoteId}. Check Shippo for this order before trying another label.</p></div>}
      {!quote ? (
        <>
          <div className="border border-white/10 bg-white/[0.015] p-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-brand-gold/50 font-black">Destination address</p>
                {!editingAddress && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-brand-parchment/70">{displayAddress(addressDraft)}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditingAddress(current => !current)} disabled={loading !== null} className="inline-flex items-center gap-2 px-4 py-2 border border-brand-gold/25 text-brand-gold text-[9px] uppercase tracking-[0.16em] font-black disabled:opacity-40">
                  <Pencil size={12} /> {editingAddress ? 'Done editing' : 'Edit address'}
                </button>
                <button type="button" onClick={resetAddress} disabled={loading !== null} className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 text-brand-parchment/60 text-[9px] uppercase tracking-[0.16em] font-black disabled:opacity-40">
                  <RotateCcw size={12} /> Reset
                </button>
              </div>
            </div>
            {validationError && (
              <div role="alert" className="flex items-start gap-3 border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <p className="font-black">
                    {validationError.code === 'invalid_sender_address'
                      ? 'The configured shipment origin needs attention.'
                      : validationError.code === 'no_shipping_rates'
                        ? 'No carrier returned a usable rate.'
                        : 'Shippo could not confirm one deliverable address.'}
                  </p>
                  <p className="mt-1 text-amber-100/75">{validationError.message}</p>
                  {validationError.diagnostics.length > 0 && (
                    <ul className="mt-3 space-y-2 text-xs text-amber-100/65">
                      {validationError.diagnostics.map((diagnostic, index) => (
                        <li key={`${diagnostic.source || 'shippo'}-${diagnostic.code || index}`} className="border-l border-amber-300/25 pl-3">
                          <span className="font-black text-amber-200">{diagnostic.source || 'Shippo'}{diagnostic.code ? ` · ${diagnostic.code}` : ''}</span>
                          {diagnostic.text && <span className="block mt-0.5">{diagnostic.text}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-amber-100/55">
                    {validationError.code === 'invalid_sender_address'
                      ? 'Update the SHIPPO_FROM_* deployment settings to a deliverable business or return address, then redeploy.'
                      : validationError.code === 'no_shipping_rates'
                        ? 'Review the carrier details above, USPS service levels, and whether the carrier is active in the same test account as the API token.'
                        : 'Check the street direction, apartment or suite, city, state, and postal code, then validate again.'}
                  </p>
                </div>
              </div>
            )}
            {editingAddress && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addressFields.map(field => (
                  <label key={field.key} className={`text-[9px] uppercase tracking-[0.18em] text-brand-parchment/40 ${field.className || ''}`}>
                    {field.label}{field.required ? ' *' : ''}
                    <input
                      value={addressDraft[field.key] || ''}
                      onChange={event => updateAddress(field.key, event.target.value)}
                      required={field.required}
                      autoComplete="off"
                      className="input-premium py-3 mt-2 normal-case tracking-normal"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['length', 'width', 'height', 'weight'] as const).map(field => <label key={field} className="text-[9px] uppercase tracking-[0.18em] text-brand-parchment/40">{field}<input type="number" min="0.01" step="0.01" value={parcel[field]} onChange={event => updateParcel(field, event.target.value)} className="input-premium py-3 mt-2" /></label>)}
          </div>
          <div className="flex gap-4">
            <select value={parcel.distanceUnit} onChange={event => updateParcel('distanceUnit', event.target.value)} className="input-premium py-3"><option value="in">Inches</option><option value="cm">Centimeters</option></select>
            <select value={parcel.massUnit} onChange={event => updateParcel('massUnit', event.target.value)} className="input-premium py-3"><option value="lb">Pounds</option><option value="oz">Ounces</option><option value="kg">Kilograms</option></select>
          </div>
          <button onClick={loadRates} disabled={loading !== null} className="px-5 py-3 bg-brand-gold text-brand-black text-[10px] uppercase tracking-[0.2em] font-black disabled:opacity-50">{loading === 'quote' ? 'Validating...' : validationError && ['invalid_address', 'shipping_address_incomplete', 'validation_error'].includes(validationError.code || '') ? 'Validate Corrected Address' : 'Validate & Get Rates'}</button>
        </>
      ) : (
        <>
          {quote.addressChanged && <div className="border border-amber-400/30 bg-amber-400/5 p-5 space-y-4"><p className="text-xs text-amber-300 font-black">Confirm the validated shipping address.</p><div className="grid md:grid-cols-2 gap-5 whitespace-pre-line text-sm text-brand-parchment/60"><div><span className="text-[9px] uppercase block text-brand-parchment/30">Checkout address</span>{displayAddress(quote.originalAddress)}</div><div><span className="text-[9px] uppercase block text-brand-parchment/30">Validated address</span>{displayAddress(quote.correctedAddress)}</div></div><label className="flex items-start gap-3 text-sm text-brand-parchment/70"><input type="checkbox" className="mt-1" checked={acceptedCorrection} onChange={event => setAcceptedCorrection(event.target.checked)} /> Use this validated address for the label and record the correction on the order</label></div>}
          <div className="space-y-3">{quote.rates.map(rate => <label key={rate.id} className={`block border p-4 cursor-pointer ${selectedRateId === rate.id ? 'border-brand-gold/50 bg-brand-gold/5' : 'border-white/10'}`}><input type="radio" className="mr-3" name="shipping-rate" checked={selectedRateId === rate.id} onChange={() => setSelectedRateId(rate.id)} /><span className="text-brand-parchment font-black">{rate.carrier} {rate.service}</span><span className="float-right text-brand-gold font-black">${rate.amount.toFixed(2)} {rate.currency}</span><span className="block ml-6 text-xs text-brand-parchment/40">{rate.estimatedDays ? `About ${rate.estimatedDays} days` : rate.durationTerms || 'Carrier estimate unavailable'}</span></label>)}</div>
          <div className="flex gap-3"><button onClick={() => setQuote(null)} disabled={loading !== null} className="px-5 py-3 border border-white/10 text-brand-parchment/60 text-[10px] uppercase tracking-[0.2em] font-black">Back</button><button onClick={purchase} disabled={loading !== null || !selectedRateId || !acceptedCorrection} className="px-5 py-3 bg-brand-gold text-brand-black text-[10px] uppercase tracking-[0.2em] font-black disabled:opacity-40">{loading === 'purchase' ? 'Purchasing Once...' : 'Purchase Label & Ship'}</button></div>
        </>
      )}
    </div>
  );
}
