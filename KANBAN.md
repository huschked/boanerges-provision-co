# Boanerges Provisions Co Website Kanban

This board is the working queue for website development. Keep cards actionable enough that Codex or a human contributor can pick one up without digging through chat history.

## Working Rules

- When starting work, move one card from `Ready` to `In Progress`.
- When implementation is done, move the card to `Review / Verify` and add the relevant test or build results.
- Move a card to `Done` only after its acceptance criteria are met or intentionally deferred with a note.
- Add new discoveries as cards instead of leaving them only in chat.
- Default verification commands are `npm run lint`, `npm run build`, and targeted browser checks for user-facing flows.

## Card Template

```md
### WEB-000 - Short task title

- **Priority:** High | Medium | Low
- **Area:** storefront | checkout | admin | analytics | content | infra
- **Goal:** What this task should accomplish.
- **Acceptance Criteria:**
  - Observable result or behavior.
  - Required edge case or constraint.
- **Verification:**
  - Command, browser flow, or manual check.
- **Notes / Links:** Relevant files, routes, or context.
```

## Backlog

### WEB-016 - Add Order Filters, Saved Queues, and Batch Actions

- **Priority:** Medium
- **Area:** admin
- **Goal:** Make the order list efficient as volume grows by replacing the single client-side search workflow with operational queues and batch tools.
- **Acceptance Criteria:**
  - Orders can be filtered by fulfillment, payment, shipment, carrier, and date state; exception detection and resolution remain owned by WEB-013.
  - Admins can sort fulfillment queues oldest-first and save or quickly reopen common views.
  - Multi-select supports batch labels and safe status updates, with printable fulfillment documents supplied by WEB-017.
  - Destructive or irreversible batch actions require confirmation and report partial failures clearly.
  - Order ID, email, address, and tracking values have accessible copy actions.
  - Unsaved notes or shipment edits warn before changing orders or leaving the page.
- **Verification:**
  - Browser-check filters, sorting, saved views, selection, and batch actions with mixed-status orders.
  - Verify a partial batch failure does not incorrectly update successful or untouched orders.
- **Notes / Links:** Depends on WEB-009 and WEB-012; consumes exception data from WEB-013 and printable documents from WEB-017 without redefining either workflow. Relevant files include `src/components/admin/OrdersView.tsx` and `src/pages/Admin.tsx`.

### WEB-017 - Add Packing Slips and Consolidated Pick Lists

- **Priority:** Medium
- **Area:** admin
- **Goal:** Reduce packing mistakes and manual transcription by generating printable fulfillment documents.
- **Acceptance Criteria:**
  - Each order can produce a printable packing slip with order reference, customer, address, SKU/item, quantity, and packing instructions.
  - Selected orders can produce a consolidated pick list grouped by SKU/product.
  - Packing slips include a QR code or barcode that opens the matching admin order.
  - Print layouts remain legible without the normal admin navigation or decorative styling.
- **Verification:**
  - Print-preview single and multi-order documents on letter-size paper.
  - Compare generated quantities with source orders containing repeated and bundled items.
- **Notes / Links:** Coordinate with WEB-016 and the carrier workflow in WEB-010.

### WEB-018 - Build a Coordinated Cancellation and Refund Workflow

- **Priority:** Medium
- **Area:** admin
- **Goal:** Let an admin cancel or refund an order without separately reconciling Stripe, inventory, labels, customer communication, and order state.
- **Acceptance Criteria:**
  - Admins can issue full or partial refunds with a required reason.
  - The workflow prevents refunding more than the remaining paid amount.
  - Admins explicitly choose whether eligible items return to inventory, with inventory movements recorded once.
  - Unused labels can be voided when supported, and shipped-order refunds show an additional warning.
  - The customer receives a refund/cancellation notification and the order audit trail records the actor and outcome.
- **Verification:**
  - Test full, partial, repeated, pre-shipment, and post-shipment refund scenarios in Stripe test mode.
  - Confirm inventory, payment, fulfillment, email, and label states remain consistent after failures and retries.
- **Notes / Links:** Existing refund webhook handling is in `server.ts`; depends on WEB-009 and WEB-012.

### WEB-019 - Add Server-Side Order Search and Pagination

