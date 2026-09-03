export type RefundLineItem = {
  productId?: string;
  name?: string;
  quantity?: number;
  cancelledQuantity?: number;
};

export type RefundWorkflowOrder = {
  totalAmount?: number;
  refundedAmount?: number;
  fulfillmentStatus?: string;
  shipmentStatus?: string;
  shippoTransactionId?: string;
  items?: RefundLineItem[];
};

export type RefundWorkflowRequest = {
  amount: number;
  cancelOrder: boolean;
  voidLabel: boolean;
  acknowledgeShipped: boolean;
  cancelQuantities: Record<string, number>;
};

export type RefundWorkflowPlan = {
  remainingAmount: number;
  fullRemainingRefund: boolean;
  shipmentStarted: boolean;
  labelNeedsVoid: boolean;
  inventoryAdjustments: Array<{ productId: string; name: string; quantity: number }>;
};

const money = (value: number) => Number(value.toFixed(2));

export const isLabelRefundComplete = (status: unknown) => String(status || '').toLowerCase() === 'success';

export function buildRefundWorkflowPlan(order: RefundWorkflowOrder, request: RefundWorkflowRequest): RefundWorkflowPlan {
  const remainingAmount = money(Number(order.totalAmount || 0) - Number(order.refundedAmount || 0));
  const amount = money(Number(request.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > remainingAmount) throw new Error(`Refund amount must be between $0.01 and $${remainingAmount.toFixed(2)}.`);

  const shipmentStarted = ['in_transit', 'delayed', 'delivered', 'exception', 'returned', 'failure'].includes(order.shipmentStatus || 'not_shipped');
  if (shipmentStarted && request.acknowledgeShipped !== true) throw new Error('Acknowledge that this order has entered the carrier network before refunding it.');
  if (shipmentStarted && (request.cancelOrder || Object.values(request.cancelQuantities).some(value => Number(value) > 0))) {
    throw new Error('Shipped products cannot be canceled or restored to inventory. Issue a refund without inventory changes.');
  }

  const fullRemainingRefund = amount === remainingAmount;
  if (request.cancelOrder && !fullRemainingRefund) throw new Error('Canceling the entire order requires refunding the full remaining balance.');
  const labelNeedsVoid = Boolean(order.shippoTransactionId) && !shipmentStarted;
  if (request.cancelOrder && labelNeedsVoid && !request.voidLabel) throw new Error('Void the unused shipping label before canceling this order.');

  const inventoryAdjustments: RefundWorkflowPlan['inventoryAdjustments'] = [];
  for (const item of order.items || []) {
    if (!item.productId) continue;
    const purchased = Math.max(0, Number(item.quantity || 0));
    const alreadyCancelled = Math.max(0, Number(item.cancelledQuantity || 0));
    const availableToCancel = Math.max(0, purchased - alreadyCancelled);
    const requested = Math.max(0, Number(request.cancelQuantities[item.productId] || 0));
    if (!Number.isInteger(requested) || requested > availableToCancel) throw new Error(`${item.name || 'Item'} cancellation quantity must be between 0 and ${availableToCancel}.`);
    if (requested > 0) inventoryAdjustments.push({ productId: item.productId, name: item.name || item.productId, quantity: requested });
  }

  if (request.cancelOrder) {
    const expected = (order.items || []).filter(item => item.productId).reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.cancelledQuantity || 0)), 0);
    const selected = inventoryAdjustments.reduce((sum, item) => sum + item.quantity, 0);
    if (selected !== expected) throw new Error('Canceling the order requires canceling every remaining item quantity.');
  }
  if (inventoryAdjustments.length > 0 && labelNeedsVoid && !request.voidLabel) {
    throw new Error('Void the unused shipping label before restoring canceled items to inventory.');
  }

  return { remainingAmount, fullRemainingRefund, shipmentStarted, labelNeedsVoid, inventoryAdjustments };
}
