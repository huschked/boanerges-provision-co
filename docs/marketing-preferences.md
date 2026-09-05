# Marketing email preferences (WEB-044)

## Deployment

- Deploy the app and `firestore.rules`. Subscriber writes now go through server APIs; tokens are server-only, and admins can read preference audit events.
- Keep `MARKETING_POSTAL_ADDRESS` blank for now, as requested by the owner. The app records signup consent but does not send marketing welcome emails. It does not copy the Shippo/home address. Configure a valid, owner-approved public mailing address before enabling marketing.
- Configure `RESEND_AUDIENCE_ID`, the verified `EMAIL_FROM_GENERAL`, and the canonical HTTPS `APP_URL`.
- In Resend, create a webhook for `contact.updated` at `https://YOUR_DOMAIN/api/webhooks/resend`. Set its signing secret as `RESEND_WEBHOOK_SECRET` in Vercel, then redeploy. Provider opt-outs synchronize to Firestore; provider opt-ins never grant consent.
- Do not send Resend Broadcasts while the address is blank. The application cannot block campaigns sent directly through the Resend dashboard. Future broadcasts must include the approved mailing address and Resend's unsubscribe mechanism, and use the synchronized contact audience.

## Behavior

- Admin Audience includes a confirmed Delete Subscriber action. The server opts out locally, removes the Resend contact by email (already missing is treated as success), then replaces the profile with a minimal suppression tombstone. Completed tombstones have no `createdAt` and are excluded from the normal Audience query. Orders and product subscriptions remain untouched. Preference audit records remain; this is not a full personal-data erasure operation.
- If deletion fails, the entry remains available for Retry deletion. An in-flight operation is protected for two minutes before retry recovery. A fresh signup after deletion requires email confirmation; confirmation recreates the Resend contact. Test success, provider failure/retry, repeated deletion, non-admin denial, and stale confirmation before relying on this in production.

- The welcome email identifies the sender, includes the approved postal address and a public unsubscribe link, and has a plain-text alternative.
- GET requests only display preferences; email scanners do not change consent. The explicit unsubscribe button saves the opt-out immediately, without login or extra information, then synchronizes Resend.
- Links contain random 256-bit tokens, not email addresses. Only hashes are stored as token document IDs. Unsubscribe links remain usable; re-subscription confirmations expire after 24 hours and are single-use/version-bound.
- A later signup for a suppressed address sends a non-promotional confirmation request. Only explicit confirmation can reactivate it. Old checkout events cannot reverse an opt-out.
- Order receipts, shipping, billing, and subscription service messages remain separate. Marketing opt-out does not cancel Subscribe & Save.
- Admin Audience shows actual preference, provider sync, and welcome-email status. Failed/pending provider sync can be retried there. Monitor these failures and retry promptly before any campaign; there is no scheduled background retry worker in this release. Local suppression remains saved when Resend is unavailable.
- `marketing_events` records consent changes and deduplicated provider events. Do not delete subscriber suppression history when cleaning up test data used for replay verification.

## Verification after deployment

1. With the postal address blank, submit a newsletter signup. Confirm active consent is recorded, welcome status is `blocked_missing_address`, and no marketing email is sent.
2. Once an approved address is configured, use a controlled recipient to receive the welcome email. Check sender, address, unsubscribe link, and plain-text body.
3. Open the preference link: merely viewing it must not unsubscribe. Press Unsubscribe, refresh Audience, and confirm Firestore and Resend both show unsubscribed. Repeat the POST/link action: preference remains unsubscribed.
4. Replay an older consented checkout webhook: the opt-out must remain. Submit a fresh signup: confirm it stays unsubscribed until the confirmation email's button is pressed.
5. Confirm re-subscription; unsubscribe again; replay the used confirmation: it must not reactivate. Check expired, altered, missing, and stale-version tokens fail without exposing email data.
6. Unsubscribe in Resend and verify its signed `contact.updated` webhook suppresses Firestore. Replay the event; verify only one provider audit receipt. An invalid signature must return 400.
7. Simulate a provider failure in a test environment. Verify local opt-out persists, Audience displays a sync failure, and Retry restores provider suppression.
8. Confirm order and subscription service emails still send to an opted-out controlled recipient.

Automated verification covers token shape, consent requirements, stale/expired confirmation, consumed-token replay, and enduring opt-out links. Live provider delivery, deployed rules, and rendered email verification remain owner checks.
