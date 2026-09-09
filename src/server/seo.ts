import type { Express, Request } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  absoluteAssetUrl,
  canonicalUrl,
  DEFAULT_SOCIAL_IMAGE,
  isPrivateRoute,
  normalizePathname,
  productSeoPage,
  routeSeoPage,
  SITE_NAME,
  STATIC_SEO_PAGES,
  type SeoPage,
} from '../lib/seo.js';

type TimestampLike = { toDate?: () => Date; toMillis?: () => number; seconds?: number };

export type SeoProduct = {
  id: string;
  name: string;
  slug?: string;
  price: number;
  sizeOz?: number;
  shortDescription: string;
  imageUrl?: string;
  imageAlt?: string;
  imageType?: 'photograph' | 'illustrative';
  currentInventory?: number;
  reservedInventory?: number;
  category?: string;
  ingredients?: string[];
  pairings?: string[];
  updatedAt?: TimestampLike | string | number | Date;
};

export type SeoBundle = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sellingPrice: number;
  availableStock: number;
  imageUrl?: string;
  imageAlt?: string;
};

export type SeoReviewSummary = {
  count: number;
  average: number | null;
  reviews: Array<{ displayName: string; rating: number; text: string; date: string }>;
};

type SeoRouteDependencies = {
  appUrl: (request: Request) => string;
  isPrelaunch: () => boolean;
  getProducts: () => Promise<SeoProduct[]>;
  getProduct: (slug: string) => Promise<SeoProduct | null>;
  getBundles: () => Promise<SeoBundle[]>;
  getReviewSummary: (productId: string) => Promise<SeoReviewSummary>;
};

const STATIC_HEADINGS: Record<string, string> = {
  '/': 'Bold Heat. Refined Flavor.',
  '/shop': 'Shop the Collection',
  '/bundles': 'Artisan Bundles',
  '/about': 'Our Story',
  '/recipes': 'Pairing Guide',
  '/faq': 'Common Inquiries',
  '/contact': 'Get in Touch',
  '/returns': 'Returns & Refunds',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function safeOrigin(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    return url.origin;
  } catch {
    return 'https://www.boanergesprovisions.com';
  }
}

function productPath(product: SeoProduct) {
  return `/product/${encodeURIComponent(product.slug || product.id)}`;
}

function isoLastModified(value: SeoProduct['updatedAt']) {
  try {
    const candidate = value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
      ? value.toDate()
      : value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number'
        ? new Date(value.seconds * 1000)
        : new Date(value as string | number | Date);
    return Number.isNaN(candidate.getTime()) ? '' : candidate.toISOString();
  } catch {
    return '';
  }
}

function commonStructuredData(appUrl: string) {
  const organizationId = `${appUrl}/#organization`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': organizationId,
      name: SITE_NAME,
      url: `${appUrl}/`,
      logo: absoluteAssetUrl(appUrl, '/apple-touch-icon.png'),
      email: 'support@boanergesprovisions.com',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${appUrl}/#website`,
      name: SITE_NAME,
      url: `${appUrl}/`,
      publisher: { '@id': organizationId },
    },
  ];
}

function breadcrumbs(appUrl: string, page: SeoPage, product?: SeoProduct) {
  const items: Array<Record<string, unknown>> = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${appUrl}/` },
  ];
  if (product) {
    items.push({ '@type': 'ListItem', position: 2, name: 'Shop', item: `${appUrl}/shop` });
    items.push({ '@type': 'ListItem', position: 3, name: product.name, item: canonicalUrl(appUrl, page.pathname) });
  } else if (page.pathname !== '/') {
    items.push({ '@type': 'ListItem', position: 2, name: STATIC_HEADINGS[page.pathname] || page.title, item: canonicalUrl(appUrl, page.pathname) });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

function productStructuredData(appUrl: string, product: SeoProduct, pathname: string, reviewSummary?: SeoReviewSummary) {
  const available = Number(product.currentInventory || 0) - Number(product.reservedInventory || 0) > 0;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonicalUrl(appUrl, pathname)}#product`,
    name: product.name,
    description: product.shortDescription,
    image: product.imageUrl ? [absoluteAssetUrl(appUrl, product.imageUrl)] : undefined,
    sku: product.id,
    brand: { '@type': 'Brand', name: SITE_NAME },
    category: product.category,
    url: canonicalUrl(appUrl, pathname),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: Number(product.price).toFixed(2),
      availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: canonicalUrl(appUrl, pathname),
    },
    ...(reviewSummary && reviewSummary.count > 0 && reviewSummary.average
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(reviewSummary.average.toFixed(2)),
            reviewCount: reviewSummary.count,
          },
          review: reviewSummary.reviews.map(review => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: review.displayName },
            ...(review.date ? { datePublished: review.date } : {}),
            reviewBody: review.text,
            reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5, worstRating: 1 },
          })),
        }
      : {}),
  };
}

