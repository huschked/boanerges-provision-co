import React from 'react';
import { motion } from 'motion/react';
import { bundles, products as localProducts } from '@/src/data/products';
import { useCart } from '@/src/store';
import { Product as ServiceProduct } from '@/src/services/productService';
import { Plus, Check, ArrowRight } from 'lucide-react';
import bundleImage1 from '@/src/assets/bundle-image-1.png';
import bundleImage2 from '@/src/assets/bundle-image-2.png';
import bundleImage3 from '@/src/assets/bundle-image-3.png';

export const Bundles: React.FC = () => {
  const addItem = useCart((state) => state.addItem);

  return (
    <div className="pt-40 pb-32 animate-fade-in editorial-surface-dark relative overflow-hidden">
      <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center space-y-6 mb-24">
          <span className="text-brand-gold text-[12px] uppercase tracking-[0.4em] font-black block">Curated Collections</span>
          <h1 className="text-5xl md:text-7xl font-serif text-brand-parchment">Artisan Bundles</h1>
          <p className="text-brand-parchment/60 max-w-2xl mx-auto text-lg font-light">
            Expertly curated sets designed to elevate your pantry or make the perfect gift. 
            Save more when you provision in sets.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {bundles.map((bundle, i) => {
            const bundleProducts = localProducts.filter(p => bundle.products.includes(p.id));
            const bundleImages = [
              bundleImage1,
              bundleImage2,
              bundleImage3
            ];
            
            return (
              <motion.div 
                key={bundle.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-brand-black rounded-sm border border-white/10 overflow-hidden flex flex-col shadow-2xl hover:shadow-brand-gold/5 transition-all duration-500 group"
              >
                <div className="aspect-[4/3] relative overflow-hidden">
                  <img 
                    src={bundleImages[i]} 
                    alt={bundle.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 right-4 bg-brand-gold text-brand-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                    Save 15%
                  </div>
                </div>

                <div className="p-10 flex-1 flex flex-col space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-serif text-brand-parchment">{bundle.name}</h3>
                    <p className="text-sm text-brand-parchment/60 leading-relaxed">{bundle.description}</p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] uppercase tracking-widest font-black text-brand-gold">Includes:</p>
                    <ul className="space-y-3">
                      {bundleProducts.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 text-sm text-brand-parchment/80">
                          <Check size={14} className="text-brand-gold" />
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto pt-8 flex items-center justify-between border-t border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-widest text-brand-parchment/40 font-black line-through">$29.99</span>
                      <span className="text-2xl font-serif text-brand-gold">${bundle.price.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={() => {
                        bundleProducts.forEach(p => {
                          // Map local product to ServiceProduct type
                          const serviceProduct: ServiceProduct = {
                            id: p.id,
                            name: p.name,
                            slug: p.slug,
                            price: p.price,
                            sizeOz: parseInt(p.size) || 3,
                            shortDescription: p.description,
                            flavorNotes: p.flavorNotes,
                            pairings: p.pairings,
                            tags: p.tags,
                            active: true,
                            featured: false,
                            currentInventory: 100,
                            reorderThreshold: 10,
                            imageUrl: p.image,
                            imageAlt: `Illustrative view of ${p.name} finishing salt with ingredient cues`,
                            imageType: 'illustrative',
                            gallery: [{ url: p.image, alt: `Illustrative view of ${p.name} finishing salt with ingredient cues`, type: 'illustrative', role: 'ingredient-art' }],
                            category: p.category,
                            heatLevel: p.heatLevel
                          };
                          addItem(serviceProduct);
                        });
                      }}
                      className="px-8 py-4 bg-brand-gold text-brand-black text-[10px] uppercase tracking-widest font-black hover:bg-brand-parchment transition-all flex items-center gap-2"
                    >
                      <Plus size={14} />
                      Add Bundle
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
