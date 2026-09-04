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

### WEB-021 - Add Consistent Order References and Fulfillment Copy

- **Priority:** Medium
- **Area:** checkout
- **Goal:** Use one customer-friendly order reference and one accurate delivery promise everywhere.
- **Acceptance Criteria:**
  - A human-readable order number is generated once and used in checkout success, emails, admin search, packing slips, and support workflows.
  - Handling, shipping, and delivery estimates are sourced from shared configuration.
  - Checkout, FAQ, order confirmation, shipment email, and order-status copy no longer conflict.
- **Verification:**
  - Complete a test order and compare the reference and timing language in every customer/admin surface.
- **Notes / Links:** Current views use different slices of the Stripe Checkout Session id.

### WEB-023 - Replace Placeholder Admin Metrics and Optimize App Bundles

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
  - The launch checklist verifies legal routes, customer contact details, internal links, product-content completeness, and the absence of placeholder or unsupported claims.
  - A test-purchase matrix covers every enabled individual SKU and sellable bundle.
  - Any missing assets, placeholder copy, or obvious launch blockers are added as separate kanban cards.
- **Verification:**
  - Read README setup from a fresh-contributor perspective.
  - Run `npm run lint` and `npm run build`.
- **Notes / Links:** Current README still appears close to the initial AI Studio scaffold.

### WEB-041 - Replace Template-Led Copy with Product Evidence

- **Priority:** Medium
- **Area:** content/storefront
- **Goal:** Preserve the premium Boanerges voice while grounding product and brand claims in concrete, approved facts.
- **Acceptance Criteria:**
  - Homepage and PDP copy clearly explain what finishing salt is, how much to use, when to apply it, and what each flavor pairs with.
  - Founder, location, sourcing, pepper varieties, process, batch, and food-quality details appear only when provided and approved by the business.
  - Repetitive or vague `artisan`, `premium`, `sacred`, `bold`, and `refined` language is reduced in favor of useful evidence.
  - Extreme-heat products include clear starting-amount and handling guidance approved by the business.
  - Homepage trust sections are consolidated and customer education, products, and bundle value precede the longer brand story.
- **Verification:**
  - Owner-review every factual claim and compare PDP guidance with product labels and approved product records.
  - Browser-check homepage and PDP information hierarchy on desktop and mobile.
- **Notes / Links:** Requires business-provided facts and authentic process/founder media; implementation should not invent sourcing, production, safety, or founder details.

## Ready

### WEB-044 - Add Compliant Marketing Email Preferences

- **Priority:** High
- **Area:** checkout/content/infra
- **Goal:** Give newsletter recipients a reliable opt-out and ensure marketing messages contain the required sender information.
- **Acceptance Criteria:**
  - Every marketing email has an accurate sender identity, non-deceptive subject, working unsubscribe action, and a configured valid physical postal address.
  - Unsubscribe requests update the Firestore subscriber and Resend audience/suppression state without requiring login or information beyond the email/link token.
  - Opt-out requests are honored within the applicable deadline and cannot be reversed by a replayed signup or checkout event without fresh consent.
  - Transactional order messages remain distinct from marketing messages and do not silently add promotional content that changes their primary purpose.
  - Preference changes are idempotent, auditable, rate-limited, and covered by the Privacy Policy.
- **Verification:**
  - Send marketing and transactional test messages, exercise unsubscribe/re-subscribe/replay cases, and confirm provider and Firestore state.
  - Confirm the configured postal address and final email templates with the business owner before launch.
- **Notes / Links:** Added after reviewing FTC CAN-SPAM guidance during WEB-038. A street address, registered USPS post office box, or qualifying registered private mailbox may be used; do not publish a private address without owner approval.

### WEB-039 - Repair Merchandising Navigation and CTA Destinations

- **Priority:** High
- **Area:** storefront
- **Goal:** Ensure high-intent navigation and merchandising actions always lead to the promised product or collection.
- **Acceptance Criteria:**
  - Header and mobile navigation use consistent `Shop Salts`, `Bundles & Gifts`, `Pairing Guide`, and `Our Story` labels when their destinations are ready.
  - Best Sellers resolves to a real curated collection and never produces an accidental empty page.
  - Each Pairing Guide product CTA deep-links to the exact product; unused Instagram CTAs are removed or linked to a real profile.
  - Add-to-cart produces visible and screen-reader-announced success feedback.
  - Automated route/link checks cover customer-facing internal CTAs.