function itemListStructuredData(appUrl: string, items: Array<{ name: string; pathname: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: canonicalUrl(appUrl, item.pathname),
    })),
  };
}

function navigation() {
  return '<nav aria-label="Primary"><a href="/">Home</a><a href="/shop">Shop</a><a href="/bundles">Bundles</a><a href="/recipes">Pairing guide</a><a href="/about">About</a><a href="/faq">FAQ</a><a href="/contact">Contact</a></nav>';
}

function catalogCards(items: Array<{ name: string; pathname: string; description: string; price?: number; availability?: string }>) {
  if (!items.length) return '';
  return `<ul class="seo-catalog">${items.map(item => `<li><a href="${escapeHtml(item.pathname)}"><strong>${escapeHtml(item.name)}</strong></a>${typeof item.price === 'number' ? `<span>$${item.price.toFixed(2)}</span>` : ''}<p>${escapeHtml(item.description)}</p>${item.availability ? `<small>${escapeHtml(item.availability)}</small>` : ''}</li>`).join('')}</ul>`;
}

function storefrontShell(page: SeoPage, body: string) {
  return `<div class="seo-shell"><header><a class="seo-brand" href="/">${SITE_NAME}</a>${navigation()}</header><main><p class="seo-kicker">Small-Batch Finishing Salts</p><h1>${escapeHtml(STATIC_HEADINGS[page.pathname] || page.title)}</h1><p class="seo-intro">${escapeHtml(page.description)}</p>${body}</main><footer><a href="/returns">Returns &amp; refunds</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer></div>`;
}

