import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Product } from '@/src/services/productService';
import { HeatScale } from './HeatScale';
import { ProductRating } from './ProductRating';
import { useCart } from '@/src/store';
import { cn } from '@/src/lib/utils';
import { trackAnalyticsEvent } from '@/src/lib/analytics';
import toast from 'react-hot-toast';

export const ProductCard: React.FC<{ product: Product; className?: string; dark?: boolean }> = ({ product, className, dark }) => {
  const addItem = useCart((state) => state.addItem);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={cn("group relative flex flex-col", className)}
    >
      <div className={cn(
        "relative aspect-[4/5] overflow-hidden bg-white rounded-sm border transition-all duration-700",
        dark ? "border-white/5 shadow-2xl" : "border-brand-earth/5 shadow-lg hover:shadow-2xl"
      )}>
        <Link to={`/product/${product.slug}`} className="block w-full h-full"><img
          src={product.imageUrl} 
          alt={product.imageAlt || product.name}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          referrerPolicy="no-referrer"
        /></Link>
        <div className="pointer-events-none absolute inset-0 bg-brand-black/0 group-hover:bg-brand-black/20 transition-colors duration-700" />
        {product.imageType === 'illustrative' && (
          <div className="absolute bottom-3 right-3 px-3 py-1 bg-brand-black/80 text-brand-parchment text-[8px] font-black uppercase tracking-[0.16em] rounded-full">
            Illustrative image
          </div>
        )}
        
        {/* Quick Add Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 translate-y-0 opacity-100 md:translate-y-6 md:opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 transition-all duration-700 ease-out">
          <button 
            type="button" aria-label={`Add ${product.name} to cart`} disabled={product.currentInventory <= 0}
            onClick={(e) => {
              e.preventDefault();
              addItem(product as any);
              toast.success(`${product.name} added to your cart.`, { ariaProps: { role: 'status', 'aria-live': 'polite' } });
              trackAnalyticsEvent({
                type: 'add_to_cart',
                productId: product.id,
                productName: product.name,
                category: product.category,
                quantity: 1,
                value: product.price,
              });
            }}
            className="w-full py-5 bg-brand-black text-brand-gold text-[10px] uppercase tracking-[0.3em] font-black flex items-center justify-center gap-3 hover:bg-brand-gold hover:text-brand-black transition-all duration-500 shadow-2xl active:scale-95"
          >
            <Plus size={14} strokeWidth={3} />
            {product.currentInventory <= 0 ? 'Sold Out' : 'Quick Add'}
          </button>
        </div>

        {/* Badge */}
        {product.featured && (
          <div className="absolute top-6 left-6 px-4 py-1.5 bg-brand-gold/90 backdrop-blur-md text-brand-black text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-xl">
            Featured
          </div>
        )}
      </div>

      <div className="mt-10 space-y-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start gap-6">
          <Link to={`/product/${product.slug}`} className={cn("hover:text-brand-gold transition-colors duration-500", dark ? "text-brand-parchment" : "text-brand-black")}>
            <h3 className="font-serif text-3xl md:text-4xl leading-[1.05] tracking-tight">{product.name}</h3>
          </Link>
          <div className="flex flex-col items-end shrink-0">
            <span className={cn("font-bold text-xl tracking-tighter", dark ? "text-brand-gold" : "text-brand-black")}>${product.price.toFixed(2)}</span>
            <span className={cn("text-[9px] uppercase tracking-widest opacity-40 font-black", dark ? "text-brand-parchment" : "text-brand-black")}>{product.sizeOz} oz</span>
          </div>
        </div>
        
        <ProductRating productId={product.id} slug={product.slug} dark={dark} />
        <div className="flex flex-wrap gap-2.5">
          {product.tags.map((tag) => (
            <span 
              key={tag} 
              className={cn(
                "text-[8px] uppercase tracking-[0.2em] font-black px-3 py-1 rounded-full border transition-colors duration-500",
                dark 
                  ? "border-white/10 text-brand-parchment/30 group-hover:border-brand-gold/30 group-hover:text-brand-gold/60" 
                  : "border-brand-earth/10 text-brand-earth/40 group-hover:border-brand-gold/30 group-hover:text-brand-gold/60"
              )}
            >
              {tag}
            </span>
          ))}
        </div>
        
        <div className="py-2">
          <HeatScale level={product.heatLevel} dark={dark} />
        </div>
        
        <p className={cn("text-[15px] line-clamp-2 leading-relaxed font-light italic opacity-80", dark ? "text-brand-parchment/60" : "text-brand-earth/70")}>
          {product.shortDescription}
        </p>

        <div className={cn("mt-auto pt-8 flex items-center justify-between border-t transition-colors duration-700", dark ? "border-white/5 group-hover:border-white/20" : "border-brand-earth/5 group-hover:border-brand-gold/20")}>
          <Link 
            to={`/product/${product.slug}`}
            className={cn("text-[10px] uppercase tracking-[0.3em] font-black flex items-center gap-3 group/link transition-all duration-500", dark ? "text-brand-parchment/40 hover:text-brand-gold" : "text-brand-black/40 hover:text-brand-gold")}
          >
            Explore Product
            <ArrowRight size={12} className="group-hover/link:translate-x-2 transition-transform duration-500" />
          </Link>
          <div className={cn("h-1 w-1 rounded-full", dark ? "bg-white/10" : "bg-brand-black/10")} />
        </div>
      </div>
    </motion.div>
  );
};
