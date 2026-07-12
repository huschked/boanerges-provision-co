# Inventory reservations

Checkout reserves stock before creating a Stripe Checkout Session. The default reservation lifetime is 31 minutes (`INVENTORY_RESERVATION_MINUTES`), matching the explicit Stripe Session expiry while leaving enough margin above Stripe's 30-minute minimum.

## Data model

- `products.reservedInventory` is the quantity held by active checkouts. Sellable quantity is `currentInventory - reservedInventory`.
- `inventory_reservations/{pendingOrderId}` stores the item quantities, Stripe Session, expiry, and lifecycle status.
- `inventory_reservation_events` records one deterministic commit or release event.
- `inventory_movements/{reservationId}_{productId}` records the final stock decrement exactly once.

Reservation statuses are `reserved`, `committed`, `released`, and `requires_review`. Product counters and reservation state always change in the same Firestore transaction.

## Lifecycle

1. Checkout creation transactionally verifies available quantity and increments each product's reserved quantity.
2. Stripe Session creation uses the reservation expiry. If Session creation fails, the reservation is released.
3. A paid Checkout event converts the hold into physical inventory decrement and creates deterministic movement records.
4. `checkout.session.expired` and `checkout.session.async_payment_failed` release the hold once. Webhook replays become no-ops.
5. A paid order whose reservation cannot commit is marked for manual intervention, and its reservation becomes `requires_review`.

Admins can inspect expired/stuck reservations from the Orders view and release their held stock. Before releasing `requires_review` stock, reconcile the related paid order.

## Verification scenarios

- Set a product's inventory to one and submit two simultaneous checkout requests. Exactly one must receive a Session; the other receives `inventory_unavailable` with requested and available quantities.
- Replay paid, expired, and asynchronous-failure webhook fixtures. Product counters and deterministic event/movement documents must change once.
- Let a Session expire and confirm `reservedInventory` returns to its previous value.
- Force a product inventory conflict before committing a paid reservation and confirm both the order and reservation appear for manual review.
