import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Mail } from 'lucide-react';
import logo from '@/src/assets/brand/boanerges-stacked-lockup.png';
import { subscribeToNewsletter } from '@/src/lib/newsletter';
import { openCookiePreferences, trackAnalyticsEvent } from '@/src/lib/analytics';

export const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setStatus(null);
    try {
      const result = await subscribeToNewsletter(email.trim(), 'footer_newsletter');
      setStatus({ type: 'success', message: result.message || 'You are subscribed to the table.' });
      void trackAnalyticsEvent({ type: 'newsletter_signup', metadata: { source: 'footer_newsletter' } });
      setEmail('');
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Unable to subscribe right now.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#0A0A0A] text-brand-parchment pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div className="flex flex-col">
            <Link to="/" className="inline-block group mb-2">
              <img 
                src={logo} 
                alt="Boanerges Provisions Co."
                className="h-32 md:h-40 w-auto object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                referrerPolicy="no-referrer"
              />
            </Link>
            <p className="text-sm text-brand-parchment/80 leading-relaxed max-w-xs">
              Handcrafted finishing salts inspired by old-world traditions and bold, modern flavors. Small-batch excellence from our kitchen to yours.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-brand-gold text-[11px] uppercase tracking-[0.2em] font-black mb-8">Provisions</h4>
            <ul className="space-y-4">
              <li><Link to="/shop" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Shop Salts</Link></li>
              <li><Link to="/shop?category=Spicy" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Heat Collection</Link></li>
              <li><Link to="/shop?category=Savory" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Savory Blends</Link></li>
              <li><Link to="/shop?category=Citrus" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Citrus Salts</Link></li>
              <li><Link to="/shop?category=Herbal" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Herbal Salts</Link></li>
              <li><Link to="/bundles" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Bundles & Gifts</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-brand-gold text-[11px] uppercase tracking-[0.2em] font-black mb-8">The Company</h4>
            <ul className="space-y-4">
              <li><Link to="/about" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Our Story</Link></li>
              <li><Link to="/recipes" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Pairing Guide</Link></li>
              <li><Link to="/faq" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Shipping FAQ</Link></li>
              <li><Link to="/returns" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Returns & Refunds</Link></li>
              <li><Link to="/contact" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Contact Us</Link></li>
              <li><Link to="/privacy" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Privacy Policy</Link></li>
              <li><button type="button" onClick={openCookiePreferences} className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Cookie Choices</button></li>
              <li><Link to="/terms" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-8">
            <h4 className="text-brand-gold text-[11px] uppercase tracking-[0.2em] font-black mb-8">Join the Table</h4>
            <p className="text-sm text-brand-parchment/80 leading-relaxed">
              Subscribe for exclusive flavor releases, recipes, and artisan stories.
            </p>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="relative">
                <label htmlFor="footer-newsletter-email" className="sr-only">Email address</label>
                <input
                  id="footer-newsletter-email"
                  type="email"
                  placeholder="Email Address"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  aria-describedby="footer-newsletter-consent footer-newsletter-status"
                  className="w-full min-h-11 bg-transparent border-b border-brand-parchment/50 py-3 pr-24 text-sm focus:border-brand-gold transition-colors placeholder:text-brand-parchment/60"
                />
                <button type="submit" disabled={submitting} className="touch-target absolute right-0 top-1/2 -translate-y-1/2 px-2 text-brand-gold text-[10px] uppercase tracking-widest font-black transition-transform disabled:opacity-50">
                  {submitting ? 'Saving…' : 'Sign Up'}
                </button>
              </div>
              <p id="footer-newsletter-status" role={status?.type === 'error' ? 'alert' : 'status'} aria-live="polite" className={status ? `text-xs ${status.type === 'error' ? 'text-red-200' : 'text-brand-gold'}` : 'sr-only'}>
                {status?.message || 'Enter your email address to subscribe.'}
              </p>
            </form>
            <p id="footer-newsletter-consent" className="text-xs leading-5 text-brand-parchment/70">
              By signing up, you agree to receive marketing email. Unsubscribe anytime. See our <Link to="/privacy" className="text-brand-gold hover:text-brand-parchment underline underline-offset-4">Privacy Policy</Link>.
            </p>
          </div>
        </div>

        <div className="pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col md:flex-row gap-8 items-center text-[10px] uppercase tracking-widest text-brand-parchment/60 font-black">
            <div className="flex items-center gap-2"><MapPin size={12} /> Small Batch, USA</div>
            <a href="mailto:hello@boanergesprovisions.com" className="flex items-center gap-2 hover:text-brand-gold transition-colors"><Mail size={12} /> hello@boanergesprovisions.com</a>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-brand-parchment/40 font-black">
            © 2026 Boanerges Provisions Co. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
