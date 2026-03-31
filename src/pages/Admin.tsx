import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Lock, 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Mail, 
  Settings, 
  LogOut, 
  Search, 
  Loader2
} from 'lucide-react';
import logo from '@/src/assets/BoanergesLogoSimple.png';
import { auth, db } from '@/src/lib/firebase';
import { cn } from '@/src/lib/utils';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  limit, 
  doc, 
  getDoc
} from 'firebase/firestore';
import { Product, getProducts } from '@/src/services/productService';
import toast from 'react-hot-toast';

import { DashboardView, Order } from '../components/admin/DashboardView';
import { ProductsView } from '../components/admin/ProductsView';
import { OrdersView } from '../components/admin/OrdersView';
import { SubscribersView, Subscriber } from '../components/admin/SubscribersView';
import { MessagesView, ContactMessage } from '../components/admin/MessagesView';

// --- Types ---
type AdminTab = 'dashboard' | 'products' | 'orders' | 'subscribers' | 'contact';

export const Admin: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [stats, setStats] = useState({
    revenue: 0,
    orderCount: 0,
    productCount: 0,
    lowStock: 0
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Strict admin check via Firestore mapping
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists() && userDoc.data()?.role === 'admin') {
            setIsAdmin(true); 
            fetchData();
          } else {
            setIsAdmin(false);
            toast.error("Unauthorized: You do not have admin access.", { icon: '🔒' });
            await signOut(auth); // Log them out immediately
          }
        } catch (error) {
          console.error("Error verifying admin role:", error);
          setIsAdmin(false);
          await signOut(auth);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    try {
      // Products
      const pData = await getProducts();
      setProducts(pData);

      // Orders
      const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50)));
      const oData = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(oData);

      // Subscribers
      const subSnap = await getDocs(query(collection(db, 'subscribers'), orderBy('subscribedAt', 'desc'), limit(100)));
      const sData = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscriber));
      setSubscribers(sData);

      // Messages
      const msgSnap = await getDocs(query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'), limit(50)));
      const mData = msgSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactMessage));
      setMessages(mData);

      // Stats
      const revenue = oData.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
      const lowStock = pData.filter(p => p.currentInventory < 10).length;
      setStats({
        revenue,
        orderCount: oData.length,
        productCount: pData.length,
        lowStock
      });

    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Failed to fetch admin data.");
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-black">
        <Loader2 className="animate-spin text-brand-gold" size={48} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-black parchment-texture relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/5 via-transparent to-brand-gold/5" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full p-12 glass-dark border-brand-gold/20 text-center space-y-10 relative z-10 shadow-2xl"
        >
          <div className="space-y-6">
            <motion.img 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              src={logo} 
              alt="Boanerges" 
              className="h-32 mx-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="space-y-2">
              <h1 className="text-3xl font-serif text-brand-parchment tracking-tight">Admin Portal</h1>
              <p className="text-brand-gold/60 text-[10px] uppercase tracking-[0.4em] font-black">Secure Access Required</p>
            </div>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent" />

          <button 
            onClick={handleLogin}
            className="w-full py-5 bg-brand-gold text-brand-black text-[11px] uppercase tracking-[0.3em] font-black hover:bg-brand-parchment transition-all duration-500 flex items-center justify-center gap-3 shadow-xl group"
          >
            <Lock size={16} className="group-hover:scale-110 transition-transform" />
            Sign in with Google
          </button>
          
          <p className="text-brand-parchment/20 text-[9px] uppercase tracking-widest">
            Authorized Personnel Only
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black flex">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 flex flex-col bg-brand-black relative overflow-hidden z-40">
        <div className="absolute inset-0 parchment-texture opacity-[0.03] pointer-events-none" />
        
        <div className="p-10 border-b border-white/5 flex flex-col items-center text-center">
          <Link to="/" className="group relative">
            <div className="absolute -inset-4 bg-brand-gold/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <img 
              src={logo} 
              alt="Boanerges" 
              className="h-28 w-auto object-contain group-hover:scale-105 transition-all duration-700 relative z-10" 
              referrerPolicy="no-referrer"
            />
          </Link>
          <div className="mt-4 space-y-1">
            <p className="text-[10px] uppercase tracking-[0.4em] text-brand-gold font-black">Admin Portal</p>
            <div className="h-0.5 w-8 bg-brand-gold/30 mx-auto rounded-full" />
          </div>
        </div>

        <nav className="flex-grow p-6 space-y-1.5">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'products', label: 'Inventory', icon: Package },
              { id: 'orders', label: 'Orders', icon: ShoppingCart },
              { id: 'subscribers', label: 'Audience', icon: Users },
              { id: 'contact', label: 'Inquiries', icon: Mail },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-sm text-[10px] uppercase tracking-[0.25em] font-black transition-all duration-500 relative group overflow-hidden ${
                  activeTab === tab.id 
                    ? 'text-brand-black' 
                    : 'text-brand-parchment/30 hover:text-brand-parchment'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-brand-gold shadow-lg shadow-brand-gold/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-4">
                  <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 1.5} className="transition-all duration-500 group-hover:scale-110" />
                  <span>{tab.label}</span>
                </div>
                {activeTab !== tab.id && (
                  <div className="absolute left-0 top-0 w-1 h-full bg-brand-gold scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-top" />
                )}
              </button>
            ))}
        </nav>

        <div className="p-8 border-t border-white/5 space-y-6">
          <div className="flex items-center gap-4 px-2 relative z-10 group cursor-default">
            <div className="relative">
              <div className="absolute -inset-1 bg-brand-gold/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img src={user?.photoURL || ''} className="w-11 h-11 rounded-full border border-white/10 shadow-xl relative z-10" alt="Admin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-brand-parchment font-black tracking-wide leading-tight">{user?.displayName}</p>
              <p className="text-[9px] text-brand-gold/50 uppercase tracking-[0.2em] font-bold">Master Admin</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-4 text-[10px] uppercase tracking-[0.2em] font-black text-red-400/60 hover:text-red-400 hover:bg-red-400/5 rounded-sm transition-all duration-500 group"
          >
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto parchment-texture">
        <header className="h-28 border-b border-white/5 flex items-center justify-between px-16 bg-brand-black/90 backdrop-blur-2xl sticky top-0 z-30">
          <div className="flex items-center gap-6">
            <div className="w-1.5 h-10 bg-brand-gold rounded-full shadow-[0_0_15px_rgba(197,160,89,0.5)]" />
            <div className="space-y-0.5">
              <h2 className="text-3xl font-serif text-brand-parchment capitalize tracking-tight">{activeTab}</h2>
              <p className="text-[9px] uppercase tracking-[0.3em] text-brand-gold/40 font-black">Management Console</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-parchment/20 group-focus-within:text-brand-gold transition-colors" size={14} />
              <input 
                type="text" 
                placeholder="Search resources..." 
                className="bg-white/5 border border-white/10 rounded-full py-3 pl-14 pr-8 text-[11px] uppercase tracking-widest text-brand-parchment outline-none focus:border-brand-gold/50 focus:bg-white/10 transition-all duration-500 w-80 placeholder:text-brand-parchment/10"
              />
            </div>
            <button className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-brand-parchment/40 hover:text-brand-gold hover:border-brand-gold/50 hover:bg-white/5 transition-all duration-500 group">
              <Settings size={18} className="group-hover:rotate-90 transition-transform duration-700" />
            </button>
          </div>
        </header>

        <div className="p-12">
          {activeTab === 'dashboard' && <DashboardView stats={stats} orders={orders} products={products} />}
          {activeTab === 'products' && <ProductsView products={products} onRefresh={fetchData} />}
          {activeTab === 'orders' && <OrdersView orders={orders} onRefresh={fetchData} />}
          {activeTab === 'subscribers' && <SubscribersView subscribers={subscribers} />}
          {activeTab === 'contact' && <MessagesView messages={messages} onRefresh={fetchData} />}
        </div>
      </main>
    </div>
  );
};
