import React from 'react';
import { Link } from 'react-router-dom';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-4">
    <h2 className="text-2xl md:text-3xl font-serif text-brand-parchment">{title}</h2>
    <div className="space-y-4 text-sm md:text-base leading-7 text-brand-parchment/65">{children}</div>
  </section>
);

export const PrivacyPolicy: React.FC = () => (
  <div className="pt-40 pb-32 animate-fade-in editorial-surface-dark relative overflow-hidden">
    <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
    <article className="max-w-4xl mx-auto px-6 md:px-12 relative z-10">
      <header className="space-y-5 pb-12 border-b border-white/10">
        <span className="text-brand-gold text-[11px] uppercase tracking-[0.35em] font-black">Customer Privacy</span>
        <h1 className="text-5xl md:text-7xl font-serif text-brand-parchment">Privacy Policy</h1>
        <p className="text-brand-parchment/50">Effective September 3, 2026</p>
        <p className="text-lg leading-8 text-brand-parchment/70">
          This policy explains how Boanerges Provisions Co. collects, uses, and shares information when you shop with us, contact us, subscribe to email, or use this website.
        </p>
      </header>

      <div className="py-12 space-y-12">
        <Section title="Information we collect">
          <p><strong className="text-brand-parchment">Orders and fulfillment.</strong> We receive contact, shipping, and order information such as your name, email, phone number when provided, shipping address, purchased items, amounts, and order status. Stripe processes payment-card details; we do not store your full card number.</p>
          <p><strong className="text-brand-parchment">Messages and email signup.</strong> We collect the information you submit through our contact and newsletter forms, including your name, email, subject, message, consent choice, source, and relevant timestamps.</p>
          <p><strong className="text-brand-parchment">Website activity.</strong> We collect limited events such as product views, add-to-cart actions, checkout starts, and newsletter signups. Our hosting and security providers may also process request information such as IP address, browser details, and timestamps. Your cart is saved in your browser so it can survive navigation and a cancelled checkout.</p>
        </Section>

        <Section title="How we use information">
          <ul className="list-disc pl-5 space-y-2">
            <li>Process payment, fulfill and ship orders, provide tracking, and handle refunds or support.</li>
            <li>Send transactional messages about an order or inquiry.</li>
            <li>Send marketing email only when you have requested it, and maintain your communication preferences.</li>
            <li>Operate, troubleshoot, secure, measure, and improve the website and customer experience.</li>
            <li>Prevent fraud, enforce our terms, and meet legal, tax, accounting, or safety obligations.</li>
          </ul>
        </Section>

        <Section title="Service providers and sharing">
          <p>We disclose information only as needed to operate the business, including to Stripe for payment and tax, Firebase and Google Cloud for application data and authentication, Shippo and carriers for shipping, Resend for email delivery, and Vercel for website hosting.</p>
          <p>We may also disclose information when required by law, to protect customers or the business, or as part of a business reorganization. We do not sell personal information or use it for cross-context behavioral advertising.</p>
        </Section>

        <Section title="Your choices and privacy requests">
          <p>Use the unsubscribe link in any marketing email to stop marketing messages without logging in, or contact us below. We record your preference and synchronize it with our email provider. You can subscribe again immediately by submitting our newsletter form; no confirmation email is required. We retain consent and opt-out records to honor your choices and prevent replayed signup requests or old checkout events from reversing them. Transactional order, subscription service, and safety messages may still be sent when necessary; unsubscribing from marketing does not cancel a product subscription.</p>
          <p>Depending on where you live, you may have rights to request access, correction, deletion, or a copy of personal information. You may also ask about the third parties to which information was disclosed. We will verify and respond to applicable requests as required by law.</p>
          <p>Email <a className="text-brand-gold hover:text-brand-parchment underline underline-offset-4" href="mailto:support@boanergesprovisions.com?subject=Privacy%20Request">support@boanergesprovisions.com</a> with the subject “Privacy Request.”</p>
        </Section>

        <Section title="Retention and security">
          <p>We retain information only as reasonably needed for the purposes described above, including order fulfillment, customer support, fraud prevention, and tax or accounting obligations. Retention periods vary by record type.</p>
          <p>We use administrative and technical safeguards designed to protect information, but no online system can guarantee absolute security.</p>
        </Section>

        <Section title="Children, changes, and contact">
          <p>This website is not directed to children under 13, and we do not knowingly collect their personal information.</p>
          <p>We may update this policy as our services or legal obligations change. The effective date above will identify the latest version.</p>
          <p>Questions may be sent to <a className="text-brand-gold hover:text-brand-parchment underline underline-offset-4" href="mailto:support@boanergesprovisions.com">support@boanergesprovisions.com</a>. For order questions, use <a className="text-brand-gold hover:text-brand-parchment underline underline-offset-4" href="mailto:orders@boanergesprovisions.com">orders@boanergesprovisions.com</a> or visit our <Link className="text-brand-gold hover:text-brand-parchment underline underline-offset-4" to="/contact">Contact page</Link>.</p>
        </Section>
      </div>
    </article>
  </div>
);
