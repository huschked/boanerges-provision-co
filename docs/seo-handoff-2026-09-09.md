# WEB-049 SEO, Ecommerce Search, and AI Discovery Handoff

Audit date: 2026-09-09  
Canonical production origin: `https://www.boanergesprovisions.com` (configured through `APP_URL`)  
Launch state: prelaunch gate remains enabled and public storefront responses remain `noindex`

This document records what was inspected, what is implemented, what is intentionally deferred, and how to verify the production deployment. Search visibility is earned and monitored; none of these changes guarantees a ranking, rich result, shopping placement, or AI citation.

## Pre-change audit

### Critical

1. Public routes returned the same JavaScript shell. Product name, price, availability, description, canonical, and schema were absent from initial HTML.
2. Coming Soon applied `noindex` only after JavaScript ran. The HTTP response itself had no indexation directive.
3. There was no production `robots.txt` or XML sitemap.
4. Product and content routes had no canonical tags, so search/sort/tracking query combinations had no consolidation signal.

### High

1. Every route inherited one generic title and had no meta description, Open Graph, Twitter, or route-level metadata.
2. Product pages had no `Product`/`Offer` structured data; published review data was not represented in schema.
3. Private routes such as Admin, checkout, order status, review, and email preferences had no server-visible exclusion policy.
4. Missing product behavior depended on client JavaScript and did not reliably expose an HTTP 404.
5. No current Search Console, Bing Webmaster Tools, Merchant Center, or AI-crawler handoff existed.

### Nice to have / post-launch iteration

1. Dedicated, search-demand-backed collection landing pages do not exist yet; arbitrary Shop filters should not become indexable substitutes.
2. No Merchant Center feed/API or IndexNow publishing hook is active while products and live commerce settings remain provisional.
3. A dedicated 1200×630 social image should replace the current brand-icon fallback after final photography/design is approved.
4. Individual recipe URLs and full recipe content do not exist, so `Recipe` schema is intentionally absent.
5. `llms.txt` is intentionally absent because it is not a substitute for crawlable HTML, normal indexing controls, or factual content, and no measurable need has been established.

## Route baseline and index policy

| Template | Expected status | Index after launch | Initial HTML | Canonical | Schema | Sitemap |
| --- | ---: | --- | --- | --- | --- | --- |
| `/` | 200 | Yes | Branded H1, description, featured product links | Self | Organization, WebSite, Breadcrumb, ItemList when featured products exist | Yes |
| `/shop` | 200 | Yes | H1, description, all active publish-ready product links/prices/availability | `/shop` regardless of query filters | Organization, WebSite, Breadcrumb, ItemList | Yes |
| `/product/:slug` valid | 200 | Yes | Name, price, availability, description, image, approved facts | Self | Organization, WebSite, Breadcrumb, Product, Offer, published verified ratings/reviews when present | Yes |
| `/product/:slug` missing | 404 | No | Helpful missing-page content and Shop link | Missing URL | None | No |
| `/bundles` | 200 | Yes when active valid bundles exist; page remains useful otherwise | H1, description, active valid bundle details | Self | Organization, WebSite, Breadcrumb, ItemList when bundles exist | Yes |
| `/about` | 200 | Yes | H1 and factual introduction | Self | Organization, WebSite, Breadcrumb | Yes |
| `/recipes` | 200 | Yes | Pairing-guide H1 and introduction | Self | Organization, WebSite, Breadcrumb; no Recipe markup yet | Yes |
| `/faq` | 200 | Yes | FAQ H1 and introduction | Self | Organization, WebSite, Breadcrumb; no FAQ rich-result markup | Yes |
| `/contact` | 200 | Yes | H1 and contact introduction | Self | Organization, WebSite, Breadcrumb | Yes |
| `/returns` | 200 | Yes | Policy H1 and summary | Self | Organization, WebSite, Breadcrumb | Yes |
| `/privacy`, `/terms` | 200 | Yes after launch | Policy H1 and summary | Self | Organization, WebSite, Breadcrumb | Yes |
| Admin, checkout, success, order-status, review, email-preferences, API | 200/route-specific | No | Existing app shell | None required | None | No |
| Unknown client route | 404 at host or helpful client 404 | No | Helpful missing-page content | Missing URL | None | No |

While `PRELAUNCH_MODE=true`, storefront SEO responses send `X-Robots-Tag: noindex, nofollow, noarchive`, no-store caching, and a valid empty sitemap. Privacy and Terms remain available but also send server-level `noindex`. The browser password is not an SEO or security signal; protected product/catalog data is not placed in initial HTML during prelaunch.

