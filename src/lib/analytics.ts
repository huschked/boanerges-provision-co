export type AnalyticsEventType =
  | 'page_view'
  | 'cta_click'
  | 'collection_filter'
  | 'product_view'
  | 'product_detail_engagement'
  | 'bundle_selection'
  | 'add_to_cart'
  | 'checkout_start'
  | 'checkout_error'
  | 'inventory_error'
  | 'purchase'
  | 'subscription_checkout_start'
  | 'newsletter_signup'
  | 'contact_submission'
  | 'review_request'
  | 'review_submission';

export interface AnalyticsItem {
  id: string;
  name: string;
  category?: string;
  price?: number;
  quantity?: number;
}

export interface AnalyticsEventPayload {
  type: AnalyticsEventType;
  productId?: string;
  productName?: string;
  category?: string;
  quantity?: number;
  value?: number;
  currency?: string;
  transactionId?: string;
  path?: string;
  items?: AnalyticsItem[];
  metadata?: Record<string, unknown>;
}

export interface TrackingConsent {
  version: 1;
  analytics: boolean;
  advertising: boolean;
  updatedAt: string;
}

type ProviderEvent = { name: string; parameters: Record<string, unknown> };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[][]; loaded?: boolean; version?: string };
    _fbq?: Window['fbq'];
  }
}

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const GA_MEASUREMENT_ID = env?.VITE_GA_MEASUREMENT_ID?.trim() || '';
const META_PIXEL_ID = env?.VITE_META_PIXEL_ID?.trim() || '';
export const TRACKING_CONSENT_STORAGE_KEY = 'boanerges-tracking-consent-v1';
export const TRACKING_CONSENT_EVENT = 'boanerges:tracking-consent-changed';
export const OPEN_COOKIE_PREFERENCES_EVENT = 'boanerges:open-cookie-preferences';

const sensitiveKey = /email|phone|address|street|customer|(?:first|last|full)[_-]?name/i;
const safeQueryParameters = new Set(['category', 'sort', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid']);
const sensitiveTrackingRoutes = ['/order-status', '/email-preferences', '/checkout/success', '/checkout-success', '/success', '/review'];
let googleInitialized = false;
let metaInitialized = false;
let lastPageView = '';

export function normalizeTrackingConsent(value: unknown): TrackingConsent | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<TrackingConsent>;
  if (candidate.version !== 1 || typeof candidate.analytics !== 'boolean' || typeof candidate.advertising !== 'boolean') return null;
  return {
    version: 1,
    analytics: candidate.analytics,
    advertising: candidate.advertising,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : '',
  };
}

export function getTrackingConsent(): TrackingConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeTrackingConsent(JSON.parse(window.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function saveTrackingConsent(input: Pick<TrackingConsent, 'analytics' | 'advertising'>): TrackingConsent {
  const previous = getTrackingConsent();
  const consent: TrackingConsent = { version: 1, ...input, updatedAt: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent(TRACKING_CONSENT_EVENT, { detail: consent }));
  }
  configureAnalyticsProviders(consent);
  if (typeof window !== 'undefined') {
    const path = sanitizeAnalyticsPath(`${window.location.pathname}${window.location.search}`);
    if (!isSensitiveTrackingPath(path)) {
      if (consent.analytics && !previous?.analytics && window.gtag) window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: `${window.location.origin}${path}`,
        page_path: path,
      });
      if (consent.advertising && !previous?.advertising && window.fbq) window.fbq('track', 'PageView');
    }
  }
  return consent;
}

export function openCookiePreferences() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT));
}

