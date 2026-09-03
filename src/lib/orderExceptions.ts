export type OrderExceptionKind =
  | 'overdue_fulfillment'
  | 'inventory_conflict'
  | 'invalid_address'
  | 'payment_dispute'
  | 'email_failure'
  | 'label_failure'
  | 'tracking_gap'
  | 'carrier_exception'
  | 'refund_request';

export type OrderExceptionSeverity = 'critical' | 'high' | 'medium';

export interface OperationalOrderException {
  kind: OrderExceptionKind;
  severity: OrderExceptionSeverity;
  label: string;
  reason: string;
  recommendedAction: string;
  occurredAtMs: number;
  ageMs: number;
}

export interface ExceptionOrder {
  createdAt?: unknown;
  paidAt?: unknown;
  updatedAt?: unknown;
  shippedAt?: unknown;
  fulfillmentStatus?: string;
  paymentStatus?: string;
  shipmentStatus?: string;
  trackingNumber?: string;
  stripeDisputeId?: string;
  disputeStatus?: string;
  disputeReason?: string;
  error?: string;
  fulfillmentError?: string;
  inventoryConflict?: unknown;
  reservationException?: unknown;
  shippingAddressException?: ExceptionMarker;
  shipmentException?: ExceptionMarker;
  resendEmailStatus?: string;
  resendEmailError?: string;
  shipmentEmailStatus?: string;
  shipmentEmailError?: string;
  refundEmailStatus?: string;
  refundEmailError?: string;
  deliveredEmailStatus?: string;
  deliveredEmailError?: string;
  delayedEmailStatus?: string;
  delayedEmailError?: string;
  exceptionEmailStatus?: string;
  exceptionEmailError?: string;
  latestTransactionalEmail?: { type?: string; status?: string; error?: string; occurredAt?: unknown };
  refundRequestStatus?: string;
  refundRequestedAt?: unknown;
  refundRequestReason?: string;
}

interface ExceptionMarker {
  status?: string;
  type?: string;
  code?: string;
  message?: string;
  occurredAt?: unknown;
  resolvedAt?: unknown;
}

export const ORDER_EXCEPTION_LABELS: Record<OrderExceptionKind, string> = {
  overdue_fulfillment: 'Overdue fulfillment',
  inventory_conflict: 'Inventory conflict',
  invalid_address: 'Invalid address',
  payment_dispute: 'Payment dispute',
  email_failure: 'Email failure',
  label_failure: 'Label failure',
  tracking_gap: 'Tracking gap',
  carrier_exception: 'Carrier exception',
  refund_request: 'Refund request',
};

const SEVERITY_ORDER: Record<OrderExceptionSeverity, number> = { critical: 0, high: 1, medium: 2 };
const RESOLVED_STATUSES = new Set(['resolved', 'closed', 'completed', 'succeeded', 'sent', 'won', 'lost', 'canceled', 'cancelled']);

export function timestampToMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object') {
    const timestamp = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
  }
  return null;
}

function isUnresolved(status?: string) {
  return !status || !RESOLVED_STATUSES.has(status.toLowerCase());
}

function messageFrom(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const marker = value as { message?: string; reason?: string; error?: string };
    return marker.message || marker.reason || marker.error || fallback;
  }
  return fallback;
}

