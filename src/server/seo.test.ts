import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalUrl, isPrivateRoute, STATIC_SEO_PAGES } from '../lib/seo.ts';
import { registerSeoRoutes, seoTestHelpers, type SeoProduct } from './seo.ts';

const product: SeoProduct = {
  id: 'habanero-lime-garlic',
  slug: 'habanero-lime-garlic',
  name: 'Habanero Lime Garlic',
  shortDescription: 'Bright lime, savory garlic, and habanero heat.',
  price: 9.49,
  sizeOz: 4,
  imageUrl: '/products/habanero-lime-garlic.png',
  imageAlt: 'Habanero Lime Garlic finishing salt',
  imageType: 'photograph',
  currentInventory: 12,
  reservedInventory: 2,
  category: 'Spicy',
  updatedAt: '2026-09-08T18:30:00.000Z',
};

test('static public pages have unique titles and descriptions', () => {
  const pages = Object.values(STATIC_SEO_PAGES);
  assert.equal(new Set(pages.map(page => page.title)).size, pages.length);
  assert.equal(new Set(pages.map(page => page.description)).size, pages.length);
  pages.forEach(page => {
    assert.ok(page.title.length > 10);
    assert.ok(page.description.length > 50);
  });
});

test('every indexable route is sent through the SEO function on Vercel', () => {
  const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
  const rewrites = new Map<string, string>(config.rewrites.map((rewrite: { source: string; destination: string }) => [rewrite.source, rewrite.destination]));
  for (const pathname of Object.keys(STATIC_SEO_PAGES)) {
    assert.match(rewrites.get(pathname) || '', /^\/api\?path=seo&route=/, `${pathname} must not fall through to the public SPA file`);
  }
  assert.equal(rewrites.get('/product/:slug'), '/api?path=seo&route=/product/:slug');
  ['/admin/:path*', '/checkout/:path*', '/checkout-success', '/success', '/order-status', '/review', '/email-preferences'].forEach(pathname => {
    assert.match(rewrites.get(pathname) || '', /^\/api\?path=seo&route=/, `${pathname} must use the private server template`);
  });
  assert.equal(config.functions['api/index.ts'].includeFiles, '.seo-build/storefront-shell.html');
});

test('canonical URLs discard queries, fragments, and trailing slashes', () => {
  assert.equal(canonicalUrl('https://www.boanergesprovisions.com/', '/shop/?sort=price-low#salts'), 'https://www.boanergesprovisions.com/shop');
  assert.equal(canonicalUrl('https://www.boanergesprovisions.com', '/'), 'https://www.boanergesprovisions.com/');
});

test('private and utility routes are excluded from indexing policy', () => {
  ['/admin', '/checkout/success', '/order-status', '/review', '/email-preferences?token=secret', '/api/products'].forEach(route => {
    assert.equal(isPrivateRoute(route), true, route);
  });
  assert.equal(isPrivateRoute('/product/habanero-lime-garlic'), false);
});

test('product schema mirrors public price and inventory', () => {
  const schema = seoTestHelpers.productStructuredData('https://www.boanergesprovisions.com', product, '/product/habanero-lime-garlic') as Record<string, any>;
  assert.equal(schema.name, product.name);
  assert.equal(schema.offers.price, '9.49');
  assert.equal(schema.offers.priceCurrency, 'USD');
  assert.equal(schema.offers.availability, 'https://schema.org/InStock');
  assert.equal(schema.image[0], 'https://www.boanergesprovisions.com/products/habanero-lime-garlic.png');
  assert.equal('aggregateRating' in schema, false);
});

test('rendered HTML exposes canonical metadata, schema, content, and safe JSON', () => {
  const template = '<!doctype html><html><head><meta name="description" content="old"><meta name="robots" content="noindex"><title>Old</title></head><body><div id="root"></div></body></html>';
  const page = { title: 'Habanero Lime Garlic Finishing Salt | Boanerges Provisions', description: product.shortDescription, pathname: '/product/habanero-lime-garlic', type: 'product' as const };
  const html = seoTestHelpers.renderDocument(template, {
    appUrl: 'https://www.boanergesprovisions.com',
    page,
    shell: '<main><h1>Habanero Lime Garlic</h1></main>',
    structuredData: [{ name: '</script><script>alert(1)</script>' }],
    indexable: true,
  });
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.boanergesprovisions\.com\/product\/habanero-lime-garlic"/);
  assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large"/);
  assert.match(html, /<h1>Habanero Lime Garlic<\/h1>/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003c\/script\\u003e/);
});