## Implemented file/change log

- `src/server/seo.ts`: dynamic initial HTML, route metadata, JSON-LD, robots, sitemap, 404s, catalog filtering, and prelaunch response policy.
- `src/lib/seo.ts`: canonical URL rules, route metadata inventory, private-route classification, and browser metadata updates.
- `src/components/SeoHead.tsx`: client-navigation metadata parity.
- `src/pages/NotFound.tsx`: accessible branded client 404.
- `src/App.tsx`: route metadata manager and catch-all route.
- `src/pages/ProductDetail.tsx`: product-specific browser metadata.
- `src/server/prelaunch.ts`: permits only the dedicated SEO response endpoints through the API gate so they can communicate `noindex` without exposing the catalog.
- `server.ts`: connects SEO responses to active publish-ready Firestore products, active valid bundles, and published verified reviews.
- `vercel.json`: routes public pages through the SEO renderer, exposes root robots/sitemap endpoints, bundles the built HTML template, and adds server-level private-route exclusions.
- `scripts/build.mjs`: moves the generated app shell outside Vercel's public static output so the root URL cannot bypass the SEO rewrite through filesystem precedence.
- `index.html`: fail-closed fallback metadata; the dynamic renderer replaces its default `noindex` only for launch-eligible pages.
- `.env.example`: documents the independent model-training crawler choice.
- `src/server/seo.test.ts`: route, canonical, schema, escaping, robots, and sitemap regression coverage.

## Title and description inventory

| Route | Title | Primary intent |
| --- | --- | --- |
| `/` | Boanerges Provisions \| Small-Batch Finishing Salts | Brand + category discovery |
| `/shop` | Shop Flavored Finishing Salts \| Boanerges Provisions | Commercial collection |
| `/product/:slug` | `{Product} Finishing Salt \| Boanerges Provisions` | Exact product/flavor purchase |
| `/bundles` | Finishing Salt Bundles \| Boanerges Provisions | Bundle, sampler, and gifting purchase |
| `/about` | About Boanerges Provisions | Brand/entity validation |
| `/recipes` | Finishing Salt Pairing Guide \| Boanerges Provisions | Usage and pairing information |
| `/faq` | Finishing Salt FAQ \| Boanerges Provisions | Product and purchase questions |
| `/contact` | Contact Boanerges Provisions | Brand support/contact |
| `/returns` | Returns and Refunds \| Boanerges Provisions | Pre-purchase policy validation |
| `/privacy` | Privacy Policy \| Boanerges Provisions | Legal/entity trust |
| `/terms` | Terms of Service \| Boanerges Provisions | Legal/entity trust |

Descriptions live in one inventory in `src/lib/seo.ts`. Product descriptions come from the same approved publish-ready record displayed to customers. No title or description uses a private query string, preview hostname, token, customer fact, fake discount, geographic claim, certification, or unapproved sourcing claim.

## Canonical, query, and redirect policy

- `APP_URL` is the only approved production canonical origin. It must remain `https://www.boanergesprovisions.com` in Vercel Production, never a preview deployment.
- Canonicals are lowercase, have no query or fragment, and use no trailing slash except the root.
- `/shop?category=`, `sort`, on-page search, UTM, ad, and analytics parameters canonicalize to `/shop` and stay out of the sitemap. They are user controls, not landing pages.
- Tokenized routes are excluded, never canonicalized into public content, and never included in schema, feeds, or sitemaps.
- The apex domain currently redirects to the canonical `www` host at the platform level. Keep that as a one-hop permanent redirect.
- Existing product URLs remain `/product/:slug`. Do not rename a live slug for cosmetic reasons. If a product slug must change later, add a one-hop 308/301 from the exact old URL, update internal links/schema/sitemap/feed together, and retain the redirect long-term.
- Product lookup accepts the public slug independently of the Firestore document id, and all storefront product links now use that slug.
- Search-demand-worthy collections should get stable routes only after WEB-041 validates demand and the collection has unique useful content. Do not index a thin filtered Shop URL.
- Deleted products return 404 today. Use 410 only for a deliberately permanent removal with no relevant replacement; redirect only when a genuinely equivalent successor exists.

## Structured-data inventory

