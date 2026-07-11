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
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

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
export type ShippingQuote = { quoteId: string; originalAddress: ShippingAddress; correctedAddress: ShippingAddress; addressChanged: boolean; rates: ShippingRate[] };

export function requestShippingQuote(orderId: string, parcel: Record<string, unknown>): Promise<ShippingQuote> {
  return adminPost(`/api/admin/orders/${encodeURIComponent(orderId)}/shipping/quote`, parcel);
}

export function purchaseShippingLabel(orderId: string, payload: { quoteId: string; rateId: string; acceptCorrectedAddress: boolean }) {
  return adminPost(`/api/admin/orders/${encodeURIComponent(orderId)}/shipping/purchase`, payload);
}
