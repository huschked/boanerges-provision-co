import React from 'react';
import { Link } from 'react-router-dom';
import { ORDER_PROCESSING_TEXT } from '@/src/config/fulfillment';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-4">
    <h2 className="text-2xl md:text-3xl font-serif text-brand-parchment">{title}</h2>
    <div className="space-y-4 text-sm md:text-base leading-7 text-brand-parchment/65">{children}</div>
  </section>
);

export const TermsOfService: React.FC = () => (
  <div className="pt-40 pb-32 animate-fade-in editorial-surface-dark relative overflow-hidden">
    <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
    <article className="max-w-4xl mx-auto px-6 md:px-12 relative z-10">
      <header className="space-y-5 pb-12 border-b border-white/10">
        <span className="text-brand-gold text-[11px] uppercase tracking-[0.35em] font-black">Website and Store</span>
        <h1 className="text-5xl md:text-7xl font-serif text-brand-parchment">Terms of Service</h1>
        <p className="text-brand-parchment/50">Effective September 3, 2026</p>
        <p className="text-lg leading-8 text-brand-parchment/70">These terms govern your use of the Boanerges Provisions Co. website and purchases made through it. By using the site or placing an order, you agree to these terms.</p>
      </header>

      <div className="py-12 space-y-12">
        <Section title="Products and product information">
          <p>We sell flavored finishing salts and related products. We work to describe products, ingredients, heat, weight, images, pricing, and availability accurately. Natural and small-batch products may have reasonable variation.</p>
          <p>Review the current ingredient information before purchasing or consuming a product. If you have allergies, sensitivities, or dietary questions, contact us before ordering. Product information on this site is not medical advice.</p>
        </Section>

        <Section title="Orders, prices, and payment">
          <p>Your order is an offer to purchase. We may reject or cancel an order for inaccurate pricing, unavailable inventory, suspected fraud, shipping restrictions, or another reasonable operational or legal reason. If payment was collected for a cancelled order, we will issue the appropriate refund.</p>
          <p>Prices are shown in U.S. dollars unless stated otherwise. Applicable shipping and taxes are presented during checkout. Payments are processed by Stripe and are subject to its applicable terms and policies.</p>
        </Section>

        <Section title="Shipping and delivery">
          <p>{ORDER_PROCESSING_TEXT} Carrier delivery dates are estimates rather than guarantees. Risk of carrier delay, weather, address errors, or events outside our reasonable control may affect delivery.</p>
          <p>You are responsible for providing a complete and accurate shipping address. Contact <a className="text-brand-gold hover:text-brand-parchment underline underline-offset-4" href="mailto:orders@boanergesprovisions.com">orders@boanergesprovisions.com</a> immediately if an address needs correction; changes are not guaranteed after fulfillment begins.</p>
        </Section>

        <Section title="Subscribe & Save">
          <p>When you select Subscribe &amp; Save, you authorize Stripe to charge the displayed recurring product price, shipping, and applicable tax on the cadence selected at checkout until you cancel. The first order is created after the initial payment succeeds, and each later paid invoice creates a separate fulfillment order.</p>
          <p>You may manage payment details, review billing history, or cancel through the secure Stripe customer portal linked from your order-status page. Changes should be completed before the next invoice. Cancellation stops future renewals but does not automatically cancel or refund an order that has already been paid or entered fulfillment.</p>
          <p>If payment fails, that renewal is not fulfilled until payment succeeds. If an item is unavailable after a successful recurring charge, we will hold fulfillment and contact you regarding resolution or refund rather than substitute another product without approval.</p>
        </Section>

        <Section title="Final sale, damaged orders, and cancellation">
          <p>Because our products are consumable food products, physical returns are not accepted and purchases are final sale. Damaged, incorrect, or missing orders may qualify for a replacement or refund when reported within the timeframe and with the information described in our <Link className="text-brand-gold hover:text-brand-parchment underline underline-offset-4" to="/returns">Returns & Refunds Policy</Link>.</p>
          <p>Cancellation requests are reviewed only while fulfillment and shipment can still be stopped. Submitting a request does not guarantee cancellation.</p>
        </Section>

        <Section title="Acceptable use and intellectual property">
          <p>You may not misuse the site, interfere with its operation, attempt unauthorized access, submit harmful code, abuse checkout or promotional systems, or use the site for unlawful activity.</p>
          <p>The Boanerges name, logos, site design, text, images, and other original materials are owned by or licensed to Boanerges Provisions Co. and may not be copied or commercially used without permission.</p>
        </Section>

        <Section title="Disclaimers and limitation">
          <p>To the extent permitted by law, the website is provided on an “as available” basis. We do not guarantee uninterrupted access or that every display or description will be free of error.</p>
          <p>To the extent permitted by law, Boanerges Provisions Co. will not be liable for indirect, incidental, special, or consequential damages arising from use of the site. Nothing in these terms excludes rights or remedies that cannot legally be limited.</p>
        </Section>

        <Section title="Changes, governing law, and contact">
          <p>We may update these terms as the store and its services change. The effective date above identifies the latest version. Material changes apply prospectively unless law requires otherwise.</p>
          <p>These terms are governed by the laws of Minnesota and applicable federal law, without regard to conflict-of-law principles.</p>
          <p>Questions about these terms may be sent to <a className="text-brand-gold hover:text-brand-parchment underline underline-offset-4" href="mailto:support@boanergesprovisions.com">support@boanergesprovisions.com</a>. Please also review our <Link className="text-brand-gold hover:text-brand-parchment underline underline-offset-4" to="/privacy">Privacy Policy</Link>.</p>
        </Section>
      </div>
    </article>
  </div>
);