- **Verification:**
  - Exercise every header, footer, homepage, product, bundle, and Pairing Guide CTA on desktop and mobile.
- **Notes / Links:** Do not promote Bundles & Gifts until WEB-036 makes bundle purchasing safe.

### WEB-040 - Complete a Mobile Commerce and Accessibility Pass

- **Priority:** High
- **Area:** storefront/accessibility
- **Goal:** Make browsing and purchasing efficient for touch, keyboard, and assistive-technology users.
- **Acceptance Criteria:**
  - Icon-only controls, sort/filter controls, heat scales, cart changes, and dynamic confirmations have meaningful accessible names or live text.
  - Contact and signup labels are programmatically associated with their inputs and validation/status feedback is announced.
  - Interactive targets meet a practical 44-by-44-pixel minimum without making compact mobile cards unusable.
  - Product add controls remain discoverable on touch; PDP purchase actions remain accessible after the primary controls scroll away.
  - Cart content scrolls clearly without being hidden behind its summary, and Shop shows a loading skeleton rather than a false empty state.
  - Small low-opacity utility copy and focus indicators meet appropriate readability and contrast expectations.
- **Verification:**
  - Keyboard and screen-reader smoke-test the complete browse, cart, contact, and checkout path.
  - Browser-check mobile, tablet, desktop, zoom, reduced-motion, loading, empty, and error states.
- **Notes / Links:** Prefer responsive card behavior based on available width instead of forcing two columns on every small phone.

### WEB-042 - Implement Subscribe & Save with Stripe Billing

- **Priority:** High
- **Area:** checkout/admin
- **Goal:** Offer a trustworthy recurring-purchase option that creates, bills, fulfills, and lets customers manage subscriptions end to end.
- **Acceptance Criteria:**
  - Eligible products have server-owned Stripe recurring prices and supported delivery cadences; one-time and subscription items remain distinct in cart and checkout.
  - Customers see the recurring price, cadence, shipping/tax treatment, renewal terms, cancellation policy, and consent before purchase.
  - Stripe Billing webhooks create exactly one fulfillment order per paid renewal and do not fulfill failed, incomplete, duplicated, or replayed invoices.
  - Renewal orders reserve/decrement inventory safely and expose out-of-stock, payment-failure, cancellation, pause, and recovery states to admins.
  - Confirmation, upcoming-renewal where required, payment-failure, shipment, cancellation, and resumption communications are idempotent and auditable.
  - Customers can securely manage payment method, cadence where supported, pause/cancel, and billing history through Stripe's customer portal or an equivalent authenticated flow.
  - Refund, tax, shipping, discount, and customer-support workflows clearly distinguish subscription orders.
- **Verification:**
  - Stripe test clocks cover signup, trial if offered, renewal, duplicate webhook, failed/retried payment, cancellation, pause/resume, price change, inventory shortage, refund, and portal access.
  - Complete a production-readiness review of webhook secrets, customer communication, policy copy, and recurring-payment disclosures.
- **Notes / Links:** Depends on accurate product data from WEB-035 and consistent fulfillment promises from WEB-021. WEB-037 hides the current nonfunctional UI only until this card passes verification.

### WEB-043 - Add Verified-Buyer Review Requests and Moderated Reviews

- **Priority:** Medium
- **Area:** storefront/checkout/admin
- **Goal:** Build credible social proof by requesting and publishing reviews only from customers who purchased the reviewed product.
- **Acceptance Criteria:**
  - An idempotent review-request email is scheduled from a documented post-delivery delay and sent only for eligible delivered orders.
  - Each request uses a signed, expiring, single-purpose link tied to the order and purchased product without exposing customer or order data.
  - A verified buyer can submit one rating and review per purchased product, with clear consent for public display and safe edit/support handling.
  - Duplicate, forged, expired, cross-product, abusive, and rate-limited submissions are handled safely.
  - Reviews enter a moderation queue with publish/reject controls, audit history, and protection against silently changing the customer's meaning.
  - PDP aggregates are calculated only from published verified reviews and display honest zero-review states.
  - Review emails include unsubscribe/preferences handling appropriate to transactional review requests, and any incentive is disclosed prominently.
