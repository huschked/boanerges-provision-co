import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Mail, PackageCheck, ShieldCheck } from 'lucide-react';

const policySections = [
  {
    title: 'Food products are final sale',
    body: 'For food-safety and quality-control reasons, we do not accept physical returns of finishing salts, including unopened jars. Please do not mail food products back to us.',
  },
  {
    title: 'Damaged, incorrect, or missing products',
    body: 'Contact us within 7 calendar days after delivery if an item arrives damaged, your package contains the wrong product, or an item is missing. Include your order reference and a clear description; photographs of the package or product may be requested. After review, we may provide an appropriate replacement or refund to the original payment method.',
  },
  {
    title: 'Cancellations before shipment',
    body: 'Contact us as soon as possible if you need to cancel. We can cancel and refund an order only if fulfillment and shipment can still be stopped. Once an order has shipped, it cannot be canceled or returned.',
  },
  {
    title: 'Refund timing',
    body: 'Approved refunds are issued to the original payment method. The time for the credit to appear is controlled by your bank or card issuer.',
  },
  {
    title: 'Recalls and legal rights',
    body: 'Product recalls, product-safety notices, and rights that cannot legally be excluded are handled separately and are not limited by this policy.',
  },
];

export const ReturnsPolicy: React.FC = () => (
  <div className="pt-40 pb-32 animate-fade-in editorial-surface-dark relative overflow-hidden">
    <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
    <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10">
      <header className="max-w-3xl space-y-6 mb-16">
        <span className="text-brand-gold text-[11px] uppercase tracking-[0.35em] font-black block">Customer Care</span>
        <h1 className="text-5xl md:text-7xl font-serif text-brand-parchment">Returns & Refunds</h1>
        <p className="text-brand-parchment/65 text-lg font-light leading-relaxed">
          Our salts are consumable food products. This policy explains how we handle order cancellations, damaged or incorrect shipments, and refunds without accepting food returns.
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-brand-parchment/35 font-black">Effective September 3, 2026</p>
      </header>

      <div className="border border-amber-400/25 bg-amber-400/[0.06] p-6 md:p-8 mb-10 flex items-start gap-4">
        <AlertCircle className="text-amber-300 shrink-0 mt-1" size={22} />
        <div>
          <h2 className="text-xl font-serif text-brand-parchment">Please contact us instead of returning the product.</h2>
          <p className="mt-2 text-brand-parchment/60 leading-relaxed">We can usually resolve eligible order problems using the order reference, details, and photographs—no return shipment is required or accepted.</p>
        </div>
      </div>

      <div className="grid gap-5">
        {policySections.map((section, index) => (
          <section key={section.title} className="card-premium p-7 md:p-9 grid md:grid-cols-[72px_1fr] gap-5">
            <div className="text-brand-gold/40 font-serif text-3xl">0{index + 1}</div>
            <div className="space-y-3">
              <h2 className="text-2xl font-serif text-brand-parchment">{section.title}</h2>
              <p className="text-brand-parchment/60 leading-7">{section.body}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12 border border-brand-gold/20 bg-brand-gold/[0.04] p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-7">
        <div className="flex items-start gap-4">
          <PackageCheck className="text-brand-gold shrink-0" size={24} />
          <div>
            <h2 className="text-2xl font-serif text-brand-parchment">Need help with an order?</h2>
            <p className="mt-2 text-brand-parchment/55">Email us with your order reference and the issue within the applicable seven-day window.</p>
          </div>
        </div>
        <a href="mailto:orders@boanergesprovisions.com" className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-4 bg-brand-gold text-brand-black text-[10px] uppercase tracking-[0.2em] font-black"><Mail size={14} /> Email Order Support</a>
      </section>

      <div className="mt-10 flex items-center gap-3 text-sm text-brand-parchment/45">
        <ShieldCheck size={16} className="text-brand-gold" />
        <span>For shipping estimates and general product questions, visit our <Link to="/faq" className="text-brand-gold hover:text-brand-parchment">FAQ</Link>.</span>
      </div>
    </div>
  </div>
);
