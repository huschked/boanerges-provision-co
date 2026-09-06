import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { getReviewSummary, type ReviewSummary } from '../services/reviewSummaryService';
import { cn } from '../lib/utils';

export function ProductRating({ productId, slug, dark = false }: { productId: string; slug: string; dark?: boolean }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; setSummary(null); setFailed(false);
    getReviewSummary(productId).then(value => { if (active) setSummary(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [productId]);
  const average = summary?.count ? summary.average! : 0;
  const label = failed ? 'Reviews unavailable' : !summary ? 'Loading reviews…' : !summary.count ? 'No reviews yet' : `${average.toFixed(1)} (${summary.count} ${summary.count === 1 ? 'review' : 'reviews'})`;
  return <Link to={`/product/${slug}#reviews`} aria-label={summary?.count ? `${average.toFixed(1)} out of 5 stars, ${summary.count} verified buyer reviews. Read reviews.` : `${label}. View reviews.`}
    className={cn('inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs leading-5 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold', dark ? 'text-brand-parchment/75 hover:text-brand-parchment' : 'text-brand-earth hover:text-brand-black')}>
    <span className="inline-flex gap-0.5 shrink-0" aria-hidden="true">{[0, 1, 2, 3, 4].map(index => <span key={index} className="relative block w-3.5 h-3.5">
      <Star size={14} strokeWidth={1.5} className={dark ? 'text-brand-parchment/50' : 'text-brand-earth/60'} />
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${Math.max(0, Math.min(1, average - index)) * 100}%` }}><Star size={14} strokeWidth={1.5} className="text-brand-gold fill-brand-gold max-w-none" /></span>
    </span>)}</span>
    <span>{label}</span>
  </Link>;
}
