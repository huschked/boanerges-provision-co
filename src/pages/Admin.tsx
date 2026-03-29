import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Plus, 
  Search, 
  Filter, 
  MoreVertical,
  TrendingUp,
  DollarSign,
  PackageCheck,
  AlertCircle,
  Loader2,
  Trash2,
  Edit,
  Save,
  X,
  CheckCircle2,
  Upload
} from 'lucide-react';
import logo from '@/src/assets/BoanergesLogoSimple.png';
import { auth, db, storage, ref, uploadBytes, getDownloadURL } from '@/src/lib/firebase';
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
  updateDoc, 
  deleteDoc, 
  addDoc,
  Timestamp,
  where
} from 'firebase/firestore';
import { Product, getProducts } from '@/src/services/productService';

// --- Types ---
type AdminTab = 'dashboard' | 'products' | 'orders' | 'subscribers' | 'contact';

interface Order {
  id: string;
  customerEmail: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: any;
  items: any[];
}

interface Subscriber {
  id: string;
  email: string;
  source: string;
  subscribedAt: any;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: any;
  status: 'new' | 'read' | 'replied';
}

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
        // Simple admin check - in production use custom claims or a roles collection
        // For now, we'll check against the admin email from env if available
        // Or just allow the logged in user for this demo
        setIsAdmin(true); 
        fetchData();
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

  if (!user) {
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
              <img src={user.photoURL || ''} className="w-11 h-11 rounded-full border border-white/10 shadow-xl relative z-10" alt="Admin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-brand-parchment font-black tracking-wide leading-tight">{user.displayName}</p>
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

// --- Sub-Views ---

const DashboardView: React.FC<{ stats: any, orders: Order[], products: Product[] }> = ({ stats, orders, products }) => {
  return (
    <div className="space-y-16 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {[
            { label: 'Total Revenue', value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, color: 'text-green-400', glow: 'shadow-green-400/10' },
            { label: 'Total Orders', value: stats.orderCount, icon: ShoppingCart, color: 'text-blue-400', glow: 'shadow-blue-400/10' },
            { label: 'Total Products', value: stats.productCount, icon: Package, color: 'text-brand-gold', glow: 'shadow-brand-gold/10' },
            { label: 'Low Stock Items', value: stats.lowStock, icon: AlertCircle, color: 'text-red-400', glow: 'shadow-red-400/10' },
          ].map((stat, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`card-premium p-10 space-y-6 relative group ${stat.glow}`}
            >
              <div className="flex justify-between items-start">
                <div className={`p-4 rounded-sm bg-white/5 ${stat.color} group-hover:scale-110 transition-transform duration-700 shadow-inner`}>
                  <stat.icon size={22} strokeWidth={1.5} />
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-400/5 text-green-400 text-[9px] font-black tracking-widest">
                  <TrendingUp size={10} />
                  +12%
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">{stat.label}</p>
                <h3 className="text-4xl font-serif text-brand-parchment group-hover:text-brand-gold transition-colors duration-500">{stat.value}</h3>
              </div>
              <div className="pt-4 border-t border-white/5">
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '70%' }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className={`h-full bg-gradient-to-r from-transparent to-current ${stat.color}`}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        {/* Recent Orders */}
        <div className="xl:col-span-2 card-premium overflow-hidden">
          <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <div className="space-y-1">
              <h3 className="text-2xl font-serif text-brand-parchment">Recent Transactions</h3>
              <p className="text-[9px] uppercase tracking-[0.2em] text-brand-gold/40 font-black">Latest customer orders</p>
            </div>
            <button className="text-[10px] uppercase tracking-[0.3em] font-black text-brand-gold hover:text-brand-parchment transition-all duration-500 border border-brand-gold/20 px-6 py-2.5 rounded-sm hover:bg-brand-gold/10">View All Orders</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-10 py-6 text-[10px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Order ID</th>
                  <th className="px-10 py-6 text-[10px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Customer</th>
                  <th className="px-10 py-6 text-[10px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Amount</th>
                  <th className="px-10 py-6 text-[10px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.slice(0, 6).map((order) => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-10 py-6 text-[11px] text-brand-parchment font-mono tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">#{order.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-10 py-6 text-[11px] text-brand-parchment/80 font-medium">{order.customerEmail}</td>
                    <td className="px-10 py-6 text-sm text-brand-parchment font-black tracking-tight">${order.totalAmount?.toFixed(2)}</td>
                    <td className="px-10 py-6 text-right">
                      <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] uppercase tracking-[0.2em] font-black border ${
                        order.status === 'delivered' ? 'bg-green-400/5 text-green-400 border-green-400/10' :
                        order.status === 'processing' ? 'bg-blue-400/5 text-blue-400 border-blue-400/10' :
                        'bg-brand-gold/5 text-brand-gold border-brand-gold/10'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          order.status === 'delivered' ? 'bg-green-400' :
                          order.status === 'processing' ? 'bg-blue-400' :
                          'bg-brand-gold'
                        }`} />
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="card-premium overflow-hidden">
          <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <div className="space-y-1">
              <h3 className="text-2xl font-serif text-brand-parchment">Stock Alerts</h3>
              <p className="text-[9px] uppercase tracking-[0.2em] text-brand-gold/40 font-black">Low inventory monitoring</p>
            </div>
          </div>
          <div className="p-10 space-y-8">
            {products.filter(p => p.currentInventory < 15).slice(0, 6).map((product) => (
              <div key={product.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-brand-gold/10 rounded-sm blur opacity-0 group-hover:opacity-100 transition-opacity" />
                    <img src={product.imageUrl} className="w-14 h-14 object-cover rounded-sm border border-white/10 relative z-10 group-hover:scale-105 transition-transform duration-500" alt={product.name} />
                  </div>
                  <div>
                    <p className="text-[13px] text-brand-parchment font-black group-hover:text-brand-gold transition-colors">{product.name}</p>
                    <p className="text-[9px] text-brand-parchment/30 uppercase tracking-[0.2em] font-bold">{product.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-serif ${product.currentInventory < 5 ? 'text-red-400' : 'text-brand-gold'}`}>{product.currentInventory}</p>
                  <p className="text-[8px] text-brand-parchment/30 uppercase tracking-widest font-black">Units Left</p>
                </div>
              </div>
            ))}
            {products.filter(p => p.currentInventory < 15).length === 0 && (
              <div className="text-center py-20 space-y-6">
                <div className="w-20 h-20 bg-green-400/5 rounded-full flex items-center justify-center mx-auto border border-green-400/10">
                  <PackageCheck size={32} className="text-green-400/40" />
                </div>
                <div className="space-y-2">
                  <p className="text-brand-parchment text-sm font-black uppercase tracking-widest">Inventory Optimized</p>
                  <p className="text-brand-parchment/30 text-[11px] font-light italic">All stock levels are currently healthy.</p>
                </div>
              </div>
            )}
          </div>
          <div className="p-8 bg-white/[0.01] border-t border-white/5">
            <button className="w-full py-4 text-[10px] uppercase tracking-[0.3em] font-black text-brand-gold hover:text-brand-parchment hover:bg-brand-gold/5 transition-all duration-500 rounded-sm">Manage Inventory</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductsView: React.FC<{ products: Product[], onRefresh: () => void }> = ({ products, onRefresh }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    price: 0,
    currentInventory: 0,
    category: 'Spicy',
    sizeOz: 4,
    shortDescription: '',
    featured: false,
    active: true,
    tags: ['Spicy']
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Ensure tags include the category for store filtering
      const updatedTags = Array.from(new Set([...(formData.tags || []), formData.category as string]));
      const finalData = { ...formData, tags: updatedTags };

      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), finalData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...finalData,
          slug: formData.name?.toLowerCase().replace(/ /g, '-'),
          createdAt: Timestamp.now(),
          active: true // Ensure new products are active by default
        });
      }
      setIsAdding(false);
      setEditingId(null);
      onRefresh();
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
        onRefresh();
      } catch (error) {
        console.error("Error deleting product:", error);
      }
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <button className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/60 hover:text-brand-gold hover:border-brand-gold/30 transition-all flex items-center gap-3 group">
            <Filter size={14} className="group-hover:rotate-180 transition-transform duration-500" /> 
            Filter Inventory
          </button>
        </div>
        <button 
          onClick={() => {
            setFormData({
              name: '',
              price: 0,
              currentInventory: 0,
              category: 'Spicy',
              sizeOz: 4,
              shortDescription: '',
              imageUrl: '',
              featured: false,
              active: true,
              tags: ['Spicy']
            });
            setIsAdding(true);
          }}
          className="btn-primary flex items-center gap-3"
        >
          <Plus size={18} strokeWidth={3} /> 
          Add New Provision
        </button>
      </div>

      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card-premium p-12 overflow-hidden border-brand-gold/20 bg-brand-charcoal/40 backdrop-blur-2xl"
          >
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-1">
                <h3 className="text-3xl font-serif text-brand-parchment">{editingId ? 'Edit Provision' : 'New Provision'}</h3>
                <p className="text-[9px] uppercase tracking-[0.3em] text-brand-gold/40 font-black">Refine your artisanal catalog</p>
              </div>
              <button 
                onClick={() => { setIsAdding(false); setEditingId(null); }}
                className="p-2 text-brand-parchment/20 hover:text-brand-gold transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Left Column: Core Details */}
              <div className="lg:col-span-7 space-y-8">
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Product Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Smoked Bourbon Honey"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="input-premium block w-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Category</label>
                    <div className="relative">
                      <select 
                        value={formData.category || 'Spicy'}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="input-premium block w-full appearance-none pr-10"
                      >
                        <option value="Spicy">Spicy</option>
                        <option value="Savory">Savory</option>
                        <option value="Herbal">Herbal</option>
                        <option value="Citrus">Citrus</option>
                        <option value="Bundles">Bundles</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-gold/40">
                        <Filter size={12} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Size (oz)</label>
                    <input 
                      type="number" 
                      value={formData.sizeOz}
                      onChange={e => setFormData({...formData, sizeOz: parseInt(e.target.value)})}
                      className="input-premium block w-full"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Short Description</label>
                  <textarea 
                    rows={4}
                    placeholder="A brief, evocative description for the catalog..."
                    value={formData.shortDescription}
                    onChange={e => setFormData({...formData, shortDescription: e.target.value})}
                    className="input-premium block w-full resize-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Price ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                      className="input-premium block w-full"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Stock Level</label>
                    <input 
                      type="number" 
                      value={formData.currentInventory}
                      onChange={e => setFormData({...formData, currentInventory: parseInt(e.target.value)})}
                      className="input-premium block w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Media & Settings */}
              <div className="lg:col-span-5 space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Product Image</label>
                    <label className="cursor-pointer group/upload">
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                      <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-black text-brand-gold/60 group-hover/upload:text-brand-gold transition-colors">
                        {isUploading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Upload size={12} />
                        )}
                        {isUploading ? 'Uploading...' : 'Upload Image'}
                      </div>
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Or paste Image URL (https://...)"
                      value={formData.imageUrl}
                      onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                      className="input-premium block w-full text-[11px]"
                    />
                  </div>

                  <div className="aspect-square rounded-sm border border-white/10 overflow-hidden bg-white/5 relative group/preview">
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover/preview:scale-110" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-brand-parchment/10 space-y-4">
                        <Package size={48} strokeWidth={1} />
                        <p className="text-[9px] uppercase tracking-widest font-black">Image Preview</p>
                      </div>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 size={24} className="animate-spin text-brand-gold" />
                          <p className="text-[9px] uppercase tracking-widest font-black text-brand-gold">Processing...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-8 rounded-sm bg-white/[0.02] border border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/60">Featured Product</label>
                      <p className="text-[8px] text-brand-parchment/20 uppercase tracking-widest font-black">Storefront Highlight</p>
                    </div>
                    <button 
                      onClick={() => setFormData({...formData, featured: !formData.featured})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all duration-500 relative",
                        formData.featured ? "bg-brand-gold" : "bg-white/10"
                      )}
                    >
                      <motion.div 
                        animate={{ x: formData.featured ? 24 : 4 }}
                        className={cn("absolute top-1 w-4 h-4 rounded-full shadow-sm", formData.featured ? "bg-brand-black" : "bg-brand-parchment/40")}
                      />
                    </button>
                  </div>
                  <p className="text-[9px] text-brand-parchment/30 leading-relaxed italic">Featured products appear prominently on the storefront homepage.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-6 mt-12 pt-10 border-t border-white/5">
              <button 
                onClick={() => { setIsAdding(false); setEditingId(null); }}
                className="px-8 py-3 text-[10px] uppercase tracking-[0.3em] font-black text-brand-parchment/40 hover:text-brand-parchment transition-colors"
              >
                Discard Changes
              </button>
              <button 
                onClick={handleSave}
                className="btn-primary px-12"
              >
                {editingId ? 'Update Provision' : 'Publish Provision'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card-premium overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.01]">
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Provision</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black text-center">Category</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Price</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Inventory</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-white/[0.02] transition-all group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-6">
                    <div className="relative group/img">
                      <div className="absolute -inset-2 bg-brand-gold/5 rounded-sm blur-lg opacity-0 group-hover/img:opacity-100 transition-opacity duration-700" />
                      <img src={product.imageUrl} className="w-16 h-16 object-cover rounded-sm border border-white/10 relative z-10 group-hover/img:scale-110 transition-transform duration-700" alt={product.name} />
                    </div>
                    <div>
                      <p className="text-base text-brand-parchment font-black group-hover:text-brand-gold transition-colors duration-500">{product.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[9px] text-brand-parchment/30 uppercase tracking-[0.2em] font-bold">{product.sizeOz}oz Jar</p>
                        {product.featured && <span className="w-1 h-1 rounded-full bg-brand-gold" />}
                        {product.featured && <p className="text-[8px] text-brand-gold uppercase tracking-widest font-black">Featured</p>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-8 text-center">
                  <span className="px-5 py-2 rounded-full bg-brand-gold/5 text-brand-gold text-[8px] uppercase tracking-[0.2em] font-black border border-brand-gold/10 group-hover:bg-brand-gold/10 transition-all duration-500">
                    {product.category || 'Uncategorized'}
                  </span>
                </td>
                <td className="px-10 py-8">
                  <span className="text-base text-brand-parchment font-black tracking-tighter">${product.price.toFixed(2)}</span>
                </td>
                <td className="px-10 py-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-1.5 h-1.5 rounded-full ${product.currentInventory < 10 ? 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)] animate-pulse' : 'bg-green-400/40'}`} />
                    <span className={`text-lg font-serif ${product.currentInventory < 10 ? 'text-red-400' : 'text-brand-parchment/60'}`}>{product.currentInventory}</span>
                  </div>
                </td>
                <td className="px-10 py-8 text-right">
                  <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                    <button 
                      onClick={() => { 
                        setEditingId(product.id); 
                        setFormData({
                          ...product,
                          category: product.category || 'Spicy'
                        }); 
                      }}
                      className="p-3 rounded-full bg-white/5 text-brand-parchment/30 hover:text-brand-gold hover:bg-brand-gold/10 transition-all duration-500"
                      title="Edit Provision"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(product.id)}
                      className="p-3 rounded-full bg-white/5 text-brand-parchment/30 hover:text-red-400 hover:bg-red-400/10 transition-all duration-500"
                      title="Delete Provision"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const OrdersView: React.FC<{ orders: Order[], onRefresh: () => void }> = ({ orders, onRefresh }) => {
  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
      onRefresh();
    } catch (error) {
      console.error("Error updating order:", error);
    }
  };

  return (
    <div className="space-y-10">
      <div className="card-premium overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.01]">
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Transaction ID</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Date</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Customer</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Total</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Status</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-white/[0.02] transition-all group">
                <td className="px-10 py-8">
                  <span className="text-xs font-mono text-brand-gold/60 tracking-wider">#{order.id.slice(0, 8).toUpperCase()}</span>
                </td>
                <td className="px-10 py-8">
                  <span className="text-xs text-brand-parchment/60 font-medium">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </span>
                </td>
                <td className="px-10 py-8">
                  <div className="space-y-1">
                    <p className="text-sm text-brand-parchment font-black">{order.customerEmail}</p>
                    <p className="text-[9px] text-brand-parchment/30 uppercase tracking-widest font-bold">Verified Customer</p>
                  </div>
                </td>
                <td className="px-10 py-8">
                  <span className="text-base text-brand-parchment font-black tracking-tighter">${order.totalAmount?.toFixed(2)}</span>
                </td>
                <td className="px-10 py-8">
                  <select 
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className={cn(
                      "input-premium py-1.5 px-4 text-[9px] uppercase tracking-[0.2em] font-black cursor-pointer w-auto min-w-[140px]",
                      order.status === 'delivered' ? 'text-green-400 border-green-400/20' :
                      order.status === 'shipped' ? 'text-blue-400 border-blue-400/20' :
                      order.status === 'processing' ? 'text-purple-400 border-purple-400/20' :
                      'text-brand-gold border-brand-gold/20'
                    )}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-10 py-8 text-right">
                  <button className="p-3 rounded-full bg-white/5 text-brand-parchment/30 hover:text-brand-gold hover:bg-brand-gold/10 transition-all duration-500">
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SubscribersView: React.FC<{ subscribers: Subscriber[] }> = ({ subscribers }) => {
  return (
    <div className="space-y-10">
      <div className="card-premium overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.01]">
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Email Address</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Source</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Joined Date</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {subscribers.map((sub) => (
              <tr key={sub.id} className="hover:bg-white/[0.02] transition-all group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-brand-gold/5 border border-brand-gold/10 flex items-center justify-center text-brand-gold text-[10px] font-black">
                      {sub.email[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-brand-parchment font-black">{sub.email}</span>
                  </div>
                </td>
                <td className="px-10 py-8">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">{sub.source || 'Direct Storefront'}</span>
                </td>
                <td className="px-10 py-8">
                  <span className="text-xs text-brand-parchment/60 font-medium">
                    {sub.subscribedAt?.toDate ? sub.subscribedAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </span>
                </td>
                <td className="px-10 py-8 text-right">
                  <span className="px-4 py-1.5 rounded-full bg-green-400/5 text-green-400 text-[8px] uppercase tracking-[0.2em] font-black border border-green-400/10">
                    Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MessagesView: React.FC<{ messages: ContactMessage[], onRefresh: () => void }> = ({ messages, onRefresh }) => {
  const [selectedMsg, setSelectedMsg] = useState<ContactMessage | null>(null);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'contact_messages', id), { status });
      onRefresh();
    } catch (error) {
      console.error("Error updating message:", error);
    }
  };

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Message List */}
        <div className="lg:col-span-4 card-premium overflow-hidden flex flex-col h-[700px]">
          <div className="p-8 border-b border-white/5 bg-white/[0.01] flex justify-between items-center">
            <div className="space-y-1">
              <h3 className="text-2xl font-serif text-brand-parchment">Inquiries</h3>
              <p className="text-[9px] uppercase tracking-[0.2em] text-brand-gold/40 font-black">Customer communications</p>
            </div>
            <div className="px-3 py-1 bg-brand-gold/10 rounded-full border border-brand-gold/20">
              <span className="text-[9px] text-brand-gold font-black uppercase tracking-widest">{messages.filter(m => m.status === 'new').length} New</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {messages.map((msg) => (
              <button 
                key={msg.id}
                onClick={() => { setSelectedMsg(msg); if(msg.status === 'new') updateStatus(msg.id, 'read'); }}
                className={cn(
                  "w-full p-8 text-left transition-all duration-500 group relative",
                  selectedMsg?.id === msg.id ? "bg-brand-gold/[0.03]" : "hover:bg-white/[0.02]"
                )}
              >
                {selectedMsg?.id === msg.id && (
                  <motion.div 
                    layoutId="activeMessage"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-brand-gold shadow-[0_0_15px_rgba(212,175,55,0.5)]"
                  />
                )}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      msg.status === 'new' ? "bg-brand-gold animate-pulse shadow-[0_0_8px_rgba(212,175,55,0.5)]" : "bg-white/10"
                    )} />
                    <p className={cn(
                      "text-sm font-black transition-colors duration-500",
                      msg.status === 'new' ? "text-brand-parchment" : "text-brand-parchment/40 group-hover:text-brand-parchment/60"
                    )}>
                      {msg.name}
                    </p>
                  </div>
                  <span className="text-[8px] text-brand-parchment/30 uppercase tracking-widest font-black">
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
                <p className="text-[10px] text-brand-gold/60 font-black uppercase tracking-[0.15em] mb-2 truncate">{msg.subject}</p>
                <p className="text-[11px] text-brand-parchment/30 line-clamp-2 font-light italic leading-relaxed">{msg.message}</p>
              </button>
            ))}
            {messages.length === 0 && (
              <div className="p-20 text-center space-y-4">
                <Mail size={32} className="mx-auto text-brand-parchment/10" />
                <p className="text-[10px] uppercase tracking-widest text-brand-parchment/20 font-black">No messages found</p>
              </div>
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-8 h-[700px]">
          {selectedMsg ? (
            <motion.div 
              key={selectedMsg.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="card-premium h-full flex flex-col overflow-hidden"
            >
              <div className="p-10 border-b border-white/5 bg-white/[0.01] flex justify-between items-start">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-brand-gold/5 border border-brand-gold/10 flex items-center justify-center text-brand-gold text-lg font-black shadow-inner">
                      {selectedMsg.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-3xl font-serif text-brand-parchment leading-tight">{selectedMsg.subject}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[11px] text-brand-parchment font-black">{selectedMsg.name}</p>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <p className="text-[10px] text-brand-parchment/40 font-medium">{selectedMsg.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="p-4 rounded-full bg-white/5 text-brand-parchment/30 hover:text-brand-gold hover:bg-brand-gold/10 transition-all duration-500 border border-white/5">
                    <Mail size={18} />
                  </button>
                  <button className="p-4 rounded-full bg-white/5 text-brand-parchment/30 hover:text-red-400 hover:bg-red-400/10 transition-all duration-500 border border-white/5">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-12 overflow-y-auto bg-brand-charcoal/20">
                <div className="max-w-3xl mx-auto space-y-10">
                  <div className="flex justify-center">
                    <div className="px-6 py-2 bg-white/[0.02] border border-white/5 rounded-full text-[9px] uppercase tracking-[0.3em] text-brand-parchment/20 font-black">
                      Received {selectedMsg.createdAt?.toDate ? selectedMsg.createdAt.toDate().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                  <div className="p-10 bg-white/[0.01] rounded-sm border border-white/5 shadow-2xl relative">
                    <div className="absolute top-0 left-10 w-px h-10 bg-gradient-to-b from-brand-gold/40 to-transparent" />
                    <p className="text-brand-parchment/80 text-lg leading-[1.8] font-light italic whitespace-pre-wrap">
                      "{selectedMsg.message}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-10 bg-white/[0.01] border-t border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-6">
                  <label className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Status</label>
                  <select 
                    value={selectedMsg.status}
                    onChange={(e) => updateStatus(selectedMsg.id, e.target.value)}
                    className="input-premium py-2 px-6 text-[10px] uppercase tracking-[0.2em] font-black cursor-pointer w-auto min-w-[160px]"
                  >
                    <option value="new">New Inquiry</option>
                    <option value="read">Mark as Read</option>
                    <option value="replied">Replied</option>
                  </select>
                </div>
                <button className="btn-primary flex items-center gap-3 px-10">
                  <Mail size={16} strokeWidth={3} />
                  Draft Response
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center card-premium p-20 text-center space-y-8 bg-brand-charcoal/20">
              <div className="w-24 h-24 bg-brand-gold/5 rounded-full flex items-center justify-center border border-brand-gold/10 shadow-inner">
                <Mail size={40} className="text-brand-gold/20" />
              </div>
              <div className="space-y-3 max-w-xs">
                <h3 className="text-3xl font-serif text-brand-parchment">Select an Inquiry</h3>
                <p className="text-brand-parchment/30 text-sm font-light italic leading-relaxed">Choose a customer message from the inbox to view details and draft a response.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
