import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronDown, Search, PackageSearch, Mail, Phone, MapPin } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { AdminOrderApiError, runOrderCommand, type FulfillmentOperation } from '@/src/lib/adminOrders';
import { Order } from './DashboardView';
import toast from 'react-hot-toast';
import { ShippingWorkflow } from './ShippingWorkflow';
import { ReservationPanel } from './ReservationPanel';
import { formatExceptionAge, getOrderExceptions, ORDER_EXCEPTION_LABELS, type OrderExceptionKind } from '@/src/lib/orderExceptions';

export type OrderQueueFilter = 'all' | 'attention' | OrderExceptionKind;

interface OrdersViewProps {
  orders: Order[];
  onRefresh: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  queueFilter: OrderQueueFilter;
  onQueueFilterChange: (value: OrderQueueFilter) => void;
}

const formatAddress = (address: Order['shippingAddress']) => {
  if (!address) return 'Shipping address not available yet.';

  return [address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country]
    .filter(Boolean)
    .join('\n');
};

export const OrdersView: React.FC<OrdersViewProps> = ({ orders, onRefresh, searchTerm, onSearchTermChange, queueFilter, onQueueFilterChange }) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [trackingNumberDraft, setTrackingNumberDraft] = useState('');
  const [trackingUrlDraft, setTrackingUrlDraft] = useState('');
  const [isSavingOps, setIsSavingOps] = useState(false);
  const [activeCommand, setActiveCommand] = useState<FulfillmentOperation | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  const ordersWithExceptions = useMemo(() => orders.map(order => ({ order, exceptions: getOrderExceptions(order) })), [orders]);
  const exceptionCounts = useMemo(() => ordersWithExceptions.reduce((counts, item) => {
    for (const exception of item.exceptions) counts[exception.kind] = (counts[exception.kind] || 0) + 1;
    return counts;
  }, {} as Partial<Record<OrderExceptionKind, number>>), [ordersWithExceptions]);
  const visibleOrderEntries = useMemo(() => {
    const filtered = ordersWithExceptions.filter(item =>
      queueFilter === 'all' || (queueFilter === 'attention' ? item.exceptions.length > 0 : item.exceptions.some(value => value.kind === queueFilter))
    );
    if (queueFilter === 'all') return filtered;
    const severityRank = { critical: 0, high: 1, medium: 2 } as const;
    return [...filtered].sort((a, b) => {
      const aException = queueFilter === 'attention' ? a.exceptions[0] : a.exceptions.find(value => value.kind === queueFilter)!;
      const bException = queueFilter === 'attention' ? b.exceptions[0] : b.exceptions.find(value => value.kind === queueFilter)!;
      return severityRank[aException.severity] - severityRank[bException.severity] || bException.ageMs - aException.ageMs;
    });
  }, [ordersWithExceptions, queueFilter]);
  const visibleOrders = useMemo(() => visibleOrderEntries.map(item => item.order), [visibleOrderEntries]);
  const selectedOrder = useMemo(
    () => visibleOrders.find((order) => order.id === selectedOrderId) || visibleOrders[0] || null,
    [visibleOrders, selectedOrderId]
  );
  const selectedOrderExceptions = useMemo(() => selectedOrder ? getOrderExceptions(selectedOrder) : [], [selectedOrder]);
  const normalizedSearchTerm = searchTerm.trim();
  const selectedOrderStatus = selectedOrder?.fulfillmentStatus || 'pending';
  const canPackSelectedOrder = ['pending', 'requires_attention'].includes(selectedOrderStatus);
  const canCancelSelectedOrder = ['pending', 'packed', 'requires_attention'].includes(selectedOrderStatus);
  const retryNotificationType = selectedOrder?.latestTransactionalEmail?.status === 'failed'
    ? selectedOrder.latestTransactionalEmail.type
    : selectedOrder?.shipmentEmailStatus === 'failed' ? 'shipment' : 'confirmation';

  useEffect(() => {
    if (!visibleOrders.length) {
      setSelectedOrderId(null);
      return;
    }

    const hasSelectedOrder = selectedOrderId && visibleOrders.some((order) => order.id === selectedOrderId);
    if (!hasSelectedOrder) {
      setSelectedOrderId(visibleOrders[0].id);
    }
  }, [visibleOrders, selectedOrderId]);

  useEffect(() => {
    setNotesDraft(selectedOrder?.adminNotes || '');
    setTrackingNumberDraft(selectedOrder?.trackingNumber || '');
    setTrackingUrlDraft(selectedOrder?.trackingUrl || '');
  }, [selectedOrder?.id, selectedOrder?.adminNotes, selectedOrder?.trackingNumber, selectedOrder?.trackingUrl]);

  const describeError = (error: unknown) => {
    if (error instanceof AdminOrderApiError) return error.message;
    return 'The operation could not be completed. Please retry.';
  };

  const executeCommand = async (operation: FulfillmentOperation, payload: Record<string, unknown> = {}) => {
    if (!selectedOrder) return false;
    setActiveCommand(operation);
    try {
      await runOrderCommand(selectedOrder.id, operation, payload);
      toast.success(operation === 'notification-retry' ? 'Notification sent.' : 'Order updated.');
      await onRefresh();
      return true;
    } catch (error) {
      console.error(`Order ${operation} failed:`, error);
      toast.error(describeError(error));
      return false;
    } finally {
      setActiveCommand(null);
    }
  };

  const saveOperationsDetails = async () => {
    if (!selectedOrder) return;

    setIsSavingOps(true);
    try {
      await runOrderCommand(selectedOrder.id, 'tracking', {
        trackingNumber: trackingNumberDraft.trim(),
        trackingUrl: trackingUrlDraft.trim(),
      });
      await runOrderCommand(selectedOrder.id, 'notes', { adminNotes: notesDraft.trim() });
      toast.success('Order notes and tracking saved.');
      await onRefresh();
    } catch (error) {
      console.error('Error saving operations details:', error);
      toast.error(`${describeError(error)} Some details may have saved; refresh before retrying.`);
    } finally {
      setIsSavingOps(false);
    }
  };

  return (
    <div className="min-w-0 space-y-10">
      <ReservationPanel />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-2xl font-serif text-brand-parchment">Order Fulfillment</h3>
          <p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/50 font-black">Search by order id, customer name, or email</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-parchment/20" size={14} />
            <input
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Search orders..."
              className="bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-5 text-[11px] uppercase tracking-[0.2em] text-brand-parchment w-full md:w-80"
            />
          </div>
          {normalizedSearchTerm && (
            <button
              onClick={() => onSearchTermChange('')}
              className="px-4 py-3 rounded-full border border-white/10 text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/60 hover:text-brand-gold hover:border-brand-gold/40 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-premium p-5 space-y-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Visible Orders</p>
          <p className="text-2xl font-serif text-brand-parchment">{visibleOrders.length}</p>
        </div>
        <button onClick={() => onQueueFilterChange('attention')} className={cn('card-premium p-5 space-y-2 text-left hover:border-red-400/30 transition-colors', queueFilter === 'attention' && 'border-red-400/40 bg-red-400/[0.04]')}>
          <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Needs Attention</p>
          <p className="text-2xl font-serif text-brand-parchment">
            {ordersWithExceptions.filter(item => item.exceptions.length > 0).length}
          </p>
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Order exception filters">
        {([
          ['all', 'All', orders.length],
          ['attention', 'Needs attention', ordersWithExceptions.filter(item => item.exceptions.length > 0).length],
          ...Object.entries(ORDER_EXCEPTION_LABELS).map(([kind, label]) => [kind, label, exceptionCounts[kind as OrderExceptionKind] || 0]),
        ] as Array<[OrderQueueFilter, string, number]>).filter(([kind, , count]) => kind === 'all' || kind === 'attention' || count > 0).map(([kind, label, count]) => (
          <button key={kind} onClick={() => onQueueFilterChange(kind)} className={cn('shrink-0 px-4 py-2 border text-[9px] uppercase tracking-[0.16em] font-black transition-colors', queueFilter === kind ? 'bg-brand-gold text-brand-black border-brand-gold' : 'border-white/10 text-brand-parchment/45 hover:text-brand-gold hover:border-brand-gold/30')}>
            {label} · {count}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] items-start gap-6">
        <div className={cn('min-w-0 self-start xl:sticky xl:top-32 card-premium overflow-hidden', isMobileDetailOpen ? 'hidden xl:block' : 'block')}>
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-brand-gold/60 font-black">Order Queue</p>
            <p className="text-xs text-brand-parchment/35">{normalizedSearchTerm ? `${visibleOrders.length} matching` : `${visibleOrders.length} shown`}</p>
          </div>
          <div className="divide-y divide-white/5 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto">
            {visibleOrderEntries.map(({ order, exceptions }) => {
              const orderStatus = order.fulfillmentStatus || 'pending';
              const totalAmount = order.totalAmount ?? 0;
              const isSelected = selectedOrder?.id === order.id;
              const paymentStatus = order.paymentStatus || 'unknown';

              return (
                <button
                  key={order.id}
                  onClick={() => { setSelectedOrderId(order.id); setIsMobileDetailOpen(true); }}
                  className={cn(
                    'w-full text-left p-6 border-l-2 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 focus-visible:ring-inset',
                    isSelected ? 'bg-brand-gold/[0.07] border-l-brand-gold' : 'border-l-transparent hover:bg-white/[0.02]'
                  )}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 space-y-2">
                      <p className="text-xs font-mono text-brand-gold/60 tracking-wider">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="truncate text-sm text-brand-parchment font-black">{order.customerName || order.customerEmail}</p>
                      <p className="truncate text-[10px] text-brand-parchment/40 font-medium">{order.customerEmail}</p>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/25 font-black">
                        Payment: {paymentStatus.replaceAll('_', ' ')}
                      </p>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/25 font-black">Shipment: {(order.shipmentStatus || 'not_shipped').replaceAll('_', ' ')}</p>
                      {exceptions[0] && (
                        <div className={cn('mt-2 border-l-2 pl-3 space-y-1', exceptions[0].severity === 'critical' ? 'border-red-400' : exceptions[0].severity === 'high' ? 'border-amber-400' : 'border-blue-400')}>
                          <p className="text-[9px] uppercase tracking-[0.14em] text-amber-300 font-black">{exceptions[0].label} · {formatExceptionAge(exceptions[0].ageMs)}</p>
                          <p className="text-[10px] normal-case text-brand-parchment/50 line-clamp-2">{exceptions[0].reason}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right space-y-2">
                      <p className="text-sm text-brand-parchment font-black">${totalAmount.toFixed(2)}</p>
                      <span className={cn(
                        'inline-flex items-center gap-2 px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.2em] font-black border',
                        orderStatus === 'shipped' || orderStatus === 'packed' ? 'bg-blue-400/5 text-blue-400 border-blue-400/10' :
                        orderStatus === 'requires_attention' ? 'bg-red-400/5 text-red-400 border-red-400/10' :
                        'bg-brand-gold/5 text-brand-gold border-brand-gold/10'
                      )}>
                        Fulfillment: {orderStatus.replaceAll('_', ' ')}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
            {visibleOrders.length === 0 && (
              <div className="p-20 text-center space-y-4">
                <PackageSearch size={32} className="mx-auto text-brand-parchment/10" />
                <p className="text-[10px] uppercase tracking-widest text-brand-parchment/20 font-black">No orders match this queue</p>
              </div>
            )}
          </div>
        </div>

        <div className={cn('min-w-0', isMobileDetailOpen ? 'block' : 'hidden xl:block')}>
          {selectedOrder ? (
            <div className="card-premium overflow-visible">
              <div className="sticky top-28 z-20 p-6 lg:p-8 border-b border-white/10 bg-brand-black/95 backdrop-blur-xl flex flex-col lg:flex-row justify-between gap-6 shadow-xl">
                <div className="space-y-3">
                  <button onClick={() => setIsMobileDetailOpen(false)} className="xl:hidden inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-brand-gold font-black"><ArrowLeft size={14} /> Back to orders</button>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold/50 font-black">Order Details</p>
                  <h3 className="text-3xl font-serif text-brand-parchment">#{selectedOrder.id.slice(0, 8).toUpperCase()}</h3>
                  <p className="text-brand-parchment/50 text-sm">
                    {selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date unavailable'}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-3 py-1 border border-green-400/20 bg-green-400/5 text-green-300 text-[8px] uppercase tracking-[0.16em] font-black">Payment: {(selectedOrder.paymentStatus || 'unknown').replaceAll('_', ' ')}</span>
                    <span className="px-3 py-1 border border-blue-400/20 bg-blue-400/5 text-blue-300 text-[8px] uppercase tracking-[0.16em] font-black">Fulfillment: {selectedOrderStatus.replaceAll('_', ' ')}</span>
                    <span className="px-3 py-1 border border-brand-gold/20 bg-brand-gold/5 text-brand-gold text-[8px] uppercase tracking-[0.16em] font-black">Shipment: {(selectedOrder.shipmentStatus || 'not_shipped').replaceAll('_', ' ')}</span>
                  </div>
                </div>
                <div className="space-y-3 max-w-sm">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Fulfillment Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {canPackSelectedOrder && (
                      <button
                        onClick={() => executeCommand('pack')}
                        disabled={activeCommand !== null}
                        className="px-4 py-2 border border-brand-gold/20 text-[9px] uppercase tracking-[0.18em] font-black text-brand-gold hover:bg-brand-gold/10 disabled:opacity-40"
                      >
                        {activeCommand === 'pack' ? 'Working...' : 'Pack'}
                      </button>
                    )}
                    {selectedOrderStatus === 'packed' && <span className="px-4 py-2 border border-green-400/20 text-[9px] uppercase tracking-[0.18em] font-black text-green-300">Ready for Label</span>}
                    {canCancelSelectedOrder && (
                      <button onClick={() => executeCommand('cancel')} disabled={activeCommand !== null} className="px-4 py-2 border border-red-400/20 text-[9px] uppercase tracking-[0.18em] font-black text-red-300 hover:bg-red-400/10 disabled:opacity-40">
                        {activeCommand === 'cancel' ? 'Working...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-brand-parchment/40">Invalid transitions are rejected by the server.</p>
                </div>
              </div>

              {selectedOrderExceptions.length > 0 && (
                <section className="p-6 lg:p-8 border-b border-amber-400/20 bg-amber-400/[0.025] space-y-4" aria-label="Operational exceptions">
                  <div className="flex items-center gap-3 text-amber-300">
                    <AlertTriangle size={18} />
                    <h4 className="text-[10px] uppercase tracking-[0.24em] font-black">Operational exceptions</h4>
                  </div>
                  <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
                    {selectedOrderExceptions.map(exception => (
                      <div key={exception.kind} className="border border-white/10 bg-brand-black/40 p-4 space-y-2">
                        <div className="flex justify-between gap-4">
                          <p className="text-sm text-brand-parchment font-black">{exception.label}</p>
                          <span className={cn('text-[8px] uppercase tracking-[0.15em] font-black', exception.severity === 'critical' ? 'text-red-400' : exception.severity === 'high' ? 'text-amber-300' : 'text-blue-300')}>{exception.severity} · {formatExceptionAge(exception.ageMs)}</span>
                        </div>
                        <p className="text-xs text-brand-parchment/55">{exception.reason}</p>
                        <p className="text-xs text-brand-gold"><span className="font-black">Next:</span> {exception.recommendedAction}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10 border-b border-white/5">
                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/40 font-black">Customer</p>
                  <div className="space-y-3 text-brand-parchment">
                    <p className="font-black">{selectedOrder.customerName || 'Customer name unavailable'}</p>
                    <a href={`mailto:${selectedOrder.customerEmail}`} className="flex items-center gap-3 text-brand-parchment/70 hover:text-brand-gold transition-colors">
                      <Mail size={14} />
                      {selectedOrder.customerEmail}
                    </a>
                    <p className="flex items-center gap-3 text-brand-parchment/70">
                      <Phone size={14} />
                      {selectedOrder.customerPhone || 'Phone not provided'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/40 font-black">Shipping</p>
                  <p className="flex items-start gap-3 text-brand-parchment/70 whitespace-pre-line">
                    <MapPin size={14} className="mt-1 shrink-0" />
                    {formatAddress(selectedOrder.shippingAddress)}
                  </p>
                </div>
              </div>

              <ShippingWorkflow order={selectedOrder} onComplete={onRefresh} />

              <div className="p-6 lg:p-8 border-b border-white/5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Payment Status</p>
                    <p className="text-brand-parchment">{selectedOrder.paymentStatus || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Fulfillment Status</p>
                    <p className="text-brand-parchment">{selectedOrder.fulfillmentStatus || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Shipment Status</p>
                    <p className="text-brand-parchment">{selectedOrder.shipmentStatus || 'Not shipped'}</p>
                  </div>
                </div>
                {(selectedOrder.refundedAmount || selectedOrder.stripeDisputeId || selectedOrder.shippingMethod) && (
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Shipping Method</p>
                      <p className="text-brand-parchment/70 text-sm">{selectedOrder.shippingMethod || 'Standard Shipping'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Refunded</p>
                      <p className="text-brand-parchment/70 text-sm">${(selectedOrder.refundedAmount ?? 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Dispute</p>
                      <p className="text-brand-parchment/70 text-sm">
                        {selectedOrder.stripeDisputeId ? `${selectedOrder.disputeStatus || 'open'} ${selectedOrder.disputeReason ? `- ${selectedOrder.disputeReason}` : ''}` : 'None'}
                      </p>
                    </div>
                  </div>
                )}
                <details className="mt-6 border-t border-white/5 pt-5 group">
                  <summary className="list-none cursor-pointer inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-brand-parchment/40 hover:text-brand-gold font-black">
                    Payment technical details <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Stripe Session</p><p className="text-brand-parchment/60 text-xs break-all font-mono">{selectedOrder.stripeSessionId || selectedOrder.id}</p></div>
                    <div><p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Payment Intent</p><p className="text-brand-parchment/60 text-xs break-all font-mono">{selectedOrder.stripePaymentIntentId || 'Not available'}</p></div>
                  </div>
                </details>
              </div>

              <div className="p-10 border-b border-white/5 space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/40 font-black">Fulfillment Notes</p>
                    <p className="text-sm text-brand-parchment/40">Internal notes and shipment details for your team.</p>
                  </div>
                  <button
                    onClick={saveOperationsDetails}
                    disabled={isSavingOps}
                    className="px-5 py-3 rounded-sm bg-brand-gold text-brand-black text-[10px] uppercase tracking-[0.2em] font-black hover:bg-brand-parchment transition-colors disabled:opacity-70"
                  >
                    {isSavingOps ? 'Saving...' : 'Save Details'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Tracking Number</label>
                    <input
                      value={trackingNumberDraft}
                      onChange={(e) => setTrackingNumberDraft(e.target.value)}
                      readOnly={Boolean(selectedOrder.shippoTransactionId)}
                      placeholder="UPS / USPS / FedEx reference"
                      className="input-premium py-3 read-only:opacity-60 read-only:cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Tracking URL</label>
                    <input
                      value={trackingUrlDraft}
                      onChange={(e) => setTrackingUrlDraft(e.target.value)}
                      readOnly={Boolean(selectedOrder.shippoTransactionId)}
                      placeholder="https://carrier.example/track/..."
                      className="input-premium py-3 read-only:opacity-60 read-only:cursor-not-allowed"
                    />
                  </div>
                </div>

                {selectedOrder.shippoTransactionId && <p className="text-xs text-brand-parchment/35">Tracking was generated by Shippo and is read-only. Internal notes can still be updated.</p>}

                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Admin Notes</label>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={5}
                    placeholder="Packing instructions, issue follow-up, gift note verification, or fulfillment reminders..."
                    className="input-premium py-4 min-h-[140px] resize-y"
                  />
                </div>
              </div>

              <div className="p-10 border-b border-white/5 space-y-6">
                <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/40 font-black">Notifications & Refunds</p>
                  <p className="text-sm text-brand-parchment/40">Refunds require a reason and cannot exceed the remaining paid amount.</p>
                  <p className="text-xs text-brand-parchment/35">Order confirmation: {selectedOrder.resendEmailStatus || 'unknown'}{selectedOrder.labelUrl ? ` · Shipment email: ${selectedOrder.shipmentEmailStatus || 'unknown'}` : ''}{selectedOrder.latestTransactionalEmail ? ` · Latest ${selectedOrder.latestTransactionalEmail.type}: ${selectedOrder.latestTransactionalEmail.status}` : ''}</p>
                  {selectedOrder.latestTrackingStatus && <p className="text-xs text-brand-parchment/35">Carrier status: {selectedOrder.latestTrackingStatus.status}{selectedOrder.latestTrackingStatus.details ? ` — ${selectedOrder.latestTrackingStatus.details}` : ''}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} type="number" min="0.01" step="0.01" placeholder="Refund amount" className="input-premium py-3" />
                  <input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="Required refund reason" className="input-premium py-3" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Issue a $${Number(refundAmount).toFixed(2)} refund? This action cannot be undone here.`)) return;
                      if (await executeCommand('refund', { amount: Number(refundAmount), reason: refundReason })) {
                        setRefundAmount('');
                        setRefundReason('');
                      }
                    }}
                    disabled={activeCommand !== null || !refundAmount || !refundReason.trim()}
                    className="px-5 py-3 rounded-sm border border-red-400/30 text-red-300 text-[10px] uppercase tracking-[0.2em] font-black hover:bg-red-400/10 disabled:opacity-40"
                  >
                    {activeCommand === 'refund' ? 'Refunding...' : 'Issue Refund'}
                  </button>
                  <button
                    onClick={() => executeCommand('notification-retry', { notificationType: retryNotificationType })}
                    disabled={activeCommand !== null}
                    className="px-5 py-3 rounded-sm border border-brand-gold/30 text-brand-gold text-[10px] uppercase tracking-[0.2em] font-black hover:bg-brand-gold/10 disabled:opacity-40"
                  >
                    {activeCommand === 'notification-retry' ? 'Sending...' : `Retry ${retryNotificationType === 'confirmation' ? 'Confirmation' : retryNotificationType.charAt(0).toUpperCase() + retryNotificationType.slice(1)} Email`}
                  </button>
                </div>
              </div>

              <div className="p-10 space-y-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/40 font-black">Line Items</p>
                <div className="space-y-4">
                  {(selectedOrder.items || []).map((item: any, index: number) => (
                    <div key={`${item.productId || item.name}-${index}`} className="flex items-center justify-between gap-6 border border-white/5 rounded-sm p-5 bg-white/[0.01]">
                      <div className="space-y-1">
                        <p className="text-brand-parchment font-black">{item.name}</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">
                          Qty {item.quantity} {item.sizeOz ? `- ${item.sizeOz}oz` : ''}
                        </p>
                      </div>
                      <p className="text-brand-gold font-black">${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</p>
                    </div>
                  ))}
                  {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                    <div className="border border-dashed border-white/10 rounded-sm p-6 text-sm text-brand-parchment/40">
                      Line items are not available for this order yet.
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Subtotal</p>
                    <p className="text-brand-parchment font-black">${(selectedOrder.subtotalAmount ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Shipping</p>
                    <p className="text-brand-parchment font-black">${(selectedOrder.shippingAmount ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Tax</p>
                    <p className="text-brand-parchment font-black">${(selectedOrder.taxAmount ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Total</p>
                    <p className="text-brand-gold font-black text-xl">${(selectedOrder.totalAmount ?? 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-premium h-full flex flex-col items-center justify-center p-20 text-center space-y-6">
              <PackageSearch size={40} className="text-brand-gold/20" />
              <div className="space-y-2">
                <h3 className="text-3xl font-serif text-brand-parchment">Select an Order</h3>
                <p className="text-brand-parchment/30 text-sm">Choose an order from the list to review shipping, items, and payment details.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
