import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronDown, Search, PackageSearch, Mail, Phone, MapPin, Printer, ListChecks, Copy, Loader2, Download, BookmarkPlus, PackagePlus } from 'lucide-react';
import QRCode from 'qrcode';
import { cn } from '@/src/lib/utils';
import { AdminOrderApiError, exportAdminOrders, runOrderCommand, type AdminOrderQueryOptions, type FulfillmentOperation } from '@/src/lib/adminOrders';
import { Order } from './DashboardView';
import toast from 'react-hot-toast';
import { ShippingWorkflow } from './ShippingWorkflow';
import { ReservationPanel } from './ReservationPanel';
import { formatExceptionAge, getOrderExceptions, ORDER_EXCEPTION_LABELS, type OrderExceptionKind } from '@/src/lib/orderExceptions';
import { canIncludeInPickList } from '@/src/lib/fulfillmentDocuments';
import { FulfillmentPrintDocuments, type FulfillmentPrintJob } from './FulfillmentPrintDocuments';
import { orderReference } from '@/src/lib/orderReference';
import { BatchShippingLabels } from './BatchShippingLabels';
import { canBatchPack, summarizeOrderBatch } from '@/src/lib/adminOrderBatch';

export type OrderQueueFilter = 'all' | 'attention' | OrderExceptionKind;

interface OrdersViewProps {
  orders: Order[];
  onRefresh: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  query: AdminOrderQueryOptions;
  onQueryChange: (value: AdminOrderQueryOptions) => void;
  onDirtyChange?: (dirty: boolean) => void;
  discardEditsRevision?: number;
  queueFilter: OrderQueueFilter;
  onQueueFilterChange: (value: OrderQueueFilter) => void;
  initialSelectedOrderId?: string;
  refreshRevision?: number;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  queryError?: string | null;
  onRetry?: () => void;
  onLoadMore?: () => void;
}

const formatAddress = (address: Order['shippingAddress']) => {
  if (!address) return 'Shipping address not available yet.';

  return [address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country]
    .filter(Boolean)
    .join('\n');
};

const SAVED_ORDER_VIEWS_KEY = 'boanerges.admin.order-views.v1';

