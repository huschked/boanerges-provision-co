# Order lifecycle state model

Orders use three independent, versioned state fields. `lifecycleVersion: 2` identifies the current model.

| Dimension | States | Meaning |
| --- | --- | --- |
| Payment | `awaiting_payment`, `paid`, `partially_refunded`, `refunded`, `disputed`, `failed`, `expired` | Money movement and payment risk only. |
| Fulfillment | `pending`, `packed`, `shipped`, `cancelled`, `requires_attention` | Warehouse preparation and handoff only. |
| Shipment | `not_shipped`, `unknown`, `pre_transit`, `in_transit`, `delayed`, `delivered`, `exception`, `returned`, `failure` | Carrier progress only. |

A delivered package therefore remains `fulfillmentStatus: shipped` and becomes `shipmentStatus: delivered`. A dispute changes payment to `disputed` and fulfillment to `requires_attention`; it does not pretend the carrier state changed.

New orders are written with all three fields. Existing documents are normalized when loaded or operated on: legacy `delivered` becomes fulfillment `shipped` plus shipment `delivered`, `needs_manual_intervention` becomes `requires_attention`, and an existing label or tracking number implies `pre_transit` when no carrier state was stored. Normalization does not discard legacy fields, exception details, refunds, disputes, tracking, or timestamps.

Server-side admin operations validate transitions before writing. Audit events include the lifecycle before and after the operation. Shippo webhook events reject stale backward carrier transitions, such as `delivered` back to `in_transit`.

Lifecycle timestamps remain top-level fields for operational queries: `paidAt`, `packedAt`, `shippedAt`, `deliveredAt`, `cancelledAt`, and `refundedAt`.
