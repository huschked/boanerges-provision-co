import { orderReference } from './orderReference.js';

export type FulfillmentDocumentItem = {
  productId?: string;
  name?: string;
  quantity?: number;
  cancelledQuantity?: number;
  sizeOz?: number;
  itemType?: 'product' | 'bundle';
  components?: Array<{ productId: string; name: string; quantity: number; sizeOz: number }>;
};

export type FulfillmentDocumentOrder = {
  id: string;
  orderReference?: string;
  items?: FulfillmentDocumentItem[];
  paymentStatus?: string;
  fulfillmentStatus?: string;
};

export type PickListItem = {
  productId: string;
  name: string;
  sizeOz: number;
  quantity: number;
  orderCount: number;
};

export function quantityToFulfill(item: FulfillmentDocumentItem) {
  return Math.max(0, Number(item.quantity || 0) - Number(item.cancelledQuantity || 0));
}

export function getPackingSlipItems(order: FulfillmentDocumentOrder) {
  return (order.items || [])
    .map(item => ({ ...item, fulfillQuantity: quantityToFulfill(item) }))
    .filter(item => item.fulfillQuantity > 0);
}

export function canIncludeInPickList(order: FulfillmentDocumentOrder) {
  return ['paid', 'partially_refunded'].includes(order.paymentStatus || '')
    && ['pending', 'packed'].includes(order.fulfillmentStatus || '')
    && getPackingSlipItems(order).length > 0;
}

export function buildConsolidatedPickList(orders: FulfillmentDocumentOrder[]): PickListItem[] {
  const grouped = new Map<string, PickListItem & { orderIds: Set<string> }>();

  for (const order of orders) {
    for (const item of getPackingSlipItems(order)) {
      const pickItems = item.itemType === 'bundle' && Array.isArray(item.components)
        ? item.components.map(component => ({ ...component, quantity: component.quantity * item.fulfillQuantity }))
        : [{ productId: item.productId || item.name || 'unknown-item', name: item.name || item.productId || 'Unknown item', sizeOz: Number(item.sizeOz || 0), quantity: item.fulfillQuantity }];
      for (const pickItem of pickItems) {
        const key = `${pickItem.productId}::${Number(pickItem.sizeOz || 0)}`;
        const existing = grouped.get(key) || { productId: pickItem.productId, name: pickItem.name, sizeOz: Number(pickItem.sizeOz || 0), quantity: 0, orderCount: 0, orderIds: new Set<string>() };
        existing.quantity += pickItem.quantity;
        existing.orderIds.add(order.id);
        existing.orderCount = existing.orderIds.size;
        grouped.set(key, existing);
      }
    }
  }

  return [...grouped.values()]
    .map(({ orderIds: _orderIds, ...item }) => item)
    .sort((a, b) => a.name.localeCompare(b.name) || a.sizeOz - b.sizeOz);
}

export function shortOrderReference(order: FulfillmentDocumentOrder) {
  return orderReference(order.id, order.orderReference);
}
