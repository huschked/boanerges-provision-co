import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { ProductDetail } from './pages/ProductDetail';
import { About } from './pages/About';
import { Recipes } from './pages/Recipes';
import { FAQ } from './pages/FAQ';
import { Contact } from './pages/Contact';
import { Bundles } from './pages/Bundles';
import { Checkout } from './pages/Checkout';
import { CheckoutSuccess } from './pages/CheckoutSuccess';
import { Admin } from './pages/Admin';
import { ReturnsPolicy } from './pages/ReturnsPolicy';
import { OrderStatus } from './pages/OrderStatus';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { EmailPreferences } from './pages/EmailPreferences';
import { Review } from './pages/Review';
import { TermsOfService } from './pages/TermsOfService';
import { auth } from './lib/firebase';
import { MotionConfig } from 'motion/react';
import { CookiePreferences } from './components/CookiePreferences';
import { trackPageView } from './lib/analytics';

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
  const wasAdminPage = useRef(isAdminPage);

  useEffect(() => {
    if (wasAdminPage.current && !isAdminPage) {
      void signOut(auth).catch((error) => console.error('Unable to end the admin session:', error));
    }
    wasAdminPage.current = isAdminPage;
  }, [isAdminPage]);

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex flex-col">
      <Toaster position="bottom-right" />
      <ScrollToTop />
      <AnalyticsRouteTracker />
      {!isAdminPage && <Header onCartClick={() => setIsCartOpen(true)} />}
      {!isAdminPage && <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />}
      
      <main className="flex-grow">
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
        </Routes>
      </main>

      {!isAdminPage && <Footer />}
      {!isAdminPage && <CookiePreferences />}
    </div>
    </MotionConfig>
  );
}
