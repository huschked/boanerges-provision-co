import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Twitter, MapPin, Mail, Phone } from 'lucide-react';
import logo from '@/src/assets/BoanergesLogoTransparent.png';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0A0A0A] text-brand-parchment pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div className="flex flex-col">
            <Link to="/" className="inline-block group mb-2">
              <img 
                src={logo} 
                alt="Boanerges Provision Co." 
                className="h-20 md:h-24 w-auto object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                referrerPolicy="no-referrer"
              />
            </Link>
            <p className="text-sm text-brand-parchment/80 leading-relaxed max-w-xs">
              Handcrafted finishing salts inspired by old-world traditions and bold, modern flavors. Small-batch excellence from our kitchen to yours.
            </p>
            <div className="flex gap-6 pt-6">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-brand-parchment/60 hover:text-brand-gold transition-colors"><Instagram size={20} /></a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-brand-parchment/60 hover:text-brand-gold transition-colors"><Facebook size={20} /></a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-brand-parchment/60 hover:text-brand-gold transition-colors"><Twitter size={20} /></a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-brand-gold text-[11px] uppercase tracking-[0.2em] font-black mb-8">Provisions</h4>
            <ul className="space-y-4">
              <li><Link to="/shop" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Shop All Salts</Link></li>
              <li><Link to="/shop?category=Spicy" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Heat Collection</Link></li>
              <li><Link to="/shop?category=Savory" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Savory Blends</Link></li>
              <li><Link to="/shop?category=Citrus" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Citrus & Herbal</Link></li>
              <li><Link to="/bundles" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Gift Bundles</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-brand-gold text-[11px] uppercase tracking-[0.2em] font-black mb-8">The Company</h4>
            <ul className="space-y-4">
              <li><Link to="/about" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Our Story</Link></li>
              <li><Link to="/recipes" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Pairing Guide</Link></li>
              <li><Link to="/faq" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Shipping & Returns</Link></li>
              <li><Link to="/contact" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Contact Us</Link></li>
              <li><Link to="/terms" className="text-sm text-brand-parchment/80 hover:text-brand-gold transition-colors">Terms of Service</Link></li>
              <li><Link to="/admin" className="text-sm text-brand-parchment/40 hover:text-brand-gold transition-colors">Admin Portal</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-8">
            <h4 className="text-brand-gold text-[11px] uppercase tracking-[0.2em] font-black mb-8">Join the Table</h4>
            <p className="text-sm text-brand-parchment/80 leading-relaxed">
              Subscribe for exclusive flavor releases, recipes, and artisan stories.
            </p>
            <form className="relative">
              <input 
                type="email" 
                placeholder="Email Address" 
                className="w-full bg-transparent border-b border-brand-parchment/40 py-3 text-sm focus:border-brand-gold outline-none transition-colors placeholder:text-brand-parchment/40"
              />
              <button className="absolute right-0 bottom-3 text-brand-gold text-[10px] uppercase tracking-widest font-black hover:translate-x-1 transition-transform">
                Sign Up
              </button>
            </form>
          </div>
        </div>

        <div className="pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col md:flex-row gap-8 items-center text-[10px] uppercase tracking-widest text-brand-parchment/60 font-black">
            <div className="flex items-center gap-2"><MapPin size={12} /> Small Batch, USA</div>
            <div className="flex items-center gap-2"><Mail size={12} /> hello@boanergesprovision.com</div>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-brand-parchment/40 font-black">
            © 2026 Boanerges Provision Co. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
