# Temporary product media

The eight `public/products/*-illustrative.webp` files are AI-generated ingredient artwork approved by the owner as temporary replacements for unrelated Picsum and Unsplash images. They are not photographs of the finished Boanerges products, jars, or labels.

The storefront identifies these records with `imageType: "illustrative"` and visibly displays **Illustrative image**. Do not change that field to `photograph` unless the asset is replaced with a real product photograph. Temporary primary entries use the `ingredient-art` view role.

## Admin gallery workflow

The primary image is always gallery position one. Admin keeps its URL, alt text, media type, and view role synchronized with the product's primary media fields. Up to three additional images may be uploaded or entered by URL, then reordered or removed, for a maximum of four product views.

Every gallery entry requires:

- a working image URL;
- specific alt text naming the product and view;
- `photograph` or `illustrative` media type; and
- one of `jar-front`, `salt-detail`, `label-detail`, `in-use`, `ingredient-art`, or `other` as its view role.

An active product cannot be saved when gallery metadata is incomplete, a URL is duplicated, or the first gallery entry conflicts with the primary image. Removing an uploaded gallery entry from a product does not delete the underlying Storage file, which prevents accidental loss while editing.

## Generated asset mapping

| Product | Temporary asset |
| --- | --- |
| Smoked Jalapeño Garlic | `/products/smoked-jalapeno-garlic-illustrative.webp` |
| Habanero Lime Garlic | `/products/habanero-lime-garlic-illustrative.webp` |
| Hot Lemon Pepper | `/products/hot-lemon-pepper-illustrative.webp` |
| Smoky Habanero Paprika | `/products/smoky-habanero-paprika-illustrative.webp` |
| Roasted Garlic Ghost Pepper | `/products/roasted-garlic-ghost-pepper-illustrative.webp` |
| Smoked Garlic Onion | `/products/smoked-garlic-onion-illustrative.webp` |
| Lemon Rosemary | `/products/lemon-rosemary-illustrative.webp` |
| Porcini Garlic Umami | `/products/porcini-garlic-umami-illustrative.webp` |

## Generation prompt set

Each image used the following common prompt, with the product-specific ingredients and natural accent colors substituted:

> Create a photorealistic editorial food photograph representing [PRODUCT] finishing salt. On a matte black stone surface, center a small mound of coarse flaky sea salt visibly blended with [INGREDIENTS], with restrained whole ingredient cues nearby. Use a consistent square, close three-quarter overhead catalog composition, soft directional studio light, deep shadows, warm highlights, and a charcoal, parchment, and antique-gold palette. Ingredient artwork only: no jar, package, label, logo, typography, hands, utensils, claims, or watermark. Keep the blend visually plausible; avoid neon colors, oversized pieces, powdered seasoning replacing the salt, floating ingredients, and fake text.

Product-specific subjects were:

- Smoked Jalapeño Garlic: muted green smoked jalapeño and golden roasted garlic
- Habanero Lime Garlic: orange habanero, lime zest, and golden garlic
- Hot Lemon Pepper: cracked black pepper, lemon zest, and restrained red chile
- Smoky Habanero Paprika: brick-red smoked paprika and orange habanero
- Roasted Garlic Ghost Pepper: deep-red ghost pepper and roasted garlic
- Smoked Garlic Onion: toasted onion and smoked roasted garlic
- Lemon Rosemary: lemon zest and dry rosemary
- Porcini Garlic Umami: dried porcini and roasted garlic

## Deployment order

1. Deploy the website so the new `/products/*-illustrative.webp` paths exist.
2. Run `npm run migrate:media` with the Firebase Admin credentials for the intended project. The script only merges media fields into existing product documents and does not alter price, facts, or inventory.
3. Verify every SKU in Shop, PDP, cart, checkout, email, and order status.
4. Replace each asset through Admin as real photography becomes available. Uploaded images default to `photograph`; supply specific alt text and the correct view role before activation.
