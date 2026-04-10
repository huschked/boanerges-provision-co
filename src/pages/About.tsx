import React from 'react';
import { motion } from 'motion/react';
import aboutHeroImage from '@/src/assets/about-hero.png';
import aboutOriginImage from '@/src/assets/about-origin.png';
import aboutCraftsmanshipImage from '@/src/assets/about-craftsmanship.png';
import aboutFlavorPhilosophyImage from '@/src/assets/about-flavor-philosophy.png';

export const About: React.FC = () => {
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative h-[70vh] flex items-center justify-center overflow-hidden bg-brand-black">
        <div className="absolute inset-0 z-0">
          <img 
            src={aboutHeroImage} 
            alt="Artisan Salt Crystals" 
            className="w-full h-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-black/60 via-transparent to-brand-black" />
        </div>
        <div className="relative z-10 text-center space-y-6 flex flex-col items-center">
          <span className="text-brand-gold text-[12px] uppercase tracking-[0.4em] font-black block">The Artisan Path</span>
          <h1 className="text-6xl md:text-9xl font-serif text-brand-parchment italic drop-shadow-2xl">Our Story</h1>
        </div>
      </section>

      {/* Brand Origin */}
      <section className="py-32 editorial-surface-light">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-10">
              <div className="space-y-4">
                <span className="text-brand-gold text-[12px] uppercase tracking-[0.3em] font-black">Brand Origin</span>
                <h2 className="text-4xl md:text-6xl font-serif text-brand-black leading-tight">Born from <br /> <span className="italic text-brand-gold">Bold Curiosity</span></h2>
              </div>
              <div className="space-y-6 text-lg text-brand-earth/70 leading-relaxed font-light">
                <p>
                  Boanerges Provision Co. didn't start in a boardroom. It started in a garden, with a single habanero plant and a passion for the transformative power of flavor.
                </p>
                <p>
                  We noticed that most seasonings were either too salty, too artificial, or lacked the nuance that a truly great dish deserves. We wanted something more—a finishing touch that respected the ingredients while adding a bold, refined edge.
                </p>
                <p>
                  The name "Boanerges"—Sons of Thunder—reflects our commitment to bold, impactful flavor that commands attention and elevates every meal.
                </p>
              </div>
            </div>
            <div className="relative aspect-[4/5] rounded-sm overflow-hidden shadow-2xl">
              <img 
                src={aboutOriginImage} 
                alt="Homegrown Peppers" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 border-[20px] border-brand-parchment/20" />
            </div>
          </div>
        </div>
      </section>

      {/* Small-Batch Craftsmanship */}
      <section className="py-32 editorial-surface-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="order-2 lg:order-1 relative aspect-[4/5] rounded-sm overflow-hidden shadow-2xl">
              <img 
                src={aboutCraftsmanshipImage} 
                alt="Small-Batch Craftsmanship" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 border-[20px] border-brand-black/20" />
            </div>
            <div className="order-1 lg:order-2 space-y-10">
              <div className="space-y-4">
                <span className="text-brand-gold text-[12px] uppercase tracking-[0.3em] font-black">Small-Batch Craft</span>
                <h2 className="text-4xl md:text-6xl font-serif text-brand-parchment leading-tight">Handcrafted <br /> <span className="italic text-brand-gold">With Intent</span></h2>
              </div>
              <div className="space-y-6 text-lg text-brand-parchment/60 leading-relaxed font-light">
                <p>
                  Every jar of Boanerges salt is blended by hand. We don't use industrial fillers or anti-caking agents. We use real peppers, fresh-dried herbs, and premium sea salt.
                </p>
                <p>
                  Our process is slow. We smoke our peppers over aged hardwoods, roast our garlic until it's caramelized and sweet, and zest our citrus by hand. It's the only way to ensure that every pinch delivers the complexity we're known for.
                </p>
                <p>
                  This is artisan craftsmanship for the modern kitchen, where quality is never sacrificed for speed.
                </p>
              </div>
              <div className="flex gap-12 pt-4">
                <div className="space-y-1">
                  <span className="text-3xl font-serif text-brand-gold block">100%</span>
                  <span className="text-[10px] uppercase tracking-widest text-brand-parchment/40 font-black">Natural Ingredients</span>
                </div>
                <div className="space-y-1">
                  <span className="text-3xl font-serif text-brand-gold block">Hand</span>
                  <span className="text-[10px] uppercase tracking-widest text-brand-parchment/40 font-black">Blended & Packed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Flavor Philosophy */}
      <section className="py-32 editorial-surface-light">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-10">
              <div className="space-y-4">
                <span className="text-brand-gold text-[12px] uppercase tracking-[0.3em] font-black">Flavor Philosophy</span>
                <h2 className="text-4xl md:text-6xl font-serif text-brand-black leading-tight">Bold Heat <br /> <span className="italic text-brand-gold">Refined Flavor</span></h2>
              </div>
              <div className="space-y-6 text-lg text-brand-earth/70 leading-relaxed font-light">
                <p>
                  We believe that heat should never be hollow. Our philosophy is built on the marriage of bold, impactful spice and refined, nuanced flavor. 
                </p>
                <p>
                  Whether it's the earthy depth of porcini or the bright zest of lemon rosemary, every blend is designed to enhance your food, not mask it. We create finishing salts that tell a story of the land and the hands that crafted them.
                </p>
              </div>
            </div>
            <div className="relative aspect-[4/5] rounded-sm overflow-hidden shadow-2xl">
              <img 
                src={aboutFlavorPhilosophyImage} 
                alt="Flavor Philosophy" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 border-[20px] border-brand-parchment/20" />
            </div>
          </div>
        </div>
      </section>

      {/* Why Special */}
      <section className="py-32 editorial-surface-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="text-center space-y-4 mb-24">
            <span className="text-brand-gold text-[12px] uppercase tracking-[0.3em] font-black">The Difference</span>
            <h2 className="text-4xl md:text-6xl font-serif text-brand-parchment">What Makes Us Special</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {[
              { title: 'Artisan Integrity', desc: 'We never compromise on the slow, handcrafted process that makes our salts superior.' },
              { title: 'Homegrown Peppers', desc: 'Our peppers are grown with care, ensuring the highest quality and most vibrant flavor profiles.' },
              { title: 'Sacred Quality', desc: 'From our garden to your table, we treat every ingredient with the respect it deserves.' },
            ].map((value, i) => (
              <div key={i} className="space-y-6 text-center">
                <div className="w-16 h-16 rounded-full border border-brand-gold/20 flex items-center justify-center text-brand-gold mx-auto">
                  <span className="font-serif text-2xl">0{i + 1}</span>
                </div>
                <h3 className="text-2xl font-serif text-brand-parchment">{value.title}</h3>
                <p className="text-brand-parchment/60 font-light leading-relaxed">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
