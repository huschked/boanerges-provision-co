import React from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';

export const FAQ: React.FC = () => {
  const faqs = [
    {
      q: "What makes Boanerges salts unique?",
      a: "Our salts are handcrafted in small batches using premium sea salt and homegrown peppers. We focus on a 'finishing' philosophy—meaning our salts are designed to be added at the end of cooking to preserve the delicate balance of heat and aromatic flavor."
    },
    {
      q: "How should I store my flavored salts?",
      a: "To maintain maximum freshness and prevent clumping, store your salts in a cool, dry place away from direct sunlight. Our jars are designed to be airtight, but keeping them away from stove-side steam is always a good practice."
    },
    {
      q: "Are your salts gluten-free and vegan?",
      a: "Yes, all our flavored salts are naturally gluten-free and vegan. We use only whole-food ingredients like peppers, garlic, herbs, and citrus zest."
    },
    {
      q: "How long do the salts stay fresh?",
      a: "While salt itself doesn't expire, the aromatic ingredients (like lime zest or rosemary) are best within 12 months of opening. We recommend using them frequently to enjoy the full flavor profile."
    },
    {
      q: "What is your shipping policy?",
      a: "We offer free standard shipping on all orders over $50 within the continental USA. Orders are typically processed within 2-3 business days and shipped via USPS or UPS."
    },
    {
      q: "Can I return a jar of salt?",
      a: "No. Because our salts are consumable food products, all products are final sale and we do not accept physical returns, including unopened jars. If your order arrives damaged, incorrect, or missing an item, contact orders@boanergesprovisions.com within 7 calendar days after delivery so we can review a replacement or refund."
    },
    {
      q: "Can I cancel an order?",
      a: "Contact orders@boanergesprovisions.com as soon as possible. We can cancel and refund an order only if fulfillment and shipment can still be stopped. Orders that have already shipped cannot be canceled or returned."
    },
    {
      q: "Do you offer subscriptions?",
      a: "Yes! You can subscribe to any of our salts and save 15% on every order. You can choose your delivery frequency and cancel or pause your subscription at any time through your account portal."
    }
  ];

  return (
    <div className="pt-40 pb-32 animate-fade-in editorial-surface-dark relative overflow-hidden">
      <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <div className="text-center space-y-6 mb-24">
          <span className="text-brand-gold text-[12px] uppercase tracking-[0.4em] font-black block">Support & Guidance</span>
          <h1 className="text-5xl md:text-7xl font-serif text-brand-parchment">Common Inquiries</h1>
          <p className="text-brand-parchment/60 text-lg font-light">
            Everything you need to know about our artisan provisions and service.
          </p>
        </div>

        <div className="space-y-8">
          {faqs.map((faq, i) => (
            <motion.details 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group border-b border-white/10 pb-8"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <h3 className="text-xl md:text-2xl font-serif text-brand-parchment group-hover:text-brand-gold transition-colors pr-8">
                  {faq.q}
                </h3>
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-open:rotate-45 transition-transform text-brand-gold">
                  <Plus size={16} />
                </div>
              </summary>
              <div className="pt-6 text-brand-parchment/60 leading-relaxed text-lg font-light max-w-3xl">
                {faq.a}
              </div>
            </motion.details>
          ))}
        </div>

        <div className="mt-24 p-12 bg-white/5 rounded-sm text-center space-y-6 border border-white/10">
          <h3 className="text-2xl font-serif text-brand-parchment">Still have questions?</h3>
          <p className="text-brand-parchment/60">Our team is here to help you find the perfect flavor.</p>
          <div className="pt-4">
            <a 
              href="/contact" 
              className="inline-block px-12 py-5 bg-brand-gold text-brand-black text-xs uppercase tracking-[0.2em] font-black hover:bg-brand-parchment transition-all"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