function productShell(page: SeoPage, product: SeoProduct) {
  const available = Number(product.currentInventory || 0) - Number(product.reservedInventory || 0) > 0;
  const detailSections = [
    product.ingredients?.length ? `<section><h2>Ingredients</h2><p>${escapeHtml(product.ingredients.join(', '))}</p></section>` : '',
    product.pairings?.length ? `<section><h2>Suggested pairings</h2><p>${escapeHtml(product.pairings.join(', '))}</p></section>` : '',
  ].join('');
  return `<div class="seo-shell"><header><a class="seo-brand" href="/">${SITE_NAME}</a>${navigation()}</header><main><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a> / ${escapeHtml(product.name)}</nav><article>${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.imageAlt || product.name)}" width="800" height="800" />` : ''}<div><p class="seo-kicker">${escapeHtml(product.category || 'Finishing Salt')}</p><h1>${escapeHtml(product.name)}</h1><p class="seo-price">$${Number(product.price).toFixed(2)}${product.sizeOz ? ` · ${escapeHtml(product.sizeOz)} oz` : ''}</p><p>${escapeHtml(product.shortDescription)}</p><p><strong>${available ? 'In stock' : 'Out of stock'}</strong></p>${detailSections}<a class="seo-cta" href="/shop">Shop the collection</a></div></article></main><footer><a href="/returns">Returns &amp; refunds</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer></div>`;
}

function comingSoonShell() {
  return `<div class="seo-shell seo-coming-soon"><main><p class="seo-kicker">Boanerges Provisions</p><h1>Bold flavor is almost here.</h1><p>Our storefront is currently in private preview while we prepare the collection for launch.</p></main></div>`;
}

function utilityShell() {
  return `<div class="seo-shell seo-coming-soon"><main><p class="seo-kicker">Boanerges Provisions</p><h1>Secure storefront page</h1><p>This page requires JavaScript and is intentionally excluded from public search results.</p></main></div>`;
}

function utilitySeoPage(pathname: string): SeoPage {
  const title = pathname.startsWith('/admin') ? 'Admin'
    : pathname.startsWith('/order-status') ? 'Order Status'
      : pathname.startsWith('/review') ? 'Product Review'
        : pathname.startsWith('/email-preferences') ? 'Email Preferences'
          : pathname.includes('success') ? 'Order Confirmation'
            : 'Secure Checkout';
  return {
    title: `${title} | ${SITE_NAME}`,
    description: 'This secure page is not part of the public storefront search index.',
    pathname,
    indexable: false,
  };
}

const shellCss = `<style data-seo-shell>body{margin:0;background:#0b0a08;color:#f4ead6;font-family:Arial,sans-serif}.seo-shell{min-height:100vh;background:radial-gradient(circle at top,#292116,#0b0a08 58%);padding:2rem 6vw;box-sizing:border-box}.seo-shell header,.seo-shell footer{display:flex;align-items:center;justify-content:space-between;gap:2rem;max-width:1200px;margin:auto}.seo-brand,.seo-shell a{color:#d1a64f}.seo-brand{font-family:Georgia,serif;font-size:1.5rem;text-decoration:none}.seo-shell nav{display:flex;gap:1.25rem;flex-wrap:wrap}.seo-shell main{max-width:1200px;margin:7rem auto}.seo-kicker{text-transform:uppercase;letter-spacing:.24em;color:#d1a64f;font-size:.75rem;font-weight:700}.seo-shell h1{font:clamp(3rem,8vw,6rem)/1 Georgia,serif;max-width:900px;margin:.5rem 0 1.5rem}.seo-intro{max-width:760px;font-size:1.2rem;line-height:1.7;color:#d8cebc}.seo-catalog{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1.5rem;margin:4rem 0}.seo-catalog li{border:1px solid #5b4930;padding:1.5rem}.seo-catalog strong{font:1.5rem Georgia,serif}.seo-catalog span{display:block;color:#d1a64f;margin-top:.5rem}.seo-catalog p,article p{line-height:1.6;color:#d8cebc}.seo-catalog small{color:#baa77e}.seo-shell article{display:grid;grid-template-columns:minmax(260px,1fr) 1fr;gap:4rem;margin-top:2rem}.seo-shell article img{width:100%;height:auto;background:white}.seo-price{font:1.7rem Georgia,serif;color:#d1a64f!important}.seo-shell section h2{font:1.5rem Georgia,serif}.seo-cta{display:inline-block;border:1px solid #d1a64f;padding:1rem 1.5rem;margin-top:1rem}.seo-shell footer{border-top:1px solid #3b3124;padding-top:2rem;justify-content:flex-start}.seo-coming-soon{display:grid;place-items:center;text-align:center}.seo-coming-soon main{margin:auto}@media(max-width:700px){.seo-shell header{align-items:flex-start;flex-direction:column}.seo-shell article{grid-template-columns:1fr}.seo-shell main{margin:4rem auto}}</style>`;

function renderDocument(template: string, args: {
  appUrl: string;
  page: SeoPage;
  shell: string;
  structuredData?: unknown[];
  indexable: boolean;
}) {
  const canonical = canonicalUrl(args.appUrl, args.page.pathname);
  const image = absoluteAssetUrl(args.appUrl, args.page.image || DEFAULT_SOCIAL_IMAGE);
  const robots = args.indexable ? 'index,follow,max-image-preview:large' : 'noindex,nofollow,noarchive';
  const publicTags = args.indexable ? [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(args.page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(args.page.description)}" />`,
    `<meta property="og:type" content="${args.page.type || 'website'}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(args.page.imageAlt || SITE_NAME)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(args.page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(args.page.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ] : [];
  const tags = [
    `<meta name="description" content="${escapeHtml(args.page.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    ...publicTags,
    ...(args.structuredData || []).map(data => `<script type="application/ld+json">${safeJson(data)}</script>`),
    shellCss,
  ].join('\n    ');
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(args.page.title)}</title>`)
    .replace(/\s*<meta\s+name=["'](?:description|robots)["'][^>]*>/gi, '')
    .replace('</head>', `    ${tags}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${args.shell}</div>`);
  return html;
}

async function loadTemplate() {
  const candidates = [
    path.join(process.cwd(), '.seo-build', 'storefront-shell.html'),
    path.join(process.cwd(), 'dist', 'index.html'),
    ...(process.env.NODE_ENV === 'production' ? [] : [path.join(process.cwd(), 'index.html')]),
  ];
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, 'utf8');
    } catch {
      // Try the development template next.
    }
  }
  throw new Error('SEO HTML template is unavailable.');
}

function robotsText(appUrl: string, prelaunch: boolean) {
  const privateRules = ['/admin', '/api/', '/checkout', '/checkout-success', '/success', '/order-status', '/review', '/email-preferences'];
  const disallows = privateRules.map(rule => `Disallow: ${rule}`).join('\n');
  const trainingPolicy = process.env.ALLOW_AI_TRAINING_CRAWLERS === 'true' ? `Allow: /\n${disallows}` : 'Disallow: /';
  return `# robots.txt does not grant access to private content.\nUser-agent: *\nAllow: /\n${disallows}\n\nUser-agent: OAI-SearchBot\nAllow: /\n${disallows}\n\nUser-agent: GPTBot\n${trainingPolicy}\n\n# Storefront responses remain noindex while prelaunch is enabled: ${prelaunch}\nSitemap: ${appUrl}/sitemap.xml\n`;
}