- **Priority:** Medium
- **Area:** admin
- **Goal:** Ensure older orders remain searchable and dashboard totals do not depend on the newest 300 documents loaded in the browser.
- **Acceptance Criteria:**
  - Order results use cursor pagination with clear previous/next or load-more behavior.
  - Server-side lookup supports order reference, normalized email, customer name, and tracking number.
  - Dashboard lifetime and period totals come from aggregate data rather than the current result page.
  - Loading, empty, expired-cursor, and query-failure states are clear.
- **Verification:**
  - Test with more than 300 seeded orders and confirm the oldest order is discoverable.
  - Compare aggregate counts and revenue against known fixture totals.
- **Notes / Links:** Current loading is capped in `src/pages/Admin.tsx`.

### WEB-020 - Add Secure Customer Order Tracking

- **Priority:** Medium
- **Area:** checkout
- **Goal:** Reduce order-status inquiries by giving customers a secure, account-free view of fulfillment and tracking progress.
- **Acceptance Criteria:**
  - Confirmation and shipment emails link to an expiring or revocable signed order-status URL.
  - The page shows purchased items, totals, fulfillment stage, tracking, estimated delivery, and support contact.
  - The page does not expose customer or order data when the token is missing, invalid, expired, or for another order.
  - Address-change or cancellation options appear only while the order is still eligible.
- **Verification:**
  - Browser-check valid, expired, modified, and cross-order tokens.
  - Confirm carrier updates appear without exposing admin-only notes or payment identifiers.
- **Notes / Links:** Extend `src/pages/CheckoutSuccess.tsx`; depends on WEB-010 and WEB-014.

### WEB-021 - Add Consistent Order References and Fulfillment Copy

- **Priority:** Low
- **Area:** checkout
- **Goal:** Use one customer-friendly order reference and one accurate delivery promise everywhere.
- **Acceptance Criteria:**
  - A human-readable order number is generated once and used in checkout success, emails, admin search, packing slips, and support workflows.
  - Handling and delivery estimates are sourced from shared configuration.
  - Checkout, FAQ, order confirmation, and shipping copy no longer conflict.
- **Verification:**
  - Complete a test order and compare the reference and timing language in every customer/admin surface.
- **Notes / Links:** Current views use different slices of the Stripe Checkout Session id.

### WEB-023 - Replace Placeholder Admin Metrics and Optimize Bundles

- **Priority:** Low
- **Area:** admin
- **Goal:** Remove misleading dashboard decoration and improve initial application loading.
- **Acceptance Criteria:**
  - The hard-coded `+12%` dashboard indicator is replaced with a real period comparison or removed.
  - Admin and analytics views are lazy-loaded where practical.
  - Production build chunk warnings are reduced or intentionally documented.
- **Verification:**
  - Compare displayed period changes with fixture data.
  - Run `npm run build` and inspect generated chunk sizes.
- **Notes / Links:** Relevant files include `src/components/admin/DashboardView.tsx` and `src/App.tsx`.

### WEB-008 - Confirm Production Firebase Auth Domains

- **Priority:** Medium
- **Area:** infra
- **Goal:** Confirm deployed app URLs are authorized for Firebase Google sign-in.
- **Acceptance Criteria:**
  - Production and preview domains are listed in Firebase Auth authorized domains.
  - `.env.example` and launch notes describe which app URL values must match deployment.
  - Any auth-domain mismatch behavior is documented for troubleshooting.
- **Verification:**
  - Browser-check Google sign-in on `/admin` in the deployed environment.
  - Confirm Firebase console authorized domains match `APP_URL` and any preview URL.
- **Notes / Links:** The admin UI uses Google popup sign-in and checks `users/{uid}.role === "admin"`.

### WEB-006 - Launch Readiness Pass

- **Priority:** Medium
- **Area:** content
- **Goal:** Make the repo and app easier to launch, test, and hand off.
- **Acceptance Criteria:**
  - README accurately explains local setup, required env variables, and available npm scripts.
  - Deployment notes cover build command, runtime command, and expected app URL configuration.
  - Known pre-launch checks are listed, including checkout, admin auth, contact form, newsletter, analytics, and mobile browsing.
  - Any missing assets, placeholder copy, or obvious launch blockers are added as separate kanban cards.
- **Verification:**
  - Read README setup from a fresh-contributor perspective.
  - Run `npm run lint` and `npm run build`.
- **Notes / Links:** Current README still appears close to the initial AI Studio scaffold.

## Ready

