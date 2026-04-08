import React from 'react';
import { cn } from '@/src/lib/utils';

type MetricPoint = {
  label: string;
  value: number;
};

type StackedPoint = {
  label: string;
  newCustomers: number;
  returningCustomers: number;
};

export const InsightCard: React.FC<{
  eyebrow: string;
  title: string;
  value: string;
  hint?: string;
}> = ({ eyebrow, title, value, hint }) => (
  <div className="card-premium p-7 space-y-3 min-h-[160px]">
    <p className="text-[9px] uppercase tracking-[0.25em] text-brand-gold/45 font-black">{eyebrow}</p>
    <div className="space-y-1">
      <p className="text-sm text-brand-parchment/45">{title}</p>
      <p className="text-4xl font-serif text-brand-parchment">{value}</p>
    </div>
    {hint && <p className="text-xs text-brand-parchment/35 leading-relaxed">{hint}</p>}
  </div>
);

export const InsightPanel: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, subtitle, children, action }) => (
  <section className="card-premium overflow-hidden">
    <div className="p-8 border-b border-white/5 bg-white/[0.01] flex items-center justify-between gap-6">
      <div className="space-y-1">
        <h3 className="text-2xl font-serif text-brand-parchment">{title}</h3>
        {subtitle && <p className="text-[10px] uppercase tracking-[0.2em] text-brand-gold/40 font-black">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="p-8">{children}</div>
  </section>
);

export const EmptyInsight: React.FC<{
  title: string;
  description: string;
}> = ({ title, description }) => (
  <div className="min-h-[260px] flex items-center justify-center text-center">
    <div className="max-w-sm space-y-3">
      <p className="text-brand-parchment text-lg font-serif">{title}</p>
      <p className="text-sm text-brand-parchment/35 leading-relaxed">{description}</p>
    </div>
  </div>
);

export const TrendChart: React.FC<{
  data: MetricPoint[];
  formatter?: (value: number) => string;
  accentClassName?: string;
}> = ({ data, formatter = (value) => `${value}`, accentClassName = 'text-brand-gold' }) => {
  if (!data.length) {
    return <EmptyInsight title="No trend data yet" description="This trend will appear once there is timestamped activity in Firestore." />;
  }

  const width = 720;
  const height = 250;
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((point, index) => {
    const x = stepX * index;
    const y = height - (point.value / maxValue) * (height - 24) - 12;
    return `${x},${y}`;
  });

  const areaPoints = [`0,${height}`, ...points, `${width},${height}`].join(' ');
  const latestPoint = data[data.length - 1];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className={cn('text-3xl font-serif', accentClassName)}>{formatter(latestPoint.value)}</p>
          <p className="text-xs text-brand-parchment/35">Latest period: {latestPoint.label}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {data.slice(-4).map((point) => (
            <div key={point.label} className="px-3 py-2 rounded-full border border-white/5 bg-white/[0.01] text-[10px] uppercase tracking-[0.15em] text-brand-parchment/45 font-black">
              {point.label}
            </div>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[250px] overflow-visible">
        <defs>
          <linearGradient id="analytics-area" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(197,160,89,0.35)" />
            <stop offset="100%" stopColor="rgba(197,160,89,0)" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#analytics-area)" />
        <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="4" className={accentClassName} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((point, index) => {
          const x = stepX * index;
          const y = height - (point.value / maxValue) * (height - 24) - 12;
          return (
            <g key={point.label}>
              <circle cx={x} cy={y} r="5" fill="currentColor" className={accentClassName} />
            </g>
          );
        })}
      </svg>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.slice(-4).map((point) => (
          <div key={point.label} className="rounded-sm border border-white/5 bg-white/[0.01] px-4 py-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">{point.label}</p>
            <p className="text-sm text-brand-parchment mt-1">{formatter(point.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const HorizontalBars: React.FC<{
  data: Array<{ label: string; value: number; secondaryValue?: string }>;
  formatter?: (value: number) => string;
  emptyTitle: string;
  emptyDescription: string;
}> = ({ data, formatter = (value) => `${value}`, emptyTitle, emptyDescription }) => {
  if (!data.length) {
    return <EmptyInsight title={emptyTitle} description={emptyDescription} />;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-brand-parchment font-black">{item.label}</p>
              {item.secondaryValue && <p className="text-[11px] text-brand-parchment/35">{item.secondaryValue}</p>}
            </div>
            <p className="text-sm text-brand-gold font-black">{formatter(item.value)}</p>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-gold/40 via-brand-gold to-brand-parchment" style={{ width: `${(item.value / maxValue) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const DistributionBars: React.FC<{
  data: Array<{ label: string; value: number }>;
  formatter?: (value: number) => string;
  emptyTitle: string;
  emptyDescription: string;
}> = ({ data, formatter = (value) => `${value}`, emptyTitle, emptyDescription }) => {
  if (!data.length) {
    return <EmptyInsight title={emptyTitle} description={emptyDescription} />;
  }

  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <div className="space-y-5">
      <div className="h-4 rounded-full overflow-hidden bg-white/5 flex">
        {data.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              'h-full',
              index % 4 === 0 && 'bg-brand-gold',
              index % 4 === 1 && 'bg-brand-parchment',
              index % 4 === 2 && 'bg-brand-gold/60',
              index % 4 === 3 && 'bg-brand-parchment/60'
            )}
            style={{ width: `${(item.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-3 h-3 rounded-full',
                  index % 4 === 0 && 'bg-brand-gold',
                  index % 4 === 1 && 'bg-brand-parchment',
                  index % 4 === 2 && 'bg-brand-gold/60',
                  index % 4 === 3 && 'bg-brand-parchment/60'
                )}
              />
              <p className="text-sm text-brand-parchment">{item.label}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-brand-gold font-black">{formatter(item.value)}</p>
              <p className="text-[10px] text-brand-parchment/35">{((item.value / total) * 100).toFixed(1)}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const StackedBars: React.FC<{
  data: StackedPoint[];
  emptyTitle: string;
  emptyDescription: string;
}> = ({ data, emptyTitle, emptyDescription }) => {
  if (!data.length) {
    return <EmptyInsight title={emptyTitle} description={emptyDescription} />;
  }

  const maxValue = Math.max(...data.map((point) => point.newCustomers + point.returningCustomers), 1);

  return (
    <div className="space-y-4">
      {data.map((point) => {
        const total = point.newCustomers + point.returningCustomers;
        return (
          <div key={point.label} className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-brand-parchment font-black">{point.label}</p>
              <p className="text-[11px] text-brand-parchment/45">
                {point.newCustomers} new / {point.returningCustomers} returning
              </p>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-white/5 flex">
              <div className="bg-brand-gold" style={{ width: `${(point.newCustomers / maxValue) * 100}%` }} />
              <div className="bg-brand-parchment/70" style={{ width: `${(point.returningCustomers / maxValue) * 100}%` }} />
            </div>
            <p className="text-[10px] text-brand-parchment/30">Total customer orders in period: {total}</p>
          </div>
        );
      })}
    </div>
  );
};
