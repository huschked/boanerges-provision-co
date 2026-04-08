type AnalyticsEventType =
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_start'
  | 'newsletter_signup'
  | 'contact_submission';

interface AnalyticsEventPayload {
  type: AnalyticsEventType;
  productId?: string;
  productName?: string;
  category?: string;
  quantity?: number;
  value?: number;
  path?: string;
  metadata?: Record<string, unknown>;
}

export async function trackAnalyticsEvent(event: AnalyticsEventPayload) {
  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...event,
        path: event.path || window.location.pathname,
      }),
    });
  } catch (error) {
    console.warn('Analytics event failed:', error);
  }
}
