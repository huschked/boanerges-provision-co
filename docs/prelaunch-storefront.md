# Prelaunch Storefront Gate

The prelaunch gate keeps the public catalog and commerce APIs private while the production domain is being prepared. Operational webhooks, scheduled jobs, Admin, signed customer links, legal pages, and newsletter signup remain available.

## Deployment order

1. Deploy this application version with `PRELAUNCH_MODE=false` (or unset).
2. Deploy `firestore.rules`. Public product reads now go through the server; Admin remains authenticated through Firebase.
3. In Vercel Production environment variables, add:
   - `PRELAUNCH_MODE=true`
   - `PRELAUNCH_PASSWORD=<a unique password of at least 12 characters>`
4. Redeploy Production so the server receives the new variables.

`PRELAUNCH_PASSWORD` is server-only. Do not give it a `VITE_` prefix or place it in client code. Treat it like a secret in Vercel.

Changing the password invalidates all existing preview sessions. A successful unlock uses a signed, HTTP-only cookie that expires after 12 hours.

## Verification

Use an incognito window so an existing preview cookie cannot affect the result.

1. Open the production domain and confirm the branded Coming Soon page appears.
2. Confirm Shop, Bundles, and direct product URLs remain behind the gate.
3. Enter an incorrect password and confirm access is refused without revealing configuration details.
4. Enter the correct password and confirm the complete storefront loads.
5. Refresh and navigate among Shop, a product, Bundles, and Cart; access should remain unlocked.
6. In a second incognito window, confirm the storefront is still locked.
7. Confirm `/admin`, `/privacy`, and `/terms` remain reachable.
8. Submit the Coming Soon email form with a test address and confirm the normal newsletter feedback appears.
9. Run a Stripe test-mode checkout and confirm Stripe and Shippo/Resend webhook deliveries still return successful responses.

The gate deliberately allows these operational routes while enabled:

- Prelaunch status and unlock
- Stripe, Shippo, and Resend webhooks
- Scheduled jobs
- Authenticated Admin APIs
- Signed order status, subscription portal, email preference, and review routes
- Stripe checkout-success verification
- Newsletter signup

## Launch

Set `PRELAUNCH_MODE=false` in Vercel Production and redeploy. Verify the public storefront in an incognito window. The password may then be removed or rotated; keeping the variable while the mode is false does not enable the gate.
