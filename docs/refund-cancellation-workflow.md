# Refund and cancellation workflow

WEB-018 coordinates the irreversible and recoverable parts of an order resolution through the authenticated admin order API.

## Admin behavior

- Every refund requires an amount, a reason, and explicit final confirmation.
- The server rejects amounts above the order's remaining paid balance.
- A partial refund may optionally cancel selected quantities that have not shipped.
- Canceling the entire order selects every remaining quantity and requires the full remaining refund.
- If an unused Shippo label exists, it must be submitted for refund before canceled quantities are restored.
- Once carrier movement has started, the admin must acknowledge the warning and no inventory can be restored.
- Food products are not physically returned to sellable inventory. Damaged, incorrect, or missing-order resolutions are handled without a customer return shipment.

## Recorded outcomes

Stripe uses the admin command id as its idempotency key. Each command also creates an `admin_order_commands` record and an `order_audit_events` record containing the authenticated actor and the result.

Successful reconciliation updates the absolute refunded amount, payment state, cancellation quantities, inventory movements, label-refund state, fulfillment state, and customer-email state. Inventory movement ids include the Stripe refund id and product id, preventing the same refund from restoring a product twice.

If Stripe succeeds but a later step fails, the response is marked as a partial failure and the order moves to an attention state rather than initiating another Stripe refund. Any Shippo label-refund result other than `SUCCESS` leaves the intended inventory adjustment in `pendingInventoryRestock`; it is not applied silently. A Resend failure creates an email exception and can be retried with the admin notification action without affecting Stripe, Shippo, or inventory.

## Verification matrix

In Stripe and Shippo test mode, verify:

1. A partial refund without canceled quantities changes only the paid balance and sends the refund email.
2. A partial pre-shipment cancellation restores only the selected quantity and marks it canceled on the order.
3. A full pre-shipment cancellation restores every remaining quantity and changes fulfillment to `cancelled`.
4. A cancellation with an unused label refunds that label and clears its active tracking/label fields.
5. A post-shipment refund requires acknowledgement and never restores inventory.
6. A second refund cannot exceed the remaining balance or restore an already canceled quantity.
7. A failed refund email appears in the exception queue and Retry Notification sends only the email.
8. A failed label refund leaves inventory unchanged and makes the order require review.

Automated plan tests are in `src/lib/refundWorkflow.test.ts`.
