export const CHECKOUT_NEWSLETTER_SOURCE = 'checkout';

export interface CheckoutNewsletterState {
  newsletterOptIn?: boolean;
  paymentStatus?: string;
  customerEmail?: string;
}

export function shouldActivateCheckoutNewsletter(state: CheckoutNewsletterState) {
  return state.newsletterOptIn === true
    && state.paymentStatus === 'paid'
    && typeof state.customerEmail === 'string'
    && state.customerEmail.trim().length > 0;
}