- `Organization`: approved brand name, canonical origin, brand mark, and published support email. No address, founder, locality, or `sameAs` placeholder is emitted.
- `WebSite`: brand and publisher entity. No site-search action is claimed because the Shop control is client-side filtering rather than a stable search-results URL.
- `BreadcrumbList`: Home plus the current public page; product pages include Shop.
- `ItemList`: only links rendered in Home featured products, Shop products, or valid Bundles.
- `Product` + merchant `Offer`: name, description, canonical URL, SKU/document id, brand, image, USD price, condition, and availability calculated from current minus reserved inventory.
- `AggregateRating` and `Review`: emitted only for published, verified reviews and mirror what the product review component can display.
- Shipping and merchant-return policy schema are deferred until WEB-048 confirms production costs, destinations, timing, and policy configuration. Visible policy text remains the source of truth.
- `Recipe` is deferred until a real recipe detail template includes the required visible recipe facts.

## Keyword-to-page map (qualitative, pending first-party data)

The 2026-09-09 search scan showed a mixed result set: commercial salt/gift intent competes with DIY recipes and broad informational guides. This makes intent separation important. No volume, difficulty, or ranking claim is inferred from this scan; Search Console and an approved keyword-data source should refine the map after launch.

| Intent cluster | Primary page | Supporting page/content |
| --- | --- | --- |
| Boanerges Provisions / exact brand | Home | About, Contact |
| flavored finishing salts / small-batch finishing salt | Home | Shop, About |
| buy/shop flavored finishing salt | Shop | Product pages |
| spicy/pepper finishing salt | Approved future collection or Shop | Pepper product pages, heat guide |
| citrus/herb finishing salt | Approved future collection or Shop | Citrus/herb products, pairing guide |
| garlic/umami finishing salt | Approved future collection or Shop | Garlic/umami products, pairing guide |
| exact flavor such as habanero lime garlic salt | Matching product | Pairing guide |
| finishing salt gift set / sampler | Bundles | Gift chooser content |
| how to use finishing salt | Recipes/pairing guide | FAQ, individual guides |
| finishing salt for steak, seafood, vegetables, eggs, popcorn, cocktails | Pairing guide | Evidence-backed recipe/use pages |
| finishing salt storage / shelf life | FAQ | Product approved facts |
| shipping, returns, subscription, ingredients/allergens | FAQ/policies | Product details and checkout |

## First ten content opportunities for WEB-041

These are a prioritized backlog, not permission to publish unsupported copy. Each item must be based on tested uses, approved ingredient/process facts, and final products.

1. A concise “What is finishing salt and when do I add it?” guide with demonstrated application amounts and internal product links.
2. A clear finishing salt vs. table salt vs. seasoning salt comparison that avoids nutritional or health claims.
3. A visual heat-and-flavor selector based on the actual five-level product scale, ingredients, and tasted intensity.
4. A tested steak and grilled-meat finishing guide featuring the relevant smoky, garlic, pepper, or umami products.
5. A tested seafood, vegetable, and salad guide for citrus and herb products.
6. Quick everyday uses for eggs, potatoes, popcorn, avocado toast, and roasted vegetables, with real product photos.
7. A cocktail-rim guide with tested ratios and clear responsible-use presentation.
8. A “Which finishing salt bundle should I choose?” gift/sampler decision guide after final bundles are approved.
9. A comparison table for every final product: flavor notes, heat level, ingredients, texture, size, and tested pairings.
10. Storage, freshness, clumping prevention, and shelf-life guidance based only on approved labels/process validation.

## Internal linking and performance changes

- Initial Home, Shop, Product, and Bundle HTML now uses normal crawlable `<a href>` links. Navigation and policy links are also present before JavaScript.
- Product images include descriptive approved alt text and intrinsic dimensions in the server shell. The existing React image system continues to provide responsive sources, explicit dimensions, priority for primary media, and lazy loading elsewhere.
- Edge caching is limited to five minutes with stale revalidation so product availability is not frozen indefinitely. Prelaunch and error responses are not publicly cached.
- The dynamic renderer adds no third-party script and does not change consent-gated GA4/Meta behavior.
- WEB-046's image audit remains the source of truth for dimensions/formats. Final product photography should preserve stable descriptive filenames and generate a dedicated social crop.

## Business facts and assets awaiting owner approval

- Final product names, slugs, prices, sizes, inventory, ingredients, allergen/cross-contact text, storage, shelf life, dietary claims, images, and image type.
- Whether “homegrown peppers,” “premium ingredients,” “handcrafted,” production location, founder story, and any sourcing/process statements are accurate and publishable.
- Final bundle composition, prices, savings presentation, availability, and images.
- Production shipping destinations, carrier/service expectations, prices, free-shipping threshold, and delivery estimates.
- Final return/cancellation/subscription policy wording and the public business mailing address when available. A home address must not be published for SEO.
- Live Instagram/Facebook profile URLs before adding `sameAs`.
- Whether model-training crawling should be allowed. Default is `ALLOW_AI_TRAINING_CRAWLERS=false`; ChatGPT search discovery remains independently allowed.
- A final 1200×630 brand social-sharing image and final primary product photography.