test('sitemap contains canonical public catalog URLs and honest lastmod only after launch', () => {
  const launched = seoTestHelpers.sitemapXml('https://www.boanergesprovisions.com', [product], [], false);
  assert.match(launched, /<loc>https:\/\/www\.boanergesprovisions\.com\/shop<\/loc>/);
  assert.match(launched, /<loc>https:\/\/www\.boanergesprovisions\.com\/product\/habanero-lime-garlic<\/loc>/);
  assert.match(launched, /<lastmod>2026-09-08T18:30:00\.000Z<\/lastmod>/);
  assert.doesNotMatch(launched, /checkout|order-status|email-preferences/);

  const prelaunch = seoTestHelpers.sitemapXml('https://www.boanergesprovisions.com', [product], [], true);
  assert.doesNotMatch(prelaunch, /<url>/);
});

test('robots allow search crawlers to see server noindex while blocking utility paths', () => {
  const robots = seoTestHelpers.robotsText('https://www.boanergesprovisions.com', true);
  assert.match(robots, /User-agent: OAI-SearchBot\nAllow: \//);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /User-agent: GPTBot\nDisallow: \//);
  assert.match(robots, /Sitemap: https:\/\/www\.boanergesprovisions\.com\/sitemap\.xml/);

  const previous = process.env.ALLOW_AI_TRAINING_CRAWLERS;
  process.env.ALLOW_AI_TRAINING_CRAWLERS = 'true';
  try {
    const trainingAllowed = seoTestHelpers.robotsText('https://www.boanergesprovisions.com', false);
    assert.match(trainingAllowed, /User-agent: GPTBot\nAllow: \/\nDisallow: \/admin/);
  } finally {
    if (previous === undefined) delete process.env.ALLOW_AI_TRAINING_CRAWLERS;
    else process.env.ALLOW_AI_TRAINING_CRAWLERS = previous;
  }
});

test('HTTP SEO routes preserve content parity across crawler agents and fail closed in prelaunch', async () => {
  let prelaunch = false;
  const app = express();
  registerSeoRoutes(app, {
    appUrl: () => 'https://www.boanergesprovisions.com',
    isPrelaunch: () => prelaunch,
    getProducts: async () => [product],
    getProduct: async slug => slug === product.slug ? product : null,
    getBundles: async () => [],
    getReviewSummary: async () => ({ count: 0, average: null, reviews: [] }),
  });
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const endpoint = `http://127.0.0.1:${address.port}`;

    const normal = await fetch(`${endpoint}/api/seo?route=/product/habanero-lime-garlic`);
    const google = await fetch(`${endpoint}/api/seo?route=/product/habanero-lime-garlic`, { headers: { 'user-agent': 'Googlebot' } });
    const bing = await fetch(`${endpoint}/api/seo?route=/product/habanero-lime-garlic`, { headers: { 'user-agent': 'Bingbot' } });
    const openAi = await fetch(`${endpoint}/api/seo?route=/product/habanero-lime-garlic`, { headers: { 'user-agent': 'OAI-SearchBot' } });
    const bodies = await Promise.all([normal, google, bing, openAi].map(response => response.text()));
    bodies.forEach(body => {
      assert.match(body, /<h1>Habanero Lime Garlic<\/h1>/);
      assert.match(body, /"@type":"Product"/);
      assert.doesNotMatch(body, /noindex,nofollow,noarchive/);
    });
    assert.equal(new Set(bodies).size, 1);

    const missing = await fetch(`${endpoint}/api/seo?route=/product/not-a-product`);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('x-robots-tag') || '', /noindex/);

    const utility = await fetch(`${endpoint}/api/seo?route=/order-status%3Ftoken%3Dprivate`);
    const utilityBody = await utility.text();
    assert.equal(utility.status, 200);
    assert.match(utility.headers.get('x-robots-tag') || '', /noindex/);
    assert.match(utilityBody, /Secure storefront page/);
    assert.doesNotMatch(utilityBody, /private/);
    assert.doesNotMatch(utilityBody, /rel="canonical"/);

    prelaunch = true;
    const gated = await fetch(`${endpoint}/api/seo?route=/shop`);
    const gatedBody = await gated.text();
    assert.equal(gated.status, 200);
    assert.match(gated.headers.get('x-robots-tag') || '', /noindex/);
    assert.match(gatedBody, /storefront is currently in private preview/i);
    assert.doesNotMatch(gatedBody, /Habanero Lime Garlic/);

    const sitemap = await fetch(`${endpoint}/api/seo/sitemap.xml`).then(response => response.text());
    assert.doesNotMatch(sitemap, /<url>/);
  } finally {
    server.close();
  }
});
