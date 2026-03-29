import React, { useState, useEffect } from 'react';
import { ShoppingBag, Menu, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '@/src/store';
import { cn } from '@/src/lib/utils';
import logo from '@/src/assets/BoanergesLogoSimple.png';

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

  const navLinks = [
    { name: 'Shop All', path: '/shop' },
    { name: 'Our Story', path: '/about' },
    { name: 'Recipes', path: '/recipes' },
    { name: 'Contact', path: '/contact' },
    { name: 'FAQ', path: '/faq' },
  ];

  // Pages that have a dark hero/background at the top
  const isDarkHeroPage = ['/', '/about', '/shop', '/recipes', '/faq', '/contact', '/bundles', '/checkout'].includes(location.pathname) || location.pathname.startsWith('/product/');
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
              "md:hidden transition-colors duration-300",
              showDarkText ? "text-brand-black" : "text-brand-parchment"
            )}
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-12">
            {navLinks.slice(0, 2).map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={cn(
                  "text-[14px] uppercase tracking-[0.2em] transition-all duration-300 font-black",
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
          <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center group">
            <img 
              src={logo} 
              alt="Boanerges Provision Co." 
              className={cn(
                "w-auto object-contain group-hover:scale-105 transition-all duration-500",
                isScrolled ? "h-16 md:h-24" : "h-32 md:h-56",
                showDarkText && "brightness-0" // Make logo black on light backgrounds if it's too light
              )}
              referrerPolicy="no-referrer"
            />
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-8 md:gap-12">
            <nav className="hidden md:flex items-center gap-12">
              {navLinks.slice(2).map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={cn(
                    "text-[14px] uppercase tracking-[0.2em] transition-all duration-300 font-black",
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
            className="fixed inset-0 z-50 bg-brand-black parchment-texture flex flex-col p-12"
          >
            <button 
              className="absolute top-8 right-8 text-brand-gold"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={32} />
            </button>
            
            <div className="mt-20 flex flex-col gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className="text-4xl font-serif text-brand-parchment hover:text-brand-gold transition-colors flex items-center justify-between group font-black"
                >
                  {link.name}
                  <ChevronRight className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>

            <div className="mt-auto pt-12 border-t border-brand-earth/20">
              <p className="text-brand-gold text-[10px] uppercase tracking-widest mb-4">Follow our journey</p>
              <div className="flex gap-6 text-brand-parchment">
                <span className="text-sm">Instagram</span>
                <span className="text-sm">Facebook</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
