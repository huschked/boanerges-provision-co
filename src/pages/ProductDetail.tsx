import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, ShieldCheck, Truck, RotateCcw, ChevronRight, Star, Heart, ShoppingBag, Flame, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getProductBySlug, getProducts, Product } from '@/src/services/productService';
import { HeatScale } from '@/src/components/HeatScale';
import { ProductCard } from '@/src/components/ProductCard';
import { useCart } from '@/src/store';
import { cn } from '@/src/lib/utils';

export const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [purchaseType, setPurchaseType] = useState<'one-time' | 'subscribe'>('one-time');
  const addItem = useCart((state) => state.addItem);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchData = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const data = await getProductBySlug(slug);
        if (data) {
          setProduct(data);
          // Fetch related products (same category)
          const allProducts = await getProducts();
          const related = allProducts
            .filter((p) => p.id !== data.id && p.category === data.category)
            .slice(0, 4);
          setRelatedProducts(related);
        } else {
          navigate('/shop');
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen pt-40 flex flex-col items-center justify-center bg-brand-black">
        <Loader2 className="animate-spin text-brand-gold mb-4" size={48} />
        <p className="text-brand-parchment/60 uppercase tracking-widest text-xs">Fetching Provision...</p>
      </div>
    );
  }

  if (!product) return null;

  const flavorNotes = product.flavorNotes ?? [];
  const pairings = product.pairings ?? [];
  const ingredients = product.ingredients ?? [];

  return (
    <div className="pt-40 pb-32 animate-fade-in bg-brand-black relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 stone-texture" />
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-brand-parchment/30 mb-12">
          <Link to="/" className="hover:text-brand-gold transition-colors">Home</Link>
          <ChevronRight size={12} />
          <Link to="/shop" className="hover:text-brand-gold transition-colors">Shop</Link>
          <ChevronRight size={12} />
          <span className="text-brand-parchment/60">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 xl:gap-24">
          {/* Image Gallery */}
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="aspect-square bg-white rounded-sm overflow-hidden border border-white/10"
            >
              <img 
                src={product.imageUrl} 
                alt={product.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-square bg-white rounded-sm overflow-hidden border border-white/10 cursor-pointer hover:border-brand-gold transition-colors">
                  <img 
                    src={`https://picsum.photos/seed/salt-detail-${i}/400/400`} 
                    alt="Detail" 
                    className="w-full h-full object-cover opacity-60 hover:opacity-100 transition-opacity"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-brand-gold text-[11px] uppercase tracking-[0.3em] font-black">{product.category} Collection</span>
                <div className="flex items-center gap-1 text-brand-gold">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                  <span className="text-[10px] text-brand-parchment/30 ml-2 font-black">(24 Reviews)</span>
                </div>
              </div>
              <h1 className="text-4xl md:text-6xl font-serif text-brand-parchment leading-tight">{product.name}</h1>
              <div className="flex items-center gap-6">
                <span className="text-3xl font-serif text-brand-gold">${product.price.toFixed(2)}</span>
                <span className="text-[10px] text-brand-parchment/40 font-black uppercase tracking-[0.2em]">{product.sizeOz} oz</span>
              </div>
            </div>

            <div className="space-y-6">
              <HeatScale level={product.heatLevel} className="scale-110 origin-left" />
              <p className="text-lg text-brand-parchment/60 leading-relaxed font-light">
                {product.shortDescription}
              </p>
            </div>

            {/* Purchase Options */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => setPurchaseType('one-time')}
                  className={cn(
                    "p-6 border rounded-sm text-left transition-all group",
                    purchaseType === 'one-time' ? "border-brand-gold bg-brand-gold/5" : "border-white/10 hover:border-white/30"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-[11px] font-black uppercase tracking-widest text-brand-parchment">One-time Purchase</p>
                      <p className="text-xs text-brand-parchment/40">Standard artisan delivery</p>
                    </div>
                    <span className="font-serif text-xl text-brand-parchment">${product.price.toFixed(2)}</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => setPurchaseType('subscribe')}
                  className={cn(
                    "p-6 border rounded-sm text-left transition-all group",
                    purchaseType === 'subscribe' ? "border-brand-gold bg-brand-gold/5" : "border-white/10 hover:border-white/30"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black uppercase tracking-widest text-brand-parchment">Subscribe & Save 15%</p>
                        <span className="bg-brand-gold text-brand-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Best Value</span>
                      </div>
                      <p className="text-xs text-brand-parchment/40">Delivered every 30 days. Cancel anytime.</p>
                    </div>
                    <span className="font-serif text-xl text-brand-gold">${(product.price * 0.85).toFixed(2)}</span>
                  </div>
                </button>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center border border-white/10 rounded-sm bg-white/5">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-4 hover:bg-white/5 transition-colors text-brand-parchment"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center font-black text-brand-parchment">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-4 py-4 hover:bg-white/5 transition-colors text-brand-parchment"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <button 
                  onClick={() => {
                    for(let i = 0; i < quantity; i++) {
                      addItem(product as any);
                    }
                  }}
                  disabled={product.currentInventory <= 0}
                  className={cn(
                    "flex-1 text-[11px] uppercase tracking-[0.3em] font-black transition-all shadow-xl flex items-center justify-center gap-3",
                    product.currentInventory > 0 
                      ? "bg-brand-gold text-brand-black hover:bg-brand-parchment" 
                      : "bg-white/10 text-brand-parchment/20 cursor-not-allowed"
                  )}
                >
                  <ShoppingBag size={18} />
                  {product.currentInventory > 0 ? 'Add to Provisions' : 'Out of Stock'}
                </button>
                <button className="px-5 border border-white/10 rounded-sm hover:bg-white/5 transition-colors text-brand-parchment/40 hover:text-red-500">
                  <Heart size={20} />
                </button>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
              <div className="flex flex-col items-center text-center gap-2">
                <Truck size={20} className="text-brand-gold" strokeWidth={1.5} />
                <span className="text-[9px] uppercase tracking-widest font-black text-brand-parchment/40">Free Shipping $50+</span>
              </div>
              <div className="flex flex-col items-center text-center gap-2">
                <ShieldCheck size={20} className="text-brand-gold" strokeWidth={1.5} />
                <span className="text-[9px] uppercase tracking-widest font-black text-brand-parchment/40">Secure Checkout</span>
              </div>
              <div className="flex flex-col items-center text-center gap-2">
                <RotateCcw size={20} className="text-brand-gold" strokeWidth={1.5} />
                <span className="text-[9px] uppercase tracking-widest font-black text-brand-parchment/40">30-Day Returns</span>
              </div>
            </div>

            {/* Accordions */}
            <div className="space-y-4 pt-6">
              {[
                { title: 'Flavor Notes', content: flavorNotes.length ? flavorNotes.join(', ') : 'Flavor notes coming soon.' },
                { title: 'Suggested Pairings', content: pairings.length ? pairings.join(', ') : 'Pairing ideas coming soon.' },
                { title: 'Ingredients', content: ingredients.length ? ingredients.join(', ') : 'Ingredient details coming soon.' },
              ].map((item, i) => (
                <details key={i} className="group border-b border-white/10 pb-4">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <span className="text-[11px] uppercase tracking-widest font-black text-brand-parchment">{item.title}</span>
                    <Plus size={14} className="group-open:rotate-45 transition-transform text-brand-gold" />
                  </summary>
                  <div className="pt-4 text-sm text-brand-parchment/60 leading-relaxed font-light">
                    {item.content}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-40">
            <div className="text-center space-y-4 mb-20">
              <span className="text-brand-gold text-[12px] uppercase tracking-[0.3em] font-black">Complete the Set</span>
              <h2 className="text-4xl md:text-5xl font-serif text-brand-parchment">You May Also Like</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} dark />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