### WEB-012 - Separate Payment, Fulfillment, and Shipment State Machines

- **Priority:** High
- **Area:** admin
- **Goal:** Represent the real order lifecycle without conflating payment, warehouse work, carrier progress, cancellation, and exceptions.
- **Acceptance Criteria:**
  - Orders have independently typed payment, fulfillment, and shipment states with documented transitions.
  - Lifecycle timestamps include paid, packed, shipped, delivered, cancelled, and refunded events where applicable.
  - Invalid transitions are rejected server-side with an actionable message.
  - Existing orders are migrated or normalized without losing refund, dispute, tracking, or manual-review information.
  - Admin badges and queues clearly communicate all three state dimensions.
- **Verification:**
  - Unit-test valid and invalid transitions, including paid/cancelled, shipped/refunded, disputed, returned, and carrier-exception cases.
  - Browser-check migrated and newly created orders in dashboard and order detail views.
- **Notes / Links:** Current code mirrors `status` and `fulfillmentStatus`; coordinate with WEB-009.

### WEB-013 - Build an Exception-First Fulfillment Queue

- **Priority:** High
- **Area:** admin
- **Goal:** Define, detect, and resolve operational problems; general order filtering, saved views, and batch controls remain owned by WEB-016.
- **Acceptance Criteria:**
  - The queue identifies overdue unfulfilled orders, inventory conflicts, invalid addresses, disputes, email failures, label failures, tracking gaps, carrier exceptions, and refund requests.
  - Exceptions show age, severity, reason, and the next recommended action.
  - Dashboard counts link to the matching filtered order queue.
  - Resolving the underlying issue removes the exception without manual cleanup.
- **Verification:**
  - Seed every exception type and verify counts, ordering, filtering, and resolution behavior.
  - Confirm normal pending orders are not incorrectly marked as exceptions before their handling deadline.
- **Notes / Links:** Replace the narrow `Needs Attention` calculation in `src/components/admin/OrdersView.tsx`. Depends on WEB-012.

### WEB-014 - Add Shipment and Delivery Notifications

- **Priority:** High
- **Area:** checkout
- **Goal:** Automatically keep customers informed from label creation through delivery and reduce order-status support work.
- **Acceptance Criteria:**
  - Label creation sends one shipment email containing carrier, tracking link, shipped items, and estimated delivery.
  - Carrier webhook updates can trigger delivered, delayed, and exception communications according to documented rules.
  - Notification attempts and provider ids are stored, visible to admins, and safely retryable.
  - Order details show the latest transactional email state and provide an idempotent retry action for failed messages.
  - Duplicate carrier or admin events cannot send duplicate customer messages.
- **Verification:**
  - Test shipment, delivery, delay, exception, email-provider failure, and webhook replay scenarios.
  - Verify links and order details in rendered emails on desktop and mobile clients.
- **Notes / Links:** Label creation now sends carrier, tracking, shipped items, and estimated delivery, and the admin retry control targets a failed shipment email before the original confirmation. Carrier delivery/delay/exception webhooks and their replay verification remain. Extend the order-confirmation email infrastructure in `server.ts`; coordinate with WEB-010 and WEB-020.

### WEB-024 - Fix Checkout Newsletter Consent and Actionable Errors

- **Priority:** High
- **Area:** checkout
- **Goal:** Honor the customer's newsletter choice and help customers recover from checkout validation failures.
- **Acceptance Criteria:**
  - The checkout request persists newsletter opt-in, consent timestamp, and source with the pending order.
  - A customer is subscribed only after successful payment and only when explicit consent was recorded.
  - Safe server validation messages, including unavailable inventory, are shown instead of a generic error.
  - Recovery actions let customers return to the cart or adjust an affected quantity without losing unrelated cart items.
  - Phone collection is optional unless a documented carrier or business rule requires it.
- **Verification:**
  - Test opted-in, opted-out, abandoned, failed, and completed checkouts and inspect subscriber records.
  - Test invalid email, inactive product, insufficient inventory, rate limit, and server-error responses.
- **Notes / Links:** The checkbox currently affects analytics only in `src/pages/Checkout.tsx`.

### WEB-001 - Storefront Polish Pass

