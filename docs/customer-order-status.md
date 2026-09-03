# Secure customer order status

WEB-020 provides account-free, read-only order tracking through an expiring signed link.

## Production configuration

Add these Vercel Production environment variables and redeploy:

- `ORDER_STATUS_SECRET`: at least 32 unpredictable characters. Generate it once, store it securely, and keep it stable. Changing it immediately invalidates every status link already sent.
- `ORDER_STATUS_TOKEN_DAYS`: optional validity period from 1 to 365 days; the default is 90.
- `APP_URL`: the canonical production origin used in emailed links, such as `https://boanergesprovisions.com`.

The server does not generate links if the signing secret is absent or too short. After configuration, new order-confirmation, shipment, and carrier-update emails use **View Order Status**. Retrying an eligible notification generates a new valid link for an existing order.

## Security model

Tokens contain an order id, issue time, expiration, and version protected by an HMAC-SHA256 signature. The API validates the signature and expiration before reading Firestore. A missing, modified, expired, or nonexistent-order token receives the same non-disclosing response. Responses use `Cache-Control: private, no-store` and the endpoint is rate limited.

The public response is built from an explicit whitelist. It includes customer-safe fulfillment, shipment, item, total, and carrier fields. It excludes customer name, email, phone, shipping address, product ids, internal order id, admin notes, audit information, Stripe identifiers, and internal exception records.

The page never changes an order directly. Eligible address-change and cancellation options open a pre-addressed support email. Address changes disappear after packing or label creation. Cancellation requests disappear after carrier movement or when the order leaves a cancellable fulfillment state.

## Live verification

1. Complete a Stripe test checkout and open **View Order Status** from the confirmation email.
2. Confirm the checkout-success link appears once the order exists.
3. Pack and ship the order; refresh the status page and confirm its stages, service, and tracking update.
4. Trigger a Shippo tracking update and confirm carrier details appear without internal information.
5. Modify one token character and verify that no order data is returned.
6. Test an expired token and a token copied from another order.
7. Confirm address-change and cancellation links disappear at the documented lifecycle boundaries.
