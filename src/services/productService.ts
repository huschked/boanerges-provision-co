import { db, collection, getDocs } from '../lib/firebase';
import { isProductPublishReady } from '../lib/productCatalog';

export type ProductImageType = 'photograph' | 'illustrative';
export type ProductMediaRole = 'jar-front' | 'salt-detail' | 'label-detail' | 'in-use' | 'ingredient-art' | 'other';
export type SubscriptionCadence = 'monthly' | 'every_two_months' | 'every_three_months';

export interface ProductMedia {
  url: string;
  alt: string;
  type: ProductImageType;
  role: ProductMediaRole;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  sizeOz: number;
  heatLevel: number;
  shortDescription: string;
  flavorNotes: string[];
  pairings: string[];
  tags: string[];
  ingredients?: string[];
  allergenStatement?: string;
  crossContactStatement?: string;
  storageInstructions?: string;
  shelfLife?: string;
  dietaryClaims?: string[];
  dietaryClaimsApproved?: boolean;
  productFactsApproved?: boolean;
  productDataVersion?: number;
  heatLabel?: string;
  active: boolean;
  featured: boolean;
  currentInventory: number;
  reservedInventory?: number;
  reorderThreshold: number;
  stripePriceId?: string;
  stripeTaxCode?: string;
  subscriptionEligible?: boolean;
  subscriptionPriceIds?: Partial<Record<SubscriptionCadence, string>>;
  imageUrl: string;
  imageAlt?: string;
  imageType?: ProductImageType;
  gallery?: ProductMedia[];
  category?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  commerceType?: 'product' | 'bundle';
  compareAtPrice?: number;
  savingsAmount?: number;
  bundleComponents?: Array<{ productId: string; name: string; quantity: number; sizeOz: number; unitPrice: number }>;
}

export const getProducts = async (category?: string) => {
  const params = new URLSearchParams();
  if (category && category !== 'All') params.set('category', category);
  const response = await fetch(`/api/products${params.size ? `?${params}` : ''}`);
  if (!response.ok) throw new Error('Products are temporarily unavailable.');
  const products = await response.json() as Product[];
  return products.filter((product) => isProductPublishReady(product as unknown as Record<string, unknown>));
};

export const getAllProducts = async () => {
  const snapshot = await getDocs(collection(db, 'products'));
  return snapshot.docs.map(productDoc => ({ id: productDoc.id, ...productDoc.data() } as Product));
};

export const getProductsByIds = async (ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const responses = await Promise.all(uniqueIds.map((id) => fetch(`/api/products/${encodeURIComponent(id)}`)));
  const products = await Promise.all(responses.map(async response => response.ok ? await response.json() as Product : null));
  return products.filter((product): product is Product => Boolean(product));
};

export const getProductBySlug = async (slug: string) => {
  const response = await fetch(`/api/products/${encodeURIComponent(slug)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('This product is temporarily unavailable.');
  return await response.json() as Product;
};
