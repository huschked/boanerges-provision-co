# Analytics and ad tracking

WEB-004 keeps first-party operational events in Firestore and optionally sends consented storefront events to Google Analytics 4 and Meta Pixel.

## Deployment configuration

Create a GA4 web data stream and a Meta dataset/pixel, then add these public identifiers to the Vercel Production environment:

```text
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_META_PIXEL_ID=123456789012345
```

Redeploy after changing either value. Leaving one blank disables that provider. These IDs are public browser identifiers, not API secrets. Do not add a Meta Conversions API access token with a `VITE_` prefix.

## Consent behavior

- Necessary storage is always available for the cart, checkout continuity, security, and the stored privacy choice.
- GA4 loads only when analytics consent is granted.
- Meta Pixel loads only when advertising consent is granted.
- Visitors can reopen Cookie Choices from the footer or Privacy Policy.
- First-party operational events continue without provider cookies and intentionally exclude direct customer contact data.

## Event mapping

| Storefront action | GA4 | Meta |
| --- | --- | --- |
| Route view | `page_view` | `PageView` |
| Product view | `view_item` | `ViewContent` |
| Add product or bundle | `add_to_cart` | `AddToCart` |
| One-time checkout start | `begin_checkout` | `InitiateCheckout` |
| Subscription checkout start | `begin_checkout` with subscription context | `InitiateCheckout` |
| Verified paid checkout | `purchase` | `Purchase` |
| Newsletter signup | `sign_up` | `Lead` |
| Contact form success | `generate_lead` | `Contact` |

Purchase events use the Stripe Checkout Session/order ID as the transaction and event ID. The browser stores a per-transaction marker so refreshing the confirmation page does not emit another purchase.

## Verification

1. Deploy with one or both IDs configured.
2. Open the site in a private browser window and confirm neither provider script loads before a choice.
3. Choose Necessary only and confirm the provider scripts remain blocked while shopping and checkout still work.
4. Reopen Cookie Choices, grant Analytics and Advertising, and confirm the GA and Meta scripts load.
5. Use Google Tag Assistant/GA4 DebugView and Meta Events Manager Test Events (or Meta Pixel Helper) to inspect `PageView`, product view, add-to-cart, checkout, and test-purchase events.
6. Refresh the successful-payment page and confirm the same purchase is not sent again.
7. Confirm requests contain product/catalog details but no customer email, name, phone, or shipping address.

Official references: [GA4 ecommerce measurement](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce), [Google consent mode](https://support.google.com/analytics/answer/10000067), and [Meta Pixel documentation](https://developers.facebook.com/docs/meta-pixel/).
