import React from 'react';
import { cn } from '@/src/lib/utils';
import { getHeatLabel } from '@/src/lib/productCatalog';

export const HeatScale: React.FC<{ level: number; className?: string; dark?: boolean }> = ({ level, className, dark = false }) => {
  const valid = Number.isInteger(level) && level >= 0 && level <= 5;
  const heat = valid ? level : 0;
  const label = valid ? getHeatLabel(heat) : 'Not rated';
  return <div className={cn('space-y-2.5', className)} role="img" aria-label={valid ? `Heat: ${label}, ${heat} out of 5` : 'Heat not rated'}>
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-hidden="true">
      <span className={cn('text-[11px] uppercase tracking-[0.14em] font-bold', dark ? 'text-brand-parchment/75' : 'text-brand-earth')}>Heat scale</span>
      <span className={cn('text-xs font-semibold', dark ? 'text-brand-parchment' : 'text-brand-black')}>{label}{valid && <span className={cn('ml-2 font-normal', dark ? 'text-brand-parchment/65' : 'text-brand-earth')}>{heat}/5</span>}</span>
    </div>
    <div className="flex gap-2" aria-hidden="true">{[0, 1, 2, 3, 4].map(index => <svg key={index} viewBox="0 0 24 24" className={cn('w-6 h-6 shrink-0', index < heat ? heat <= 2 ? 'text-brand-gold' : heat <= 4 ? (dark ? 'text-orange-400' : 'text-orange-700') : (dark ? 'text-red-400' : 'text-red-700') : dark ? 'text-brand-parchment/45' : 'text-brand-earth/50')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 6c0-2 1-3 3-3" />
      <path d="M13 7c3-2 6-1 7 2 2 6-6 12-17 12 5-3 7-6 8-10 .4-2 1-3 2-4Z" fill={index < heat ? 'currentColor' : 'none'} fillOpacity={index < heat ? '.8' : '0'} />
      <path d="m12 8 3 2 4-2" />
    </svg>)}</div>
  </div>;
};
