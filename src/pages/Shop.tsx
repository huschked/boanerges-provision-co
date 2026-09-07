import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { getProducts, Product } from '@/src/services/productService';
import { ProductCard } from '@/src/components/ProductCard';
import { cn } from '@/src/lib/utils';
import { SHOP_CATEGORIES, shopCategory, inCollection } from '@/src/lib/merchandising';
import { trackAnalyticsEvent } from '@/src/lib/analytics';

const ProductGridSkeleton = () => (
  <div role="status" aria-live="polite" aria-label="Loading salts">
    <span className="sr-only">Loading salts…</span>
    <div aria-hidden="true" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-x-8 xl:gap-x-12 gap-y-16">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="space-y-5">
          <div className="aspect-[4/5] rounded-sm skeleton-shimmer" />
          <div className="flex items-start justify-between gap-5">
            <div className="h-8 w-2/3 rounded-sm skeleton-shimmer" />
            <div className="h-6 w-16 rounded-sm skeleton-shimmer" />
          </div>
          <div className="h-4 w-36 rounded-sm skeleton-shimmer" />
          <div className="flex gap-2"><div className="h-6 w-16 rounded-full skeleton-shimmer" /><div className="h-6 w-20 rounded-full skeleton-shimmer" /></div>
          <div className="h-5 w-44 rounded-sm skeleton-shimmer" />
        </div>
      ))}
    </div>
  </div>
);

export const Shop: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const activeCategory = shopCategory(searchParams.get('category'));
  const activeSort = searchParams.get('sort') || 'featured';

  const categories = SHOP_CATEGORIES;
  const featuredFallback = activeCategory === 'Featured' && !products.some(p => p.featured);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const data = await getProducts();
        setProducts(data);
      } catch (error) {
        setFailed(true);
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
        const matchesCategory = inCollection(p, activeCategory, featuredFallback);
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             p.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (activeSort === 'price-low') return a.price - b.price;
        if (activeSort === 'price-high') return b.price - a.price;
        if (activeSort === 'heat-low') return a.heatLevel - b.heatLevel;
        if (activeSort === 'heat-high') return b.heatLevel - a.heatLevel;
        return Number(!!b.featured) - Number(!!a.featured);
      });
  }, [products, activeCategory, searchQuery, activeSort, featuredFallback]);

  return (
    <div className="pt-40 pb-32 animate-fade-in editorial-surface-dark relative overflow-hidden">
      <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        {/* Header */}
        <div className="text-center space-y-6 mb-20">
          <span className="text-brand-gold text-[12px] uppercase tracking-[0.4em] font-bold block">The Provisions</span>
          <h1 className="text-5xl md:text-7xl font-serif text-brand-parchment">{activeCategory === 'Featured' ? 'Featured Salts' : 'Shop the Collection'}</h1>
          <p className="text-brand-parchment/60 max-w-2xl mx-auto text-lg font-light">
            Small-batch finishing salts crafted with sacred intent and bold flavor. 
            Find the perfect companion for your next culinary creation.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-8 items-center justify-between mb-12 border-y border-white/10 py-8">
          {/* Categories */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSearchParams({ ...Object.fromEntries(searchParams), category: cat });
                  void trackAnalyticsEvent({ type: 'collection_filter', category: cat, metadata: { control: 'category' } });
                }}
                aria-pressed={activeCategory === cat}
                className={cn(
                  "min-h-11 px-5 py-2 rounded-full text-[11px] uppercase tracking-widest font-bold transition-all whitespace-nowrap",
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
              <label htmlFor="shop-search" className="sr-only">Search salts</label>
              <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-parchment/65" size={16} />
              <input 
                id="shop-search"
                type="text" 
                placeholder="Search salts..."
                aria-describedby="shop-results-status"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => { if (searchQuery.trim()) void trackAnalyticsEvent({ type: 'collection_filter', metadata: { control: 'search', resultCount: filteredProducts.length } }); }}
                className="w-full min-h-11 bg-white/5 border border-white/10 py-3 pl-12 pr-4 text-sm rounded-sm transition-all text-brand-parchment placeholder:text-brand-parchment/50"
              />
            </div>
            <label htmlFor="shop-sort" className="sr-only">Sort salts</label>
            <select 
              id="shop-sort"
              value={activeSort}
              onChange={(e) => {
                setSearchParams({ ...Object.fromEntries(searchParams), sort: e.target.value });
                void trackAnalyticsEvent({ type: 'collection_filter', metadata: { control: 'sort', selection: e.target.value } });
              }}
              className="min-h-11 bg-white/5 border border-white/10 py-3 px-4 sm:px-6 text-[11px] uppercase tracking-widest font-bold rounded-sm cursor-pointer text-brand-parchment"
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
            <span className="text-[10px] uppercase tracking-widest text-brand-parchment/70 font-bold">Active Filters:</span>
            <div className="flex flex-wrap gap-2">
              {activeCategory !== 'All' && (
                <button 
                  onClick={() => setSearchParams({ category: 'All' })}
                  aria-label={`Remove ${activeCategory} category filter`}
                  className="min-h-11 flex items-center gap-2 bg-brand-gold/10 text-brand-gold px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest"
                >
                  {activeCategory} <X size={12} aria-hidden="true" />
                </button>
              )}
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  aria-label={`Clear search for ${searchQuery}`}
                  className="min-h-11 flex items-center gap-2 bg-brand-gold/10 text-brand-gold px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest"
                >
                  "{searchQuery}" <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Grid */}
        <p id="shop-results-status" className="sr-only" role="status" aria-live="polite">
          {!loading && !failed ? `${filteredProducts.length} ${filteredProducts.length === 1 ? 'salt' : 'salts'} shown.` : ''}
        </p>
        {!loading && !failed && featuredFallback && <p role="status" className="mb-8 text-brand-parchment/75">Our featured selection is being refreshed. Browse all available salts below.</p>}
        {loading ? <ProductGridSkeleton /> : failed ? <div role="alert" className="py-20 text-center text-brand-parchment space-y-5"><p>Salts could not be loaded. Please refresh to try again.</p><button type="button" onClick={() => window.location.reload()} className="btn-secondary min-h-11">Retry</button></div> : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-x-8 xl:gap-x-12 gap-y-16 xl:gap-y-20">
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
              className="min-h-11 px-8 py-3 bg-brand-gold text-brand-black text-[10px] uppercase tracking-widest font-bold hover:bg-brand-parchment transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