- **Verification:**
  - Test delivered/not-delivered eligibility, delayed scheduling, duplicate carrier events, token tampering/expiry, one-review enforcement, moderation, aggregate recalculation, rejection, and email replay.
  - Submit and publish a review from a real sandbox order, then confirm the correct PDP count and content.
- **Notes / Links:** Reuses the completed delivery lifecycle from WEB-014 and signed-link patterns from WEB-020. Do not restore hard-coded ratings while this feature is under development.

### WEB-001 - Storefront Polish Pass

- **Priority:** High
- **Area:** storefront
- **Goal:** Perform the final public-storefront visual and interaction regression after the audit remediation cards are complete.
- **Acceptance Criteria:**
  - Home, shop, product detail, bundles, recipes, FAQ, contact, header, footer, and cart drawer are visually consistent on desktop and mobile.
  - Product cards, recipe content, bundle sections, and navigation states have no obvious broken links, clipped text, empty states, or layout overlap.
  - Add-to-cart interactions remain clear and stable from product listing and product detail pages.
  - Any content or design gaps discovered during review are either fixed or added as follow-up cards.
- **Verification:**
  - Run `npm run lint` and `npm run build`.
  - Browser-check `/`, `/shop`, `/product/:slug`, `/bundles`, `/recipes`, `/faq`, `/contact`, and cart drawer interactions.
- **Notes / Links:** Run after WEB-034 through WEB-040 and any customer-facing portion of WEB-042/WEB-043 that is enabled for launch. Relevant files include `src/pages/*`, `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/components/CartDrawer.tsx`, and `src/components/ProductCard.tsx`.

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
  - Hero/merchandising CTA, collection/filter use, product view, product-detail engagement, bundle selection, add-to-cart outcome, checkout start, inventory error, subscription, review request/submission, and newsletter signup events send the expected payload shape when their features are enabled.
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

## Review / Verify

### WEB-036 - Rebuild or Disable Bundle Commerce

- **Priority:** High
- **Area:** storefront/checkout
- **Goal:** Ensure advertised bundles are real sellable offers with correct pricing, inventory, tax, and fulfillment behavior.
- **Acceptance Criteria:**
  - Bundle definitions come from managed server data rather than `src/data/products.ts` or invented client inventory.
  - Compare-at value, selling price, savings amount/percentage, components, quantities, sizes, and images are calculated and displayed accurately.
  - Bundle stock derives from available component inventory and unavailable bundles cannot be added or checked out.
  - Cart and order records preserve bundle identity while fulfillment and inventory decrement the correct components exactly once.
  - Stripe receives the intended bundle price, tax treatment, description, and fulfillment metadata; server validation prevents client price manipulation.
  - Existing bundle purchase controls remain disabled until these requirements pass.
- **Verification:**
  - Automated coverage validates bundle value, savings, component-limited stock, invalid definitions, component-expanded pick lists, component-expanded refunds, and the existing repeated-webhook protections.
  - Deploy the code and Firestore rules, run `npm run seed:bundles`, approve bundle facts in Admin, and test the scenarios in `docs/bundle-commerce.md` against Stripe test mode and live Firestore records.
- **Progress:** Firestore-managed definitions, Admin bundle management, server-resolved storefront offers, component-derived availability, server-owned Stripe pricing/tax metadata, preserved order identity, component reservations/decrements, pick-list expansion, and component-aware cancellation restocking are implemented. Hard-coded client bundle definitions and invented client inventory are removed.
- **Notes / Links:** Operational and owner verification is documented in `docs/bundle-commerce.md`. Template prices remain inactive until owner-approved. Advanced Build Your Own and gift options can follow after the curated bundle foundation is verified.

### WEB-035 - Enforce Complete and Consistent Product Data

