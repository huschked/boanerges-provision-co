import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '@/src/assets/BoanergesLogoTransparent-v2.png';
import heroImage from '@/src/assets/HeroImage.png';
import { subscribeToNewsletter } from '@/src/lib/newsletter';
import { ResponsiveImage } from './ResponsiveImage';

type GateState = 'checking' | 'locked' | 'unlocked' | 'disabled' | 'error';

interface PrelaunchBoundaryProps {
  bypass?: boolean;
  children: React.ReactNode;
}

function useNoIndex(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const prior = existing?.content;
    const meta = existing || document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow, noarchive';
    if (!existing) document.head.appendChild(meta);
    return () => {
      if (existing && prior !== undefined) existing.content = prior;
      else meta.remove();
    };
  }, [active]);
}

export function PrelaunchBoundary({ bypass = false, children }: PrelaunchBoundaryProps) {
  const [state, setState] = useState<GateState>(bypass ? 'disabled' : 'checking');

  useEffect(() => {
    if (bypass) {
      setState('disabled');
      return;
    }
    const controller = new AbortController();
    setState('checking');
    fetch('/api/prelaunch/status', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Preview status is unavailable.');
        return await response.json() as { enabled?: boolean; unlocked?: boolean };
      })
      .then(result => setState(!result.enabled ? 'disabled' : result.unlocked ? 'unlocked' : 'locked'))
      .catch(error => { if (error.name !== 'AbortError') setState('error'); });
    return () => controller.abort();
  }, [bypass]);

  useNoIndex(!bypass && (state === 'checking' || state === 'locked' || state === 'error'));

  if (bypass || state === 'disabled' || state === 'unlocked') return <>{children}</>;
  return <ComingSoon state={state} onUnlock={() => setState('unlocked')} />;
}

