import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Lock, LayoutDashboard, Package, ShoppingCart, Users, Mail, LogOut, Search, Loader2, RefreshCw, ChartNoAxesCombined, Gift } from 'lucide-react';
import logo from '@/src/assets/BoanergesLogoTransparent-v2.png';
import { auth, db } from '@/src/lib/firebase';
import { inMemoryPersistence, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, setPersistence, signOut, User } from 'firebase/auth';
import { collection, query, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { Product, getAllProducts } from '@/src/services/productService';
import toast from 'react-hot-toast';
import { DashboardView, Order } from '../components/admin/DashboardView';
import { ProductsView } from '../components/admin/ProductsView';
import { OrdersView } from '../components/admin/OrdersView';
import type { OrderQueueFilter } from '../components/admin/OrdersView';
import { SubscribersView, Subscriber } from '../components/admin/SubscribersView';
import { MessagesView, ContactMessage } from '../components/admin/MessagesView';
import { AnalyticsView } from '../components/admin/AnalyticsView';
import { BundlesView } from '../components/admin/BundlesView';
import { normalizeOrderLifecycle } from '@/src/lib/orderLifecycle';

type AdminTab = 'dashboard' | 'analytics' | 'products' | 'bundles' | 'orders' | 'subscribers' | 'contact';

export const Admin: React.FC = () => {
  const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
  const initialParams = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const initialOrderId = initialParams.get('order') || '';
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(() => initialParams.get('tab') === 'orders' || initialOrderId ? 'orders' : 'dashboard');
  const [orderQueue, setOrderQueue] = useState<OrderQueueFilter>('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialOrderId);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [stats, setStats] = useState({ revenue: 0, orderCount: 0, productCount: 0, lowStock: 0 });
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const pData = await getAllProducts();
      setProducts(pData);

      const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(300)));
      const oData = ordersSnap.docs.map((snapshot) => {
        const data = snapshot.data();
        const lifecycle = normalizeOrderLifecycle(data);
        return {
          id: snapshot.id,
          ...data,
          totalAmount: data.totalAmount ?? data.total ?? 0,
          ...lifecycle,
        } as Order;
      });
      setOrders(oData);

      const subSnap = await getDocs(query(collection(db, 'subscribers'), orderBy('createdAt', 'desc'), limit(300)));
      setSubscribers(subSnap.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as Subscriber)));

      const msgSnap = await getDocs(query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'), limit(300)));
      setMessages(msgSnap.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as ContactMessage)));

      setStats({
        revenue: oData.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0),
        orderCount: oData.length,
        productCount: pData.length,
        lowStock: pData.filter((product) => product.currentInventory < (product.reorderThreshold || 10)).length,
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to fetch admin data.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    const initializeAdminSession = async () => {
      try {
        // A fresh visit to /admin always requires a fresh authentication ceremony.
        await signOut(auth);
        await setPersistence(auth, inMemoryPersistence);
        if (cancelled) return;

        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError(null);

      if (!currentUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && userDoc.data()?.role === 'admin') {
          setIsAdmin(true);
          await fetchData();
        } else {
          setIsAdmin(false);
          toast.error('Unauthorized: You do not have admin access.', { icon: '🔒' });
          await signOut(auth);
        }
      } catch (error) {
        console.error('Error verifying admin role:', error);
        setIsAdmin(false);
        setAuthError('We could not verify admin access right now. Please retry.');
        toast.error('Unable to verify admin access right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
        });
      } catch (error) {
        console.error('Unable to initialize the admin session:', error);
        if (!cancelled) {
          setIsAdmin(false);
          setAuthError('We could not initialize a secure admin session. Please retry.');
          setLoading(false);
        }
      }
    };

    void initializeAdminSession();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      return;
    }

    const resetIdleTimer = () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      idleTimeoutRef.current = setTimeout(async () => {
        toast('Admin session timed out after 15 minutes of inactivity.');
        await signOut(auth);
      }, ADMIN_IDLE_TIMEOUT_MS);
    };

    const activityEvents: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

    resetIdleTimer();
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    });

    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
    };
  }, [isAdmin]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setAuthError(null);
      await setPersistence(auth, inMemoryPersistence);
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login error:', error);
      const message =
        error?.code === 'auth/unauthorized-domain'
          ? 'This domain is not authorized for Firebase Google sign-in yet.'
          : 'Unable to start Google sign-in.';
      setAuthError(message);
      toast.error(message);
    }
  };

  const handleLogout = async () => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    await signOut(auth);
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredProducts = products.filter((product) =>
    !normalizedSearchTerm ||
    product.name.toLowerCase().includes(normalizedSearchTerm) ||
    (product.category || '').toLowerCase().includes(normalizedSearchTerm) ||
    product.slug.toLowerCase().includes(normalizedSearchTerm)
  );
  const filteredOrders = orders.filter((order) =>
    !normalizedSearchTerm ||
    order.id.toLowerCase().includes(normalizedSearchTerm) ||
    order.customerEmail.toLowerCase().includes(normalizedSearchTerm) ||
    (order.customerName || '').toLowerCase().includes(normalizedSearchTerm) ||
    (order.customerPhone || '').toLowerCase().includes(normalizedSearchTerm) ||
    (order.paymentStatus || '').toLowerCase().includes(normalizedSearchTerm) ||
    (order.fulfillmentStatus || '').toLowerCase().includes(normalizedSearchTerm) ||
    (order.shipmentStatus || '').toLowerCase().includes(normalizedSearchTerm) ||
    [order.shippingAddress?.line1, order.shippingAddress?.city, order.shippingAddress?.state, order.shippingAddress?.postalCode]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearchTerm)
  );
  const filteredSubscribers = subscribers.filter((subscriber) =>
    !normalizedSearchTerm ||
    subscriber.email.toLowerCase().includes(normalizedSearchTerm) ||
    (subscriber.source || '').toLowerCase().includes(normalizedSearchTerm)
  );
  const filteredMessages = messages.filter((message) =>
    !normalizedSearchTerm ||
    message.name.toLowerCase().includes(normalizedSearchTerm) ||
    message.email.toLowerCase().includes(normalizedSearchTerm) ||
    (message.subject || '').toLowerCase().includes(normalizedSearchTerm) ||
    message.message.toLowerCase().includes(normalizedSearchTerm)
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-black">
        <Loader2 className="animate-spin text-brand-gold" size={48} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center editorial-surface-dark relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/5 via-transparent to-brand-gold/5" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full p-12 glass-dark border-brand-gold/20 text-center space-y-10 relative z-10 shadow-2xl">
          <div className="space-y-6">
            <motion.img initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} src={logo} alt="Boanerges" className="h-24 mx-auto object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]" referrerPolicy="no-referrer" />
            <div className="space-y-2">
              <h1 className="text-3xl font-serif text-brand-parchment tracking-tight">Admin Portal</h1>
              <p className="text-brand-gold/60 text-[10px] uppercase tracking-[0.4em] font-black">Secure Access Required</p>
            </div>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent" />
          <button onClick={handleLogin} className="w-full py-5 bg-brand-gold text-brand-black text-[11px] uppercase tracking-[0.3em] font-black hover:bg-brand-parchment transition-all duration-500 flex items-center justify-center gap-3 shadow-xl group">
            <Lock size={16} className="group-hover:scale-110 transition-transform" />
            Sign in with Google
          </button>
          <p className="text-brand-parchment/20 text-[9px] uppercase tracking-widest">Authorized Personnel Only</p>
          {authError && <p className="text-xs text-red-400/80 leading-relaxed">{authError}</p>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black flex overflow-x-hidden">
      <aside className="w-20 lg:w-72 shrink-0 border-r border-white/5 flex flex-col editorial-surface-dark relative overflow-hidden z-40 transition-[width] duration-300">
        <div className="absolute inset-0 surface-vignette-dark opacity-70 pointer-events-none" />
        <div className="px-3 py-6 lg:p-10 border-b border-white/5 flex flex-col items-center text-center">
          <Link to="/" className="group relative">
            <div className="absolute -inset-4 bg-brand-gold/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <img src={logo} alt="Boanerges" className="h-10 lg:h-20 max-w-full object-contain group-hover:scale-105 transition-all duration-700 relative z-10 drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]" referrerPolicy="no-referrer" />
          </Link>
          <div className="hidden lg:block mt-4 space-y-1">
            <p className="text-[10px] uppercase tracking-[0.4em] text-brand-gold font-black">Admin Portal</p>
            <div className="h-0.5 w-8 bg-brand-gold/30 mx-auto rounded-full" />
          </div>
        </div>

        <nav className="flex-grow px-2 py-6 lg:p-6 space-y-1.5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
            { id: 'products', label: 'Inventory', icon: Package },
            { id: 'bundles', label: 'Bundles', icon: Gift },
            { id: 'orders', label: 'Orders', icon: ShoppingCart },
            { id: 'subscribers', label: 'Audience', icon: Users },
            { id: 'contact', label: 'Inquiries', icon: Mail },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { if (tab.id === 'orders') setOrderQueue('all'); setActiveTab(tab.id as AdminTab); }}
              title={tab.label}
              className={`w-full flex items-center justify-center lg:justify-start gap-4 px-3 lg:px-5 py-4 rounded-sm text-[10px] uppercase tracking-[0.25em] font-black transition-all duration-500 relative group overflow-hidden ${
                activeTab === tab.id ? 'text-brand-black' : 'text-brand-parchment/30 hover:text-brand-parchment'
              }`}
            >
              {activeTab === tab.id && <motion.div layoutId="activeTab" className="absolute inset-0 bg-brand-gold shadow-lg shadow-brand-gold/20" transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />}
              <div className="relative z-10 flex min-w-0 items-center gap-4">
                <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 1.5} className="transition-all duration-500 group-hover:scale-110" />
                <span className="hidden lg:inline whitespace-nowrap">{tab.label}</span>
              </div>
            </button>
          ))}
        </nav>

        <div className="px-2 py-5 lg:p-8 border-t border-white/5 space-y-6">
          <div className="flex items-center justify-center lg:justify-start gap-4 lg:px-2 relative z-10 group cursor-default">
            <div className="relative">
              <div className="absolute -inset-1 bg-brand-gold/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img src={user?.photoURL || ''} className="w-9 h-9 lg:w-11 lg:h-11 rounded-full border border-white/10 shadow-xl relative z-10" alt="Admin" />
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-[11px] text-brand-parchment font-black tracking-wide leading-tight">{user?.displayName}</p>
              <p className="text-[9px] text-brand-gold/50 uppercase tracking-[0.2em] font-bold">Master Admin</p>
            </div>
          </div>
          <button onClick={handleLogout} title="Sign Out" className="w-full flex items-center justify-center lg:justify-start gap-4 px-3 lg:px-4 py-4 text-[10px] uppercase tracking-[0.2em] font-black text-red-400/60 hover:text-red-400 hover:bg-red-400/5 rounded-sm transition-all duration-500 group">
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="hidden lg:inline whitespace-nowrap">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto editorial-surface-dark">
        <header className="h-28 border-b border-white/5 flex items-center justify-between gap-6 px-6 lg:px-10 xl:px-16 bg-brand-black/90 backdrop-blur-2xl sticky top-0 z-30">
          <div className="flex items-center gap-6">
            <div className="w-1.5 h-10 bg-brand-gold rounded-full shadow-[0_0_15px_rgba(197,160,89,0.5)]" />
            <div className="space-y-0.5">
              <h2 className="text-3xl font-serif text-brand-parchment capitalize tracking-tight">{activeTab}</h2>
              <p className="text-[9px] uppercase tracking-[0.3em] text-brand-gold/40 font-black">Management Console</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            {activeTab !== 'orders' && <div className="relative group hidden lg:block">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-parchment/20 group-focus-within:text-brand-gold transition-colors" size={14} />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} type="text" placeholder="Search resources..." className="bg-white/5 border border-white/10 rounded-full py-3 pl-14 pr-8 text-[11px] uppercase tracking-widest text-brand-parchment outline-none focus:border-brand-gold/50 focus:bg-white/10 transition-all duration-500 w-56 xl:w-80 placeholder:text-brand-parchment/10" />
            </div>}
            <button onClick={fetchData} className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-brand-parchment/40 hover:text-brand-gold hover:border-brand-gold/50 hover:bg-white/5 transition-all duration-500 group">
              {isRefreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-700" />}
            </button>
          </div>
        </header>

        <div className="min-w-0 p-6 lg:p-10 xl:p-12">
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              orders={filteredOrders}
              products={filteredProducts}
              onViewOrders={(queue = 'all') => { setOrderQueue(queue); setActiveTab('orders'); }}
              onManageInventory={() => setActiveTab('products')}
            />
          )}
          {activeTab === 'analytics' && <AnalyticsView orders={orders} products={products} subscribers={subscribers} messages={messages} />}
          {activeTab === 'products' && <ProductsView products={filteredProducts} onRefresh={fetchData} />}
          {activeTab === 'bundles' && <BundlesView products={products} />}
          {activeTab === 'orders' && <OrdersView orders={filteredOrders} onRefresh={fetchData} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} queueFilter={orderQueue} onQueueFilterChange={setOrderQueue} initialSelectedOrderId={initialOrderId} />}
          {activeTab === 'subscribers' && <SubscribersView subscribers={filteredSubscribers} />}
          {activeTab === 'contact' && <MessagesView messages={filteredMessages} onRefresh={fetchData} />}
        </div>
      </main>
    </div>
  );
};