- **Priority:** High
- **Area:** storefront/checkout/admin
- **Goal:** Make Firestore the authoritative, publish-safe source for accurate food-product information on every customer and operational surface.
- **Acceptance Criteria:**
  - Active products require exact net weight, ingredients in approved order, allergen/cross-contact language, storage guidance, shelf life, price, inventory, heat rating/label, and approved dietary claims.
  - Admin validation distinguishes required facts from optional marketing copy and blocks incomplete records from becoming active.
  - Shop, PDP, cart, checkout, Stripe line items, emails, packing slips, and order status use the same stored price, size, name, and image data.
  - Orders retain an immutable snapshot of the facts shown at purchase even if the product is edited later.
  - A migration/report identifies currently active products with incomplete or conflicting data.
- **Verification:**
  - Shared publication validation, storefront filtering, server checkout enforcement, complete order snapshots, and the Admin catalog report are implemented.
  - TypeScript validation, all 33 automated tests, and the production build pass; the existing large-chunk warning remains.
  - Owner must enter approved facts for each real SKU, deploy `firestore.rules`, confirm incomplete active records are reported/hidden, and compare one complete test SKU across Shop, PDP, cart, Stripe Checkout, confirmation email, order status, and packing slip.
- **Notes / Links:** Migration and verification instructions are in `docs/product-catalog-readiness.md`. No ingredient, allergen, cross-contact, storage, shelf-life, or dietary values were invented.

## Done

### WEB-034 - Replace Placeholder Product Media

- **Priority:** High
- **Area:** storefront/content
- **Goal:** Present every sellable product with accurate, trustworthy media rather than unrelated stock or placeholder imagery.
- **Acceptance Criteria:**
  - Picsum, unrelated stock imagery, broken sources, and generic detail thumbnails are removed from customer-facing product and bundle surfaces.
  - The product schema supports an ordered gallery with a jar-front image, salt/texture detail, label detail, and product-in-use image where supplied.
  - Missing required media prevents a product from being published as active.
  - Alt text identifies the actual product and view rather than using generic values such as `Detail`.
  - Cart, checkout, emails, product cards, PDPs, and bundles use the same approved primary image.
- **Verification:** TypeScript, automated tests, production build, source scans, direct asset checks, and owner browser verification pass. Owner confirmed WEB-034 on 2026-09-03.
- **Notes / Links:** The owner approved clearly disclosed AI-generated ingredient artwork as temporary media. Replace it with real jar, label, texture, and in-use photography when available; do not treat the illustrative assets as exact depictions of the finished products.

### WEB-038 - Publish Legal Pages and Clean Customer Trust Surfaces

- **Priority:** High
- **Area:** content/infra
- **Goal:** Give customers working policy links and truthful ways to identify and contact the business.
- **Acceptance Criteria:**
  - `/terms` and `/privacy` render complete pages and survive direct Vercel navigation/refresh.
  - Newsletter and checkout consent copy links to the applicable policy pages.
  - Fake phone/address data is removed or replaced with approved business information and a clear response-time expectation.
  - Placeholder social links are hidden until real profiles exist.
  - Admin Portal is removed from customer navigation and remains available only by direct protected URL.
  - Footer policy and support links have no broken destinations.
- **Verification:**
  - Source checks confirmed both React routes, both Vercel direct-navigation rewrites, and policy links from the footer and consent surfaces.
  - Source checks confirmed fake contact details, placeholder social links, and the customer-facing Admin link are absent.
  - TypeScript validation, all 29 automated tests, and the production build passed; the existing large-chunk warning remains.
  - Owner confirmed the deployed implementation on 2026-09-03.
- **Notes / Links:** Draft policy assumptions, owner-review items, and authoritative references are documented in `docs/legal-policy-review.md`. WEB-044 tracks the separate marketing-email unsubscribe and postal-address workflow discovered during review.

### WEB-037 - Remove Unsupported Storefront Claims

- **Priority:** High
- **Area:** storefront/content
- **Goal:** Prevent customers from seeing fabricated, contradictory, or not-yet-implemented promises while their full features are being built.
- **Acceptance Criteria:**
  - Hard-coded ratings/review counts and the unverified chef testimonial are removed until WEB-043 supplies genuine moderated reviews.
  - Subscribe & Save controls and FAQ promises are hidden until WEB-042 is production-ready.
  - `30-Day Returns` is replaced with policy-accurate final-sale and damaged-order support copy.
  - Dietary, sourcing, production, and no-fillers claims appear only when approved and supported by product/business records.
  - Processing and shipping promises use the shared copy established by WEB-021.