export const OrdersView: React.FC<OrdersViewProps> = ({ orders, onRefresh, searchTerm, onSearchTermChange, query, onQueryChange, onDirtyChange, discardEditsRevision = 0, queueFilter, onQueueFilterChange, initialSelectedOrderId, refreshRevision = 0, isLoading = false, isLoadingMore = false, hasMore = false, queryError = null, onRetry, onLoadMore }) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialSelectedOrderId || null);
  const [notesDraft, setNotesDraft] = useState('');
  const [trackingNumberDraft, setTrackingNumberDraft] = useState('');
  const [trackingUrlDraft, setTrackingUrlDraft] = useState('');
  const [isSavingOps, setIsSavingOps] = useState(false);
  const [activeCommand, setActiveCommand] = useState<FulfillmentOperation | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [cancelOrder, setCancelOrder] = useState(false);
  const [voidLabel, setVoidLabel] = useState(false);
  const [acknowledgeShipped, setAcknowledgeShipped] = useState(false);
  const [cancelQuantities, setCancelQuantities] = useState<Record<string, string>>({});
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [selectedPrintOrderIds, setSelectedPrintOrderIds] = useState<Set<string>>(new Set());
  const [printJob, setPrintJob] = useState<FulfillmentPrintJob | null>(null);
  const [savedViews, setSavedViews] = useState<Array<{ id: string; name: string; query: AdminOrderQueryOptions }>>([]);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState('');
  const [batchResult, setBatchResult] = useState<{ succeeded: string[]; failed: Array<{ id: string; message: string }> } | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [showBatchLabels, setShowBatchLabels] = useState(false);
  const [exporting, setExporting] = useState(false);

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
  const remainingRefundAmount = Math.max(0, Number(((selectedOrder?.totalAmount || 0) - (selectedOrder?.refundedAmount || 0)).toFixed(2)));
  const shipmentStarted = ['in_transit', 'delayed', 'delivered', 'exception', 'returned', 'failure'].includes(selectedOrder?.shipmentStatus || 'not_shipped');
  const hasUnusedLabel = Boolean(selectedOrder?.shippoTransactionId) && !shipmentStarted;
  const retryNotificationType = selectedOrder?.latestTransactionalEmail?.status === 'failed'
    ? selectedOrder.latestTransactionalEmail.type
    : selectedOrder?.refundEmailStatus === 'failed' ? 'refund'
      : selectedOrder?.shipmentEmailStatus === 'failed' ? 'shipment' : 'confirmation';
  const hasUnsavedEdits = Boolean(selectedOrder) && (
    notesDraft !== (selectedOrder?.adminNotes || '')
    || trackingNumberDraft !== (selectedOrder?.trackingNumber || '')
    || trackingUrlDraft !== (selectedOrder?.trackingUrl || '')
  );

  const copyOrderReference = async () => {
    if (!selectedOrder) return;
    try {
      await navigator.clipboard.writeText(orderReference(selectedOrder.id, selectedOrder.orderReference));
      toast.success('Order reference copied.');
    } catch {
      toast.error('Could not copy the order reference.');
    }
  };

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

  useEffect(() => {
    if (discardEditsRevision > 0) {
      setNotesDraft(selectedOrder?.adminNotes || '');
      setTrackingNumberDraft(selectedOrder?.trackingNumber || '');
      setTrackingUrlDraft(selectedOrder?.trackingUrl || '');
    }
  }, [discardEditsRevision]);

  useEffect(() => {
    onDirtyChange?.(hasUnsavedEdits);
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedEdits) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      onDirtyChange?.(false);
    };
  }, [hasUnsavedEdits, onDirtyChange]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVED_ORDER_VIEWS_KEY) || '[]');
      if (Array.isArray(parsed)) setSavedViews(parsed.filter(view => view && typeof view.id === 'string' && typeof view.name === 'string' && view.query));
    } catch {
      setSavedViews([]);
    }
  }, []);

  useEffect(() => {
    setRefundAmount('');
    setRefundReason('');
    setCancelOrder(false);
    setVoidLabel(false);
    setAcknowledgeShipped(false);
    setCancelQuantities({});
    setRefundConfirmed(false);
  }, [selectedOrder?.id]);

  useEffect(() => {
    if (!printJob) return;
    const clearPrintJob = () => setPrintJob(null);
    window.addEventListener('afterprint', clearPrintJob, { once: true });
    let cancelled = false;
    const prepareAndPrint = async () => {
      const images = [...document.querySelectorAll<HTMLImageElement>('.admin-print-root img')];
      await Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      })));
      await document.fonts?.ready;
      if (!cancelled) window.print();
    };
    const timer = window.setTimeout(() => void prepareAndPrint(), 50);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', clearPrintJob);
    };
  }, [printJob]);

  const printPackingSlip = async () => {
    if (!selectedOrder) return;
    try {
      const adminUrl = new URL('/admin', window.location.origin);
      adminUrl.searchParams.set('tab', 'orders');
      adminUrl.searchParams.set('order', selectedOrder.id);
      const qrDataUrl = await QRCode.toDataURL(adminUrl.toString(), { errorCorrectionLevel: 'M', margin: 1, width: 320 });
      setPrintJob({ type: 'packing-slip', order: selectedOrder, qrDataUrl });
    } catch (error) {
      console.error('Unable to prepare packing slip:', error);
      toast.error('The packing slip could not be prepared.');
    }
  };

  const printSelectedPickList = () => {
    const selectedOrders = orders.filter(order => selectedPrintOrderIds.has(order.id) && canIncludeInPickList(order));
    if (!selectedOrders.length) {
      toast.error('Select at least one order with quantities left to fulfill.');
      return;
    }
    setPrintJob({ type: 'pick-list', orders: selectedOrders });
  };

  const printSelectedPackingSlips = async () => {
    const selectedOrders = orders.filter(order => selectedPrintOrderIds.has(order.id));
    if (!selectedOrders.length) return toast.error('Select at least one order.');
    try {
      const entries = await Promise.all(selectedOrders.map(async order => {
        const adminUrl = new URL('/admin', window.location.origin);
        adminUrl.searchParams.set('tab', 'orders');
        adminUrl.searchParams.set('order', order.id);
        return { order, qrDataUrl: await QRCode.toDataURL(adminUrl.toString(), { errorCorrectionLevel: 'M', margin: 1, width: 320 }) };
      }));
      setPrintJob({ type: 'packing-slips', entries });
    } catch {
      toast.error('The selected packing slips could not be prepared.');
    }
  };

  const openSelectedLabels = () => {
    const labelOrders = orders.filter(order => selectedPrintOrderIds.has(order.id) && order.labelUrl);
    if (!labelOrders.length) return toast.error('None of the selected orders has an existing label.');
    if (labelOrders.length > 20) return toast.error('Open no more than 20 label PDFs at once. Narrow the selection and retry.');
    if (!window.confirm(`Open ${labelOrders.length} shipping-label ${labelOrders.length === 1 ? 'PDF' : 'PDFs'} in new tabs for printing? Your browser may ask permission for multiple tabs.`)) return;
    const opened = labelOrders.reduce((count, order) => {
      const tab = window.open(order.labelUrl, '_blank');
      if (!tab) return count;
      tab.opener = null;
      return count + 1;
    }, 0);
    if (opened < labelOrders.length) toast.error(`${labelOrders.length - opened} label tabs were blocked by the browser.`);
  };

  const openBatchLabels = () => {
    if (!confirmDiscardEdits()) return;
    if (selectedPrintOrderIds.size > 20) return toast.error('Create no more than 20 shipping labels per batch. Narrow the selection and retry.');
    setShowBatchLabels(true);
  };

  const describeError = (error: unknown) => {
    if (error instanceof AdminOrderApiError) return error.message;
    return 'The operation could not be completed. Please retry.';
  };

  const discardDrafts = () => {
    setNotesDraft(selectedOrder?.adminNotes || '');
    setTrackingNumberDraft(selectedOrder?.trackingNumber || '');
    setTrackingUrlDraft(selectedOrder?.trackingUrl || '');
  };

  const confirmDiscardEdits = () => {
    if (!hasUnsavedEdits) return true;
    if (!window.confirm('Discard unsaved order notes or shipment edits?')) return false;
    discardDrafts();
    return true;
  };

  const updateQuery = (changes: Partial<AdminOrderQueryOptions>) => {
    if (!confirmDiscardEdits()) return;
    onQueryChange({ ...query, ...changes });
    setSelectedPrintOrderIds(new Set());
    setBatchResult(null);
  };

  const copyValue = async (label: string, value: string) => {
    if (!value.trim()) return toast.error(`${label} is not available.`);
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`${label} could not be copied.`);
    }
  };

  const persistSavedViews = (views: typeof savedViews) => {
    setSavedViews(views);
    localStorage.setItem(SAVED_ORDER_VIEWS_KEY, JSON.stringify(views));
  };

  const saveCurrentView = () => {
    const name = viewName.trim();
    if (!name) return;
    const next = [...savedViews.filter(view => view.name.toLowerCase() !== name.toLowerCase()), { id: crypto.randomUUID(), name, query }].slice(-12);
    persistSavedViews(next);
    setViewName('');
    setSavingView(false);
    toast.success('Order view saved on this browser.');
  };

  const runBatchPack = async () => {
    if (!confirmDiscardEdits()) return;
    const selected = orders.filter(order => selectedPrintOrderIds.has(order.id));
    const eligible = selected.filter(canBatchPack);
    if (!eligible.length) return toast.error('Select at least one paid order that is ready to pack.');
    if (!window.confirm(`Mark ${eligible.length} ${eligible.length === 1 ? 'order' : 'orders'} as packed? ${selected.length - eligible.length || 'No'} ineligible selections will be skipped.`)) return;
    setBatchBusy(true);
    const settled = await Promise.allSettled(eligible.map(order => runOrderCommand(order.id, 'pack')));
    const result = summarizeOrderBatch(eligible, settled, describeError);
    setBatchResult(result);
    setBatchBusy(false);
    setSelectedPrintOrderIds(new Set(result.failed.map(item => item.id)));
    if (result.failed.length) toast.error(`${result.succeeded.length} packed; ${result.failed.length} failed. Review the batch report.`);
    else toast.success(`${result.succeeded.length} ${result.succeeded.length === 1 ? 'order' : 'orders'} packed.`);
    await onRefresh();
  };

  const exportOrders = async () => {
    const selectedIds = [...selectedPrintOrderIds];
    if (!window.confirm(`Export ${selectedIds.length ? `${selectedIds.length} selected orders` : 'every order matching the current server filters'}? The CSV contains customer contact and shipping information.`)) return;
    setExporting(true);
    try {
      const { blob, filename } = await exportAdminOrders({ search: searchTerm, query, orderIds: selectedIds });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Order CSV downloaded.');
    } catch (error) {
      toast.error(describeError(error));
    } finally {
      setExporting(false);
    }
  };

  const executeCommand = async (operation: FulfillmentOperation, payload: Record<string, unknown> = {}) => {
    if (!selectedOrder) return false;
    setActiveCommand(operation);
    try {
      const result = await runOrderCommand(selectedOrder.id, operation, payload);
      if (result.partialFailure) toast.error(String(result.partialFailure), { duration: 8000 });
      else toast.success(operation === 'notification-retry' ? 'Notification sent.' : 'Order updated.');
      await onRefresh();
      return result;
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
      <FulfillmentPrintDocuments job={printJob} />
      {showBatchLabels && <BatchShippingLabels orders={orders.filter(order => selectedPrintOrderIds.has(order.id))} onClose={() => setShowBatchLabels(false)} onComplete={async () => { setSelectedPrintOrderIds(new Set()); await onRefresh(); }} />}
      <ReservationPanel refreshRevision={refreshRevision} />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-2xl font-serif text-brand-parchment">Order Fulfillment</h3>
          <p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/50 font-black">Search by order reference, id, email, customer name, or tracking number</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-parchment/20" size={14} />
            <input
              value={searchTerm}
              onChange={(e) => { if (confirmDiscardEdits()) { onSearchTermChange(e.target.value); setSelectedPrintOrderIds(new Set()); setBatchResult(null); } }}
              placeholder="Search orders..."
              className="bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-5 text-[11px] uppercase tracking-[0.2em] text-brand-parchment w-full md:w-80"
            />
          </div>
          {normalizedSearchTerm && (
            <button
              onClick={() => { if (confirmDiscardEdits()) { onSearchTermChange(''); setSelectedPrintOrderIds(new Set()); setBatchResult(null); } }}
              className="px-4 py-3 rounded-full border border-white/10 text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/60 hover:text-brand-gold hover:border-brand-gold/40 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-premium p-5 space-y-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Loaded Orders</p>
          <p className="text-2xl font-serif text-brand-parchment">{visibleOrders.length}</p>
        </div>
        <button onClick={() => { if (confirmDiscardEdits()) onQueueFilterChange('attention'); }} className={cn('card-premium p-5 space-y-2 text-left hover:border-red-400/30 transition-colors', queueFilter === 'attention' && 'border-red-400/40 bg-red-400/[0.04]')}>
          <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Needs Attention</p>
          <p className="text-2xl font-serif text-brand-parchment">
            {ordersWithExceptions.filter(item => item.exceptions.length > 0).length}
          </p>
        </button>
      </div>

      <section className="card-premium p-5 lg:p-6 space-y-5" aria-label="Server order filters">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 text-[9px] font-black uppercase tracking-[0.18em] text-brand-parchment/35">Quick queues</p>
          <button type="button" onClick={() => updateQuery({ fulfillmentStatus: 'pending', paymentStatus: 'paid', shipmentStatus: '', carrier: '', dateState: 'all', sort: 'oldest' })} className="border border-white/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-brand-parchment/55 hover:border-brand-gold/30 hover:text-brand-gold">Ready to pack</button>
          <button type="button" onClick={() => updateQuery({ fulfillmentStatus: 'packed', paymentStatus: 'paid', shipmentStatus: '', carrier: '', dateState: 'all', sort: 'oldest' })} className="border border-white/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-brand-parchment/55 hover:border-brand-gold/30 hover:text-brand-gold">Ready to ship</button>
          <button type="button" onClick={() => updateQuery({ fulfillmentStatus: '', paymentStatus: '', shipmentStatus: 'in_transit', carrier: '', dateState: 'all', sort: 'oldest' })} className="border border-white/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-brand-parchment/55 hover:border-brand-gold/30 hover:text-brand-gold">In transit</button>
          <button type="button" onClick={() => updateQuery({ fulfillmentStatus: '', paymentStatus: '', shipmentStatus: '', carrier: '', dateState: 'all', sort: 'newest' })} className="ml-auto border border-white/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-brand-parchment/45 hover:text-brand-gold">Reset filters</button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {([
            ['fulfillmentStatus', 'Fulfillment', [['', 'All'], ['pending', 'Pending'], ['requires_attention', 'Needs attention'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['cancelled', 'Cancelled']]],
            ['paymentStatus', 'Payment', [['', 'All'], ['paid', 'Paid'], ['partially_refunded', 'Partially refunded'], ['refunded', 'Refunded'], ['failed', 'Failed']]],
            ['shipmentStatus', 'Shipment', [['', 'All'], ['not_shipped', 'Not shipped'], ['pre_transit', 'Pre-transit'], ['in_transit', 'In transit'], ['delayed', 'Delayed'], ['delivered', 'Delivered'], ['exception', 'Exception'], ['returned', 'Returned']]],
            ['carrier', 'Carrier', [['', 'All'], ['USPS', 'USPS'], ['UPS', 'UPS'], ['FedEx', 'FedEx'], ['DHL', 'DHL']]],
            ['dateState', 'Order age', [['all', 'Any date'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['older30', 'Older than 30 days']]],
            ['sort', 'Sort', [['newest', 'Newest first'], ['oldest', 'Oldest first']]],
          ] as Array<[keyof AdminOrderQueryOptions, string, Array<[string, string]>]>).map(([key, label, options]) => <label key={key} className="text-[8px] font-black uppercase tracking-[0.15em] text-brand-parchment/35">{label}<select value={query[key]} onChange={event => updateQuery({ [key]: event.target.value } as Partial<AdminOrderQueryOptions>)} className="input-premium mt-2 min-h-11 py-2 normal-case tracking-normal">{options.map(([value, text]) => <option key={value || 'all'} value={value}>{text}</option>)}</select></label>)}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-5">
          {savedViews.map(view => <div key={view.id} className="inline-flex border border-brand-gold/20"><button type="button" onClick={() => updateQuery(view.query)} className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-brand-gold hover:bg-brand-gold/10">{view.name}</button><button type="button" aria-label={`Delete saved view ${view.name}`} onClick={() => persistSavedViews(savedViews.filter(item => item.id !== view.id))} className="border-l border-brand-gold/20 px-2 text-brand-parchment/35 hover:text-red-300">×</button></div>)}
          {!savingView ? <button type="button" onClick={() => setSavingView(true)} className="inline-flex items-center gap-2 border border-white/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-brand-parchment/55 hover:text-brand-gold"><BookmarkPlus size={13} /> Save current view</button> : <div className="flex flex-wrap gap-2"><input autoFocus value={viewName} onChange={event => setViewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveCurrentView(); }} maxLength={40} placeholder="View name" className="input-premium min-h-11 py-2" /><button type="button" onClick={saveCurrentView} disabled={!viewName.trim()} className="bg-brand-gold px-4 text-[9px] font-black uppercase tracking-[0.14em] text-brand-black disabled:opacity-40">Save</button><button type="button" onClick={() => { setSavingView(false); setViewName(''); }} className="px-3 text-[9px] font-black uppercase text-brand-parchment/45">Cancel</button></div>}
        </div>
      </section>

      {queryError && (
        <div role="alert" className="flex flex-col gap-3 border border-amber-400/25 bg-amber-400/[0.06] p-5 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <p>{queryError}</p>
          <button type="button" onClick={onRetry} className="min-h-11 shrink-0 border border-amber-300/30 px-5 py-3 text-[9px] font-black uppercase tracking-[0.18em] hover:bg-amber-300/10">Retry order query</button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Order exception filters">
        {([
          ['all', 'All', orders.length],
          ['attention', 'Needs attention', ordersWithExceptions.filter(item => item.exceptions.length > 0).length],
          ...Object.entries(ORDER_EXCEPTION_LABELS).map(([kind, label]) => [kind, label, exceptionCounts[kind as OrderExceptionKind] || 0]),
        ] as Array<[OrderQueueFilter, string, number]>).filter(([kind, , count]) => kind === 'all' || kind === 'attention' || count > 0).map(([kind, label, count]) => (
          <button key={kind} onClick={() => { if (confirmDiscardEdits()) onQueueFilterChange(kind); }} className={cn('shrink-0 px-4 py-2 border text-[9px] uppercase tracking-[0.16em] font-black transition-colors', queueFilter === kind ? 'bg-brand-gold text-brand-black border-brand-gold' : 'border-white/10 text-brand-parchment/45 hover:text-brand-gold hover:border-brand-gold/30')}>
            {label} · {count}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-4 border border-white/10 bg-white/[0.015] p-5 lg:flex-row lg:items-center lg:justify-between" aria-label="Batch order actions">
        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-gold">Batch actions</p><p className="mt-1 text-xs text-brand-parchment/45">{selectedPrintOrderIds.size} selected. Actions validate every order independently.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void runBatchPack()} disabled={batchBusy || selectedPrintOrderIds.size === 0} className="inline-flex min-h-11 items-center gap-2 border border-blue-400/25 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-blue-300 disabled:opacity-30"><PackagePlus size={14} /> Mark packed</button>
          <button type="button" onClick={openBatchLabels} disabled={batchBusy || selectedPrintOrderIds.size === 0} className="inline-flex min-h-11 items-center gap-2 border border-brand-gold/30 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-brand-gold disabled:opacity-30"><PackagePlus size={14} /> Create labels</button>
          <button type="button" onClick={openSelectedLabels} disabled={selectedPrintOrderIds.size === 0} className="inline-flex min-h-11 items-center gap-2 border border-white/15 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-brand-parchment/65 disabled:opacity-30"><Printer size={14} /> Open labels</button>
          <button type="button" onClick={() => void printSelectedPackingSlips()} disabled={selectedPrintOrderIds.size === 0} className="inline-flex min-h-11 items-center gap-2 border border-white/15 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-brand-parchment/65 disabled:opacity-30"><Printer size={14} /> Packing slips</button>
          <button type="button" onClick={printSelectedPickList} disabled={selectedPrintOrderIds.size === 0} className="inline-flex min-h-11 items-center gap-2 border border-brand-gold/30 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-brand-gold disabled:opacity-30"><ListChecks size={14} /> Print pick list</button>
          <button type="button" onClick={() => void exportOrders()} disabled={exporting} className="inline-flex min-h-11 items-center gap-2 bg-brand-gold px-4 text-[9px] font-black uppercase tracking-[0.14em] text-brand-black disabled:opacity-50">{exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {selectedPrintOrderIds.size ? 'Export selected' : 'Export filtered'}</button>
        </div>
      </section>

      {batchResult && <div role="status" className={cn('border p-5 text-sm', batchResult.failed.length ? 'border-amber-400/25 bg-amber-400/[0.05] text-amber-100' : 'border-green-400/20 bg-green-400/[0.04] text-green-100')}><p className="font-black">Batch complete: {batchResult.succeeded.length} succeeded, {batchResult.failed.length} failed.</p>{batchResult.failed.length > 0 && <ul className="mt-3 space-y-1 text-xs">{batchResult.failed.map(item => <li key={item.id}>{orderReference(item.id)} — {item.message}</li>)}</ul>}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] items-start gap-6">
        <div className={cn('min-w-0 self-start xl:sticky xl:top-32 card-premium overflow-hidden', isMobileDetailOpen ? 'hidden xl:block' : 'block')}>
          <div className="px-5 py-4 border-b border-white/5 space-y-3">
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] uppercase tracking-[0.22em] text-brand-gold/60 font-black">Order Queue</p><p className="text-xs text-brand-parchment/35">{normalizedSearchTerm ? `${visibleOrders.length} matching` : `${visibleOrders.length} shown`}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setSelectedPrintOrderIds(new Set(visibleOrders.map(order => order.id)))} className="text-[8px] uppercase tracking-[0.16em] font-black text-brand-parchment/45 hover:text-brand-gold">Select loaded</button>
              <button onClick={() => setSelectedPrintOrderIds(new Set(visibleOrders.filter(canIncludeInPickList).map(order => order.id)))} className="text-[8px] uppercase tracking-[0.16em] font-black text-brand-parchment/45 hover:text-brand-gold">Select fulfillable</button>
              {selectedPrintOrderIds.size > 0 && <button onClick={() => setSelectedPrintOrderIds(new Set())} className="text-[8px] uppercase tracking-[0.16em] font-black text-brand-parchment/45 hover:text-brand-gold">Clear</button>}
              <p className="ml-auto text-[8px] font-black uppercase tracking-[0.14em] text-brand-parchment/30">{selectedPrintOrderIds.size} selected</p>
            </div>
          </div>
          <div className="divide-y divide-white/5 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto">
            {isLoading && (
              <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-brand-gold">
                <Loader2 className="animate-spin" size={20} aria-hidden="true" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Loading matching orders</span>
              </div>
            )}
            {!isLoading && visibleOrderEntries.map(({ order, exceptions }) => {
              const orderStatus = order.fulfillmentStatus || 'pending';
              const totalAmount = order.totalAmount ?? 0;
              const isSelected = selectedOrder?.id === order.id;
              const paymentStatus = order.paymentStatus || 'unknown';

              return (
                <div key={order.id} className="relative">
                  <label className="absolute left-5 top-7 z-10 flex items-center" title="Select order for a batch action">
                    <input type="checkbox" checked={selectedPrintOrderIds.has(order.id)} onChange={event => setSelectedPrintOrderIds(current => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(order.id); else next.delete(order.id);
                      return next;
                    })} aria-label={`Select order ${order.id} for batch actions`} />
                  </label>
                  <button
                  onClick={() => { if (!confirmDiscardEdits()) return; setSelectedOrderId(order.id); setIsMobileDetailOpen(true); }}
                  className={cn(
                    'w-full text-left py-6 pr-6 pl-14 border-l-2 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 focus-visible:ring-inset',
                    isSelected ? 'bg-brand-gold/[0.07] border-l-brand-gold' : 'border-l-transparent hover:bg-white/[0.02]'
                  )}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 space-y-2">
                      <p className="text-xs font-mono text-brand-gold/60 tracking-wider">{orderReference(order.id, order.orderReference)}</p>
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
                </div>
              );
            })}
            {!isLoading && visibleOrders.length === 0 && !queryError && (
              <div className="p-20 text-center space-y-4">
                <PackageSearch size={32} className="mx-auto text-brand-parchment/10" />
                <p className="text-[10px] uppercase tracking-widest text-brand-parchment/30 font-black">{normalizedSearchTerm ? 'No orders match this search' : 'No orders are available in this queue'}</p>
                {normalizedSearchTerm && <button type="button" onClick={() => onSearchTermChange('')} className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-gold hover:text-brand-parchment">Clear search</button>}
              </div>
            )}
            {!isLoading && hasMore && (
              <div className="p-5 text-center">
                <button type="button" onClick={onLoadMore} disabled={isLoadingMore} className="inline-flex min-h-11 items-center justify-center gap-3 border border-brand-gold/30 px-6 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-brand-gold hover:bg-brand-gold/10 disabled:cursor-wait disabled:opacity-50">
                  {isLoadingMore && <Loader2 className="animate-spin" size={14} aria-hidden="true" />}
                  {isLoadingMore ? 'Loading more' : 'Load more orders'}
                </button>
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
                  <div className="flex items-center gap-3">
                    <h3 className="text-3xl font-serif text-brand-parchment">{orderReference(selectedOrder.id, selectedOrder.orderReference)}</h3>
                    <button type="button" onClick={copyOrderReference} className="inline-flex items-center gap-2 px-3 py-2 border border-white/10 text-[8px] uppercase tracking-[0.16em] font-black text-brand-parchment/50 hover:text-brand-gold hover:border-brand-gold/30" aria-label="Copy order reference"><Copy size={12} /> Copy</button>
                    <button type="button" onClick={() => void copyValue('Order ID', selectedOrder.id)} className="inline-flex items-center gap-2 px-3 py-2 border border-white/10 text-[8px] uppercase tracking-[0.16em] font-black text-brand-parchment/50 hover:text-brand-gold hover:border-brand-gold/30" aria-label="Copy internal order ID"><Copy size={12} /> ID</button>
                  </div>
                  <p className="text-brand-parchment/50 text-sm">
                    {selectedOrder.createdAt?.toDate
                      ? selectedOrder.createdAt.toDate().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : typeof selectedOrder.createdAt?.seconds === 'number'
                        ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Date unavailable'}
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
                    <button onClick={printPackingSlip} className="inline-flex items-center gap-2 px-4 py-2 border border-white/15 text-[9px] uppercase tracking-[0.18em] font-black text-brand-parchment/70 hover:text-brand-gold hover:border-brand-gold/30"><Printer size={13} /> Packing Slip</button>
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
                    {remainingRefundAmount > 0 && (
                      <button onClick={() => document.getElementById('refund-workflow')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="px-4 py-2 border border-red-400/20 text-[9px] uppercase tracking-[0.18em] font-black text-red-300 hover:bg-red-400/10">
                        Refund / Cancel
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
                    <div className="flex items-center gap-3"><a href={`mailto:${selectedOrder.customerEmail}`} className="flex min-w-0 items-center gap-3 text-brand-parchment/70 hover:text-brand-gold transition-colors">
                      <Mail size={14} />
                      {selectedOrder.customerEmail}
                    </a><button type="button" onClick={() => void copyValue('Email', selectedOrder.customerEmail || '')} aria-label="Copy customer email" className="p-2 text-brand-parchment/35 hover:text-brand-gold"><Copy size={12} /></button></div>
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
                  <button type="button" onClick={() => void copyValue('Shipping address', formatAddress(selectedOrder.shippingAddress))} className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-brand-parchment/40 hover:text-brand-gold"><Copy size={12} /> Copy address</button>
                </div>
              </div>

              {selectedOrder.orderType?.startsWith('subscription') && <div className="px-10 py-5 border-b border-brand-gold/20 bg-brand-gold/[0.04] flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.22em] text-brand-gold font-black">Subscribe &amp; Save</p><p className="mt-1 text-sm text-brand-parchment/60">{selectedOrder.orderType === 'subscription_renewal' ? 'Recurring renewal order' : 'Initial subscription order'}{selectedOrder.subscriptionCadence ? ` · ${selectedOrder.subscriptionCadence.replaceAll('_', ' ')}` : ''}</p></div><span className="text-xs font-mono text-brand-parchment/35">{selectedOrder.stripeSubscriptionId || 'Subscription ID pending'}</span></div>}

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
                    <div className="flex items-center justify-between gap-3"><label className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Tracking Number</label><button type="button" onClick={() => void copyValue('Tracking number', trackingNumberDraft)} className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] text-brand-parchment/35 hover:text-brand-gold"><Copy size={11} /> Copy</button></div>
                    <input
                      value={trackingNumberDraft}
                      onChange={(e) => setTrackingNumberDraft(e.target.value)}
                      readOnly={Boolean(selectedOrder.shippoTransactionId)}
                      placeholder="UPS / USPS / FedEx reference"
                      className="input-premium py-3 read-only:opacity-60 read-only:cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3"><label className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Tracking URL</label><button type="button" onClick={() => void copyValue('Tracking URL', trackingUrlDraft)} className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] text-brand-parchment/35 hover:text-brand-gold"><Copy size={11} /> Copy</button></div>
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

              <div id="refund-workflow" className="p-6 lg:p-10 border-b border-white/5 space-y-6 scroll-mt-40">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-brand-gold/40 font-black">Refund or Cancel</p>
                  <p className="text-sm text-brand-parchment/40">${remainingRefundAmount.toFixed(2)} remains refundable. Only quantities canceled before shipment are restored to inventory.</p>
                  <p className="text-xs text-brand-parchment/35">Order confirmation: {selectedOrder.resendEmailStatus || 'unknown'}{selectedOrder.labelUrl ? ` · Shipment email: ${selectedOrder.shipmentEmailStatus || 'unknown'}` : ''}{selectedOrder.latestTransactionalEmail ? ` · Latest ${selectedOrder.latestTransactionalEmail.type}: ${selectedOrder.latestTransactionalEmail.status}` : ''}</p>
                  {selectedOrder.latestTrackingStatus && <p className="text-xs text-brand-parchment/35">Carrier status: {selectedOrder.latestTrackingStatus.status}{selectedOrder.latestTrackingStatus.details ? ` — ${selectedOrder.latestTrackingStatus.details}` : ''}</p>}
                  {selectedOrder.labelRefundStatus && <p className="text-xs text-brand-parchment/35">Last label void: {selectedOrder.labelRefundStatus.replaceAll('_', ' ')}{selectedOrder.labelRefundError ? ` — ${selectedOrder.labelRefundError}` : ''}</p>}
                </div>
                {remainingRefundAmount > 0 ? <>
                  {shipmentStarted && (
                    <div className="border border-amber-400/30 bg-amber-400/[0.05] p-4 space-y-3">
                      <p className="text-sm font-black text-amber-300">This order has entered the carrier network.</p>
                      <p className="text-xs text-brand-parchment/55">You may refund the customer, but products cannot be canceled or returned to sellable inventory.</p>
                      <label className="flex items-start gap-3 text-sm text-brand-parchment/70"><input type="checkbox" checked={acknowledgeShipped} onChange={event => setAcknowledgeShipped(event.target.checked)} className="mt-1" /> I understand this refund will not restore inventory.</label>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="space-y-2"><span className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/35 font-black">Refund amount</span><input value={refundAmount} onChange={(event) => { setRefundAmount(event.target.value); setRefundConfirmed(false); }} type="number" min="0.01" max={remainingRefundAmount} step="0.01" placeholder={remainingRefundAmount.toFixed(2)} className="input-premium py-3" /></label>
                    <label className="space-y-2"><span className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/35 font-black">Required reason</span><input value={refundReason} onChange={(event) => { setRefundReason(event.target.value); setRefundConfirmed(false); }} placeholder="Damaged, incorrect, missing, or other resolution" className="input-premium py-3" /></label>
                  </div>
                  {!shipmentStarted && (
                    <div className="border border-white/10 p-5 space-y-4">
                      <div><p className="text-sm font-black text-brand-parchment">Cancel quantities</p><p className="text-xs text-brand-parchment/40">Select only units that will not ship. These units will be returned to available inventory.</p></div>
                      {(selectedOrder.items || []).filter((item: any) => item.productId && Number(item.quantity || 0) > Number(item.cancelledQuantity || 0)).map((item: any) => {
                        const remaining = Number(item.quantity || 0) - Number(item.cancelledQuantity || 0);
                        return <label key={item.productId} className="grid grid-cols-[1fr_90px] gap-4 items-center"><span className="text-sm text-brand-parchment/70">{item.name} <span className="text-brand-parchment/35">({remaining} available)</span></span><input type="number" min="0" max={remaining} step="1" value={cancelQuantities[item.productId] || '0'} onChange={event => { setCancelOrder(false); setCancelQuantities(current => ({ ...current, [item.productId]: event.target.value })); setRefundConfirmed(false); }} className="input-premium py-2" /></label>;
                      })}
                      <label className="flex items-start gap-3 text-sm text-brand-parchment/70"><input type="checkbox" checked={cancelOrder} onChange={event => {
                        const checked = event.target.checked;
                        setCancelOrder(checked);
                        if (checked) {
                          setRefundAmount(remainingRefundAmount.toFixed(2));
                          setCancelQuantities(Object.fromEntries((selectedOrder.items || []).filter((item: any) => item.productId).map((item: any) => [item.productId, String(Math.max(0, Number(item.quantity || 0) - Number(item.cancelledQuantity || 0)))])));
                          if (hasUnusedLabel) setVoidLabel(true);
                        }
                        setRefundConfirmed(false);
                      }} className="mt-1" /> Cancel the entire unshipped order and refund its full remaining balance.</label>
                      {hasUnusedLabel && <label className="flex items-start gap-3 text-sm text-brand-parchment/70"><input type="checkbox" checked={voidLabel} onChange={event => { setVoidLabel(event.target.checked); setRefundConfirmed(false); }} className="mt-1" /> Void the unused Shippo label before restoring inventory.</label>}
                    </div>
                  )}
                  <label className="flex items-start gap-3 border border-red-400/20 p-4 text-sm text-brand-parchment/70"><input type="checkbox" checked={refundConfirmed} onChange={event => setRefundConfirmed(event.target.checked)} className="mt-1" /> I confirm the amount, reason, canceled quantities, and label action. Stripe refunds cannot be undone.</label>
                  <div className="flex flex-wrap gap-3">
                  <button
                    onClick={async () => {
                      if (await executeCommand('refund', { amount: Number(refundAmount), reason: refundReason, cancelOrder, voidLabel, acknowledgeShipped, cancelQuantities: Object.fromEntries(Object.entries(cancelQuantities).map(([productId, quantity]) => [productId, Number(quantity)])) })) {
                        setRefundAmount('');
                        setRefundReason('');
                        setCancelOrder(false);
                        setVoidLabel(false);
                        setAcknowledgeShipped(false);
                        setCancelQuantities({});
                        setRefundConfirmed(false);
                      }
                    }}
                    disabled={activeCommand !== null || !refundConfirmed || !refundAmount || Number(refundAmount) <= 0 || Number(refundAmount) > remainingRefundAmount || !refundReason.trim() || (shipmentStarted && !acknowledgeShipped)}
                    className="px-5 py-3 rounded-sm border border-red-400/30 text-red-300 text-[10px] uppercase tracking-[0.2em] font-black hover:bg-red-400/10 disabled:opacity-40"
                  >
                    {activeCommand === 'refund' ? 'Refunding...' : 'Issue Refund'}
                  </button>
                  </div>
                </> : <p className="border border-white/10 p-4 text-sm text-brand-parchment/50">This order has no refundable balance remaining.</p>}
                <div className="flex flex-wrap gap-3 pt-2">
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
                          Qty {item.quantity} {item.cancelledQuantity ? `· Cancelled ${item.cancelledQuantity}` : ''} {item.sizeOz ? `- ${item.sizeOz}oz` : ''}{item.itemType === 'bundle' ? ' · Bundle' : ''}
                        </p>
                        {item.itemType === 'bundle' && Array.isArray(item.components) && <p className="text-xs text-brand-parchment/45">{item.components.map((component: any) => `${component.quantity}× ${component.name}`).join(' · ')}</p>}
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
