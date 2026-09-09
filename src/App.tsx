import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { auth } from './lib/firebase';
import { MotionConfig } from 'motion/react';
import { CookiePreferences } from './components/CookiePreferences';
import { trackPageView } from './lib/analytics';
import { PrelaunchBoundary } from './components/PrelaunchGate';
import { RouteSeoHead } from './components/SeoHead';

const Home = React.lazy(() => import('./pages/Home').then(({ Home }) => ({ default: Home })));
const Shop = React.lazy(() => import('./pages/Shop').then(({ Shop }) => ({ default: Shop })));
const ProductDetail = React.lazy(() => import('./pages/ProductDetail').then(({ ProductDetail }) => ({ default: ProductDetail })));
const About = React.lazy(() => import('./pages/About').then(({ About }) => ({ default: About })));
const Recipes = React.lazy(() => import('./pages/Recipes').then(({ Recipes }) => ({ default: Recipes })));
const FAQ = React.lazy(() => import('./pages/FAQ').then(({ FAQ }) => ({ default: FAQ })));
const Contact = React.lazy(() => import('./pages/Contact').then(({ Contact }) => ({ default: Contact })));
const Bundles = React.lazy(() => import('./pages/Bundles').then(({ Bundles }) => ({ default: Bundles })));
const Checkout = React.lazy(() => import('./pages/Checkout').then(({ Checkout }) => ({ default: Checkout })));
const CheckoutSuccess = React.lazy(() => import('./pages/CheckoutSuccess').then(({ CheckoutSuccess }) => ({ default: CheckoutSuccess })));
const ReturnsPolicy = React.lazy(() => import('./pages/ReturnsPolicy').then(({ ReturnsPolicy }) => ({ default: ReturnsPolicy })));
const OrderStatus = React.lazy(() => import('./pages/OrderStatus').then(({ OrderStatus }) => ({ default: OrderStatus })));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy').then(({ PrivacyPolicy }) => ({ default: PrivacyPolicy })));
const EmailPreferences = React.lazy(() => import('./pages/EmailPreferences').then(({ EmailPreferences }) => ({ default: EmailPreferences })));
const Review = React.lazy(() => import('./pages/Review').then(({ Review }) => ({ default: Review })));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService').then(({ TermsOfService }) => ({ default: TermsOfService })));
const Admin = React.lazy(() => import('./pages/Admin').then(({ Admin }) => ({ default: Admin })));
const NotFound = React.lazy(() => import('./pages/NotFound').then(({ NotFound }) => ({ default: NotFound })));

function RouteLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center bg-brand-black text-brand-gold">
      <span className="sr-only">Loading page</span>
      <div aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold/20 border-t-brand-gold" />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AnalyticsRouteTracker() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    trackPageView(`${pathname}${search}`);
  }, [pathname, search]);
  return null;
}

export default function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const isCheckoutSuccessPage = ['/checkout/success', '/checkout-success', '/success']
    .some(path => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const bypassPrelaunch = isAdminPage
    || isCheckoutSuccessPage
    || ['/order-status', '/email-preferences', '/review', '/privacy', '/terms'].includes(location.pathname);
  const wasAdminPage = useRef(isAdminPage);

  useEffect(() => {
    if (wasAdminPage.current && !isAdminPage) {
      void signOut(auth).catch((error) => console.error('Unable to end the admin session:', error));
    }
    wasAdminPage.current = isAdminPage;
  }, [isAdminPage]);

  return (
    <PrelaunchBoundary bypass={bypassPrelaunch}>
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex flex-col">
      <Toaster position="bottom-right" />
      <ScrollToTop />
      <RouteSeoHead />
      <AnalyticsRouteTracker />
      {!isAdminPage && <Header onCartClick={() => setIsCartOpen(true)} />}
      {!isAdminPage && <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />}
      
      <main className="flex-grow">
        <React.Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/bundles" element={<Bundles />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/checkout/success/*" element={<CheckoutSuccess />} />
          <Route path="/checkout-success" element={<CheckoutSuccess />} />
          <Route path="/success" element={<CheckoutSuccess />} />
          <Route path="/returns" element={<ReturnsPolicy />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/email-preferences" element={<EmailPreferences />} />
          <Route path="/review" element={<Review />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/order-status" element={<OrderStatus />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </React.Suspense>
      </main>

      {!isAdminPage && <Footer />}
      {!isAdminPage && <CookiePreferences />}
    </div>
    </MotionConfig>
    </PrelaunchBoundary>
  );
}