- **Priority:** Medium
- **Area:** storefront
- **Goal:** Review and polish the public shopping experience across the primary storefront routes.
- **Acceptance Criteria:**
  - Home, shop, product detail, bundles, recipes, FAQ, contact, header, footer, and cart drawer are visually consistent on desktop and mobile.
  - Product cards, recipe content, bundle sections, and navigation states have no obvious broken links, clipped text, empty states, or layout overlap.
  - Add-to-cart interactions remain clear and stable from product listing and product detail pages.
  - Any content or design gaps discovered during review are either fixed or added as follow-up cards.
- **Verification:**
  - Run `npm run lint` and `npm run build`.
  - Browser-check `/`, `/shop`, `/product/:slug`, `/bundles`, `/recipes`, `/faq`, `/contact`, and cart drawer interactions.
- **Notes / Links:** Relevant files include `src/pages/*`, `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/components/CartDrawer.tsx`, and `src/components/ProductCard.tsx`.

### WEB-002 - Checkout End-to-End Regression Verification

- **Priority:** High
- **Area:** checkout
- **Goal:** Perform final end-to-end regression verification after the focused checkout implementation cards are complete; this card does not own their implementation.
- **Acceptance Criteria:**
  - Cart contents produce the expected checkout payload and start a Stripe Checkout session successfully in the configured environment.
  - Newsletter opt-in behavior implemented by WEB-024 is represented correctly in the checkout request.
  - Success page handles valid, pending, missing, and failed session verification states clearly.
  - Checkout errors are user-facing, non-technical, and logged enough for debugging.
  - Any Stripe configuration or webhook gaps are documented as follow-up cards.
- **Verification:**
  - Run `npm run lint` and `npm run build`.
  - Browser-check add-to-cart, `/checkout`, Stripe redirect initiation, and `/checkout/success?session_id=...` states.
  - Inspect server routes for `/api/checkout/create-session`, `/api/checkout/session-status`, and `/api/webhooks/stripe`.
- **Notes / Links:** Run after WEB-011, WEB-015, and WEB-024. Relevant files include `src/pages/Checkout.tsx`, `src/pages/CheckoutSuccess.tsx`, `src/store.ts`, and `server.ts`.

### WEB-003 - Admin Portal End-to-End Regression Verification

- **Priority:** High
- **Area:** admin
- **Goal:** Perform final end-to-end admin regression verification after the focused fulfillment cards are complete; this card does not own their implementation.
- **Acceptance Criteria:**
  - Dashboard, analytics, inventory, orders, audience, and inquiries tabs render correctly with loaded, empty, loading, and error states.
  - Search and refresh behavior works across all admin views without stale or misleading results.
  - Product edit/create flows preserve Stripe fields, inventory values, category data, and display state.
  - Order detail workflows for notes, tracking, fulfillment, refunds, and disputes are understandable and recover gracefully from failed saves.
  - Any required Firestore indexes, rules, or data shape assumptions are documented as follow-up cards.
- **Verification:**
  - Run `npm run lint` and `npm run build`.
  - Browser-check `/admin` sign-in, tab navigation, search, refresh, and core edit/detail flows with seeded or live test data.
- **Notes / Links:** Run after the applicable WEB-009 through WEB-019 implementation cards. Relevant files include `src/pages/Admin.tsx` and `src/components/admin/*`.

### WEB-004 - Analytics and Event Tracking Review

- **Priority:** Medium
- **Area:** analytics
- **Goal:** Confirm analytics events are collected and displayed consistently for the storefront and admin analytics views.
- **Acceptance Criteria:**
  - Product view, add-to-cart, checkout start, and newsletter signup events send the expected payload shape.
  - Failed analytics requests do not break the storefront experience.
  - Admin analytics summaries are clear about current data coverage and missing attribution/conversion data.
  - Daily aggregation behavior in the server matches the event types displayed in the admin portal.
  - Any missing events or reporting blind spots are added as separate follow-up cards.
- **Verification:**
  - Run `npm run lint` and `npm run build`.
  - Inspect `src/lib/analytics.ts`, analytics calls in storefront components, `server.ts`, and `src/components/admin/AnalyticsView.tsx`.
  - Browser-check product detail, add-to-cart, checkout start, and newsletter signup while monitoring network requests.
- **Notes / Links:** Current analytics view already notes missing traffic, conversion rate, ad attribution, and abandoned cart reporting.

## In Progress

No cards currently in progress.

## Review / Verify

### WEB-030 - Prevent Admin Sidebar and Orders Layout Clipping

