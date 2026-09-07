import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { trackAnalyticsEvent } from '@/src/lib/analytics';

export const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        void trackAnalyticsEvent({ type: 'contact_submission', metadata: { subject: formData.subject } });
        setSubmitted(true);
        setFormData({ name: '', email: '', subject: 'General Inquiry', message: '' });
      } else {
        const data = await response.json();
        const message = data.error || 'Failed to send message. Please try again.';
        setSubmitError(message);
      }
    } catch (err) {
      console.error("Contact form error:", err);
      const message = 'An unexpected error occurred. Please try again later.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-40 pb-32 animate-fade-in editorial-surface-dark relative overflow-hidden">
      <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
          {/* Info */}
          <div className="space-y-12">
            <div className="space-y-6">
              <span className="text-brand-gold text-[12px] uppercase tracking-[0.4em] font-black block">Connect with Us</span>
              <h1 className="text-5xl md:text-7xl font-serif text-brand-parchment">Get in Touch</h1>
              <p className="text-brand-parchment/60 text-lg font-light leading-relaxed">
                Whether you have a question about our provisions, a wholesale inquiry, or just want to share a recipe, we'd love to hear from you.
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex items-start gap-6 group">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-brand-gold group-hover:bg-brand-gold group-hover:text-brand-black transition-all">
                  <Mail size={20} aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest font-black text-brand-parchment/40">Email Us</p>
                  <a href="mailto:hello@boanergesprovisions.com" className="text-lg font-serif text-brand-parchment hover:text-brand-gold transition-colors">hello@boanergesprovisions.com</a>
                </div>
              </div>

              <div className="flex items-start gap-6 group">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-brand-gold group-hover:bg-brand-gold group-hover:text-brand-black transition-all">
                  <Mail size={20} aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest font-black text-brand-parchment/40">Order Support</p>
                  <a href="mailto:orders@boanergesprovisions.com" className="text-lg font-serif text-brand-parchment hover:text-brand-gold transition-colors">orders@boanergesprovisions.com</a>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10">
              <p className="text-brand-gold text-[10px] uppercase tracking-widest font-black mb-3">Response Time</p>
              <p className="text-sm text-brand-parchment/60 leading-6">We typically respond within 1–2 business days. Include your order reference when contacting order support.</p>
            </div>
          </div>

          {/* Form */}
          <div className="editorial-surface-dark p-12 md:p-16 rounded-sm shadow-2xl border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-bl-full -mr-16 -mt-16" />
            
            {submitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 space-y-6 relative z-10"
                role="status"
                aria-live="polite"
              >
                <div className="w-20 h-20 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold mx-auto">
                  <CheckCircle2 size={40} aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-serif text-brand-parchment">Message Received</h2>
                  <p className="text-brand-parchment/60 font-light">
                    Thank you for reaching out. We've received your message and will get back to you within 1–2 business days.
                  </p>
                </div>
                <button 
                  onClick={() => setSubmitted(false)}
                  className="min-h-11 px-10 py-4 bg-brand-gold text-brand-black text-[11px] uppercase tracking-widest font-bold hover:bg-brand-parchment transition-all duration-500"
                >
                  Send Another Message
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label htmlFor="contact-name" className="text-[10px] uppercase tracking-widest font-black text-brand-parchment/75">Full Name</label>
                    <input 
                      id="contact-name"
                      type="text" 
                      name="name"
                      autoComplete="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full bg-white/5 border-b border-white/10 py-3 px-4 text-brand-parchment outline-none focus:border-brand-gold transition-colors placeholder:text-brand-parchment/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-email" className="text-[10px] uppercase tracking-widest font-black text-brand-parchment/75">Email Address</label>
                    <input 
                      id="contact-email"
                      type="email" 
                      name="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full bg-white/5 border-b border-white/10 py-3 px-4 text-brand-parchment outline-none focus:border-brand-gold transition-colors placeholder:text-brand-parchment/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="contact-subject" className="text-[10px] uppercase tracking-widest font-black text-brand-parchment/75">Subject</label>
                  <select 
                    id="contact-subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full bg-white/5 border-b border-white/10 py-3 px-4 text-brand-parchment outline-none focus:border-brand-gold transition-colors cursor-pointer"
                  >
                    <option className="bg-brand-black" value="General Inquiry">General Inquiry</option>
                    <option className="bg-brand-black" value="Order Support">Order Support</option>
                    <option className="bg-brand-black" value="Wholesale Inquiry">Wholesale Inquiry</option>
                    <option className="bg-brand-black" value="Press & Media">Press & Media</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="contact-message" className="text-[10px] uppercase tracking-widest font-black text-brand-parchment/75">Message</label>
                  <textarea 
                    id="contact-message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full bg-white/5 border-b border-white/10 py-3 px-4 text-brand-parchment outline-none focus:border-brand-gold transition-colors resize-none placeholder:text-brand-parchment/20"
                  />
                </div>

                {submitError && <p id="contact-submit-error" role="alert" aria-live="assertive" className="border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{submitError}</p>}

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-11 py-5 bg-brand-gold text-brand-black text-xs uppercase tracking-[0.2em] font-black hover:bg-brand-parchment transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
                  aria-describedby={submitError ? 'contact-submit-error' : undefined}
                >
                  {submitting ? (
                    <><Loader2 className="animate-spin" size={16} aria-hidden="true" /> Sending message…</>
                  ) : (
                    <>
                      Send Message
                      <Send size={16} aria-hidden="true" className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
