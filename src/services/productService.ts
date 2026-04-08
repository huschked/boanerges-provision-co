import { db, collection, getDocs, query, where, doc, getDoc } from '../lib/firebase';

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
  active: boolean;
  featured: boolean;
  currentInventory: number;
  reorderThreshold: number;
  stripePriceId?: string;
  imageUrl: string;
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
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
};

export const getProductBySlug = async (slug: string) => {
  const docRef = doc(db, 'products', slug);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Product;
  }
  return null;
};
