import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Reviews = { count: number; average: number | null; reviews: { id: string; displayName: string; rating: number; text: string; date: string }[] };
export function ProductReviews({ productId }: { productId: string }) {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== '#reviews') return;
    const frame = requestAnimationFrame(() => document.getElementById('reviews')?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [hash, productId]);
  const [data, setData] = useState<Reviews | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    fetch(`/api/reviews/product/${encodeURIComponent(productId)}`, { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error();
      setData(await r.json());
    }).catch(e => { if (e.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [productId]);
  return <section id="reviews" className="mt-20 scroll-mt-28 border-t border-white/10 pt-10 text-brand-parchment" aria-labelledby="reviews-heading">
    <h2 id="reviews-heading" className="font-serif text-3xl mb-4">Verified Buyer Reviews</h2>
    <p className="text-brand-parchment/70 mb-6">Reviews come from verified purchases and are moderated for safety and relevance, not rating. No incentives are offered.</p>
    {error ? <p role="status">Reviews could not be loaded. Please refresh to try again.</p> : !data ? <p role="status">Loading reviews…</p> : <>
      <p className="text-brand-gold mb-6">{data.count ? `${data.average!.toFixed(1)} out of 5 · ${data.count} verified ${data.count === 1 ? 'review' : 'reviews'}` : 'No reviews yet. Buyers receive a private invitation after delivery.'}</p>
      <div className="grid gap-5 md:grid-cols-2">{data.reviews.map(r => <article key={r.id} className="p-6 border border-white/10 min-w-0">
        <p className="text-brand-gold" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
        <p className="font-bold mt-2 break-words">{r.displayName} <span className="font-normal text-sm text-brand-parchment/60">· Verified buyer</span></p>
        <time className="text-sm text-brand-parchment/60">{r.date}</time>
        <p className="mt-4 whitespace-pre-wrap break-words">{r.text}</p>
      </article>)}</div>
      {data.count > 50 && <p className="mt-4">Showing the latest 50 published reviews. The rating includes all published reviews.</p>}
    </>}
  </section>;
}
