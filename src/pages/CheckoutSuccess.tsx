import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, PackageCheck, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { useCart } from '@/src/store';

export const CheckoutSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const clearCart = useCart((state) => state.clearCart);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="pt-40 pb-32 animate-fade-in bg-brand-black relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 stone-texture" />
      <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10">
        <div className="glass-dark border-brand-gold/10 rounded-sm overflow-hidden shadow-2xl">
          <div className="p-10 md:p-16 border-b border-white/5 text-center space-y-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center">
              <CheckCircle2 className="text-brand-gold" size={40} />
            </div>
            <div className="space-y-4">
              <span className="text-brand-gold text-[11px] uppercase tracking-[0.35em] font-black block">
                Order Confirmed
              </span>
              <h1 className="text-4xl md:text-6xl font-serif text-brand-parchment leading-tight">
                Your provisions are on the way.
              </h1>
              <p className="max-w-2xl mx-auto text-brand-parchment/65 text-lg font-light leading-relaxed">
                Thank you for your order. We have received your payment and your artisan salts will be prepared for shipment shortly.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-white/5">
            <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-white/5 space-y-4">
              <PackageCheck className="text-brand-gold" size={24} />
              <div className="space-y-2">
                <h2 className="text-brand-parchment text-lg font-serif">What happens next</h2>
                <p className="text-sm text-brand-parchment/55 leading-relaxed">
                  Your order is now in our queue and will be handcrafted and packed before shipping.
                </p>
              </div>
            </div>
            <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-white/5 space-y-4">
              <Mail className="text-brand-gold" size={24} />
              <div className="space-y-2">
                <h2 className="text-brand-parchment text-lg font-serif">Confirmation email</h2>
                <p className="text-sm text-brand-parchment/55 leading-relaxed">
                  A receipt and order confirmation should arrive in your inbox shortly.
                </p>
              </div>
            </div>
            <div className="p-8 md:p-10 space-y-4">
              <Sparkles className="text-brand-gold" size={24} />
              <div className="space-y-2">
                <h2 className="text-brand-parchment text-lg font-serif">Need help?</h2>
                <p className="text-sm text-brand-parchment/55 leading-relaxed">
                  If anything looks off with your order, our team can help you get it sorted quickly.
                </p>
              </div>
            </div>
          </div>

          <div className="p-10 md:p-16 flex flex-col lg:flex-row items-start justify-between gap-10">
            <div className="space-y-4">
              <p className="text-[11px] uppercase tracking-[0.25em] text-brand-gold font-black">
                Reference
              </p>
              <div className="space-y-2">
                <p className="text-brand-parchment text-lg font-serif">
                  {sessionId ? `Stripe Session ${sessionId.slice(-10).toUpperCase()}` : 'Payment received successfully'}
                </p>
                <p className="text-sm text-brand-parchment/50 leading-relaxed max-w-xl">
                  Keep this page handy until your confirmation email arrives. You can also continue exploring pairings and future provisions while we prepare your order.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <Link
                to="/shop"
                className="w-full sm:w-auto px-10 py-5 bg-brand-gold text-brand-black text-[11px] uppercase tracking-[0.25em] font-black hover:bg-brand-parchment transition-all text-center"
              >
                Continue Shopping
              </Link>
              <Link
                to="/recipes"
                className="w-full sm:w-auto px-10 py-5 border border-brand-gold/30 text-brand-gold text-[11px] uppercase tracking-[0.25em] font-black hover:bg-brand-gold/10 transition-all text-center inline-flex items-center justify-center gap-3"
              >
                Explore Pairings
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
