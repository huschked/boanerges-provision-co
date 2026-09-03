import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, CreditCard, ArrowLeft, Zap, Award, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { useCart } from '@/src/store';
import toast from 'react-hot-toast';
import { trackAnalyticsEvent } from '@/src/lib/analytics';

export const Checkout: React.FC = () => {
  const { items, total, updateQuantity, removeItem } = useCart();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [unavailableItems, setUnavailableItems] = useState<Array<{ productId: string; name: string; requested: number; available: number }>>([]);
  const [checkoutError, setCheckoutError] = useState<{ message: string; code?: string } | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      setUnavailableItems([]);
      setCheckoutError(null);
      trackAnalyticsEvent({
        type: 'checkout_start',
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        value: total(),
        metadata: {
          itemCount: items.length,
          newsletterOptIn,
        },
      });

      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: window.location.origin,
          items: items.map(item => ({
            id: item.product.id,
            quantity: item.quantity,
          })),
          customerEmail: email || undefined,
          newsletterOptIn,
        }),
      });

      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(response.ok ? 'Checkout returned an invalid response.' : 'Checkout service is unavailable. Please try again shortly.');
      }
      if (!response.ok) {
        if (data.code === 'inventory_unavailable' && Array.isArray(data.unavailableItems)) {
          setUnavailableItems(data.unavailableItems);
          toast.error(data.error || 'Some quantities are no longer available.');
          return;
        }
        setCheckoutError({ message: data.error || 'Secure checkout could not be started. Your cart is still here.', code: data.code });
        return;
      }

      const { url } = data;
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError({ message: error instanceof Error ? error.message : 'Secure checkout could not be started. Your cart is still here.', code: 'network_error' });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="pt-40 pb-32 h-screen flex flex-col items-center justify-center space-y-6">
        <h1 className="text-4xl font-serif">Your provisions are empty</h1>
        <Link to="/shop" className="text-brand-gold uppercase tracking-widest text-sm font-bold">Return to Shop</Link>
      </div>
    );
  }

  return (
    <div className="pt-40 pb-32 animate-fade-in editorial-surface-dark relative overflow-hidden">
      <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
          {/* Form Side */}
          <div className="space-y-12">
            <div className="flex items-center justify-between">
              <Link to="/shop" className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-brand-parchment/40 hover:text-brand-gold transition-colors">
                <ArrowLeft size={14} /> Back to Shop
              </Link>
              <div className="flex items-center gap-2 text-brand-gold">
                <Lock size={14} />
                <span className="text-[10px] uppercase tracking-widest font-black">Secure Checkout</span>
              </div>
            </div>

            <div className="space-y-8">
              <section className="space-y-6">
                <h2 className="text-3xl font-serif text-brand-parchment">Contact Information</h2>
                <input 
                  type="email" 
                  placeholder="Email Address (optional — Stripe will confirm it)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/10 border-b border-brand-gold/30 py-4 px-4 text-brand-parchment outline-none focus:border-brand-gold transition-colors placeholder:text-brand-parchment/40"
                />
                <div className="flex items-start gap-3 pt-2">
                  <div className="pt-1">
                    <input type="checkbox" id="newsletter" checked={newsletterOptIn} onChange={(e) => setNewsletterOptIn(e.target.checked)} className="accent-brand-gold w-4 h-4 cursor-pointer" />
                  </div>
                  <label htmlFor="newsletter" className="text-[11px] uppercase tracking-widest text-brand-parchment/60 font-black cursor-pointer leading-relaxed">
                    Email me with news and limited flavor drops
                  </label>
                </div>
              </section>

              <div className="p-8 border border-brand-gold/30 bg-brand-gold/5 rounded-sm space-y-6">
                <div className="flex items-center gap-4 text-brand-gold">
                  <CreditCard size={24} />
                  <h3 className="text-xl font-serif">Secure Payment</h3>
                </div>
                <p className="text-brand-parchment/60 text-sm font-light leading-relaxed">
                  You will be redirected to Stripe's secure payment gateway to complete your purchase. 
                  We accept all major credit cards and digital wallets.
                </p>
              </div>

              <button 
                onClick={handleCheckout}
                disabled={loading}
                className="w-full py-6 bg-brand-gold text-brand-black text-[13px] uppercase tracking-[0.3em] font-black hover:bg-brand-parchment transition-all shadow-2xl flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Proceed to Secure Payment'}
              </button>

              {unavailableItems.length > 0 && (
                <div className="border border-red-400/30 bg-red-400/5 p-6 space-y-4">
                  <p className="text-sm text-red-200 font-black">Update your cart to continue</p>
                  {unavailableItems.map(item => (
                    <div key={item.productId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                      <p className="text-brand-parchment/70"><strong className="text-brand-parchment">{item.name}</strong> — requested {item.requested}, {item.available} available</p>
                      <div className="flex gap-2">
                        {item.available > 0 && <button onClick={() => { updateQuantity(item.productId, item.available); setUnavailableItems(current => current.filter(entry => entry.productId !== item.productId)); }} className="px-3 py-2 border border-brand-gold/30 text-brand-gold text-[9px] uppercase tracking-wider font-black">Use {item.available}</button>}
                        <button onClick={() => { removeItem(item.productId); setUnavailableItems(current => current.filter(entry => entry.productId !== item.productId)); }} className="px-3 py-2 border border-red-400/30 text-red-200 text-[9px] uppercase tracking-wider font-black">Remove</button>
                      </div>
                    </div>
                  ))}
                  <Link to="/shop" className="inline-block text-[10px] uppercase tracking-widest text-brand-gold font-black">Return to shop</Link>
                </div>
              )}

              {checkoutError && (
                <div role="alert" className="border border-amber-400/30 bg-amber-400/[0.06] p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-300 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-amber-200 font-black">Checkout needs attention</p>
                      <p className="mt-1 text-sm text-brand-parchment/65">{checkoutError.message}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={handleCheckout} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-black text-[9px] uppercase tracking-wider font-black disabled:opacity-50"><RotateCcw size={12} /> Try again</button>
                    <Link to="/shop" className="px-4 py-2 border border-brand-gold/30 text-brand-gold text-[9px] uppercase tracking-wider font-black">Review cart in shop</Link>
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap items-center justify-center gap-6 text-[10px] uppercase tracking-widest text-brand-parchment/30 font-black">
                <div className="flex items-center gap-2"><ShieldCheck size={14} /> Secure Checkout</div>
                <div className="flex items-center gap-2"><Zap size={14} /> Fast Shipping</div>
                <div className="flex items-center gap-2"><Award size={14} /> Free Shipping Over $50</div>
              </div>
            </div>
          </div>

          {/* Summary Side */}
          <div className="glass-dark p-12 rounded-sm h-fit space-y-10 border border-white/10">
            <h2 className="text-3xl font-serif text-brand-parchment">Order Summary</h2>
            
            <div className="space-y-8 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-6">
                  <div className="w-20 h-20 bg-white rounded-sm overflow-hidden flex-shrink-0 border border-white/10 relative">
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <span className="absolute -top-2 -right-2 bg-brand-gold text-brand-black text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-black shadow-lg">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-base font-bold text-brand-parchment leading-tight">{item.product.name}</p>
                      <p className="text-[10px] text-brand-parchment/40 uppercase tracking-widest font-black">{item.product.sizeOz} oz</p>
                    </div>
                    <p className="text-base font-bold text-brand-gold">${(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-10 border-t border-white/10 space-y-5">
              <div className="flex justify-between text-sm uppercase tracking-widest">
                <span className="text-brand-parchment/40 font-black">Subtotal</span>
                <span className="font-bold text-brand-parchment">${total().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm uppercase tracking-widest">
                <span className="text-brand-parchment/40 font-black">Shipping</span>
                <span className="text-brand-gold font-bold">
                  {total() >= 50 ? 'FREE' : '$5.99'}
                </span>
              </div>
              <div className="flex justify-between text-sm uppercase tracking-widest">
                <span className="text-brand-parchment/40 font-black">Taxes</span>
                <span className="font-bold text-brand-parchment">Calculated in Stripe</span>
              </div>
              <div className="pt-6 flex justify-between items-center border-t border-white/10">
                <span className="font-serif text-3xl text-brand-parchment">Total</span>
                <span className="text-4xl font-serif text-brand-gold">
                  ${(total() + (total() >= 50 ? 0 : 5.99)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-8 bg-brand-gold/5 border border-brand-gold/20 rounded-sm">
              <p className="text-[12px] text-brand-parchment/60 leading-relaxed italic font-light">
                "Your provision will be handcrafted and shipped within 48 hours. Thank you for supporting artisan craftsmanship."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
