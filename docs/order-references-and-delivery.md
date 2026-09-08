# Order references and delivery promises

## Public order references

Every new paid order receives one non-sequential public reference in the form `BP-7K4M2Q`. The six-character code omits visually ambiguous characters and is allocated through server-only Firestore assignment and uniqueness-index collections. The assignment is created before the order write, so Stripe webhook retries and recurring-invoice retries reuse the same value rather than issuing another reference.

The Stripe Checkout Session or invoice ID remains the internal Firestore order document ID and analytics transaction ID. It is not presented as the customer order number. The stored `orderReference` is used by checkout confirmation, transactional email subjects and bodies, shipment lifecycle messages, the signed order-status page, Admin order search and display, packing slips, and consolidated pick lists.

Historical orders without a stored reference receive the same deterministic `BP-` fallback on every display surface. When a legacy paid order re-enters the server-side completion flow, the server assigns and persists a unique reference before sending another confirmation.

The supporting `order_reference_assignments` and `order_reference_index` collections are server-only. Firestore's default-deny rule prevents browser access.

## Fulfillment timing

The shared values in `src/config/fulfillment.ts` are the source of truth:

- Processing: 2–3 business days.
- Estimated arrival: 3–7 business days after purchase.
- Carrier dates are estimates, not guarantees.

Stripe shipping options, product purchase copy, checkout, checkout success, FAQ, Terms, confirmation email, and the pre-shipment order-status state consume those shared values. Once Shippo supplies a carrier ETA, shipment email and order status show the carrier-specific date instead.

## Deployed verification

1. Complete one Stripe test-mode purchase and record the `BP-` reference on checkout success.
2. Confirm the same reference appears in the confirmation email, Admin order queue/detail view, packing slip, and signed order-status page.
3. Search Admin with the complete reference and a partial code.
4. Copy the reference from Admin and confirm the clipboard value includes the `BP-` prefix.
5. Pack and ship the test order, then compare the shipment email reference and carrier estimate with Admin and order status.
6. Create or simulate a paid subscription renewal and confirm it receives its own reference.
7. Replay the relevant Stripe webhook and confirm the reference does not change and no duplicate order is created.