- **Priority:** High
- **Area:** admin
- **Goal:** Keep the admin navigation readable and the Orders workspace contained within the viewport at desktop and compact widths.
- **Acceptance Criteria:**
  - The desktop sidebar retains its intended width instead of shrinking when Orders content is wide.
  - Compact screens use an icon-only sidebar with accessible labels rather than clipping navigation text.
  - The admin header and Orders list/detail grid wrap within the remaining viewport without horizontal page overflow.
  - Long customer names and email addresses truncate within order cards instead of widening the grid.
- **Verification:**
  - TypeScript validation passed with `tsc --noEmit` using the bundled workspace Node runtime.
  - Production build passed; the existing large-chunk warning remains.
  - Post-deployment browser checks remain at compact, standard desktop, and wide desktop widths.
- **Notes / Links:** Added fixed flex sizing and responsive sidebar/header/content behavior in `src/pages/Admin.tsx`, plus min-width containment in `src/components/admin/OrdersView.tsx`. Discovered from the clipped Orders screenshot.

### WEB-015 - Complete Stripe Payment Event Handling

- **Priority:** High
- **Area:** checkout
- **Goal:** Fulfill only confirmed payments and correctly handle delayed payment success or failure.
- **Acceptance Criteria:**
  - Webhooks handle `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`.
  - A Checkout Session becomes fulfillable only when its payment status is paid.
  - Delayed success creates/updates the order and inventory exactly once; delayed failure releases reservations and records the failure.
  - Webhook claim processing can safely recover a genuinely stale `processing` event rather than suppressing it indefinitely.
  - Stripe CLI fixtures cover duplicate, out-of-order, delayed-success, and delayed-failure events.
- **Verification:**
  - TypeScript validation passed with `tsc --noEmit` using the bundled workspace Node runtime.
  - Production build passed; the existing large-chunk warning remains.
  - Live Stripe CLI duplicate, out-of-order, delayed-success, delayed-failure, and stale-claim checks remain pending configured sandbox services.
- **Notes / Links:** Added expiring event-processing leases with ownership tokens, terminal-state guards, an explicit checkout payment-event audit trail, a transactional analytics marker, and Resend idempotency for confirmation emails. See `server.ts` and `docs/stripe-payment-events.md`.

### WEB-029 - Create and Integrate the Lightning-B Brand System

- **Priority:** High
- **Area:** storefront
- **Goal:** Turn the lightning-B label motif into a consistent secondary mark without overloading the primary horizontal wordmark.
- **Acceptance Criteria:**
  - The brand system includes detailed crest, simplified monogram, stacked lockup, gold-only, black-only, transparent PNG, and editable SVG assets.
  - The simplified monogram remains recognizable at favicon and mobile-header sizes.
  - Desktop header and email retain the horizontal wordmark; mobile header uses the monogram; footer uses the stacked lockup.
  - Visible company-name references consistently use `Boanerges Provisions Co.`
- **Verification:**
  - Inspected the full-color detailed crest, simplified monogram, stacked lockup, and gold-only transparent assets at full resolution; alpha edges and small-mark silhouette are clean.
  - TypeScript `--noEmit` check passed.
  - Production Vite build passed; the existing large-chunk warning remains.
  - Browser-check favicon, mobile header/menu, desktop header, footer, and admin/email branding after deployment.
- **Notes / Links:** Generated from the label crest as a style reference using the built-in image-generation workflow, then normalized into a deterministic project asset suite.

### WEB-028 - Update the Boanerges Provisions Co. Logo

- **Priority:** High
- **Area:** storefront
- **Goal:** Use the correct plural company name consistently across the website and transactional email branding.
- **Acceptance Criteria:**
  - The logo reads `BOANERGES PROVISIONS CO.` exactly.
  - The gold wordmark, rules, and lower ornament remain visually consistent with the existing brand.
  - The asset retains a transparent background and remains legible on dark surfaces.
  - Header, footer, admin, and email-logo surfaces use the updated asset.
- **Verification:**
  - Inspected the 1,092 × 360 transparent asset at full resolution and against a dark background; spelling, ornament, and edge treatment are clean.
  - TypeScript `--noEmit` check passed.
  - Production Vite build passed; the existing large-chunk warning remains.
  - Browser-check header, footer, and admin branding after deployment; inspect the next transactional email.
- **Notes / Links:** Updated from the existing raster source with the built-in image-generation workflow; the original asset remains available as a rollback reference.

