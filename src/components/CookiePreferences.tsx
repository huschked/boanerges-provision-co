import React, { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { configureAnalyticsProviders, getTrackingConsent, OPEN_COOKIE_PREFERENCES_EVENT, saveTrackingConsent } from '@/src/lib/analytics';

export const CookiePreferences: React.FC = () => {
  const initial = getTrackingConsent();
  const [open, setOpen] = useState(!initial);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);
  const [advertising, setAdvertising] = useState(initial?.advertising ?? false);

  useEffect(() => {
    configureAnalyticsProviders();
    const showPreferences = () => {
      const current = getTrackingConsent();
      setAnalytics(current?.analytics ?? false);
      setAdvertising(current?.advertising ?? false);
      setCustomizing(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, showPreferences);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, showPreferences);
  }, []);

  const save = (nextAnalytics: boolean, nextAdvertising: boolean) => {
    saveTrackingConsent({ analytics: nextAnalytics, advertising: nextAdvertising });
    setAnalytics(nextAnalytics);
    setAdvertising(nextAdvertising);
    setOpen(false);
    setCustomizing(false);
  };

  if (!open) return null;

  if (customizing) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-brand-black/75 backdrop-blur-sm p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="cookie-preferences-title" className="w-full max-w-2xl border border-brand-gold/30 bg-[#11110f] p-7 sm:p-10 shadow-2xl">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-brand-gold font-black">Privacy choices</p>
              <h2 id="cookie-preferences-title" className="text-3xl font-serif text-brand-parchment">Choose your cookie settings</h2>
            </div>
            {initial && <button type="button" aria-label="Close cookie preferences" onClick={() => { setOpen(false); setCustomizing(false); }} className="min-h-11 min-w-11 inline-flex items-center justify-center border border-white/10 text-brand-parchment/60 hover:text-brand-gold"><X size={18} /></button>}
          </div>

          <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
            <div className="py-5 flex items-start justify-between gap-5">
              <div><h3 className="font-black text-brand-parchment">Necessary</h3><p className="mt-1 text-sm leading-6 text-brand-parchment/55">Required for the cart, checkout, security, and core website functions.</p></div>
              <span className="shrink-0 text-[9px] uppercase tracking-widest text-brand-gold font-black">Always on</span>
            </div>
            <label className="py-5 flex items-start justify-between gap-5 cursor-pointer">
              <div><span className="font-black text-brand-parchment">Analytics</span><p className="mt-1 text-sm leading-6 text-brand-parchment/55">Lets Google Analytics measure visits and shopping behavior so we can improve the site.</p></div>
              <input type="checkbox" checked={analytics} onChange={event => setAnalytics(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-gold" />
            </label>
            <label className="py-5 flex items-start justify-between gap-5 cursor-pointer">
              <div><span className="font-black text-brand-parchment">Advertising</span><p className="mt-1 text-sm leading-6 text-brand-parchment/55">Lets Meta measure ads and build audiences based on storefront activity.</p></div>
              <input type="checkbox" checked={advertising} onChange={event => setAdvertising(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-gold" />
            </label>
          </div>

          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" onClick={() => save(false, false)} className="min-h-11 px-6 py-3 border border-white/15 text-brand-parchment text-[10px] uppercase tracking-widest font-black hover:border-brand-gold/50">Necessary only</button>
            <button type="button" onClick={() => save(analytics, advertising)} className="min-h-11 px-7 py-3 bg-brand-gold text-brand-black text-[10px] uppercase tracking-widest font-black hover:bg-brand-parchment">Save choices</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <section role="region" aria-label="Cookie choices" className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-5xl border border-brand-gold/30 bg-[#11110f]/95 p-6 sm:p-7 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
        <ShieldCheck className="hidden sm:block shrink-0 text-brand-gold" size={30} />
        <div className="flex-1 space-y-2">
          <h2 className="text-xl font-serif text-brand-parchment">Your privacy choices</h2>
          <p className="text-sm leading-6 text-brand-parchment/60">We use necessary storage for the cart and checkout. With your permission, analytics helps improve the shop and advertising cookies help measure Meta campaigns. You can change this later from the footer.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <button type="button" onClick={() => setCustomizing(true)} className="min-h-11 px-5 py-3 border border-white/15 text-brand-parchment text-[9px] uppercase tracking-widest font-black hover:border-brand-gold/50">Customize</button>
          <button type="button" onClick={() => save(false, false)} className="min-h-11 px-5 py-3 border border-brand-gold/30 text-brand-gold text-[9px] uppercase tracking-widest font-black hover:bg-brand-gold/10">Necessary only</button>
          <button type="button" onClick={() => save(true, true)} className="min-h-11 px-6 py-3 bg-brand-gold text-brand-black text-[9px] uppercase tracking-widest font-black hover:bg-brand-parchment">Accept all</button>
        </div>
      </div>
    </section>
  );
};
