# Subscribe & Save operations

## Stripe setup

1. Create a recurring Stripe Price for every product/cadence offered. Use monthly recurrence with interval counts of 1, 2, or 3 and USD pricing.
2. In Admin > Inventory, edit the product, enter each recurring `price_...` ID, and enable Subscribe & Save.
3. Enable and configure Stripe Customer Portal cancellation, payment-method updates, and invoice history.
4. The production Stripe webhook must send `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `invoice.upcoming`, `customer.subscription.updated`, and `customer.subscription.deleted` to `/api/webhooks/stripe`.

## Operational behavior

- Subscription Checkout is intentionally separate from the one-time cart.
- The initial order uses the normal inventory reservation and fulfillment pipeline.
- A paid renewal invoice creates one order using the invoice ID. Duplicate/replayed events cannot create another order or inventory movement.
- Failed or incomplete invoices do not create fulfillment orders.
- If renewal inventory is unavailable, the paid order is marked `requires_attention`; inventory is not decremented and the customer is notified.
- Subscription lifecycle state is stored in `subscriptions/{stripeSubscriptionId}`. Initial and renewal orders carry `orderType`, `stripeSubscriptionId`, and cadence fields.
- Customers enter Stripe Customer Portal only through a signed, expiring order-status token.

## Test-mode verification

Use Stripe test clocks and test payment methods to cover initial signup, renewal, replayed webhook, failed/retried invoice, cancellation, pause/resume, price changes, inventory shortage, refunds, and portal access before enabling a production recurring Price.
