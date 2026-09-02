# Shippo fulfillment workflow

The admin shipping flow is deliberately ordered so an unprepared order cannot accidentally purchase a label.

1. A paid order enters fulfillment as `pending` and receives its order-confirmation email.
2. An admin reviews the order and selects **Pack**. The authenticated server transitions it to `packed` and records the action.
3. The admin enters the packed parcel's dimensions and weight, then selects **Validate & Get Rates**.
4. Shippo validates the destination. If Shippo corrects it, the admin must explicitly accept the correction before continuing.
5. The admin selects a service and selects **Purchase Label & Ship**.
6. The server rechecks that the order is paid, still packed, and does not already have a label. It then purchases one label, records the carrier, service, cost, tracking, label URL, and estimated delivery, and transitions the order to `shipped`.
7. A shipment email is sent with the carrier, tracking link, shipped items, and estimated delivery when available.

Both quote creation and label purchase enforce the packed state on the server. A quote cannot be used after the order leaves `packed`, even if it was valid when created.

Label purchase is claimed with a deterministic command record for its quote. An uncertain Shippo response creates a shipment exception and does not automatically attempt a second purchase; reconcile the order in Shippo before retrying.

## API debugging

Set `SHIPPO_DEBUG=true` temporarily to show Shippo request and response JSON in the authenticated admin shipping panel. Authorization headers and the API token are never included, but address payloads contain customer information. Keep `SHIPPO_DEBUG=false` in production and redeploy after changing the value.

## Notification retry

The order detail view shows the latest order-confirmation and shipment-email states. If the shipment email failed, the retry control targets that message. Otherwise it targets the original order confirmation.

Shipment retries require a `shipped` order with a tracking number. Each authenticated retry has an idempotency key, is audited, and records the returned Resend provider id. A shipment retry does not buy another label or alter tracking.

## Actions that do not email the customer

- **Pack** changes fulfillment state only.
- **Validate & Get Rates** creates a temporary quote only.
- **Save Details** stores manual tracking fields and internal notes only.
- **Issue Refund** currently changes the Stripe/payment record only; the coordinated customer notification, inventory, cancellation, and label-void workflow remains tracked by WEB-018.
