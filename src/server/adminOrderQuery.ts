export const ADMIN_ORDER_CURSOR_TTL_MS = 2 * 60 * 60 * 1000;

type SearchableOrder = Record<string, unknown> & {
  id?: string;
  orderReference?: string;
  customerEmail?: string;
  customerName?: string;
  trackingNumber?: string;
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
