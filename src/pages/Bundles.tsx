import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useCart } from '@/src/store';
import type { ResolvedBundle } from '@/src/lib/bundleCommerce';
import { bundleToCartProduct, getBundles } from '@/src/services/bundleService';
import { Plus, Check, Loader2, PackageX } from 'lucide-react';
import toast from 'react-hot-toast';
import { trackAnalyticsEvent } from '@/src/lib/analytics';

export const Bundles: React.FC = () => {
  const addItem = useCart((state) => state.addItem);
  const [bundles, setBundles] = useState<ResolvedBundle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getBundles()
      .then(data => { if (!cancelled) setBundles(data); })
      .catch(error => {
        console.error('Unable to load bundles:', error);
        if (!cancelled) toast.error('Bundles are temporarily unavailable.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const addBundle = (bundle: ResolvedBundle) => {
    if (bundle.availableStock <= 0) return;
    addItem(bundleToCartProduct(bundle));
    toast.success(`${bundle.name} added to your provisions.`);
    void trackAnalyticsEvent({
      type: 'bundle_selection', productId: bundle.id, productName: bundle.name, category: 'Bundles',
      quantity: 1, value: bundle.sellingPrice, currency: 'USD',
      items: [{ id: bundle.id, name: bundle.name, category: 'Bundles', price: bundle.sellingPrice, quantity: 1 }],
    });
    void trackAnalyticsEvent({
      type: 'add_to_cart', productId: bundle.id, productName: bundle.name, category: 'Bundles',
      quantity: 1, value: bundle.sellingPrice, currency: 'USD',
      items: [{ id: bundle.id, name: bundle.name, category: 'Bundles', price: bundle.sellingPrice, quantity: 1 }],
      metadata: { itemType: 'bundle' },
    });
  };

  return (
    <div className="pt-40 pb-32 animate-fade-in editorial-surface-dark relative overflow-hidden min-h-screen">
      <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center space-y-6 mb-24">
          <span className="text-brand-gold text-[12px] uppercase tracking-[0.4em] font-black block">Curated Collections</span>
          <h1 className="text-5xl md:text-7xl font-serif text-brand-parchment">Artisan Bundles</h1>
          <p className="text-brand-parchment/60 max-w-2xl mx-auto text-lg font-light">Curated sets with savings calculated from the current prices of the included provisions.</p>
        </div>

        {loading ? <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand-gold" size={40} /></div> : bundles.length === 0 ? (
          <div className="max-w-xl mx-auto border border-white/10 bg-white/[0.02] p-12 text-center space-y-5">
            <PackageX className="mx-auto text-brand-gold/50" size={42} strokeWidth={1.5} />
            <h2 className="text-3xl font-serif text-brand-parchment">Bundles are being prepared</h2>
            <p className="text-brand-parchment/55 leading-relaxed">No curated bundle is currently available. Individual provisions remain available in the shop.</p>
          </div>
        ) : <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {bundles.map((bundle, index) => (
            <motion.article key={bundle.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="bg-brand-black rounded-sm border border-white/10 overflow-hidden flex flex-col shadow-2xl group">
              <div className="aspect-[4/3] relative overflow-hidden">
                <img src={bundle.imageUrl} alt={bundle.imageAlt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-85" />
                {bundle.imageType === 'illustrative' && <span className="absolute bottom-4 left-4 bg-brand-black/85 text-brand-parchment px-3 py-1 text-[8px] uppercase tracking-widest font-black">Illustrative image</span>}
                {bundle.savingsAmount > 0 && <div className="absolute top-4 right-4 bg-brand-gold text-brand-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Save {bundle.savingsPercent}%</div>}
              </div>
              <div className="p-8 md:p-10 flex-1 flex flex-col space-y-6">
                <div className="space-y-2"><h2 className="text-3xl font-serif text-brand-parchment">{bundle.name}</h2><p className="text-sm text-brand-parchment/60 leading-relaxed">{bundle.description}</p></div>
                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-widest font-black text-brand-gold">Includes</p>
                  <ul className="space-y-3">{bundle.components.map(component => <li key={component.productId} className="flex items-start gap-3 text-sm text-brand-parchment/80"><Check size={14} className="text-brand-gold mt-0.5 shrink-0" /><span>{component.quantity > 1 ? `${component.quantity}× ` : ''}{component.name} <span className="text-brand-parchment/35">({component.sizeOz} oz each)</span></span></li>)}</ul>
                </div>
                <div className="mt-auto pt-8 flex items-end justify-between gap-5 border-t border-white/5">
                  <div className="flex flex-col">
                    {bundle.savingsAmount > 0 && <span className="text-xs text-brand-parchment/40 line-through">${bundle.compareAtPrice.toFixed(2)}</span>}
                    <span className="text-2xl font-serif text-brand-gold">${bundle.sellingPrice.toFixed(2)}</span>
                    {bundle.savingsAmount > 0 && <span className="mt-1 text-[9px] uppercase tracking-widest text-brand-parchment/40">Save ${bundle.savingsAmount.toFixed(2)}</span>}
                  </div>
                  <button onClick={() => addBundle(bundle)} disabled={bundle.availableStock <= 0} className="px-6 py-4 bg-brand-gold text-brand-black text-[10px] uppercase tracking-widest font-black hover:bg-brand-parchment transition-all flex items-center gap-2 disabled:bg-white/10 disabled:text-brand-parchment/35 disabled:cursor-not-allowed"><Plus size={14} />{bundle.availableStock > 0 ? 'Add Bundle' : 'Sold Out'}</button>
                </div>
                {bundle.availableStock > 0 && bundle.availableStock <= 5 && <p className="text-[10px] uppercase tracking-widest text-amber-300/75">Only {bundle.availableStock} bundle{bundle.availableStock === 1 ? '' : 's'} available</p>}
              </div>
            </motion.article>
          ))}
        </div>}
      </div>
    </div>
  );
};
