# Product catalog readiness

WEB-035 makes an active Firestore product a publishable food-product record, not merely an inventory row.

## Required before activation

- Exact customer-facing name, category, description, and approved primary image
- Current price and exact net weight in ounces
- Whole-number inventory and reorder threshold
- Heat rating from 0–5; the application derives the matching heat label
- Ingredients in the exact approved label order
- Approved allergen and cross-contact statements (use explicit approved statements when none apply; do not leave them blank)
- Storage guidance and shelf-life guidance
- A list of approved dietary claims, or an intentionally empty list
- Product-fact and dietary-claim approval checkboxes

Flavor notes, pairings, tags, featured placement, and the unused Stripe Price ID are optional marketing or merchandising data.

## Existing-product migration

1. Deploy the application changes before editing product documents.
2. Open **Admin → Inventory**. The Catalog publication report lists every active record that is missing required facts.
3. Edit one product at a time using the physical product label and approved operating guidance.
4. If facts are not ready, switch **Active Product** off and save it as a draft.
5. When all required facts are entered, check both approval boxes and activate the product.
6. Compare the SKU in Shop, its product page, cart, checkout, Stripe Checkout, a test order email, order status, and the packing slip.

The storefront and checkout server independently reject incomplete active records. Existing incomplete records are therefore hidden from customers even before their Firestore `active` flag is manually changed. New seed data is always created inactive.

## Deployment note

`firestore.rules` contains the database-side active-product gate and must be deployed through the Firebase rules deployment process; a Vercel deployment does not publish Firestore rules.

## Order history

Checkout copies the product name, price, primary image, net weight, heat data, ingredients, allergen/cross-contact statements, storage, shelf life, dietary claims, and schema version into the pending order. The paid order retains that snapshot, so later catalog edits do not rewrite what the customer purchased.
