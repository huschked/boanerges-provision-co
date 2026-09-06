import React, { useState, useEffect } from 'react';
import { ShoppingBag, Menu, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '@/src/store';
import { cn } from '@/src/lib/utils';
import logo from '@/src/assets/BoanergesLogoTransparent-v2.png';
import monogram from '@/src/assets/brand/boanerges-monogram.png';
import { STOREFRONT_NAV } from '@/src/lib/merchandising';
import { SocialLinks } from './SocialLinks';

export const Header: React.FC<{ onCartClick: () => void }> = ({ onCartClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const itemCount = useCart((state) => state.itemCount());
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navLinks = STOREFRONT_NAV;

  // Pages that have a dark hero/background at the top
  const isDarkHeroPage =
    ['/', '/about', '/shop', '/recipes', '/faq', '/contact', '/bundles', '/returns', '/privacy', '/terms', '/order-status'].includes(location.pathname) ||
    location.pathname.startsWith('/product/') ||
    location.pathname.startsWith('/checkout');
  const showDarkText = !isScrolled && !isDarkHeroPage;

  return (
    <>
      <div className="bg-brand-black text-brand-gold py-2 text-center text-[11px] uppercase tracking-[0.2em] font-black z-50 relative">
        Free shipping on all orders over $50
      </div>
      <header
        className={cn(
          "fixed left-0 right-0 z-40 transition-all duration-500 px-6 md:px-12",
          isScrolled 
            ? "top-0 py-4 glass-dark shadow-2xl" 
            : cn("top-10 py-12", !isDarkHeroPage && "bg-brand-parchment/80 backdrop-blur-md border-b border-brand-black/5")
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Mobile Menu Toggle */}
          <button 
            className={cn(
              "xl:hidden transition-colors duration-300 min-w-11 min-h-11 flex items-center justify-center",
              showDarkText ? "text-brand-black" : "text-brand-parchment"
            )}
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu" aria-expanded={isMobileMenuOpen} aria-controls="mobile-navigation"
          >
            <Menu size={24} />
          </button>

          {/* Navigation */}
          <nav aria-label="Shop navigation" className="hidden xl:flex items-center gap-5">
            {navLinks.slice(0, 3).map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={cn(
                  "text-[11px] uppercase tracking-[0.1em] whitespace-nowrap transition-all duration-300 font-black",
                  showDarkText 
                    ? "text-brand-black hover:text-brand-gold" 
                    : "text-brand-parchment hover:text-brand-gold"
                )}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Logo */}
          <Link to="/" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group z-50">
            <img
              src={monogram}
              alt="Boanerges Provisions Co."
              className={cn(
                "xl:hidden w-auto object-contain group-hover:scale-105 transition-all duration-500 drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]",
                isScrolled ? "h-12" : "h-16"
              )}
            />
            <img 
              src={logo} 
              alt="Boanerges Provisions Co."
              className={cn(
                "hidden xl:block w-[210px] h-auto object-contain group-hover:scale-105 transition-all duration-500 drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
              )}
              referrerPolicy="no-referrer"
            />
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-8 md:gap-6 xl:gap-12">
            <nav aria-label="Company navigation" className="hidden xl:flex items-center gap-5">
              {navLinks.slice(3).map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={cn(
                    "text-[11px] uppercase tracking-[0.1em] whitespace-nowrap transition-all duration-300 font-black",
                    showDarkText 
                      ? "text-brand-black hover:text-brand-gold" 
                      : "text-brand-parchment hover:text-brand-gold"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
            <button 
              onClick={onCartClick}
              aria-label={`Open cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
              className={cn(
                "relative transition-all duration-300 group/cart",
                showDarkText ? "text-brand-black hover:text-brand-gold" : "text-brand-parchment hover:text-brand-gold"
              )}
            >
              <ShoppingBag size={24} strokeWidth={1.2} className="group-hover/cart:scale-110 transition-transform" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-gold text-brand-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '-100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            id="mobile-navigation"
            className="fixed inset-0 z-50 editorial-surface-dark flex flex-col p-6 sm:p-12 overflow-y-auto"
          >
            <button 
              className="absolute top-8 right-8 text-brand-gold"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close navigation menu"
            >
              <X size={32} />
            </button>
            
            <nav aria-label="Mobile navigation" className="mt-14 flex flex-col gap-5">
              <Link to="/" className="mb-4 inline-flex justify-center">
                <img
                  src={monogram}
                  alt="Boanerges Provisions Co."
                  className="h-24 w-auto object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                  referrerPolicy="no-referrer"
                />
              </Link>
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className="text-3xl sm:text-4xl min-h-11 font-serif text-brand-parchment hover:text-brand-gold transition-colors flex items-center justify-between group font-black"
                >
                  {link.name}
                  <ChevronRight className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </nav>

            <div className="mt-auto pt-12 border-t border-brand-earth/20">
              <p className="text-brand-gold text-[10px] uppercase tracking-widest mb-4">Our social profiles · Coming soon</p>
              <SocialLinks />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