## Launch checklist

### Deployment and raw HTML

1. Keep `PRELAUNCH_MODE=true` while products/copy/configuration remain provisional.
2. Deploy and confirm `APP_URL=https://www.boanergesprovisions.com` in Vercel Production.
3. View raw source—not only DevTools Elements—for `/`, `/shop`, one product, `/recipes`, `/privacy`, a missing product, and a private utility route.
4. Confirm titles, descriptions, canonical host/path, one H1, crawlable links, JSON-LD, price/availability parity, status codes, and no private query/token data.
5. Repeat representative requests with Googlebot, Bingbot, and OAI-SearchBot user agents. The content and status must match normal unauthenticated requests.
6. While gated, confirm storefront responses include `X-Robots-Tag: noindex, nofollow, noarchive`, `/sitemap.xml` has no `<url>`, and the catalog is absent from initial HTML.
7. When WEB-041 and WEB-048 are approved, set `PRELAUNCH_MODE=false` in the same production deployment that exposes final products. Confirm no public indexable route retains `noindex` before submitting the sitemap.

### Search Console

1. Verify the canonical domain property and all DNS verification records.
2. Submit `https://www.boanergesprovisions.com/sitemap.xml` only after the gate is removed.
3. Use URL Inspection for Home, Shop, one representative product, and Bundles; verify the user-declared and selected canonical.
4. Review Page Indexing, HTTPS, Core Web Vitals, Product snippets/Merchant listings, and crawl errors weekly during the first month.
5. Compare query/page impressions, clicks, CTR, and organic purchase conversion; use real data to revise WEB-041's map.

### Bing Webmaster Tools and AI discovery

1. Verify the canonical site, import from Search Console if appropriate, and submit the same sitemap after launch.
2. Confirm `robots.txt` allows Bingbot and OAI-SearchBot and that no CDN/WAF challenge blocks their published traffic.
3. Review URL Inspection, Site Scan, crawl/index reports, and Search Performance.
4. Review AI Performance when data becomes available: cited pages, citation totals, and grounding queries. Treat it as observational citation data, not rank or authority.
5. Do not enable IndexNow while prelaunch products are placeholders. After the final catalog has a secure publish/delete workflow, create a non-secret protocol key, host its verification file, submit only canonical changed URLs, and verify receipt in Bing. Submission does not guarantee indexing.

### Merchant Center / free listings

1. Wait for WEB-048 and final products; never upload fake/draft items.
2. Verify and claim the canonical website.
3. Configure the real business identity, shipping services/costs/destinations, returns, tax behavior, and customer-service details.
4. Add products through a feed/API only when IDs, titles, descriptions, landing URLs, prices, availability, condition, images, and shipping facts match the site and Product schema.
5. Resolve diagnostics and policy warnings before enabling paid campaigns. Compare landing-page, schema, and feed data after every catalog release.

### Validation and 30-day monitoring

1. Run Schema.org Validator on Home, Shop, Bundle, and Product output. Run Google's Rich Results Test on a representative product.
2. Run mobile Lighthouse/PageSpeed for Home, Shop, Product, Bundles, Recipes, and Checkout; record LCP, INP, CLS, accessibility, and SEO changes.
3. Check for broken internal links and JavaScript errors after every production deployment.
4. In GA4, report organic landing pages, `view_item`, `add_to_cart`, `begin_checkout`, and `purchase`; segment AI referrals as they become identifiable without relying on a fixed complete referrer list.
5. At days 7, 14, and 30, record indexing, canonical selection, structured-data issues, Merchant diagnostics, Bing crawl/indexing, AI citations, organic/AI traffic, and ecommerce conversion. Create follow-up stories from evidence.

## Primary implementation references

- Google Search Central: https://developers.google.com/search/docs/specialty/ecommerce
- Google Product structured data: https://developers.google.com/search/docs/appearance/structured-data/product
- Google sitemap guidance: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google JavaScript SEO: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- OpenAI crawler controls: https://developers.openai.com/api/docs/bots
- Bing IndexNow: https://www.bing.com/webmasters/help/indexnow-0z209wby
- Bing AI Performance: https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c
