import React, { useEffect, useMemo, useState } from 'react';
import { Search, PackageSearch, Mail, Phone, MapPin } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { AdminOrderApiError, runOrderCommand, type FulfillmentOperation } from '@/src/lib/adminOrders';
import { Order } from './DashboardView';
import toast from 'react-hot-toast';
import { ShippingWorkflow } from './ShippingWorkflow';
import { ReservationPanel } from './ReservationPanel';

interface OrdersViewProps {
  orders: Order[];
  onRefresh: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
}

const formatAddress = (address: Order['shippingAddress']) => {
  if (!address) return 'Shipping address not available yet.';

  return [address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country]
    .filter(Boolean)
    .join('\n');
};

export const OrdersView: React.FC<OrdersViewProps> = ({ orders, onRefresh, searchTerm, onSearchTermChange }) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [trackingNumberDraft, setTrackingNumberDraft] = useState('');
  const [trackingUrlDraft, setTrackingUrlDraft] = useState('');
  const [isSavingOps, setIsSavingOps] = useState(false);
  const [activeCommand, setActiveCommand] = useState<FulfillmentOperation | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || orders[0] || null,
    [orders, selectedOrderId]
  );
  const normalizedSearchTerm = searchTerm.trim();

  useEffect(() => {
    if (!orders.length) {
      setSelectedOrderId(null);
      return;
    }

    const hasSelectedOrder = selectedOrderId && orders.some((order) => order.id === selectedOrderId);
    if (!hasSelectedOrder) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

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
    <div className="space-y-10">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-premium p-5 space-y-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Visible Orders</p>
          <p className="text-2xl font-serif text-brand-parchment">{orders.length}</p>
        </div>
        <div className="card-premium p-5 space-y-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Needs Attention</p>
          <p className="text-2xl font-serif text-brand-parchment">
            {orders.filter((order) =>
              ['pending', 'needs_manual_intervention'].includes(order.fulfillmentStatus || order.status || 'pending')
            ).length}
          </p>
        </div>
        <div className="card-premium p-5 space-y-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Search Scope</p>
          <p className="text-sm text-brand-parchment/70">
            {normalizedSearchTerm ? `Filtering for "${normalizedSearchTerm}"` : 'Showing all recent orders'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-10">
        <div className="xl:col-span-2 card-premium overflow-hidden">
          <div className="max-h-[760px] overflow-y-auto divide-y divide-white/5">
            {orders.map((order) => {
              const orderStatus = order.fulfillmentStatus || order.status || 'pending';
              const totalAmount = order.totalAmount ?? 0;
              const isSelected = selectedOrder?.id === order.id;
              const paymentStatus = order.paymentStatus || 'unknown';

              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={cn(
                    'w-full text-left p-8 transition-all duration-300',
                    isSelected ? 'bg-brand-gold/[0.05]' : 'hover:bg-white/[0.02]'
                  )}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-mono text-brand-gold/60 tracking-wider">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-sm text-brand-parchment font-black">{order.customerName || order.customerEmail}</p>
                      <p className="text-[10px] text-brand-parchment/40 font-medium">{order.customerEmail}</p>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/25 font-black">
                        Payment: {paymentStatus.replaceAll('_', ' ')}
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      <p className="text-sm text-brand-parchment font-black">${totalAmount.toFixed(2)}</p>
                      <span className={cn(
                        'inline-flex items-center gap-2 px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.2em] font-black border',
                        orderStatus === 'delivered' ? 'bg-green-400/5 text-green-400 border-green-400/10' :
                        orderStatus === 'shipped' || orderStatus === 'packed' ? 'bg-blue-400/5 text-blue-400 border-blue-400/10' :
                        orderStatus === 'processing' ? 'bg-purple-400/5 text-purple-400 border-purple-400/10' :
                        orderStatus === 'needs_manual_intervention' ? 'bg-red-400/5 text-red-400 border-red-400/10' :
                        'bg-brand-gold/5 text-brand-gold border-brand-gold/10'
                      )}>
                        {orderStatus.replaceAll('_', ' ')}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
            {orders.length === 0 && (
              <div className="p-20 text-center space-y-4">
                <PackageSearch size={32} className="mx-auto text-brand-parchment/10" />
                <p className="text-[10px] uppercase tracking-widest text-brand-parchment/20 font-black">No orders match this search</p>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-3">
          {selectedOrder ? (
            <div className="card-premium h-full overflow-hidden">
              <div className="p-10 border-b border-white/5 bg-white/[0.01] flex flex-col lg:flex-row justify-between gap-8">
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold/50 font-black">Order Details</p>
                  <h3 className="text-3xl font-serif text-brand-parchment">#{selectedOrder.id.slice(0, 8).toUpperCase()}</h3>
                  <p className="text-brand-parchment/50 text-sm">
                    {selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date unavailable'}
                  </p>
                </div>
                <div className="space-y-3 max-w-sm">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Fulfillment Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {(['pack', 'cancel'] as const).map((operation) => (
                      <button
                        key={operation}
                        onClick={() => executeCommand(operation)}
                        disabled={activeCommand !== null}
                        className="px-4 py-2 border border-brand-gold/20 text-[9px] uppercase tracking-[0.18em] font-black text-brand-gold hover:bg-brand-gold/10 disabled:opacity-40"
                      >
                        {activeCommand === operation ? 'Working...' : operation}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-brand-parchment/40">Invalid transitions are rejected by the server.</p>
                </div>
              </div>

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

              <div className="p-10 border-b border-white/5">
                <div className="flex flex-col md:flex-row gap-8 md:gap-16">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Payment Status</p>
                    <p className="text-brand-parchment">{selectedOrder.paymentStatus || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Stripe Session</p>
                    <p className="text-brand-parchment/70 text-sm break-all">{selectedOrder.stripeSessionId || selectedOrder.id}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black mb-2">Payment Intent</p>
                    <p className="text-brand-parchment/70 text-sm break-all">{selectedOrder.stripePaymentIntentId || 'Not available'}</p>
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
                      placeholder="UPS / USPS / FedEx reference"
                      className="input-premium py-3"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Tracking URL</label>
                    <input
                      value={trackingUrlDraft}
                      onChange={(e) => setTrackingUrlDraft(e.target.value)}
                      placeholder="https://carrier.example/track/..."
                      className="input-premium py-3"
                    />
                  </div>
                </div>

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
                  <p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/40 font-black">Payment & Notifications</p>
                  <p className="text-sm text-brand-parchment/40">Refunds require a reason and cannot exceed the remaining paid amount.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} type="number" min="0.01" step="0.01" placeholder="Refund amount" className="input-premium py-3" />
                  <input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="Required refund reason" className="input-premium py-3" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={async () => {
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
                    onClick={() => executeCommand('notification-retry')}
                    disabled={activeCommand !== null}
                    className="px-5 py-3 rounded-sm border border-brand-gold/30 text-brand-gold text-[10px] uppercase tracking-[0.2em] font-black hover:bg-brand-gold/10 disabled:opacity-40"
                  >
                    {activeCommand === 'notification-retry' ? 'Sending...' : 'Retry Confirmation Email'}
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