function sitemapXml(appUrl: string, products: SeoProduct[], bundles: SeoBundle[], prelaunch: boolean) {
  const urls = prelaunch ? [] : [
    ...Object.keys(STATIC_SEO_PAGES).map(pathname => ({ pathname, lastmod: '' })),
    ...products.map(product => ({ pathname: productPath(product), lastmod: isoLastModified(product.updatedAt) })),
    ...(bundles.length ? [{ pathname: '/bundles', lastmod: '' }] : []),
  ];
  const unique = new Map(urls.map(item => [item.pathname, item]));
  const body = [...unique.values()].map(item => `<url><loc>${escapeHtml(canonicalUrl(appUrl, item.pathname))}</loc>${item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : ''}</url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function registerSeoRoutes(app: Express, dependencies: SeoRouteDependencies) {
  app.get('/api/seo/robots.txt', (request, response) => {
    const appUrl = safeOrigin(dependencies.appUrl(request));
    response.type('text/plain').set('Cache-Control', 'public, max-age=300').send(robotsText(appUrl, dependencies.isPrelaunch()));
  });

  app.get('/api/seo/sitemap.xml', async (request, response) => {
    try {
      const appUrl = safeOrigin(dependencies.appUrl(request));
      const prelaunch = dependencies.isPrelaunch();
      const [products, bundles] = prelaunch ? [[], []] : await Promise.all([dependencies.getProducts(), dependencies.getBundles()]);
      response.type('application/xml').set('Cache-Control', 'public, max-age=300').send(sitemapXml(appUrl, products, bundles, prelaunch));
    } catch (error) {
      console.error('Sitemap generation failed:', error);
      response.status(503).type('text/plain').send('Sitemap is temporarily unavailable.');
    }
  });

  app.get('/api/seo', async (request, response) => {
    try {
      const rawRoute = typeof request.query.route === 'string' ? request.query.route : '/';
      const pathname = normalizePathname(rawRoute);
      const appUrl = safeOrigin(dependencies.appUrl(request));
      const template = await loadTemplate();
      const prelaunch = dependencies.isPrelaunch();
      const prelaunchBypass = pathname.startsWith('/admin')
        || pathname.startsWith('/checkout/success')
        || ['/checkout-success', '/success', '/order-status', '/review', '/email-preferences', '/privacy', '/terms'].includes(pathname);

      if (prelaunch && !prelaunchBypass) {
        const page = { ...routeSeoPage('/'), title: `Coming Soon | ${SITE_NAME}`, description: 'The Boanerges Provisions storefront is currently in private preview.' };
        const html = renderDocument(template, { appUrl, page, shell: comingSoonShell(), indexable: false });
        return response.status(200).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' }).send(html);
      }

      if (isPrivateRoute(pathname)) {
        const page = utilitySeoPage(pathname);
        const html = renderDocument(template, { appUrl, page, shell: utilityShell(), indexable: false });
        return response.status(200).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' }).send(html);
      }

      if (pathname.startsWith('/product/')) {
        const slug = decodeURIComponent(pathname.slice('/product/'.length));
        const product = slug ? await dependencies.getProduct(slug) : null;
        if (!product) {
          const page = routeSeoPage('/not-found');
          const html = renderDocument(template, { appUrl, page, shell: storefrontShell(page, '<p><a href="/shop">Browse available finishing salts.</a></p>'), indexable: false });
          return response.status(404).set({ 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow, noarchive' }).send(html);
        }
        const page = productSeoPage({ ...product, slug: product.slug || product.id });
        let reviewSummary: SeoReviewSummary | undefined;
        try {
          reviewSummary = await dependencies.getReviewSummary(product.id);
        } catch (error) {
          console.error(`Review schema was omitted for product ${product.id}:`, error);
        }
        const structuredData = [...commonStructuredData(appUrl), breadcrumbs(appUrl, page, product), productStructuredData(appUrl, product, page.pathname, reviewSummary)];
        const html = renderDocument(template, { appUrl, page, shell: productShell(page, product), structuredData, indexable: true });
        return response.status(200).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600' }).send(html);
      }

      const page = STATIC_SEO_PAGES[pathname];
      if (!page) {
        const missing = routeSeoPage(pathname);
        const html = renderDocument(template, { appUrl, page: missing, shell: storefrontShell(missing, '<p><a href="/shop">Browse available finishing salts.</a></p>'), indexable: false });
        return response.status(404).set({ 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow, noarchive' }).send(html);
      }

      let body = '';
      const structuredData: unknown[] = [...commonStructuredData(appUrl), breadcrumbs(appUrl, page)];
      if (pathname === '/' || pathname === '/shop') {
        const products = await dependencies.getProducts();
        const visible = pathname === '/' ? products.filter(product => Boolean((product as SeoProduct & { featured?: boolean }).featured)).slice(0, 4) : products;
        body = catalogCards(visible.map(product => ({ name: product.name, pathname: productPath(product), description: product.shortDescription, price: product.price, availability: Number(product.currentInventory || 0) - Number(product.reservedInventory || 0) > 0 ? 'In stock' : 'Out of stock' })));
        if (visible.length) structuredData.push(itemListStructuredData(appUrl, visible.map(product => ({ name: product.name, pathname: productPath(product) }))));
      } else if (pathname === '/bundles') {
        const bundles = await dependencies.getBundles();
        body = catalogCards(bundles.map(bundle => ({ name: bundle.name, pathname: '/bundles', description: bundle.description, price: bundle.sellingPrice, availability: bundle.availableStock > 0 ? 'In stock' : 'Out of stock' })));
        if (bundles.length) structuredData.push(itemListStructuredData(appUrl, bundles.map(bundle => ({ name: bundle.name, pathname: '/bundles' }))));
      }
      const indexable = !prelaunch;
      const html = renderDocument(template, { appUrl, page, shell: storefrontShell(page, body), structuredData, indexable });
      return response.status(200).set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': indexable ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600' : 'private, no-store',
        ...(indexable ? {} : { 'X-Robots-Tag': 'noindex, nofollow, noarchive' }),
      }).send(html);
    } catch (error) {
      console.error('SEO route rendering failed:', error);
      return response.status(503).set('X-Robots-Tag', 'noindex, nofollow, noarchive').type('text/plain').send('The storefront is temporarily unavailable.');
    }
  });
}

export const seoTestHelpers = { renderDocument, robotsText, sitemapXml, productStructuredData };
