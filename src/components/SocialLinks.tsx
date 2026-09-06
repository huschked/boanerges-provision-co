import React from 'react';
import { Instagram, Facebook } from 'lucide-react';

// Owner-approved placeholders. Add verified profile URLs here when the profiles exist.
export const SOCIAL_PROFILES = [
  { name: 'Instagram', url: '', Icon: Instagram },
  { name: 'Facebook', url: '', Icon: Facebook },
];
export function SocialLinks() {
  return <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">{SOCIAL_PROFILES.map(({ name, url, Icon }) => url
    ? <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-brand-gold underline"><Icon size={16} aria-hidden="true" />{name}</a>
    : <span key={name} className="inline-flex flex-wrap items-center gap-2 text-brand-parchment/70"><Icon size={16} aria-hidden="true" />{name}<span className="text-xs">· Coming soon</span></span>)}</div>;
}
