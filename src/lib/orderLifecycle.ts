export const LIFECYCLE_VERSION = 2;

export type PaymentState = "awaiting_payment" | "paid" | "partially_refunded" | "refunded" | "disputed" | "failed" | "expired";
export type FulfillmentState = "pending" | "packed" | "shipped" | "cancelled" | "requires_attention";
export type ShipmentState = "not_shipped" | "unknown" | "pre_transit" | "in_transit" | "delayed" | "delivered" | "exception" | "returned" | "failure";

export type OrderLifecycle = {
  lifecycleVersion: number;
  paymentStatus: PaymentState;
  fulfillmentStatus: FulfillmentState;
  shipmentStatus: ShipmentState;
};

const paymentStates = new Set<PaymentState>(["awaiting_payment", "paid", "partially_refunded", "refunded", "disputed", "failed", "expired"]);
const fulfillmentStates = new Set<FulfillmentState>(["pending", "packed", "shipped", "cancelled", "requires_attention"]);
const shipmentStates = new Set<ShipmentState>(["not_shipped", "unknown", "pre_transit", "in_transit", "delayed", "delivered", "exception", "returned", "failure"]);

export function normalizeOrderLifecycle(order: Record<string, unknown>): OrderLifecycle {
  const legacy = String(order.status || "").toLowerCase();
  const rawPayment = String(order.paymentStatus || "").toLowerCase();
  const paymentStatus: PaymentState = paymentStates.has(rawPayment as PaymentState)
    ? rawPayment as PaymentState
    : rawPayment === "unpaid" || rawPayment === "pending" ? "awaiting_payment" : order.paidAt || order.stripePaymentIntentId ? "paid" : "awaiting_payment";

  const rawFulfillment = String(order.fulfillmentStatus || legacy || "pending").toLowerCase();
  let fulfillmentStatus: FulfillmentState;
  if (rawFulfillment === "needs_manual_intervention" || rawFulfillment === "processing") fulfillmentStatus = rawFulfillment === "processing" ? "pending" : "requires_attention";
  else if (rawFulfillment === "delivered") fulfillmentStatus = "shipped";
  else fulfillmentStatus = fulfillmentStates.has(rawFulfillment as FulfillmentState) ? rawFulfillment as FulfillmentState : "pending";

  const rawShipment = String(order.shipmentStatus || "").toLowerCase();
  let shipmentStatus: ShipmentState;
  if (shipmentStates.has(rawShipment as ShipmentState)) shipmentStatus = rawShipment as ShipmentState;
  else if (legacy === "delivered" || order.deliveredAt) shipmentStatus = "delivered";
  else if (order.shipmentException) shipmentStatus = "exception";
  else if (order.shippoTransactionId || order.labelUrl || order.trackingNumber) shipmentStatus = "pre_transit";
  else shipmentStatus = "not_shipped";

  return { lifecycleVersion: LIFECYCLE_VERSION, paymentStatus, fulfillmentStatus, shipmentStatus };
}

const fulfillmentTransitions: Record<FulfillmentState, FulfillmentState[]> = {
  pending: ["packed", "cancelled", "requires_attention"],
  packed: ["shipped", "cancelled", "requires_attention"],
  shipped: ["requires_attention"],
  cancelled: [],
  requires_attention: ["pending", "packed", "cancelled"],
};

const paymentTransitions: Record<PaymentState, PaymentState[]> = {
  awaiting_payment: ["paid", "failed", "expired"],
  paid: ["partially_refunded", "refunded", "disputed"],
  partially_refunded: ["refunded", "disputed"],
  disputed: ["paid", "partially_refunded", "refunded"],
  refunded: [], failed: [], expired: [],
};

const shipmentTransitions: Record<ShipmentState, ShipmentState[]> = {
  not_shipped: ["unknown", "pre_transit"],
  unknown: ["pre_transit", "in_transit", "delayed", "delivered", "exception", "returned", "failure"],
  pre_transit: ["in_transit", "delayed", "delivered", "exception", "returned", "failure"],
  in_transit: ["delayed", "delivered", "exception", "returned", "failure"],
  delayed: ["in_transit", "delivered", "exception", "returned", "failure"],
  exception: ["in_transit", "delayed", "delivered", "returned", "failure"],
  delivered: [], returned: [], failure: [],
};

export function canTransitionFulfillment(from: FulfillmentState, to: FulfillmentState) { return from === to || fulfillmentTransitions[from].includes(to); }
export function canTransitionPayment(from: PaymentState, to: PaymentState) { return from === to || paymentTransitions[from].includes(to); }
export function canTransitionShipment(from: ShipmentState, to: ShipmentState) { return from === to || shipmentTransitions[from].includes(to); }
