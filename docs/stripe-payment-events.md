# Stripe payment-event verification

Stripe Checkout fulfillment is webhook-driven. A Checkout Session creates an order only after Stripe reports `payment_status=paid`; unpaid completed sessions remain in `awaiting_payment` until a later success or failure event arrives.

## Event records

- `stripe_events/{eventId}` is the delivery claim. A `processing` claim has a unique token and a five-minute lease by default. A replay suppresses a live claim, while an expired claim can be recovered safely.
- `stripe_payment_events/{eventId}` is the payment audit record for completed, delayed-success, and delayed-failure Checkout events.
- `inventory_reservation_events` and `inventory_movements` use deterministic document ids, so a replay cannot release or decrement stock twice.
- `orders/{checkoutSessionId}` is created transactionally with the inventory commit. Concurrent paid events for the same Session share a transactional analytics marker and a Resend idempotency key, producing one order, one set of movements, one analytics increment, and one confirmation email.

Set `STRIPE_EVENT_PROCESSING_TIMEOUT_SECONDS` only when the default 300-second lease is unsuitable. Values are constrained to 30-3600 seconds.

## Sandbox verification

Forward the three checkout events to the local webhook:

```powershell
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to http://localhost:3000/api/webhooks/stripe
```

Copy the listener's `whsec_...` value into `STRIPE_WEBHOOK_SECRET`, restart the app, and complete a test checkout. Use Stripe's test-mode event log to copy the resulting event id.

Replay the same event at least twice:

```powershell
stripe events resend evt_REPLACE_ME
stripe events resend evt_REPLACE_ME
```

For delayed payments, enable a compatible delayed payment method in Stripe test mode, complete its documented success and failure test flows, and then resend those event ids in reverse order. Generic `stripe trigger checkout.session.*` fixtures do not contain this application's pending-order and reservation metadata, so they are useful for endpoint smoke tests but not inventory reconciliation.

After each scenario, reconcile:

1. `stripe_events`: one processed document per Stripe event; replays do not increase business effects.
2. `stripe_payment_events`: the expected `awaiting_payment`, `paid`, or `failed` audit entry exists.
3. `pending_orders`: the final payment and reservation statuses are correct.
4. `inventory_reservations`: success is `committed`; failure or expiration is `released`.
5. `orders`, `inventory_movements`, product inventory, analytics, and confirmation email: each paid Session is reflected exactly once.

## Stale-claim recovery

In the sandbox only, set a claimed event's `status` to `processing` and its `processingLeaseExpiresAt` to a timestamp in the past, then resend it. Confirm that `attempts` increases, `lastClaimReason` becomes `stale_recovery`, and the event finishes as `processed` without duplicating the order, inventory movement, analytics, or email.
