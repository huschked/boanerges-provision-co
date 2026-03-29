import React from 'react';
import { motion } from 'motion/react';
import { products } from '@/src/data/products';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const Recipes: React.FC = () => {
  const pairings = [
    { title: 'The Perfect Steak', salt: 'Porcini Garlic Umami', img: 'https://images.unsplash.com/photo-1546241072-48010ad28c2c?q=80&w=1000&auto=format&fit=crop', desc: 'Elevate your ribeye with earthy mushroom depth and savory garlic.' },
    { title: 'Zesty Fish Tacos', salt: 'Habanero Lime Garlic', img: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=1000&auto=format&fit=crop', desc: 'A bright citrus pop with a lingering habanero sting for fresh seafood.' },
    { title: 'Smoky Roasted Potatoes', salt: 'Smoked Jalapeño Garlic', img: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?q=80&w=1000&auto=format&fit=crop', desc: 'Transform simple spuds with smooth smoke and gentle jalapeño heat.' },
    { title: 'Gourmet Popcorn', salt: 'Smoked Garlic Onion', img: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=1000&auto=format&fit=crop', desc: 'The ultimate movie night upgrade. Savory, smoky, and addictive.' },
    { title: 'Lemon Rosemary Lamb', salt: 'Lemon Rosemary', img: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=1000&auto=format&fit=crop', desc: 'Classic Mediterranean flavors for a clean, aromatic finish.' },
    { title: 'Spicy Margarita Rim', salt: 'Habanero Lime Garlic', img: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=1000&auto=format&fit=crop', desc: 'Take your cocktails to the next level with a zesty, fiery rim.' },
  ];

  return (
    <div className="pt-40 pb-32 animate-fade-in bg-brand-black relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 stone-texture" />
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center space-y-6 mb-24">
          <span className="text-brand-gold text-[12px] uppercase tracking-[0.4em] font-black block">Culinary Inspiration</span>
          <h1 className="text-5xl md:text-7xl font-serif text-brand-parchment">Pairing Guide</h1>
          <p className="text-brand-parchment/60 max-w-2xl mx-auto text-lg font-light">
            Our salts are designed to be the final, transformative touch. 
            Explore our favorite ways to bring bold heat and refined flavor to your table.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {pairings.map((pairing, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group space-y-6"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-sm border border-white/5">
                <img 
                  src={pairing.img} 
                  alt={pairing.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-brand-gold text-[10px] uppercase tracking-widest font-black">Featuring</span>
                  <span className="h-[1px] flex-1 bg-brand-gold/20" />
                  <span className="text-brand-parchment text-[10px] uppercase tracking-widest font-black italic">{pairing.salt}</span>
                </div>
                <h3 className="text-2xl font-serif text-brand-parchment">{pairing.title}</h3>
                <p className="text-sm text-brand-parchment/60 leading-relaxed">{pairing.desc}</p>
                <Link 
                  to="/shop" 
                  className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-black text-brand-gold group/link pt-2"
                >
                  Shop this Salt <ArrowRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <section className="mt-40 bg-brand-black p-12 md:p-24 rounded-sm text-center space-y-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 stone-texture" />
          <div className="relative z-10 space-y-6">
            <h2 className="text-4xl md:text-6xl font-serif text-brand-parchment italic">Have a unique pairing?</h2>
            <p className="text-brand-parchment/60 text-lg max-w-xl mx-auto font-light">
              We love seeing how you use Boanerges salts. Tag us on Instagram for a chance to be featured in our monthly provision guide.
            </p>
            <div className="pt-6">
              <a 
                href="#" 
                className="inline-block px-12 py-5 bg-brand-gold text-brand-black text-xs uppercase tracking-[0.2em] font-bold hover:bg-brand-parchment transition-all duration-500"
              >
                @BoanergesProvision
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
