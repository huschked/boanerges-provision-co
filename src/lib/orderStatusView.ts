function timestampIso(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return '';
}

function safePublicUrl(value: unknown) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

type PublicOrderLifecycle = { paymentStatus: string; fulfillmentStatus: string; shipmentStatus: string };

export function buildPublicOrderStatus(
  orderId: string,
  order: Record<string, any>,
  expiresAt: number,
  lifecycle: PublicOrderLifecycle = {
    paymentStatus: String(order.paymentStatus || 'unknown'),
    fulfillmentStatus: String(order.fulfillmentStatus || 'pending'),
    shipmentStatus: String(order.shipmentStatus || 'not_shipped'),
  },
) {
  const shipmentStarted = ['in_transit', 'delayed', 'delivered', 'exception', 'returned', 'failure'].includes(lifecycle.shipmentStatus);
  const canRequestCancellation = ['paid', 'partially_refunded'].includes(lifecycle.paymentStatus)
    && ['pending', 'packed'].includes(lifecycle.fulfillmentStatus)
    && !shipmentStarted;
  const canRequestAddressChange = canRequestCancellation
    && lifecycle.fulfillmentStatus === 'pending'
    && lifecycle.shipmentStatus === 'not_shipped'
    && !order.shippoTransactionId;

  return {
    reference: orderId.slice(-8).toUpperCase(),
    createdAt: timestampIso(order.createdAt),
    updatedAt: timestampIso(order.updatedAt),
    expiresAt: new Date(expiresAt).toISOString(),
    paymentStatus: lifecycle.paymentStatus,
    fulfillmentStatus: lifecycle.fulfillmentStatus,
    shipmentStatus: lifecycle.shipmentStatus,
    items: (Array.isArray(order.items) ? order.items : []).map((item: Record<string, unknown>) => ({
      name: String(item.name || 'Item'),
      imageUrl: safePublicUrl(item.imageUrl),
      imageAlt: String(item.imageAlt || item.name || 'Purchased item'),
      imageType: item.imageType === 'illustrative' ? 'illustrative' : 'photograph',
      sizeOz: Number(item.sizeOz || 0),
      unitPrice: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
      cancelledQuantity: Number(item.cancelledQuantity || 0),
    })),
    amounts: {
      subtotal: Number(order.subtotalAmount || 0),
      shipping: Number(order.shippingAmount || 0),
      tax: Number(order.taxAmount || 0),
      total: Number(order.totalAmount || 0),
      refunded: Number(order.refundedAmount || 0),
      currency: String(order.currency || 'usd').toUpperCase(),
    },
    shipping: {
      method: String(order.shippingMethod || order.shippingService || 'Standard Shipping'),
      carrier: String(order.carrier || ''),
      service: String(order.shippingService || ''),
      trackingNumber: String(order.trackingNumber || ''),
      trackingUrl: safePublicUrl(order.trackingUrl),
      estimatedDelivery: String(order.estimatedDelivery || ''),
      latestDetails: String(order.latestTrackingStatus?.details || ''),
      latestStatusDate: String(order.latestTrackingStatus?.statusDate || ''),
    },
    actions: { canRequestAddressChange, canRequestCancellation },
    supportEmail: 'support@boanergesprovisions.com',
  };
}
