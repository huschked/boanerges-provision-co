import { auth } from './firebase';

export type FulfillmentOperation =
  | 'pack'
  | 'ship'
  | 'cancel'
  | 'refund'
  | 'tracking'
  | 'notes'
  | 'notification-retry';

export class AdminOrderApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export type AdminOrderPage<TOrder> = {
  orders: TOrder[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type AdminOrderSummary = {
  lifetime: { orderCount: number; revenue: number };
  period: { days: number; orderCount: number; revenue: number };
};

export type AdminOrderQueryOptions = {
  fulfillmentStatus: string;
  paymentStatus: string;
  shipmentStatus: string;
  carrier: string;
  dateState: 'all' | 'today' | '7d' | '30d' | 'older30';
  sort: 'newest' | 'oldest';
};

export const DEFAULT_ADMIN_ORDER_QUERY: AdminOrderQueryOptions = {
  fulfillmentStatus: '', paymentStatus: '', shipmentStatus: '', carrier: '', dateState: 'all', sort: 'newest',
};

async function adminPost(path: string, payload: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user) throw new AdminOrderApiError('Sign in is required.', 401, 'unauthenticated');
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': crypto.randomUUID().replaceAll('-', '') },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new AdminOrderApiError(data.error || 'The operation failed.', response.status, data.code, data.details);
  return data;
}

async function adminGet(path: string) {
  const user = auth.currentUser;
  if (!user) throw new AdminOrderApiError('Sign in is required.', 401, 'unauthenticated');
  const response = await fetch(path, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new AdminOrderApiError(data.error || 'The operation failed.', response.status, data.code);
  return data;
}

export async function runOrderCommand(
  orderId: string,
  operation: FulfillmentOperation,
  payload: Record<string, unknown> = {},
) {
  return adminPost(`/api/admin/orders/${encodeURIComponent(orderId)}/${operation}`, payload);
}

export type ShippingAddress = { name: string; street1: string; street2?: string; city: string; state: string; zip: string; country: string };
export type ShippingRate = { id: string; amount: number; currency: string; carrier: string; service: string; estimatedDays: number | null; durationTerms: string };
export type ShippoDebugEntry = { method: string; path: string; request: Record<string, unknown>; httpStatus: number | null; ok: boolean; response: unknown };
export type ShippingQuote = { quoteId: string; originalAddress: ShippingAddress; submittedAddress: ShippingAddress; correctedAddress: ShippingAddress; addressChanged: boolean; rates: ShippingRate[]; debugTrace?: ShippoDebugEntry[] };

export function requestShippingQuote(orderId: string, parcel: Record<string, unknown>, addressOverride: ShippingAddress): Promise<ShippingQuote> {
  return adminPost(`/api/admin/orders/${encodeURIComponent(orderId)}/shipping/quote`, { ...parcel, addressOverride });
}

export async function getAdminOrdersPage<TOrder>({
  search = '',
  cursor = '',
  limit = 50,
  query = DEFAULT_ADMIN_ORDER_QUERY,
}: { search?: string; cursor?: string; limit?: number; query?: AdminOrderQueryOptions } = {}): Promise<AdminOrderPage<TOrder>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  if (cursor) params.set('cursor', cursor);
  Object.entries(query).forEach(([key, value]) => { if (value && value !== 'all') params.set(key, value); });
  return adminGet(`/api/admin/orders?${params.toString()}`);
}

export function getAdminOrderSummary(): Promise<AdminOrderSummary> {
  return adminGet('/api/admin/order-summary');
}

export async function exportAdminOrders({ search = '', query = DEFAULT_ADMIN_ORDER_QUERY, orderIds = [] }: { search?: string; query?: AdminOrderQueryOptions; orderIds?: string[] }) {
  const user = auth.currentUser;
  if (!user) throw new AdminOrderApiError('Sign in is required.', 401, 'unauthenticated');
  const response = await fetch('/api/admin/orders/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ search, ...query, orderIds }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new AdminOrderApiError(data.error || 'The export failed.', response.status, data.code);
  }
  const disposition = response.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `boanerges-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  return { blob: await response.blob(), filename };
}

export function purchaseShippingLabel(orderId: string, payload: { quoteId: string; rateId: string; acceptCorrectedAddress: boolean }) {
  return adminPost(`/api/admin/orders/${encodeURIComponent(orderId)}/shipping/purchase`, payload);
}

export type InventoryReservation = {
  id: string;
  status: string;
  customerEmail?: string;
  stripeSessionId?: string;
  isExpired?: boolean;
  items: Array<{ productId: string; name: string; quantity: number }>;
  expiresAt?: { _seconds?: number; seconds?: number };
};

export async function getInventoryReservations(): Promise<InventoryReservation[]> {
  const data = await adminGet('/api/admin/inventory-reservations');
  return data.reservations || [];
}

export function releaseInventoryReservation(reservationId: string) {
  return adminPost(`/api/admin/inventory-reservations/${encodeURIComponent(reservationId)}/release`, {});
}