### WEB-027 - Prevent Home Hero and Header Overlap

- **Priority:** High
- **Area:** storefront
- **Goal:** Keep the fixed header logo visually separate from the home hero copy at desktop and short-viewport sizes.
- **Acceptance Criteria:**
  - The hero reserves enough top space for the unscrolled announcement bar and header logo.
  - The hero eyebrow and headline do not overlap the logo.
  - Short viewports expand and scroll instead of clipping the oversized hero copy.
  - Mobile and wide desktop hero alignment remains centered and balanced.
- **Verification:**
  - TypeScript `--noEmit` check passed.
  - Production Vite build passed; the existing large-chunk warning remains.
  - Browser-check the home page at mobile, standard desktop, and short desktop viewport heights after deployment.
- **Notes / Links:** Discovered during Stripe checkout visual verification. The home hero used a fixed `h-screen` with no explicit header safe area.

### WEB-026 - Fix Checkout Success Header Contrast

- **Priority:** High
- **Area:** checkout
- **Goal:** Keep the Boanerges logo and navigation legible when Stripe redirects customers to the dark checkout-success page.
- **Acceptance Criteria:**
  - `/checkout/success` and legacy checkout-success routes use the dark-header presentation before scrolling.
  - Header navigation, cart icon, and logo remain legible against the page background.
  - Existing light-page and scrolled-header treatments remain unchanged.
- **Verification:**
  - TypeScript `--noEmit` check passed.
  - Production Vite build passed; the existing large-chunk warning remains.
  - Browser-check the paid, verifying, and payment-review states after deployment.
- **Notes / Links:** Discovered during a successful Stripe Tax sandbox checkout. The route was omitted from `Header.tsx`'s dark-page classification.

### WEB-025 - Improve Confirmation Email Compatibility

- **Priority:** High
- **Area:** checkout
- **Goal:** Make the order-confirmation email render clearly when remote images or modern CSS layout features are unsupported.
- **Acceptance Criteria:**
  - A visible brand wordmark remains when the logo image is unavailable or blocked.
  - Order totals retain clear label/value alignment in common email clients.
  - Shipping addresses use conventional city, state, and postal-code formatting.
  - Order lines show unit price, quantity, and line total.
- **Verification:**
  - TypeScript `--noEmit` check passed.
  - Production Vite build passed; the existing large-chunk warning remains.
  - A new sandbox order remains to be inspected with remote images enabled and disabled.
- **Notes / Links:** Discovered during the successful Stripe Tax sandbox checkout used to verify order creation and inventory commitment.

### WEB-011 - Add Inventory Reservations for Checkout

- **Priority:** High
- **Area:** checkout
- **Goal:** Prevent two active checkouts from selling the same final unit and reduce paid orders requiring manual inventory intervention.
- **Acceptance Criteria:**
  - Checkout creation reserves inventory transactionally for a bounded period.
  - Successful payment converts the reservation to a committed inventory movement exactly once.
  - Checkout expiration and asynchronous payment failure release the reservation exactly once.
  - Cart and checkout errors state which item or quantity is unavailable and offer a recovery path.
  - Admins can identify and resolve expired, stuck, or oversold reservations.
- **Verification:**
  - `npm.cmd run lint` passed.
  - `npm.cmd run build` passed; the existing large-chunk warning remains.
  - A Stripe Tax sandbox checkout completed successfully; the confirmation email was delivered, the order appeared in the admin portal, and Firestore inventory decreased by the purchased quantity.
  - Live concurrent checkout and Stripe webhook replay checks remain pending configured Firebase/Stripe test services.
- **Notes / Links:** Added transactional product reservation counters, bounded Stripe Session expiry, idempotent commit/release events and movements, asynchronous failure release, actionable cart recovery, an admin exception/release panel, server-only reservation rules, and `docs/inventory-reservations.md`.

### WEB-010 - Add Guided One-Click Shipment Fulfillment

- **Priority:** High
- **Area:** admin
- **Goal:** Let an admin validate an order, create a carrier label, record tracking, update status, and notify the customer in one guided workflow.
- **Acceptance Criteria:**
  - The workflow verifies paid/fulfillable state and presents address validation corrections before label purchase.
  - Admins can select an available carrier service and see the rate and delivery estimate before purchase.
  - A successful action stores carrier, service, tracking number/URL, label URL, shipment cost, and shipment timestamp.
  - Tracking URLs are generated from the selected carrier and tracking number rather than entered separately.
  - Shipment status and customer notification update automatically without separate manual saves.
  - Failed or retried requests do not buy duplicate labels and expose a recoverable exception state.
