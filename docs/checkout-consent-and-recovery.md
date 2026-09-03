# Checkout consent and recovery

## Newsletter consent lifecycle

The checkout request sends only the boolean `newsletterOptIn`. The server treats only the literal value `true` as consent and writes the following fields to `pending_orders/{id}` when the inventory reservation is created:

- `newsletterOptIn`
- `newsletterConsentSource: "checkout"`
- `newsletterConsentAt` (server timestamp for opt-ins, otherwise `null`)
- `newsletterChoiceRecordedAt` (server timestamp for either choice)

No subscriber is created during checkout-session creation. Abandoned, expired, session-creation-failed, and asynchronously failed payments therefore never activate the consent. After a paid Stripe webhook commits the order, the same consent evidence is copied to `orders/{checkoutSessionId}` and the paid-order effect activates the normalized customer email in Firestore and the configured Resend audience. The order records `newsletterSubscriptionStatus` so webhook replay is idempotent.

The storefront newsletter forms use the same subscriber activation helper, but remain immediate because those forms are themselves the explicit signup action.

## Checkout recovery

- Invalid email and cart payloads return safe `4xx` messages and stable error codes.
- Inventory conflicts return each affected product, requested quantity, and available quantity. The checkout page can lower only that quantity or remove only that item without changing unrelated cart lines.
- Stripe/provider and unexpected server failures return customer-safe messages without exposing provider internals. The cart remains intact and the page offers retry and return-to-shop actions.
- Stripe Checkout collects billing and shipping addresses and the email. Phone collection is disabled because the current domestic USPS workflow has no documented requirement for it.

## Live verification matrix

1. Start and abandon one opted-in checkout: pending consent exists; subscriber does not.
2. Complete one opted-out checkout: paid order records `not_requested`; subscriber does not exist because of the checkout.
3. Complete one opted-in checkout: paid order records `active`; subscriber and Resend contact exist.
4. Fail or expire one opted-in checkout: reservation releases; subscriber does not exist because of the checkout.
5. Request an inactive or over-quantity product: affected items and recovery controls appear, while other cart lines remain.
6. Submit an invalid optional email: the inline validation message appears and the cart remains.
