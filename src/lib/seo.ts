export const SITE_NAME = 'Boanerges Provisions';
export const DEFAULT_SOCIAL_IMAGE = '/apple-touch-icon.png';

export type SeoPage = {
  title: string;
  description: string;
  pathname: string;
  image?: string;
  imageAlt?: string;
  indexable?: boolean;
  type?: 'website' | 'product';
};

export const STATIC_SEO_PAGES: Record<string, SeoPage> = {
  '/': {
    title: 'Boanerges Provisions | Small-Batch Finishing Salts',
    description: 'Explore small-batch flavored finishing salts with pepper, herb, citrus, and savory flavor profiles. Shop individual salts and curated bundles.',
    pathname: '/',
  },
  '/shop': {
    title: 'Shop Flavored Finishing Salts | Boanerges Provisions',
    description: 'Shop the Boanerges Provisions collection of small-batch flavored finishing salts, from bright citrus and herbs to bold pepper heat.',
    pathname: '/shop',
  },
  '/bundles': {
    title: 'Finishing Salt Bundles | Boanerges Provisions',
    description: 'Explore curated flavored finishing salt bundles from Boanerges Provisions and find a combination for cooking, gifting, or trying new flavors.',
    pathname: '/bundles',
  },
  '/about': {
    title: 'About Boanerges Provisions',
    description: 'Learn about Boanerges Provisions and the approach behind its bold, small-batch flavored finishing salts.',
    pathname: '/about',
  },
  '/recipes': {
    title: 'Finishing Salt Pairing Guide | Boanerges Provisions',
    description: 'Find practical pairing ideas and ways to use flavored finishing salts with vegetables, proteins, drinks, and everyday dishes.',
    pathname: '/recipes',
  },
  '/faq': {
    title: 'Finishing Salt FAQ | Boanerges Provisions',
    description: 'Get answers about Boanerges Provisions finishing salts, ordering, shipping, storage, subscriptions, and product use.',
    pathname: '/faq',
  },
  '/contact': {
    title: 'Contact Boanerges Provisions',
    description: 'Contact Boanerges Provisions with a product, order, wholesale, or general question.',
    pathname: '/contact',
  },
  '/returns': {
    title: 'Returns and Refunds | Boanerges Provisions',
    description: 'Read the Boanerges Provisions policy for food-product returns, damaged or incorrect orders, cancellations, and refunds.',
    pathname: '/returns',
  },
  '/privacy': {
    title: 'Privacy Policy | Boanerges Provisions',
    description: 'Read how Boanerges Provisions collects, uses, protects, and retains information when you use the website or place an order.',
    pathname: '/privacy',
  },
  '/terms': {
    title: 'Terms of Service | Boanerges Provisions',
    description: 'Read the terms that govern use of the Boanerges Provisions website, purchases, subscriptions, and related services.',
    pathname: '/terms',
  },
};

export const PRIVATE_ROUTE_PREFIXES = [
  '/admin',
  '/checkout',
  '/checkout-success',
  '/success',
  '/order-status',
  '/review',
  '/email-preferences',
  '/api',
];

export function normalizePathname(pathname: string) {
  const path = `/${String(pathname || '/').split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '')}`;
  return path === '/' ? path : path.toLowerCase();
}

export function canonicalUrl(appUrl: string, pathname: string) {
  const base = appUrl.trim().replace(/\/+$/, '');
  const normalized = normalizePathname(pathname);
  return `${base}${normalized === '/' ? '/' : normalized}`;
}

export function absoluteAssetUrl(appUrl: string, asset = DEFAULT_SOCIAL_IMAGE) {
  if (/^https?:\/\//i.test(asset)) return asset;
  return `${appUrl.trim().replace(/\/+$/, '')}/${asset.replace(/^\/+/, '')}`;
}

export function isPrivateRoute(pathname: string) {
  const normalized = normalizePathname(pathname);
  return PRIVATE_ROUTE_PREFIXES.some(prefix => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function productSeoPage(product: {
  name: string;
  slug: string;
  shortDescription: string;
  imageUrl?: string;
  imageAlt?: string;
}): SeoPage {
  return {
    title: `${product.name} Finishing Salt | ${SITE_NAME}`,
    description: product.shortDescription,
    pathname: `/product/${product.slug}`,
    image: product.imageUrl,
    imageAlt: product.imageAlt || product.name,
    type: 'product',
  };
}

export function routeSeoPage(pathname: string): SeoPage {
  const normalized = normalizePathname(pathname);
  const configured = STATIC_SEO_PAGES[normalized];
  if (configured) return configured;
  if (normalized.startsWith('/product/')) {
    return {
      title: `Product | ${SITE_NAME}`,
      description: 'View product details from Boanerges Provisions.',
      pathname: normalized,
      indexable: false,
    };
  }
  return {
    title: `Page Not Found | ${SITE_NAME}`,
    description: 'The requested page could not be found.',
    pathname: normalized,
    indexable: false,
  };
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element!.setAttribute(name, value));
}

export function applySeoPage(page: SeoPage, appUrl = window.location.origin) {
  const canonical = canonicalUrl(appUrl, page.pathname);
  const image = absoluteAssetUrl(appUrl, page.image);
  document.title = page.title;
  upsertMeta('meta[name="description"]', { name: 'description', content: page.description });
  upsertMeta('meta[name="robots"]', { name: 'robots', content: page.indexable === false ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large' });
  if (page.indexable === false) {
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(element => element.remove());
    return;
  }
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: page.title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: page.description });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: page.type || 'website' });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
  upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: page.imageAlt || 'Boanerges Provisions' });
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: page.title });
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: page.description });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
  let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = canonical;
}