- **Verification:**
  - Source search confirms the hard-coded reviews, testimonial, subscription promises, `30-Day Returns`, 48-hour promise, `Standard artisan delivery`, and `100% Homegrown` wording are absent.
  - TypeScript validation, all 29 automated tests, and the production build pass; the existing large-chunk warning remains.
  - User verified the deployed PDP, homepage, FAQ, checkout, email signup, and returns-policy copy.
- **Notes / Links:** The owner confirmed `Homegrown peppers`, gluten-free/vegan, no fillers or anti-caking agents, natural ingredients, fresh-dried herbs, and premium sea salt are accurate. Subscription and review claims remain hidden only until WEB-042 and WEB-043 are complete.

### WEB-017 - Add Packing Slips and Consolidated Pick Lists

- **Priority:** Medium
- **Area:** admin
- **Goal:** Reduce packing mistakes and manual transcription by generating printable fulfillment documents.
- **Acceptance Criteria:**
  - Each order can produce a printable packing slip with order reference, customer, validated address, product ID/item, remaining quantity, and internal packing instructions.
  - Paid pending or packed orders can be selected for a consolidated pick list grouped by product ID and size.
  - Packing slips include a QR code that opens the matching order behind admin authentication.
  - Print layouts target letter-size paper and omit the admin navigation and decorative styling.
- **Verification:**
  - Automated tests cover canceled quantities, repeated product lines, cross-order grouping, and fulfillment eligibility.
  - TypeScript validation and the production build pass.
  - User verified single-order packing slips, consolidated pick lists, print layout/page breaks, QR navigation, and printer margins in the deployed workflow.
- **Notes / Links:** Product IDs serve as internal SKUs until dedicated SKU fields are needed. The print workflow is implemented in `src/components/admin/FulfillmentPrintDocuments.tsx` and documented in `docs/fulfillment-documents.md`. WEB-016 can extend the same selection model with saved queues and broader batch actions.

### WEB-018 - Build a Coordinated Cancellation and Refund Workflow

- **Priority:** Medium
- **Area:** admin
- **Goal:** Let an admin cancel or refund an order without separately reconciling Stripe, inventory, labels, customer communication, and order state.
- **Acceptance Criteria:**
  - Admins can issue full or partial refunds with a required reason.
  - The workflow prevents refunding more than the remaining paid amount.
  - Inventory is restored only for eligible units canceled before shipment; physical customer returns are never added back to sellable inventory.
  - Unused labels can be voided when supported, and shipped-order refunds show an additional warning.
  - The customer receives a refund/cancellation notification and the order audit trail records the actor and outcome.
- **Verification:**
  - Seven automated planning tests pass for full, partial, repeated, pre-shipment, post-shipment, inventory, and label-void rules.
  - TypeScript validation and the production build pass.
  - User verified the coordinated Stripe, Shippo, Firestore inventory, Resend notification/retry, audit, and failure-handling workflow.
- **Notes / Links:** The authenticated workflow is implemented in `server.ts` and the admin order detail. It coordinates Stripe, Shippo, inventory, order state, email, and audit outcomes; incomplete downstream work becomes an explicit exception instead of triggering another refund. Boanerges does not accept physical food returns. The published policy lives at `/returns`. See `docs/refund-cancellation-workflow.md`.

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
  - `npm run lint` and `npm run build` passed during the underlying implementation work.
  - User completed the deployed checkout regression covering the cart, Stripe redirect, checkout success, newsletter choice, recovery behavior, and order-status flow.
  - Server checkout-session and Stripe webhook routes were exercised through the deployed end-to-end flow.
- **Notes / Links:** Completed after WEB-011, WEB-015, and WEB-024. Relevant files include `src/pages/Checkout.tsx`, `src/pages/CheckoutSuccess.tsx`, `src/store.ts`, and `server.ts`.

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
  - Automated consent tests cover paid opt-in, paid opt-out, pending/abandoned, failed payment, and missing-email gating.
  - TypeScript validation, all 12 checkout/lifecycle tests, and the production build pass.
  - User completed the deployed verification of consent persistence/activation and checkout recovery/error behavior.