function appendScript(id: string, src: string) {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function googleConsentParameters(consent: TrackingConsent) {
  return {
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.advertising ? 'granted' : 'denied',
    ad_user_data: consent.advertising ? 'granted' : 'denied',
    ad_personalization: consent.advertising ? 'granted' : 'denied',
  };
}

function ensureGoogleAnalytics(consent: TrackingConsent) {
  if (!GA_MEASUREMENT_ID || !consent.analytics || typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function (...args: unknown[]) { window.dataLayer!.push(args); };
  window.gtag('consent', googleInitialized ? 'update' : 'default', googleConsentParameters(consent));
  if (googleInitialized) return;
  appendScript('boanerges-ga4', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`);
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: consent.advertising,
    allow_ad_personalization_signals: consent.advertising,
  });
  googleInitialized = true;
}

function ensureMetaPixel(consent: TrackingConsent) {
  if (!META_PIXEL_ID || !consent.advertising || typeof window === 'undefined') return;
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    } as Window['fbq'];
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    window.fbq = fbq;
    window._fbq = fbq;
  }
  window.fbq!('consent', 'grant');
  if (metaInitialized) return;
  appendScript('boanerges-meta-pixel', 'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq!('init', META_PIXEL_ID);
  metaInitialized = true;
}

export function configureAnalyticsProviders(consent = getTrackingConsent()) {
  if (!consent || typeof window === 'undefined') return;
  if (window.gtag && googleInitialized) {
    window.gtag('consent', 'update', googleConsentParameters(consent));
    window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false, allow_google_signals: consent.advertising, allow_ad_personalization_signals: consent.advertising });
  }
  if (!consent.advertising && window.fbq && metaInitialized) window.fbq('consent', 'revoke');
  ensureGoogleAnalytics(consent);
  ensureMetaPixel(consent);
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : undefined;
}

export function sanitizeAnalyticsPath(input: string) {
  try {
    const url = new URL(input || '/', 'https://boanergesprovisions.com');
    const safe = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (safeQueryParameters.has(key.toLowerCase())) safe.set(key.toLowerCase(), value.slice(0, 200));
    });
    const query = safe.toString();
    return `${url.pathname}${query ? `?${query}` : ''}`.slice(0, 500);
  } catch {
    return String(input || '/').split(/[?#]/, 1)[0].slice(0, 500) || '/';
  }
}

export function isSensitiveTrackingPath(path: string) {
  return sensitiveTrackingRoutes.some(route => path === route || path.startsWith(`${route}/`) || path.startsWith(`${route}?`));
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return undefined;
  const entries = Object.entries(metadata)
    .filter(([key, value]) => !sensitiveKey.test(key) && ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 25)
    .map(([key, value]) => [key.slice(0, 60), typeof value === 'string' ? value.slice(0, 200) : value]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function sanitizeAnalyticsEvent(event: AnalyticsEventPayload): AnalyticsEventPayload {
  const items = event.items?.slice(0, 30).map(item => ({
    id: String(item.id || '').slice(0, 120),
    name: String(item.name || '').slice(0, 160),
    ...(item.category ? { category: String(item.category).slice(0, 100) } : {}),
    ...(safeNumber(item.price) !== undefined ? { price: safeNumber(item.price) } : {}),
    ...(safeNumber(item.quantity) !== undefined ? { quantity: safeNumber(item.quantity) } : {}),
  })).filter(item => item.id && item.name);
  const metadata = sanitizeMetadata(event.metadata);
  return {
    type: event.type,
    ...(event.productId ? { productId: String(event.productId).slice(0, 120) } : {}),
    ...(event.productName ? { productName: String(event.productName).slice(0, 160) } : {}),
    ...(event.category ? { category: String(event.category).slice(0, 100) } : {}),
    ...(safeNumber(event.quantity) !== undefined ? { quantity: safeNumber(event.quantity) } : {}),
    ...(safeNumber(event.value) !== undefined ? { value: safeNumber(event.value) } : {}),
    ...(event.currency ? { currency: String(event.currency).toUpperCase().slice(0, 3) } : {}),
    ...(event.transactionId ? { transactionId: String(event.transactionId).slice(0, 200) } : {}),
    ...(event.path ? { path: sanitizeAnalyticsPath(String(event.path)) } : {}),
    ...(items?.length ? { items } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function commerceItems(event: AnalyticsEventPayload) {
  const items = event.items?.length ? event.items : event.productId && event.productName ? [{
    id: event.productId,
    name: event.productName,
    category: event.category,
    price: event.quantity && event.value !== undefined ? event.value / event.quantity : event.value,
    quantity: event.quantity || 1,
  }] : [];
  return items.map(item => ({
    item_id: item.id,
    item_name: item.name,
    item_category: item.category,
    price: item.price,
    quantity: item.quantity || 1,
  }));
}

export function providerEventsFor(event: AnalyticsEventPayload): { google?: ProviderEvent; meta?: ProviderEvent } {
  const items = commerceItems(event);
  const common = {
    currency: event.currency || 'USD',
    value: event.value,
    items,
    transaction_id: event.transactionId,
  };
  const metaCommerce = {
    currency: event.currency || 'USD',
    value: event.value,
    content_ids: items.map(item => item.item_id),
    content_type: 'product',
    contents: items.map(item => ({ id: item.item_id, quantity: item.quantity, item_price: item.price })),
  };
  switch (event.type) {
    case 'product_view': return { google: { name: 'view_item', parameters: common }, meta: { name: 'ViewContent', parameters: metaCommerce } };
    case 'add_to_cart': return { google: { name: 'add_to_cart', parameters: common }, meta: { name: 'AddToCart', parameters: metaCommerce } };
    case 'checkout_start': return { google: { name: 'begin_checkout', parameters: common }, meta: { name: 'InitiateCheckout', parameters: metaCommerce } };
    case 'subscription_checkout_start': return {
      google: { name: 'begin_checkout', parameters: { ...common, checkout_type: 'subscription', cadence: event.metadata?.cadence } },
      meta: { name: 'InitiateCheckout', parameters: { ...metaCommerce, checkout_type: 'subscription' } },
    };
    case 'purchase': return { google: { name: 'purchase', parameters: common }, meta: { name: 'Purchase', parameters: metaCommerce } };
    case 'newsletter_signup': return { google: { name: 'sign_up', parameters: { method: event.metadata?.source || 'newsletter' } }, meta: { name: 'Lead', parameters: { content_name: 'Newsletter signup' } } };
    case 'contact_submission': return { google: { name: 'generate_lead', parameters: { method: 'contact_form' } }, meta: { name: 'Contact', parameters: {} } };
    case 'bundle_selection': return { google: { name: 'select_item', parameters: common }, meta: { name: 'ViewContent', parameters: metaCommerce } };
    default: return {};
  }
}

function sendProviderEvents(event: AnalyticsEventPayload) {
  const consent = getTrackingConsent();
  if (!consent) return;
  configureAnalyticsProviders(consent);
  const mapped = providerEventsFor(event);
  if (consent.analytics && mapped.google && window.gtag) window.gtag('event', mapped.google.name, mapped.google.parameters);
  if (consent.advertising && mapped.meta && window.fbq) {
    const options = event.transactionId ? { eventID: event.transactionId } : undefined;
    window.fbq('track', mapped.meta.name, mapped.meta.parameters, options);
  }
}

export async function trackAnalyticsEvent(input: AnalyticsEventPayload) {
  if (typeof window === 'undefined') return;
  const event = sanitizeAnalyticsEvent({ ...input, path: input.path || `${window.location.pathname}${window.location.search}` });
  sendProviderEvents(event);
  try {
    const response = await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`Internal analytics returned ${response.status}.`);
  } catch (error) {
    console.warn('Analytics event failed:', error);
  }
}

export function trackPageView(path: string) {
  if (typeof window === 'undefined' || path.startsWith('/admin')) return;
  const safePath = sanitizeAnalyticsPath(path);
  if (lastPageView === safePath) return;
  lastPageView = safePath;
  const event = sanitizeAnalyticsEvent({ type: 'page_view', path: safePath });
  const consent = getTrackingConsent();
  if (consent && !isSensitiveTrackingPath(safePath)) {
    configureAnalyticsProviders(consent);
    if (consent.analytics && window.gtag) window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: `${window.location.origin}${safePath}`,
      page_path: safePath,
    });
    if (consent.advertising && window.fbq) window.fbq('track', 'PageView');
  }
  void trackAnalyticsEvent(event);
}

export function trackPurchaseOnce(event: AnalyticsEventPayload) {
  if (typeof window === 'undefined' || !event.transactionId) return false;
  const key = `boanerges-tracked-purchase:${event.transactionId}`;
  try {
    if (window.localStorage.getItem(key)) return false;
    window.localStorage.setItem(key, new Date().toISOString());
  } catch {
    // Storage may be unavailable; provider event IDs still support downstream deduplication.
  }
  void trackAnalyticsEvent({ ...event, type: 'purchase' });
  return true;
}
