export const ADMIN_ORDER_CURSOR_TTL_MS = 2 * 60 * 60 * 1000;

type SearchableOrder = Record<string, unknown> & {
  id?: string;
  orderReference?: string;
  customerEmail?: string;
  customerName?: string;
  trackingNumber?: string;
};

export type AdminOrderFilterOptions = {
  fulfillmentStatus?: string;
  paymentStatus?: string;
  shipmentStatus?: string;
  carrier?: string;
  dateState?: 'all' | 'today' | '7d' | '30d' | 'older30';
};

type CursorPayload = { version: 1; orderId: string; expiresAt: number };

export class AdminOrderCursorError extends Error {
  constructor(public code: 'invalid_cursor' | 'expired_cursor') {
    super(code === 'expired_cursor' ? 'This order-results cursor has expired.' : 'This order-results cursor is invalid.');
  }
}

export function normalizeAdminOrderSearch(value: unknown) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function compact(value: string) {
  return value.replace(/[^a-z0-9]/g, '');
}

export function matchesAdminOrderSearch(order: SearchableOrder, rawQuery: string) {
  const query = normalizeAdminOrderSearch(rawQuery);
  if (!query) return true;

  const candidates = [order.id, order.orderReference, order.customerEmail, order.customerName, order.trackingNumber]
    .map(normalizeAdminOrderSearch)
    .filter(Boolean);
  if (candidates.some(value => value.includes(query))) return true;

  const compactQuery = compact(query);
  return compactQuery.length > 0 && candidates.some(value => compact(value).includes(compactQuery));
}

function timestampMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object') {
    const timestamp = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
    if (typeof timestamp._seconds === 'number') return timestamp._seconds * 1000;
  }
  const parsed = typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function startOfDayInTimeZone(now: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const partsAt = (value: number) => Object.fromEntries(formatter.formatToParts(value).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  const today = partsAt(now);
  const desiredUtc = Date.UTC(today.year, today.month - 1, today.day);
  let guess = desiredUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rendered = partsAt(guess);
    guess += desiredUtc - Date.UTC(rendered.year, rendered.month - 1, rendered.day, rendered.hour, rendered.minute, rendered.second);
  }
  return guess;
}

export function matchesAdminOrderFilters(order: SearchableOrder, filters: AdminOrderFilterOptions, now = Date.now()) {
  for (const field of ['fulfillmentStatus', 'paymentStatus', 'shipmentStatus', 'carrier'] as const) {
    const expected = normalizeAdminOrderSearch(filters[field]);
    if (expected && expected !== 'all' && normalizeAdminOrderSearch(order[field]) !== expected) return false;
  }

  const dateState = filters.dateState || 'all';
  if (dateState === 'all') return true;
  const createdAt = timestampMillis(order.createdAt);
  if (createdAt == null) return false;
  const startOfToday = startOfDayInTimeZone(now, 'America/Chicago');
  const age = now - createdAt;
  if (dateState === 'today') return createdAt >= startOfToday && createdAt <= now;
  if (dateState === '7d') return age <= 7 * 24 * 60 * 60 * 1000;
  if (dateState === '30d') return age <= 30 * 24 * 60 * 60 * 1000;
  return age > 30 * 24 * 60 * 60 * 1000;
}

function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvDate(value: unknown) {
  const millis = timestampMillis(value);
  return millis == null ? '' : new Date(millis).toISOString();
}

export function buildAdminOrdersCsv(orders: SearchableOrder[]) {
  const headers = [
    'Order Reference', 'Order Date', 'Customer Name', 'Customer Email', 'Customer Phone', 'Items',
    'Subtotal', 'Shipping', 'Tax', 'Total', 'Refunded', 'Payment Status', 'Fulfillment Status',
    'Shipment Status', 'Carrier', 'Shipping Service', 'Tracking Number', 'Tracking URL', 'Shipping Address',
  ];
  const rows = orders.map(order => {
    const address = (order.shippingAddress || {}) as Record<string, unknown>;
    const items = Array.isArray(order.items)
      ? order.items.map(item => `${Number((item as Record<string, unknown>).quantity || 0)} x ${String((item as Record<string, unknown>).name || 'Unnamed item')}`).join('; ')
      : '';
    const shippingAddress = [
      address.name || order.customerName,
      address.line1,
      address.line2,
      [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
      address.country,
    ].filter(Boolean).join(' | ');
    return [
      order.orderReference || order.id,
      csvDate(order.createdAt),
      order.customerName,
      order.customerEmail,
      order.customerPhone,
      items,
      Number(order.subtotalAmount || 0).toFixed(2),
      Number(order.shippingAmount || 0).toFixed(2),
      Number(order.taxAmount || 0).toFixed(2),
      Number(order.totalAmount || order.total || 0).toFixed(2),
      Number(order.refundedAmount || 0).toFixed(2),
      order.paymentStatus,
      order.fulfillmentStatus,
      order.shipmentStatus,
      order.carrier,
      order.shippingService,
      order.trackingNumber,
      order.trackingUrl,
      shippingAddress,
    ].map(csvCell).join(',');
  });
  return `\uFEFF${headers.map(csvCell).join(',')}\r\n${rows.join('\r\n')}${rows.length ? '\r\n' : ''}`;
}

export function createAdminOrderCursor(orderId: string, now = Date.now()) {
  const payload: CursorPayload = { version: 1, orderId, expiresAt: now + ADMIN_ORDER_CURSOR_TTL_MS };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function parseAdminOrderCursor(cursor: string, now = Date.now()) {
  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    if (payload.version !== 1 || typeof payload.orderId !== 'string' || !payload.orderId || typeof payload.expiresAt !== 'number') {
      throw new AdminOrderCursorError('invalid_cursor');
    }
    if (payload.expiresAt <= now) throw new AdminOrderCursorError('expired_cursor');
    return payload as CursorPayload;
  } catch (error) {
    if (error instanceof AdminOrderCursorError) throw error;
    throw new AdminOrderCursorError('invalid_cursor');
  }
}

export function buildAdminOrderSummary(
  lifetime: { orderCount?: unknown; revenue?: unknown },
  period: { orderCount?: unknown; revenue?: unknown },
  days = 30,
) {
  return {
    lifetime: { orderCount: Number(lifetime.orderCount || 0), revenue: Number(lifetime.revenue || 0) },
    period: { days, orderCount: Number(period.orderCount || 0), revenue: Number(period.revenue || 0) },
  };
}
