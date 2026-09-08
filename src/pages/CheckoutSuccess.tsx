import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, PackageCheck, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { useCart } from '@/src/store';
import { trackPurchaseOnce } from '@/src/lib/analytics';
import { ORDER_DELIVERY_ESTIMATE_TEXT } from '@/src/config/fulfillment';

type CheckoutSessionStatus = {
  id: string;
  status: string;
  paymentStatus: string;
  customerEmail?: string;
  orderId?: string;
  orderReference?: string;
  orderStatus?: string;
  orderStatusUrl?: string;
  orderType?: string;
  items?: Array<{ id: string; name: string; category?: string; price?: number; quantity?: number }>;
  amounts?: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    currency: string;
  };
};

export const CheckoutSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const querySessionId = searchParams.get('session_id');
  const sessionId = querySessionId || window.sessionStorage.getItem('boanerges-latest-checkout-session');
  const clearCart = useCart((state) => state.clearCart);
  const [sessionStatus, setSessionStatus] = React.useState<CheckoutSessionStatus | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(Boolean(sessionId));
  const [verificationError, setVerificationError] = React.useState('');

  useEffect(() => {
    if (querySessionId) {
      window.sessionStorage.setItem('boanerges-latest-checkout-session', querySessionId);
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
    if (!sessionId) {
      setIsVerifying(false);
      setVerificationError('Checkout session reference is missing.');
      return;
    }

    let isMounted = true;

    const verifySession = async () => {
      try {
        let data: CheckoutSessionStatus | null = null;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const response = await fetch(`/api/checkout/session-status?session_id=${encodeURIComponent(sessionId)}`);
          data = await response.json();
          if (!response.ok) throw new Error((data as any)?.error || 'Unable to verify checkout status.');
          if (!isMounted) return;
          setSessionStatus(data);

          const awaitingOrderReference = data?.status === 'complete' && data.paymentStatus === 'paid' && !data.orderReference;
          if (!awaitingOrderReference || attempt === 7) break;
          await new Promise(resolve => window.setTimeout(resolve, 1000));
        }

        if (!data || !isMounted) return;

        if (data.status === 'complete' && data.paymentStatus === 'paid') {
          const fallbackItems = useCart.getState().items.map(item => ({
            id: item.product.id, name: item.product.name, category: item.product.category,
            price: item.product.price, quantity: item.quantity,
          }));
          trackPurchaseOnce({
            type: 'purchase',
            transactionId: data.orderId || data.id,
            value: data.amounts?.total,
            currency: data.amounts?.currency || 'USD',
            items: data.items?.length ? data.items : fallbackItems,
            metadata: { orderType: data.orderType || 'one_time' },
          });
          clearCart();
        } else {
          setVerificationError('Payment has not been confirmed yet.');
        }
      } catch (error) {
        if (!isMounted) return;
        setVerificationError(error instanceof Error ? error.message : 'Unable to verify checkout status.');
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [clearCart, querySessionId, sessionId]);

  const isPaid = sessionStatus?.status === 'complete' && sessionStatus.paymentStatus === 'paid';
  const formattedTotal = sessionStatus?.amounts
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: sessionStatus.amounts.currency || 'usd' }).format(sessionStatus.amounts.total)
    : '';

  return (
    <div className="pt-40 pb-32 animate-fade-in editorial-surface-dark relative overflow-hidden">
      <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
      <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10">
        <div className="glass-dark border-brand-gold/10 rounded-sm overflow-hidden shadow-2xl">
          <div className="p-10 md:p-16 border-b border-white/5 text-center space-y-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center">
              {isVerifying ? (
                <Loader2 className="text-brand-gold animate-spin" size={40} />
              ) : isPaid ? (
                <CheckCircle2 className="text-brand-gold" size={40} />
              ) : (
                <AlertTriangle className="text-brand-gold" size={40} />
              )}
            </div>
            <div className="space-y-4">
              <span className="text-brand-gold text-[11px] uppercase tracking-[0.35em] font-black block">
                {isVerifying ? 'Verifying Payment' : isPaid ? 'Order Confirmed' : 'Payment Review'}
              </span>
              <h1 className="text-4xl md:text-6xl font-serif text-brand-parchment leading-tight">
                {isVerifying ? 'One moment while we confirm.' : isPaid ? 'Your order is confirmed.' : 'We are checking your payment.'}
              </h1>
              <p className="max-w-2xl mx-auto text-brand-parchment/65 text-lg font-light leading-relaxed">
                {isPaid
                  ? 'Thank you for your order. We have received your payment and your artisan salts will be prepared for shipment shortly.'
                  : verificationError || 'Your checkout session is still being verified. If payment completed, your confirmation will follow shortly.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-white/5">
            <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-white/5 space-y-4">
              <PackageCheck className="text-brand-gold" size={24} />
              <div className="space-y-2">
                <h2 className="text-brand-parchment text-lg font-serif">What happens next</h2>
                <p className="text-sm text-brand-parchment/55 leading-relaxed">
                  Your order is now in our queue and will be prepared and packed before shipping. {ORDER_DELIVERY_ESTIMATE_TEXT}
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
                  {sessionStatus?.orderReference
                    ? `Order ${sessionStatus.orderReference}`
                    : isPaid
                      ? 'Order reference is being prepared'
                      : 'Checkout reference unavailable'}
                </p>
                <p className="text-sm text-brand-parchment/50 leading-relaxed max-w-xl">
                  {formattedTotal
                    ? `Confirmed total: ${formattedTotal}. Keep this page handy until your confirmation email arrives.`
                    : 'Keep this page handy until your confirmation email arrives. You can also continue exploring pairings and future provisions while we prepare your order.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              {sessionStatus?.orderStatusUrl && <a
                href={sessionStatus.orderStatusUrl}
                className="w-full sm:w-auto px-10 py-5 bg-brand-gold text-brand-black text-[11px] uppercase tracking-[0.25em] font-black hover:bg-brand-parchment transition-all text-center"
              >
                View Order Status
              </a>}
              <Link
                to="/shop"
                className={sessionStatus?.orderStatusUrl ? "w-full sm:w-auto px-10 py-5 border border-brand-gold/30 text-brand-gold text-[11px] uppercase tracking-[0.25em] font-black hover:bg-brand-gold/10 transition-all text-center" : "w-full sm:w-auto px-10 py-5 bg-brand-gold text-brand-black text-[11px] uppercase tracking-[0.25em] font-black hover:bg-brand-parchment transition-all text-center"}
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
