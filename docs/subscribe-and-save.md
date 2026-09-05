# Subscribe & Save operations

## Stripe setup

1. Create a recurring Stripe Price for every product/cadence offered. Use monthly recurrence with interval counts of 1, 2, or 3 and USD pricing.
2. In Admin > Inventory, edit the product, enter each recurring `price_...` ID, and enable Subscribe & Save.
3. Create a Stripe Product named `Standard Shipping` with the Shipping tax code (`txcd_92010001`). Add three reusable recurring Prices for the configured standard shipping amount: every 1, 2, and 3 months. Add their IDs to `STRIPE_SUBSCRIPTION_SHIPPING_PRICE_MONTHLY`, `STRIPE_SUBSCRIPTION_SHIPPING_PRICE_EVERY_TWO_MONTHS`, and `STRIPE_SUBSCRIPTION_SHIPPING_PRICE_EVERY_THREE_MONTHS` in each deployed environment. Checkout omits this line item when the merchandise subtotal qualifies for free shipping.
4. Enable and configure Stripe Customer Portal cancellation, payment-method updates, and invoice history.
5. The production Stripe webhook must send `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `invoice.upcoming`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, and `customer.subscription.resumed` to `/api/webhooks/stripe`.
6. Initially enable payment-method updates, invoice history, and cancellation in Customer Portal. Leave plan switching off until portal cadence changes are synchronized into the local subscription record.

## Operational behavior

- Subscription Checkout is intentionally separate from the one-time cart.
- Stripe Checkout collects the shipping address. Paid standard shipping is represented by a cadence-matched recurring line item so the same charge is included on renewals; qualifying subscriptions omit it under the normal free-shipping threshold.
- The initial order uses the normal inventory reservation and fulfillment pipeline.
- A paid renewal invoice creates one order using the invoice ID. Duplicate/replayed events cannot create another order or inventory movement.
- Failed or incomplete invoices do not create fulfillment orders.
- If renewal inventory is unavailable, the paid order is marked `requires_attention`; inventory is not decremented and the customer is notified.
- Subscription lifecycle state is stored in `subscriptions/{stripeSubscriptionId}`. Initial and renewal orders carry `orderType`, `stripeSubscriptionId`, and cadence fields.
- Customers enter Stripe Customer Portal only through a signed, expiring order-status token.

## Test-mode verification

Use Stripe test clocks and test payment methods to cover initial signup, renewal, replayed webhook, failed/retried invoice, cancellation, pause/resume, price changes, inventory shortage, refunds, and portal access before enabling a production recurring Price.
