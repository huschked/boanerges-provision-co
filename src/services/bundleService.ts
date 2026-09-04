import type { ResolvedBundle } from '../lib/bundleCommerce';
import type { Product } from './productService';

export async function getBundles(): Promise<ResolvedBundle[]> {
  const response = await fetch('/api/bundles');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Bundles are unavailable.');
  return Array.isArray(data.bundles) ? data.bundles : [];
}

export function bundleToCartProduct(bundle: ResolvedBundle): Product {
  return {
    id: bundle.id, slug: bundle.slug, name: bundle.name, price: bundle.sellingPrice,
    sizeOz: bundle.sizeOz, heatLevel: 0, shortDescription: bundle.description,
    flavorNotes: [], pairings: [], tags: ['Bundle'], active: bundle.availableStock > 0,
    featured: false, currentInventory: bundle.availableStock, reorderThreshold: 0,
    imageUrl: bundle.imageUrl, imageAlt: bundle.imageAlt, imageType: bundle.imageType,
    category: 'Bundles', commerceType: 'bundle', compareAtPrice: bundle.compareAtPrice,
    savingsAmount: bundle.savingsAmount, bundleComponents: bundle.components,
  };
}
