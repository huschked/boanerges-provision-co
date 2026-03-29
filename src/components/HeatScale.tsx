import React from 'react';
import { cn } from '@/src/lib/utils';

export const HeatScale: React.FC<{ level: number; className?: string }> = ({ level, className }) => {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="text-[10px] uppercase tracking-widest text-brand-earth/60 mr-2 font-black">Heat</span>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 w-7 rounded-full transition-all duration-700 shadow-sm",
            i < level 
              ? (level <= 2 ? "bg-brand-gold" : level <= 4 ? "bg-orange-500" : "bg-red-600 shadow-red-500/20")
              : "bg-brand-earth/10"
          )}
        />
      ))}
    </div>
  );
};
