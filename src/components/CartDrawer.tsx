import React, { useEffect, useRef, useState } from 'react';
import { X, Minus, Plus, ShoppingCart, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useCart } from '@/src/store';
import { cn } from '@/src/lib/utils';
import { getProductsByIds } from '@/src/services/productService';
import { bundleToCartProduct, getBundles } from '@/src/services/bundleService';

export const CartDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { items, removeItem, updateQuantity, refreshProductSnapshots, total, itemCount } = useCart();
  const [cartAnnouncement, setCartAnnouncement] = useState('');
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const productIds = items.filter((item) => item.product.commerceType !== 'bundle').map((item) => item.product.id).sort().join('|');
  const bundleIds = items.filter((item) => item.product.commerceType === 'bundle').map((item) => item.product.id).sort().join('|');

  useEffect(() => {
    if (!isOpen || (!productIds && !bundleIds)) return;
    let cancelled = false;
    Promise.all([productIds ? getProductsByIds(productIds.split('|')) : Promise.resolve([]), bundleIds ? getBundles() : Promise.resolve([])])
      .then(([products, bundles]) => { if (!cancelled) refreshProductSnapshots([...products, ...bundles.filter(bundle => bundleIds.split('|').includes(bundle.id)).map(bundleToCartProduct)]); })
      .catch((error) => console.error('Unable to refresh cart product data:', error));
    return () => { cancelled = true; };
  }, [isOpen, productIds, bundleIds, refreshProductSnapshots]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  const handleDrawerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const changeQuantity = (productId: string, productName: string, nextQuantity: number) => {
    updateQuantity(productId, nextQuantity);
    setCartAnnouncement(nextQuantity > 0 ? `${productName} quantity changed to ${nextQuantity}.` : `${productName} removed from your cart.`);
  };

  const removeFromCart = (productId: string, productName: string) => {
    removeItem(productId);
    setCartAnnouncement(`${productName} removed from your cart.`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-brand-black/60 backdrop-blur-sm z-[60]"
          />
          
          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            onKeyDown={handleDrawerKeyDown}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md editorial-surface-dark z-[70] shadow-2xl flex flex-col"
          >
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{cartAnnouncement}</p>
            <div className="shrink-0 p-5 sm:p-8 border-b border-white/10 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <h2 id="cart-drawer-title" className="text-2xl font-serif text-brand-parchment">Your Provisions</h2>
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full text-brand-gold">
                  {itemCount()} {itemCount() === 1 ? 'item' : 'items'}
                </span>
              </div>
              <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close cart" className="touch-target flex items-center justify-center text-brand-parchment/70 hover:text-brand-gold transition-colors">
                <X size={24} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-8 space-y-8 relative z-10 custom-scrollbar" aria-label="Cart items">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                    <ShoppingCart size={32} aria-hidden="true" className="text-brand-parchment/45" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-serif text-xl text-brand-parchment">Your cart is empty</p>
                    <p className="text-sm text-brand-parchment/70 font-light">Discover our handcrafted salts and start your collection.</p>
                  </div>
                  <button 
                    onClick={onClose}
                    className="min-h-11 px-8 py-3 bg-brand-gold text-brand-black text-[10px] uppercase tracking-widest font-black hover:bg-brand-parchment transition-colors"
                  >
                    Shop All Products
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.product.id} className="flex gap-4 sm:gap-6 group">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-sm overflow-hidden flex-shrink-0 border border-white/10">
                      <img 
                        src={item.product.imageUrl} 
                        alt={item.product.imageAlt || item.product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-serif text-lg leading-tight text-brand-parchment">{item.product.name}</h3>
                        <p className="font-bold text-brand-gold">${(item.product.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <p className="text-[10px] text-brand-parchment/65 uppercase tracking-widest font-black">{item.product.commerceType === 'bundle' ? `${item.product.bundleComponents?.length || 0} flavors · ` : ''}{item.product.sizeOz} oz</p>
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center border border-white/10 rounded-sm bg-white/5">
                          <button 
                            type="button"
                            onClick={() => changeQuantity(item.product.id, item.product.name, item.quantity - 1)}
                            aria-label={`Decrease ${item.product.name} quantity`}
                            className="touch-target flex items-center justify-center hover:bg-white/5 transition-colors text-brand-parchment"
                          >
                            <Minus size={14} aria-hidden="true" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-brand-parchment" aria-label={`${item.product.name} quantity ${item.quantity}`}>{item.quantity}</span>
                          <button 
                            type="button"
                            onClick={() => changeQuantity(item.product.id, item.product.name, item.quantity + 1)}
                            aria-label={`Increase ${item.product.name} quantity`}
                            className="touch-target flex items-center justify-center hover:bg-white/5 transition-colors text-brand-parchment"
                          >
                            <Plus size={14} aria-hidden="true" />
                          </button>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeFromCart(item.product.id, item.product.name)}
                          className="min-h-11 px-2 text-[10px] uppercase tracking-widest text-brand-parchment/70 hover:text-red-300 transition-colors font-black"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="shrink-0 max-h-[48dvh] overflow-y-auto overscroll-contain p-5 sm:p-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-brand-charcoal border-t border-white/10 space-y-5 relative z-10 custom-scrollbar">
                <div className="space-y-3">
                  <div className="flex justify-between text-[11px] uppercase tracking-widest">
                    <span className="text-brand-parchment/70 font-black">Subtotal</span>
                    <span className="font-bold text-brand-parchment">${total().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] uppercase tracking-widest">
                    <span className="text-brand-parchment/70 font-black">Shipping</span>
                    <span className="text-brand-gold font-bold">
                      {total() >= 50 ? 'FREE' : 'Calculated at checkout'}
                    </span>
                  </div>
                  {total() < 50 && (
                    <div className="pt-2">
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(total() / 50) * 100}%` }}
                          className="h-full bg-brand-gold"
                        />
                      </div>
                      <p className="text-[9px] text-brand-parchment/70 mt-2 uppercase tracking-widest font-black">
                        Add <span className="font-bold text-brand-gold">${(50 - total()).toFixed(2)}</span> more for free shipping
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                  <span className="font-serif text-2xl text-brand-parchment">Total</span>
                  <span className="text-3xl font-serif text-brand-gold">${total().toFixed(2)}</span>
                </div>

                <Link 
                  to="/checkout"
                  onClick={onClose}
                  className="w-full min-h-11 py-4 sm:py-5 bg-brand-gold text-brand-black text-[11px] uppercase tracking-[0.25em] font-black hover:bg-brand-parchment transition-all flex items-center justify-center gap-3 group shadow-2xl"
                >
                  Proceed to Checkout
                  <ArrowRight size={18} aria-hidden="true" className="group-hover:translate-x-1 transition-transform" />
                </Link>
                
                <p className="text-[9px] text-center text-brand-parchment/60 uppercase tracking-widest font-black">
                  Secure Checkout Powered by Stripe
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
