import { db, collection, getDocs, query, where, doc, getDoc } from '../lib/firebase';
import { isProductPublishReady } from '../lib/productCatalog';

export type ProductImageType = 'photograph' | 'illustrative';
export type ProductMediaRole = 'jar-front' | 'salt-detail' | 'label-detail' | 'in-use' | 'ingredient-art' | 'other';

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
  reorderThreshold: number;
  stripePriceId?: string;
  stripeTaxCode?: string;
  imageUrl: string;
  imageAlt?: string;
  imageType?: ProductImageType;
  gallery?: ProductMedia[];
  category?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const getProducts = async (category?: string) => {
  let q = query(collection(db, 'products'), where('active', '==', true));
  
  if (category && category !== 'All') {
    q = query(q, where('tags', 'array-contains', category));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Product))
    .filter((product) => isProductPublishReady(product as unknown as Record<string, unknown>));
};

export const getAllProducts = async () => {
  const snapshot = await getDocs(collection(db, 'products'));
  return snapshot.docs.map(productDoc => ({ id: productDoc.id, ...productDoc.data() } as Product));
};

export const getProductsByIds = async (ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const snapshots = await Promise.all(uniqueIds.map((id) => getDoc(doc(db, 'products', id))));
  return snapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as Product))
    .filter((product) => product.active && isProductPublishReady(product as unknown as Record<string, unknown>));
};

export const getProductBySlug = async (slug: string) => {
  const docRef = doc(db, 'products', slug);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    const product = { id: snapshot.id, ...snapshot.data() } as Product;
    return product.active && isProductPublishReady(product as unknown as Record<string, unknown>) ? product : null;
  }
  return null;
};