- **Notes / Links:** Checkout consent is persisted with server timestamps and activated only by paid-order effects. Customer-safe errors preserve the cart and provide targeted quantity adjustment, removal, retry, and return-to-shop actions. Cart state now survives Stripe's Back/cancel return and clears only after verified payment. Stripe phone collection is optional. See `docs/checkout-consent-and-recovery.md`.

### WEB-033 - Refine the Admin Orders Workspace Layout

- **Priority:** High
- **Area:** admin/accessibility
- **Goal:** Turn the Orders screen into a clear, efficient master-detail fulfillment workspace at desktop and compact widths.
- **Acceptance Criteria:**
  - The desktop order queue does not stretch to the height of a long detail record and remains available while the detail page scrolls.
  - Order rows and the detail summary label payment, fulfillment, and shipment states explicitly.
  - Healthy inventory reservations use a compact status treatment while exceptions remain prominent and actionable.
  - Technical payment identifiers are available without competing with operational details.
  - Compact screens use a list-to-detail flow with an accessible return action.
  - Shippo-generated tracking fields are clearly read-only and refund submission requires explicit confirmation.
- **Verification:**
  - TypeScript validation and the production build pass.
  - User verified the deployed Orders workspace across the relevant desktop and compact layouts.
- **Notes / Links:** Added a bounded sticky order queue, sticky detail summary/actions, explicit lifecycle badges, compact reservation health, collapsible Stripe identifiers, stronger selected-row focus, mobile list/detail navigation, and safer tracking/refund controls in the admin Orders workspace.

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
  - Automated tests cover legacy normalization and valid/invalid payment, fulfillment, shipment, dispute recovery, return, and carrier-exception transitions.
  - TypeScript validation and the production build pass.
  - User verified migrated and newly created order lifecycle states in the deployed admin portal.
- **Notes / Links:** Added the versioned lifecycle model and transition guards in `src/lib/orderLifecycle.ts`, normalized legacy orders at read and server-operation boundaries, stopped mirroring fulfillment into legacy `status`, separated carrier delivery from warehouse completion, and documented the model in `docs/order-lifecycle.md`.

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
  - Automated lifecycle tests cover delivered, delayed, exception, ordinary transit, exact-quote replay, in-flight purchase, and second-quote label protection.
  - TypeScript validation passed with `tsc --noEmit`.
  - User verified production webhook delivery, shipment notifications, carrier updates, replay protection, and rendered emails.
- **Notes / Links:** Added a secret-protected `track_updated` Shippo webhook, deterministic event claims, tracking state persistence, delivered/delayed/exception emails, notification-attempt records, and admin status/retry support. Production configuration is documented in `docs/shippo-fulfillment.md`.

### WEB-032 - Improve Admin Dropdown Contrast

- **Priority:** High
- **Area:** admin/accessibility
- **Goal:** Keep native dropdown choices readable against the dark admin form styling.
- **Acceptance Criteria:**
  - Edit Provision category choices use a dark background with high-contrast text.
  - Other `.input-premium` selects in Analytics, Messages, and Shippo inherit the same readable treatment.
  - Public light-form controls remain unchanged.
- **Verification:**
  - TypeScript validation passed with `tsc --noEmit` using the bundled workspace Node runtime.
  - Production build passed; the existing large-chunk warning remains.
  - User verified the Edit Provision and related admin dropdown contrast after deployment.
- **Notes / Links:** Added a dark native control color scheme and explicit option colors for `select.input-premium` in `src/index.css`.

### WEB-031 - End Admin Authentication When Leaving the Portal

- **Priority:** High
- **Area:** admin/security
- **Goal:** Prevent an authenticated admin session from silently carrying across navigation away from the protected portal.
- **Acceptance Criteria:**
  - Navigating from `/admin` to a storefront route explicitly signs out Firebase Auth.
  - Returning to or refreshing `/admin` requires a fresh Google sign-in.
  - Admin authentication uses memory-only persistence and is not restored from long-lived browser storage.
  - The existing 15-minute inactivity timeout and explicit Sign Out control continue to work.
- **Verification:**
  - TypeScript validation passed with `tsc --noEmit` using the bundled workspace Node runtime.
  - Production build passed; the existing large-chunk warning remains.
  - User verified login, storefront navigation, browser back, refresh, idle timeout, and explicit logout after deployment.