- **Verification:**
  - `npm.cmd run lint` passed.
  - `npm.cmd run build` passed; the existing large-chunk warning remains.
  - Live Shippo test-mode checks for valid, corrected, invalid, and repeated purchases remain pending configured `SHIPPO_API_TOKEN` and sender values.
- **Notes / Links:** Shippo is the selected provider. Added the guided quote/purchase UI, a server-enforced Pack → Validate → Purchase sequence, authenticated server routes, address correction confirmation, persisted quote claims, recoverable purchase exceptions, stored label/tracking/cost data, automatic shipment email, and `docs/shippo-fulfillment.md`.

### WEB-009 - Route Fulfillment Changes Through Authenticated Server APIs

- **Priority:** High
- **Area:** admin
- **Goal:** Replace direct client-side order writes with authenticated, validated, auditable fulfillment operations.
- **Acceptance Criteria:**
  - Pack, ship, cancel, refund, tracking, notes, and notification-retry mutations use server endpoints.
  - Every endpoint verifies a Firebase ID token and the `users/{uid}.role === "admin"` role before changing data.
  - Operations validate allowed state transitions and write actor, timestamp, and outcome audit events.
  - Retried requests are idempotent and cannot duplicate inventory movements, labels, refunds, or emails.
  - The admin UI reports validation, authorization, and partial-operation failures clearly.
- **Verification:**
  - `npm.cmd run lint` passed.
  - `npm.cmd run build` passed; the existing large-chunk warning remains.
  - Source inspection confirms `OrdersView.tsx` no longer imports or calls Firestore write helpers.
  - Live admin, non-admin, signed-out, repeated-request, Stripe refund, and Resend retry checks remain to be exercised with configured test credentials.
- **Notes / Links:** Added authenticated `/api/admin/orders/:orderId/:operation` commands, command idempotency records, outcome audit events, transition/refund validation, Stripe and Resend idempotency, actionable UI errors, and server-only Firestore rules for order mutations.

## Done

### WEB-005 - Firebase and Security Review

- **Priority:** High
- **Area:** infra
- **Goal:** Review Firebase, Firestore, service account, and environment handling so the app is ready for safer local and deployment workflows.
- **Acceptance Criteria:**
  - Admin access rules are documented and match the `users/{uid}.role === "admin"` app expectation.
  - Firestore rules are checked against storefront, checkout, admin, newsletter, contact, analytics, and product data usage.
  - Sensitive local files and env values are reviewed for git safety, with gaps turned into follow-up cards.
  - README or env docs identify required Firebase, Stripe, Resend, and app URL variables without exposing secrets.
- **Verification:**
  - Inspected `firestore.rules`, `.gitignore`, `.env.example`, `src/lib/firebase.ts`, `server.ts`, tracked files, and server env usage.
  - `npm.cmd run lint` passed.
  - `npm.cmd run build` passed after rerunning outside the sandbox because the first build attempt hit an access-denied Vite config load error.
- **Notes / Links:** Added `docs/firebase-security.md`, tightened public Firestore create rules, documented missing env variables, narrowed JSON ignore rules, and created WEB-007/WEB-008 follow-up cards.

### WEB-007 - Add Firebase Storage Rules

- **Priority:** Medium
- **Area:** infra
- **Goal:** Add and deploy Firebase Storage rules before relying on admin product image uploads in production.
- **Acceptance Criteria:**
  - Product image uploads are restricted to authenticated admins.
  - Public product image reads are allowed only for intended product assets.
  - `firebase.json` references the Storage rules file.
  - Local and production deployment steps are documented.
- **Verification:**
  - `npm.cmd run lint` passed.
  - `npm.cmd run build` passed.
  - Firebase CLI/emulator validation was not run because `firebase` is not installed or available on PATH in this environment.
  - Live admin/non-admin browser upload checks were intentionally deferred because they require authenticated Firebase project access.
- **Notes / Links:** Added `storage.rules`, registered it in `firebase.json`, mirrored file type/size validation in `src/components/admin/ProductsView.tsx`, and documented deployment in `docs/firebase-security.md`.