export function getOrderExceptions(order: ExceptionOrder, now = Date.now(), fulfillmentDeadlineMs = 48 * 60 * 60 * 1000): OperationalOrderException[] {
  const createdAt = timestampToMillis(order.createdAt) ?? now;
  const paidAt = timestampToMillis(order.paidAt) ?? createdAt;
  const updatedAt = timestampToMillis(order.updatedAt) ?? createdAt;
  const occurred = (value?: unknown) => timestampToMillis(value) ?? updatedAt;
  const results: Omit<OperationalOrderException, 'ageMs'>[] = [];
  const add = (item: Omit<OperationalOrderException, 'ageMs'>) => results.push(item);
  const paymentReady = order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded';

  if (paymentReady && order.fulfillmentStatus === 'pending' && now - paidAt > fulfillmentDeadlineMs) {
    add({ kind: 'overdue_fulfillment', severity: 'high', label: ORDER_EXCEPTION_LABELS.overdue_fulfillment, reason: 'This paid order has not been packed within 48 hours.', recommendedAction: 'Review the order and pack it, or record why fulfillment is blocked.', occurredAtMs: paidAt + fulfillmentDeadlineMs });
  }

  const inventorySignal = order.inventoryConflict || order.reservationException || order.fulfillmentError || order.error;
  if (inventorySignal && /inventory|reservation|stock|oversold|quantity/i.test(messageFrom(inventorySignal, 'Inventory requires review.'))) {
    add({ kind: 'inventory_conflict', severity: 'critical', label: ORDER_EXCEPTION_LABELS.inventory_conflict, reason: messageFrom(inventorySignal, 'Reserved inventory could not be fulfilled.'), recommendedAction: 'Reconcile available stock, then retry or refund the affected items.', occurredAtMs: occurred((inventorySignal as ExceptionMarker)?.occurredAt) });
  }

  if (order.shippingAddressException && isUnresolved(order.shippingAddressException.status)) {
    add({ kind: 'invalid_address', severity: 'high', label: ORDER_EXCEPTION_LABELS.invalid_address, reason: messageFrom(order.shippingAddressException, 'The shipping address could not be validated.'), recommendedAction: 'Confirm or correct the customer address, then request rates again.', occurredAtMs: occurred(order.shippingAddressException.occurredAt) });
  }

  if (order.stripeDisputeId && isUnresolved(order.disputeStatus)) {
    add({ kind: 'payment_dispute', severity: 'critical', label: ORDER_EXCEPTION_LABELS.payment_dispute, reason: order.disputeReason ? `Stripe dispute: ${order.disputeReason}.` : 'An open Stripe payment dispute requires evidence or acceptance.', recommendedAction: 'Review the dispute in Stripe and submit evidence before its deadline.', occurredAtMs: updatedAt });
  }

  const failedEmail = [
    ['confirmation', order.resendEmailStatus, order.resendEmailError],
    ['shipment', order.shipmentEmailStatus, order.shipmentEmailError],
    ['refund', order.refundEmailStatus, order.refundEmailError],
    ['delivery', order.deliveredEmailStatus, order.deliveredEmailError],
    ['delay', order.delayedEmailStatus, order.delayedEmailError],
    ['carrier exception', order.exceptionEmailStatus, order.exceptionEmailError],
  ].find(([, status]) => status === 'failed');
  const latestFailed = order.latestTransactionalEmail?.status === 'failed' ? order.latestTransactionalEmail : null;
  if (failedEmail || latestFailed) {
    const emailType = latestFailed?.type || failedEmail?.[0] || 'transactional';
    const emailError = latestFailed?.error || failedEmail?.[2];
    add({ kind: 'email_failure', severity: 'medium', label: ORDER_EXCEPTION_LABELS.email_failure, reason: messageFrom(emailError, `The ${emailType} email was not delivered by the email provider.`), recommendedAction: 'Verify the customer email and use Retry Notification.', occurredAtMs: occurred(latestFailed?.occurredAt) });
  }

  if (['label_purchase', 'label_refund'].includes(order.shipmentException?.type || '') && isUnresolved(order.shipmentException?.status)) {
    const isRefund = order.shipmentException?.type === 'label_refund';
    add({ kind: 'label_failure', severity: 'high', label: ORDER_EXCEPTION_LABELS.label_failure, reason: messageFrom(order.shipmentException, isRefund ? 'The unused shipping label could not be voided.' : 'The shipping label purchase did not complete.'), recommendedAction: isRefund ? 'Review the refund in Shippo before restoring inventory or retrying.' : 'Check Shippo for an existing transaction before safely retrying the label.', occurredAtMs: occurred(order.shipmentException?.occurredAt) });
  }

  if (order.fulfillmentStatus === 'shipped' && !order.trackingNumber) {
    add({ kind: 'tracking_gap', severity: 'high', label: ORDER_EXCEPTION_LABELS.tracking_gap, reason: 'The order is marked shipped but has no tracking number.', recommendedAction: 'Add the carrier tracking number or verify the purchased label.', occurredAtMs: occurred(order.shippedAt) });
  }

  const shipmentIsException = order.shipmentStatus === 'exception' || order.shipmentStatus === 'failure' || order.shipmentStatus === 'returned' || order.shipmentStatus === 'delayed';
  if (shipmentIsException || (order.shipmentException?.type === 'carrier_exception' && isUnresolved(order.shipmentException.status))) {
    add({ kind: 'carrier_exception', severity: order.shipmentStatus === 'returned' ? 'critical' : 'high', label: ORDER_EXCEPTION_LABELS.carrier_exception, reason: messageFrom(order.shipmentException, `The carrier reported shipment status “${order.shipmentStatus || 'exception'}”.`), recommendedAction: 'Open tracking details, contact the carrier if needed, and update the customer.', occurredAtMs: occurred(order.shipmentException?.occurredAt) });
  }

  if ((order.refundRequestStatus && ['requested', 'pending', 'requires_review'].includes(order.refundRequestStatus)) || (order.refundRequestedAt && !order.refundRequestStatus)) {
    add({ kind: 'refund_request', severity: 'high', label: ORDER_EXCEPTION_LABELS.refund_request, reason: order.refundRequestReason || 'A customer refund request is awaiting review.', recommendedAction: 'Review the request and issue or decline the refund with a recorded reason.', occurredAtMs: occurred(order.refundRequestedAt) });
  }

  return results
    .map(item => ({ ...item, ageMs: Math.max(0, now - item.occurredAtMs) }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.ageMs - a.ageMs);
}

export function formatExceptionAge(ageMs: number) {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