- **Notes / Links:** Added route-exit sign-out in `src/App.tsx` and secure admin-session initialization in `src/pages/Admin.tsx`.

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
  - User verified the sidebar and Orders layout at compact, standard desktop, and wide desktop widths.
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
  - User completed the configured payment-event verification, including duplicate, out-of-order, delayed, and recovery behavior.
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
  - User verified the favicon, mobile and desktop headers, footer, admin, and email branding after deployment.
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
  - User verified the updated logo across the deployed header, footer, admin, and transactional email surfaces.
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
  - User verified the deployed home hero at mobile, standard desktop, and short desktop viewport sizes.
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
  - User verified the deployed checkout-success header in the paid, verifying, and payment-review states.
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
  - User verified the confirmation email rendering through a deployed test order.
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
  - User completed the configured concurrent-checkout, reservation, inventory, and Stripe webhook replay verification.
- **Notes / Links:** Added transactional product reservation counters, bounded Stripe Session expiry, idempotent commit/release events and movements, asynchronous failure release, actionable cart recovery, an admin exception/release panel, server-only reservation rules, and `docs/inventory-reservations.md`.

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
  - User completed the configured admin, authorization, repeated-request, Stripe refund, and Resend retry verification.
- **Notes / Links:** Added authenticated `/api/admin/orders/:orderId/:operation` commands, command idempotency records, outcome audit events, transition/refund validation, Stripe and Resend idempotency, actionable UI errors, and server-only Firestore rules for order mutations.

### WEB-020 - Add Secure Customer Order Tracking

- **Priority:** Medium
- **Area:** checkout
- **Goal:** Reduce order-status inquiries by giving customers a secure, account-free view of fulfillment and tracking progress.
- **Acceptance Criteria:**
  - Confirmation, shipment, and carrier-update emails link to a 90-day HMAC-signed order-status URL when production signing is configured.
  - Checkout success also links to the status page once the webhook-created order is available.
  - The page shows purchased items, totals, fulfillment stage, tracking, estimated delivery, and support contact.
  - A strict public response whitelist excludes customer identity, address, product ids, admin notes, Stripe fields, and internal order ids.
  - Missing, invalid, expired, modified, cross-order, and nonexistent-order tokens do not expose order data.
  - Address-change and cancellation contact options appear only while the order remains eligible.
- **Verification:**
  - Six targeted tests cover valid, expired, modified, and cross-order tokens; response privacy; change eligibility; and unsafe tracking links.
  - All 29 automated tests and TypeScript validation pass.
  - Production build passes, and the deployed signed order-status link was verified successfully in the browser.
- **Notes / Links:** The public route is `/order-status`; the rate-limited API is `/api/order-status`. Production uses a stable `ORDER_STATUS_SECRET` of at least 32 unpredictable characters so emailed links remain valid. See `docs/customer-order-status.md`.

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
  - Automated classifier fixtures cover all nine exception types, severity ordering, normal pending deadlines, and automatic removal after resolution.
  - TypeScript validation, 11 lifecycle/exception tests, and the production build pass.
  - User verified the dashboard links, filtered exception queue, exception presentation, and resolution behavior in the deployed admin portal on September 3, 2026.
- **Notes / Links:** Replaced the narrow `Needs Attention` calculation with the shared classifier in `src/lib/orderExceptions.ts`. Shippo address failures are recorded and cleared by validation; packing, refunds, label purchase, email retry, and tracking updates clear their corresponding underlying markers. Operational rules are documented in `docs/order-exceptions.md`.

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
  - `npm.cmd run lint` and `npm.cmd run build` passed during implementation; TypeScript validation passed after the final lifecycle changes.
  - Live Shippo test mode verified valid and corrected addresses, invalid-address handling, carrier rates, label purchase, stored tracking/status, and shipment email delivery.
  - Automated tests verify exact-quote replay, in-flight purchase blocking, and rejection of a second quote once an order already has a label.
- **Notes / Links:** Shippo is the selected provider. Added the guided quote/purchase UI, a server-enforced Pack → Validate → Purchase sequence, authenticated server routes, address correction confirmation, persisted quote claims, recoverable purchase exceptions, stored label/tracking/cost data, automatic shipment email, and `docs/shippo-fulfillment.md`.

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
