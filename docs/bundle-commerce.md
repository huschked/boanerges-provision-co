# Bundle commerce operations

Bundle definitions live in the Firestore `bundles` collection and are managed from **Admin → Bundles**. The storefront does not use the retired hard-coded bundle array.

## Publication rules

An active bundle must have a name, slug, description, approved selling price, image URL, specific image alt text, image classification, and two or more unique component products with positive whole-number quantities. Every component must itself be active and publication-ready.

The server recalculates these values for every storefront request and checkout attempt:

- compare-at value from current component prices;
- dollar and percentage savings;
- total bundle weight;
- available bundle quantity from component inventory minus reservations; and
- the Stripe line-item price, tax code, description, and metadata.

Malformed bundles are omitted from the storefront. Sold-out bundles remain visible but cannot be added. Checkout independently validates the current definition, price, and aggregate component demand, so stale or manipulated browser data is not trusted.

## Initial setup

After deploying the site and Firestore rules, sign in and select **Admin → Bundles → Create Starter Templates**. It creates three **inactive** templates only when those document ids do not already exist. Existing bundle documents are never overwritten, and no local Firebase service-account credentials are required.

The optional `npm run seed:bundles` command performs the same operation for development or automation environments that already provide `FIREBASE_SERVICE_ACCOUNT_JSON` or Google Application Default Credentials.

In Admin, review every template's:

1. component products and per-bundle quantities;
2. selling price and calculated current savings;
3. customer description;
4. image and its photograph/illustration classification; and
5. Stripe tax-code override, if the normal product tax code is not appropriate.

Activate a bundle only after those facts are approved. The legacy prices in the templates are starting values, not automatically approved business facts.

## Verification checklist

- Add one in-stock bundle and confirm the same name and selling price in the bundle page, cart, checkout, Stripe, confirmation email, order, and refund view.
- Confirm the order remains one bundle line while the pick list expands the correct component quantities.
- Confirm component inventory and reservations change once, including a replayed Stripe webhook.
- Reduce one component's available inventory and confirm the calculated bundle availability changes.
- Sell out one component and confirm Add Bundle is disabled and checkout rejects a stale cart.
- Change the bundle selling price after placing it in a cart and confirm checkout uses the new server price.
- Test a pre-shipment partial and full bundle cancellation; confirm each component is restored in the correct quantity.
- Confirm Stripe Tax uses the intended tax treatment in test mode.
