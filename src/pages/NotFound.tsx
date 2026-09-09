import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-[75vh] bg-brand-black px-6 pb-24 pt-40 text-center text-brand-parchment">
      <p className="mb-5 text-[11px] font-black uppercase tracking-[0.35em] text-brand-gold">404 · Provision Not Found</p>
      <h1 className="font-serif text-5xl md:text-7xl">That page has left the table.</h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-brand-parchment/65">
        The address may have changed, or the product may no longer be available.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link to="/shop" className="min-h-11 bg-brand-gold px-8 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-brand-black">Shop finishing salts</Link>
        <Link to="/" className="min-h-11 border border-brand-gold/50 px-8 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-brand-gold">Return home</Link>
      </div>
    </div>
  );
}
