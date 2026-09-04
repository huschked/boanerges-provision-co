import type { SubscriptionCadence } from './productService';

export type SubscriptionOption = {
  cadence: SubscriptionCadence;
  label: string;
  amount: number;
  currency: string;
  savingsAmount: number;
  savingsPercent: number;
};

export async function getSubscriptionOptions(productId: string): Promise<SubscriptionOption[]> {
  const response = await fetch(`/api/subscriptions/options/${encodeURIComponent(productId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Subscription options are unavailable.');
  return Array.isArray(data.options) ? data.options : [];
}

export async function createSubscriptionCheckout(input: { productId: string; quantity: number; cadence: SubscriptionCadence; origin: string }) {
  const response = await fetch('/api/subscriptions/create-session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Subscription checkout could not be started.');
  return data as { url: string };
}
