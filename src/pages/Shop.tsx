import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, Loader2 } from 'lucide-react';
import { getProducts, Product } from '@/src/services/productService';
import { ProductCard } from '@/src/components/ProductCard';
import { cn } from '@/src/lib/utils';

export const Shop: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const activeCategory = searchParams.get('category') || 'All';
  const activeSort = searchParams.get('sort') || 'featured';

  const categories = ['All', 'Spicy', 'Savory', 'Herbal', 'Citrus'];

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const data = await getProducts();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesCategory = activeCategory === 'All' || 
          p.tags.some(t => t.toLowerCase() === activeCategory.toLowerCase()) ||
          (p.category && p.category.toLowerCase() === activeCategory.toLowerCase());
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             p.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (activeSort === 'price-low') return a.price - b.price;
        if (activeSort === 'price-high') return b.price - a.price;
        if (activeSort === 'heat-low') return a.heatLevel - b.heatLevel;
        if (activeSort === 'heat-high') return b.heatLevel - a.heatLevel;
        return 0; // featured/default
      });
  }, [products, activeCategory, searchQuery, activeSort]);

  return (
    <div className="pt-40 pb-32 animate-fade-in bg-brand-black relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 stone-texture" />
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        {/* Header */}
        <div className="text-center space-y-6 mb-20">
          <span className="text-brand-gold text-[12px] uppercase tracking-[0.4em] font-bold block">The Provisions</span>
          <h1 className="text-5xl md:text-7xl font-serif text-brand-parchment">Shop the Collection</h1>
          <p className="text-brand-parchment/60 max-w-2xl mx-auto text-lg font-light">
            Small-batch finishing salts crafted with sacred intent and bold flavor. 
            Find the perfect companion for your next culinary creation.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-8 items-center justify-between mb-12 border-y border-white/10 py-8">
          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar w-full md:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSearchParams({ category: cat })}
                className={cn(
                  "px-6 py-2 rounded-full text-[11px] uppercase tracking-widest font-bold transition-all whitespace-nowrap",
                  activeCategory === cat 
                    ? "bg-brand-gold text-brand-black" 
                    : "bg-white/5 text-brand-parchment hover:bg-white/10"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-parchment/40" size={16} />
              <input 
                type="text" 
                placeholder="Search salts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border-none py-3 pl-12 pr-4 text-sm rounded-sm focus:ring-1 focus:ring-brand-gold outline-none transition-all text-brand-parchment placeholder:text-brand-parchment/20"
              />
            </div>
            <select 
              value={activeSort}
              onChange={(e) => setSearchParams({ ...Object.fromEntries(searchParams), sort: e.target.value })}
              className="bg-white/5 border-none py-3 px-6 text-[11px] uppercase tracking-widest font-bold rounded-sm focus:ring-1 focus:ring-brand-gold outline-none cursor-pointer text-brand-parchment"
            >
              <option value="featured" className="bg-brand-black">Featured</option>
              <option value="price-low" className="bg-brand-black">Price: Low to High</option>
              <option value="price-high" className="bg-brand-black">Price: High to Low</option>
              <option value="heat-low" className="bg-brand-black">Heat: Low to High</option>
              <option value="heat-high" className="bg-brand-black">Heat: High to Low</option>
            </select>
          </div>
        </div>

        {/* Active Filters */}
        {(activeCategory !== 'All' || searchQuery) && (
          <div className="flex items-center gap-4 mb-12">
            <span className="text-[10px] uppercase tracking-widest text-brand-parchment/40 font-bold">Active Filters:</span>
            <div className="flex flex-wrap gap-2">
              {activeCategory !== 'All' && (
                <button 
                  onClick={() => setSearchParams({ category: 'All' })}
                  className="flex items-center gap-2 bg-brand-gold/10 text-brand-gold px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                >
                  {activeCategory} <X size={12} />
                </button>
              )}
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="flex items-center gap-2 bg-brand-gold/10 text-brand-gold px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                >
                  "{searchQuery}" <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-12 gap-y-20">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} dark />
            ))}
          </div>
        ) : (
          <div className="py-32 text-center space-y-6">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
              <Search size={32} className="text-brand-parchment/20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif text-brand-parchment">No provisions found</h3>
              <p className="text-brand-parchment/60">Try adjusting your filters or search terms.</p>
            </div>
            <button 
              onClick={() => {
                setSearchParams({ category: 'All' });
                setSearchQuery('');
              }}
              className="px-8 py-3 bg-brand-gold text-brand-black text-[10px] uppercase tracking-widest font-bold hover:bg-brand-parchment transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
