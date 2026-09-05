import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Flame, ShieldCheck, Zap, Award, Loader2, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getProducts, Product } from '@/src/services/productService';
import { ProductCard } from '@/src/components/ProductCard';
import toast from 'react-hot-toast';
import heroImage from '@/src/assets/HeroImage.png';
import brandStoryImage from '@/src/assets/brand-story-image.png';
import spicyCategoryImage from '@/src/assets/category-spicy.png';
import savoryCategoryImage from '@/src/assets/category-savory.png';
import herbalCategoryImage from '@/src/assets/category-herbal.png';
import { subscribeToNewsletter } from '@/src/lib/newsletter';

export const Home: React.FC = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const data = await getProducts();
        setFeaturedProducts(data.filter(p => p.featured).slice(0, 4));
      } catch (error) {
        console.error("Error fetching featured products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const result = await subscribeToNewsletter(email, 'home_newsletter');
      if (result.message) { toast.success(result.message); setEmail(''); return; }
      setSubmitted(true);
      setEmail('');
    } catch (error) {
      console.error("Newsletter error:", error);
      toast.error(error instanceof Error ? error.message : 'Unable to subscribe right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-brand-black pt-40 pb-24 md:pt-52 md:pb-32">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage} 
            alt="Artisan Salt Still Life" 
            className="w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-black/80 via-brand-black/20 to-brand-black" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6 flex flex-col items-center"
          >
            <span className="text-brand-gold text-[12px] md:text-[14px] uppercase tracking-[0.5em] font-black block">
              Small-Batch Finishing Salts
            </span>
            <h1 className="text-6xl md:text-9xl font-serif text-brand-parchment leading-[0.95] tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              Bold Heat. <br /> <span className="italic text-brand-gold">Refined Flavor.</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-brand-parchment/80 text-lg md:text-2xl max-w-3xl mx-auto leading-relaxed font-light"
          >
            Handcrafted in small batches with homegrown peppers and premium ingredients for bold flavor, refined heat, and everyday finishing.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-6"
          >
            <Link 
              to="/shop" 
              className="w-full sm:w-auto px-16 py-6 bg-brand-gold text-brand-black text-[13px] uppercase tracking-[0.3em] font-black hover:bg-brand-parchment transition-all duration-500 shadow-2xl hover:-translate-y-1"
            >
              Shop the Collection
            </Link>
            <Link 
              to="/shop?category=Best Sellers" 
              className="w-full sm:w-auto px-16 py-6 border border-brand-gold/50 text-brand-gold text-[13px] uppercase tracking-[0.3em] font-black hover:bg-brand-gold hover:text-brand-black transition-all duration-500 hover:-translate-y-1"
            >
              Explore Best Sellers
            </Link>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 text-brand-gold/40"
        >
          <div className="w-[1px] h-16 bg-gradient-to-b from-brand-gold/60 to-transparent mx-auto" />
        </motion.div>
      </section>

      {/* Trust/Value Strip */}
      <section className="bg-brand-black border-y border-white/5 py-8 relative z-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 md:gap-4">
            {[
              { label: "Small-Batch Crafted", icon: Zap },
              { label: "Homegrown Peppers", icon: Flame },
              { label: "Free Shipping Over $50", icon: ShieldCheck },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <item.icon size={16} className="text-brand-gold" />
                <span className="text-[10px] md:text-[11px] uppercase tracking-[0.25em] font-black text-brand-parchment/60">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-32 editorial-surface-light">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <div className="space-y-4">
              <span className="text-brand-gold text-[12px] uppercase tracking-[0.3em] font-black">The Collection</span>
              <h2 className="text-5xl md:text-7xl font-serif text-brand-black">Featured Provisions</h2>
            </div>
            <Link 
              to="/shop" 
              className="text-[12px] uppercase tracking-[0.25em] text-brand-black font-black flex items-center gap-3 group border-b border-brand-black/10 pb-1"
            >
              View All Products
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-brand-gold" size={48} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-20 editorial-surface-dark border-y border-brand-gold/10">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            {[
              { icon: Flame, title: "Homegrown Peppers", desc: "Farm to jar freshness" },
              { icon: Zap, title: "Small Batch", desc: "Handcrafted excellence" },
              { icon: ShieldCheck, title: "Secure Checkout", desc: "Safe & trusted payments" },
              { icon: Award, title: "Premium Flavor", desc: "Gourmet quality salts" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center space-y-4 group">
                <div className="w-14 h-14 rounded-full border border-brand-gold/20 flex items-center justify-center text-brand-gold group-hover:bg-brand-gold group-hover:text-brand-black transition-all duration-500">
                  <item.icon size={24} strokeWidth={1} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-brand-parchment text-[12px] uppercase tracking-[0.2em] font-black">{item.title}</h3>
                  <p className="text-brand-parchment/60 text-[10px] uppercase tracking-[0.15em]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Story Teaser */}
      <section className="relative py-32 overflow-hidden bg-brand-black">
        <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="relative aspect-[4/5] rounded-sm overflow-hidden shadow-2xl">
              <img 
                src={brandStoryImage} 
                alt="Artisan Salt Craftsmanship" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 border-[20px] border-brand-black/20" />
            </div>
            <div className="space-y-10">
              <div className="space-y-4">
                <span className="text-brand-gold text-[12px] uppercase tracking-[0.3em] font-bold">Our Philosophy</span>
                <h2 className="text-4xl md:text-6xl font-serif text-brand-parchment leading-tight">
                  Crafted with <br /> <span className="italic text-brand-gold">Sacred Intent</span>
                </h2>
              </div>
              <p className="text-brand-parchment/60 text-lg leading-relaxed font-light">
                At Boanerges Provisions Co., we believe that flavor is a sacred experience.
                Our salts aren't just seasonings; they are the result of patience, 
                hand-selected ingredients, and a deep respect for the artisan tradition.
              </p>
              <div className="grid grid-cols-2 gap-12 pt-4">
                <div className="space-y-2">
                  <span className="text-3xl font-serif text-brand-gold">Homegrown</span>
                  <p className="text-[10px] uppercase tracking-widest text-brand-parchment/40 font-bold">Peppers</p>
                </div>
                <div className="space-y-2">
                  <span className="text-3xl font-serif text-brand-gold">Small</span>
                  <p className="text-[10px] uppercase tracking-widest text-brand-parchment/40 font-bold">Batch Production</p>
                </div>
              </div>
              <Link 
                to="/about" 
                className="inline-block px-12 py-5 border border-brand-gold/30 text-brand-gold text-xs uppercase tracking-[0.2em] font-bold hover:bg-brand-gold hover:text-brand-black transition-all duration-500"
              >
                Read Our Story
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Flavor Explorer / Categories */}
      <section className="py-32 editorial-surface-light">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center space-y-4 mb-20">
            <span className="text-brand-gold text-[12px] uppercase tracking-[0.3em] font-bold">Find Your Match</span>
            <h2 className="text-4xl md:text-6xl font-serif text-brand-black">Explore the Profiles</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'The Heat Seekers', desc: 'Bold, fiery, and complex.', img: spicyCategoryImage, cat: 'Spicy' },
              { name: 'The Savory Staples', desc: 'Rich, earthy, and umami.', img: savoryCategoryImage, cat: 'Savory' },
              { name: 'The Bright & Herbal', desc: 'Fresh, citrusy, and aromatic.', img: herbalCategoryImage, cat: 'Herbal' },
            ].map((cat, i) => (
              <Link 
                key={i} 
                to={`/shop?category=${cat.cat}`}
                className="group relative aspect-[3/4] overflow-hidden rounded-sm"
              >
                <img 
                  src={cat.img} 
                  alt={cat.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-black/90 via-brand-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-10 space-y-2">
                  <h3 className="text-2xl font-serif text-brand-parchment">{cat.name}</h3>
                  <p className="text-sm text-brand-parchment/60 font-light">{cat.desc}</p>
                  <div className="pt-4 flex items-center gap-2 text-brand-gold text-[10px] uppercase tracking-widest font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    Explore Collection <ArrowRight size={14} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter / Email Capture */}
      <section className="py-32 editorial-surface-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-70 surface-vignette-dark" />
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="glass-dark p-12 md:p-24 rounded-sm border-brand-gold/10 flex flex-col lg:flex-row items-center justify-between gap-16">
            <div className="space-y-6 max-w-xl">
              <h2 className="text-4xl md:text-5xl font-serif text-brand-parchment">Join the Inner Circle</h2>
              <p className="text-brand-parchment/60 text-lg font-light">
                Be the first to know about limited flavor drops, artisan stories, and exclusive recipes. 
                Receive 10% off your first provision.
              </p>
            </div>
            <div className="w-full max-w-md">
              {submitted ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center p-8 bg-brand-gold/10 border border-brand-gold/30 rounded-sm space-y-4"
                >
                  <CheckCircle2 className="mx-auto text-brand-gold" size={48} />
                  <div className="space-y-2">
                    <h3 className="text-xl font-serif text-brand-parchment">Welcome to the Circle</h3>
                    <p className="text-sm text-brand-parchment/60 font-light">Check your inbox for your exclusive welcome gift.</p>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleSubscribe} className="space-y-4">
                  <div className="relative">
                    <input 
                      type="email" 
                      placeholder="Enter your email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-brand-parchment/5 border border-brand-parchment/10 py-5 px-6 text-brand-parchment outline-none focus:border-brand-gold transition-colors placeholder:text-brand-parchment/20"
                    />
                    <button 
                      type="submit"
                      disabled={submitting}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-gold text-[11px] uppercase tracking-widest font-bold hover:translate-x-1 transition-transform disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Subscribe'}
                    </button>
                  </div>
                  <p className="text-xs text-brand-parchment/50 text-center leading-5">
                    By subscribing, you agree to receive marketing email. Unsubscribe anytime. See our <Link to="/privacy" className="text-brand-gold hover:text-brand-parchment underline underline-offset-4">Privacy Policy</Link>.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
