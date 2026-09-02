import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionFulfillment, canTransitionPayment, canTransitionShipment, normalizeOrderLifecycle } from "./orderLifecycle.ts";

test("normalizes a legacy delivered order without conflating warehouse and carrier state", () => {
  assert.deepEqual(normalizeOrderLifecycle({ status: "delivered", paymentStatus: "paid" }), {
    lifecycleVersion: 2, paymentStatus: "paid", fulfillmentStatus: "shipped", shipmentStatus: "delivered",
  });
});

test("normalizes legacy manual intervention and existing labels", () => {
  assert.deepEqual(normalizeOrderLifecycle({ status: "needs_manual_intervention", paymentStatus: "paid", labelUrl: "https://label" }), {
    lifecycleVersion: 2, paymentStatus: "paid", fulfillmentStatus: "requires_attention", shipmentStatus: "pre_transit",
  });
});

test("validates independent lifecycle transitions", () => {
  assert.equal(canTransitionFulfillment("pending", "packed"), true);
  assert.equal(canTransitionFulfillment("shipped", "cancelled"), false);
  assert.equal(canTransitionPayment("paid", "refunded"), true);
  assert.equal(canTransitionPayment("refunded", "paid"), false);
  assert.equal(canTransitionPayment("paid", "disputed"), true);
  assert.equal(canTransitionPayment("disputed", "paid"), true);
  assert.equal(canTransitionShipment("pre_transit", "delivered"), true);
  assert.equal(canTransitionShipment("delivered", "in_transit"), false);
  assert.equal(canTransitionShipment("exception", "in_transit"), true);
  assert.equal(canTransitionShipment("in_transit", "returned"), true);
});

test("payment changes do not rewrite fulfillment or shipment state", () => {
  const lifecycle = normalizeOrderLifecycle({ paymentStatus: "refunded", fulfillmentStatus: "shipped", shipmentStatus: "delivered" });
  assert.equal(lifecycle.paymentStatus, "refunded");
  assert.equal(lifecycle.fulfillmentStatus, "shipped");
  assert.equal(lifecycle.shipmentStatus, "delivered");
});
