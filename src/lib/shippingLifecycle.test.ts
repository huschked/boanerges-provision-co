import assert from "node:assert/strict";
import test from "node:test";
import { classifyShippoTracking, decideLabelPurchase, normalizeShippoTrackingStatus } from "./shippingLifecycle.ts";

test("a completed label command is replayed instead of purchased again", () => {
  assert.equal(decideLabelPurchase("completed", true), "replay_completed");
});

test("an in-flight or uncertain label command blocks another Shippo purchase", () => {
  assert.equal(decideLabelPurchase("processing", false), "block_processing");
  assert.equal(decideLabelPurchase("requires_review", false), "block_processing");
});

test("a different quote cannot purchase a second label for an already-labeled order", () => {
  assert.equal(decideLabelPurchase(undefined, true), "block_existing_label");
  assert.equal(decideLabelPurchase(undefined, false), "claim");
});

test("Shippo tracking events map to lifecycle notifications", () => {
  assert.equal(classifyShippoTracking("DELIVERED", "delivered", "Delivered"), "delivered");
  assert.equal(classifyShippoTracking("TRANSIT", "delivery_delayed", "Weather delay"), "delayed");
  assert.equal(classifyShippoTracking("FAILURE", "undeliverable", "Address issue"), "exception");
  assert.equal(classifyShippoTracking("TRANSIT", "out_for_delivery", "On vehicle"), null);
  assert.equal(normalizeShippoTrackingStatus("TRANSIT"), "in_transit");
});
