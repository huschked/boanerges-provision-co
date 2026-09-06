export const STOREFRONT_NAV = [
  { name: 'Shop Salts', path: '/shop' },
  { name: 'Bundles & Gifts', path: '/bundles' },
  { name: 'Pairing Guide', path: '/recipes' },
  { name: 'Our Story', path: '/about' },
  { name: 'Contact', path: '/contact' },
  { name: 'FAQ', path: '/faq' },
];
export const PAIRING_PRODUCTS: Record<string, string> = {
  'Porcini Garlic Umami': 'porcini-garlic-umami',
  'Habanero Lime Garlic': 'habanero-lime-garlic',
  'Smoked Jalapeño Garlic': 'smoked-jalapeno-garlic',
  'Smoked Garlic Onion': 'smoked-garlic-onion',
  'Lemon Rosemary': 'lemon-rosemary',
};
export const SHOP_CATEGORIES = ['All', 'Featured', 'Spicy', 'Savory', 'Herbal', 'Citrus'];
export function shopCategory(value: string | null) {
  if (value?.toLowerCase() === 'best sellers') return 'Featured';
  return SHOP_CATEGORIES.find(c => c.toLowerCase() === value?.toLowerCase()) || 'All';
}
export function inCollection(product: { featured?: boolean; tags?: string[]; category?: string }, category: string, featuredFallback = false) {
  if (category === 'All') return true;
  if (category === 'Featured') return featuredFallback || product.featured === true;
  return product.category?.toLowerCase() === category.toLowerCase() || !!product.tags?.some(tag => tag.toLowerCase() === category.toLowerCase());
}