function ComingSoon({ state, onUnlock }: { state: GateState; onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState(state === 'error' ? 'Preview access is temporarily unavailable.' : '');
  const [email, setEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (state === 'error') setUnlockError('Preview access is temporarily unavailable.');
  }, [state]);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || unlocking) return;
    setUnlocking(true);
    setUnlockError('');
    try {
      const response = await fetch('/api/prelaunch/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Preview access could not be confirmed.');
      onUnlock();
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : 'Preview access could not be confirmed.');
    } finally {
      setUnlocking(false);
    }
  };

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || joining) return;
    setJoining(true);
    setJoinError('');
    try {
      await subscribeToNewsletter(email, 'prelaunch_coming_soon');
      setJoined(true);
      setEmail('');
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Unable to join right now.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-brand-black text-brand-parchment">
      <div className="absolute inset-0" aria-hidden="true">
        <ResponsiveImage src={heroImage} alt="" width={1536} height={1024} sizes="100vw" priority className="h-full w-full object-cover object-center opacity-35 scale-[1.03]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(197,160,89,0.12),transparent_34%),linear-gradient(180deg,rgba(10,10,10,0.72),rgba(10,10,10,0.92)_58%,#0a0a0a)]" />
        <div className="absolute inset-4 border border-brand-gold/15 md:inset-7" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col px-7 py-8 md:px-12 md:py-10">
        <header className="flex items-start justify-center md:justify-between">
          <ResponsiveImage src={logo} alt="Boanerges Provisions Co." width={1092} height={360} sizes="(min-width: 768px) 250px, 210px" loading="eager" className="h-auto w-[210px] drop-shadow-[0_12px_30px_rgba(0,0,0,0.55)] md:w-[250px]" />
          <span className="hidden pt-4 text-[10px] font-black uppercase tracking-[0.38em] text-brand-gold/75 md:block">Small-Batch Finishing Salts</span>
        </header>

        <section className="flex flex-1 items-center py-12 md:py-16">
          <div className="grid w-full items-end gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(330px,0.75fr)] lg:gap-20">
            <div className="max-w-3xl animate-slide-up">
              <div className="mb-7 flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.42em] text-brand-gold">
                <span className="h-px w-12 bg-brand-gold/60" /> Coming Soon
              </div>
              <h1 className="font-serif text-6xl leading-[0.9] tracking-[-0.045em] text-brand-parchment sm:text-7xl md:text-8xl xl:text-[7.25rem]">
                Bold flavor is<br /><span className="italic text-brand-gold">taking shape.</span>
              </h1>
              <p className="mt-8 max-w-2xl text-base font-light leading-8 text-brand-parchment/68 md:text-lg">
                We’re preparing our first collection of handcrafted finishing salts—made in small batches with homegrown peppers and premium ingredients.
              </p>

              <div className="mt-10 max-w-xl border-y border-white/10 py-7">
                {joined ? (
                  <div className="flex items-center gap-3 text-sm text-brand-parchment" role="status">
                    <CheckCircle2 className="text-brand-gold" size={20} /> You’re on the list. We’ll let you know when the first batch is ready.
                  </div>
                ) : (
                  <form onSubmit={join}>
                    <label htmlFor="prelaunch-email" className="mb-3 block text-[10px] font-black uppercase tracking-[0.32em] text-brand-gold/85">Be first to know</label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex-1">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-parchment/35" size={18} aria-hidden="true" />
                        <input id="prelaunch-email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" className="h-14 w-full border border-white/15 bg-black/30 pl-12 pr-4 text-sm text-brand-parchment placeholder:text-brand-parchment/35 focus:border-brand-gold/70" />
                      </div>
                      <button type="submit" disabled={joining} className="flex h-14 items-center justify-center gap-3 bg-brand-gold px-7 text-[10px] font-black uppercase tracking-[0.25em] text-brand-black transition-colors hover:bg-brand-parchment">
                        {joining ? <Loader2 className="animate-spin" size={17} /> : <>Notify Me <ArrowRight size={16} /></>}
                      </button>
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-brand-parchment/45">Occasional product news only. Unsubscribe anytime. See our <Link className="underline underline-offset-4 hover:text-brand-gold" to="/privacy">Privacy Policy</Link>.</p>
                    {joinError && <p className="mt-3 text-sm text-red-300" role="alert">{joinError}</p>}
                  </form>
                )}
              </div>
            </div>

            <aside className="border border-brand-gold/25 bg-black/45 p-7 shadow-2xl backdrop-blur-md md:p-9">
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center border border-brand-gold/30 text-brand-gold"><LockKeyhole size={18} /></span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-gold">Private Preview</p>
                  <p className="mt-1 text-sm text-brand-parchment/55">For approved testers</p>
                </div>
              </div>
              <form onSubmit={unlock}>
                <label htmlFor="prelaunch-password" className="sr-only">Preview password</label>
                <div className="relative">
                  <input id="prelaunch-password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter preview password" className="h-14 w-full border border-white/15 bg-white/[0.04] px-4 pr-12 text-sm text-brand-parchment placeholder:text-brand-parchment/30 focus:border-brand-gold/70" />
                  <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-0 top-0 flex h-14 w-12 items-center justify-center text-brand-parchment/45 hover:text-brand-gold" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button type="submit" disabled={unlocking || state === 'checking'} className="mt-3 flex h-14 w-full items-center justify-center gap-3 border border-brand-gold/50 text-[10px] font-black uppercase tracking-[0.28em] text-brand-gold transition-colors hover:bg-brand-gold hover:text-brand-black">
                  {unlocking || state === 'checking' ? <Loader2 className="animate-spin" size={17} /> : <>Enter the Site <ArrowRight size={16} /></>}
                </button>
                {unlockError && <p className="mt-4 text-sm leading-6 text-red-300" role="alert">{unlockError}</p>}
              </form>
            </aside>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/10 pt-6 text-[10px] uppercase tracking-[0.2em] text-brand-parchment/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Boanerges Provisions Co.</p>
          <div className="flex gap-6"><a className="hover:text-brand-gold" href="mailto:hello@boanergesprovisions.com">Contact</a><Link className="hover:text-brand-gold" to="/privacy">Privacy</Link><Link className="hover:text-brand-gold" to="/terms">Terms</Link></div>
        </footer>
      </div>
    </main>
  );
}
