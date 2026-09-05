# WEB-043: verified-buyer reviews

## Behavior

- Review requests are optional, non-incentivized emails. Seven full days must elapse after the server first records delivery. Repeated delivery notifications no longer reset that timestamp.
- The daily worker scans up to 50 delivered orders per run using a persistent cursor; it creates deterministic invitations for uncancelled purchased products (including bundle component snapshots). It sends at most 10 per run within a time budget. Requests can arrive later than day seven because of the daily schedule or backlog. Monitor backlog as volume grows.
- Only paid, delivered, non-cancelled orders qualify. Refunded/partially refunded orders are conservatively excluded. Eligibility is checked again at sending and submission.
- Invitation identity is order + product; review identity is normalized buyer email + product. Repeat purchasers may receive another invitation if they have not reviewed yet, but can only have one review record per product.
- Link signatures use a separate purpose and secret. The opaque identifier reveals no order or buyer fields. The link goes in a URL fragment, expires 60 days after the send attempt, and is a bearer credential: do not forward or log it. The submission endpoint ignores any client-supplied product/order identity.
- Public consent, a 1–5 integer rating, display name, and bounded review text are required. A honeypot and per-IP request limit supplement purchase verification. All reviews begin pending; React displays text as text, not HTML.
- Admin → Reviews supports Pending / Published / Rejected and shows recent invitation states. Moderation requires a reason and an unchanged prior status; admins cannot change customer wording or ratings. Decisions are recorded in `review_audit`.
- Product pages calculate counts and averages from all published verified records, show the newest 50, and use an honest empty state. Unpublishing removes the review from both the list and aggregate on the next fetch.
- Unsubscribe requires an explicit button click, never just opening a link. It stops future review invitations, including after the review-submission link expires. It does not cancel subscriptions or stop order messages. Existing newsletter opt-outs/deletion tombstones, including legacy email-field records, also suppress sending. No automatic review-email resubscription is offered.

## Deployment

1. Deploy the code and Firestore rules. Review records are not publicly readable or client-writable; the API exposes only the approved public fields.
2. In Vercel, configure `REVIEW_LINK_SECRET` and `CRON_SECRET` as separate, random secrets of at least 32 characters. Keep the review secret stable; rotation invalidates existing invitations. Do not put secrets in `VITE_` variables.
3. Confirm `APP_URL` is the correct HTTPS storefront origin, `RESEND_API_KEY` and the orders sender are configured, and `MARKETING_POSTAL_ADDRESS` contains the approved business mailing address. Never use a private home address without owner approval. Blank postal address blocks sending.
4. Keep `REVIEW_REQUESTS_ENABLED=false` until ready to send. Set it to `true` and redeploy only when testing/release is approved. The flag controls requests, not moderation or public published reviews.
5. The deployment config installs `GET /api/cron/review-requests` daily at 15:00 UTC. Vercel sends the `CRON_SECRET` Bearer header automatically. Confirm the job exists in the production project's Cron Jobs settings. See [Vercel cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs) and [timing limits](https://vercel.com/docs/cron-jobs/usage-and-pricing). This is not a scheduled browser/assistant task.

No email was sent and no production data was changed during implementation tests.

## Delivery safety and troubleshooting

An invitation is transactionally claimed before email is sent and removed from the due queue. The stable Resend idempotency key is an additional safeguard, not the sole dedupe mechanism: [Resend retains keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys).

`sent` and `suppressed` invitations never resend. An ambiguous error becomes `needs_attention`; a killed function can leave `sending`. Neither is automatically retried. Inspect Resend delivery records before taking any action; if sent, reconcile the record rather than resend. Escalate an unconfirmed/failed attempt for engineering-assisted recovery. There is deliberately no blind retry button. Watch recent requests in Admin → Reviews, the full `review_invitations` collection, and Vercel function errors. A growing pending backlog needs a larger scheduled-worker capacity; it is not a reason to manually resend existing invitations.

The cursor lives at `review_jobs/scan`. Missing Firestore indexes, API permissions, or credentials fail the job and appear in Vercel logs. Re-running discovery is safe because invitation IDs are deterministic. Do not delete invitation records to retry.

For corrections/removal, verify the requester owns the original purchase via a trusted order-support channel. Use Unpublish with reason `Buyer requested removal` for removal. Keep the audit record. Customer text is immutable through the admin UI; corrections require a buyer-approved replacement and engineering-assisted re-moderation, never an admin silently editing the published words. No self-service edit feature is claimed.

## Verification

Automated tests use in-memory database/email adapters, not live Firebase or Resend. They cover eligibility/delay, bundle expansion, malformed/forged/expired signatures, consent/length/rating checks, real HTTP submission, concurrent duplicate attempts, forged product input, moderation, audit creation, published-only aggregates, private-field exclusion, opt-out suppression, cron replay, ambiguous send handling, disable switch, admin authorization, and rate limiting. They do not replace deployed Firestore/Resend verification.

Owner sandbox checklist (still required):

1. Use a sandbox order owned by you, with a paid order and a delivered shipment. To avoid waiting seven days, change only this test order's `deliveredAt` in Firestore to a timestamp eight days ago. Never backdate a real customer's order for this test. Leave another sandbox order undelivered as a negative control.
2. Ensure the test email has not opted out, the approved postal address is configured, and sending is enabled. Run the deployed cron once from Vercel Cron Jobs. This sends actual email to eligible orders, so first ensure no unintended real orders qualify.
3. Confirm one invitation per eligible product arrives. Run the job again: no duplicate email. Undelivered/recent/refunded orders must not receive one.
4. Open the private link, choose a nickname, rating, text, and consent; submit. Try again: duplicate rejected. Confirm the review is Pending and absent from the product page.
5. In Admin → Reviews, enter a reason and Publish. Refresh that product page: correct review/count/rating, no buyer email or order data. Unpublish with a reason and check the aggregate returns to its previous value. Include a negative review in the test; it must be equally publishable.
6. Click the invitation's unsubscribe link and confirm the opt-out. A subsequent qualifying purchase should produce a suppressed invitation, not an email. Ordinary order emails remain unaffected.
7. Check mobile/desktop layout, keyboard form navigation, errors, and the admin queue. Do not mark Done until the owner confirms this deployed flow.
