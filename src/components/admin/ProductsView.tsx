import React, { useState } from 'react';
import { Filter, Plus, Edit, Trash2, X, Upload, Loader2, Package, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, storage, doc, getDoc, setDoc, deleteDoc, Timestamp, ref, uploadBytes, getDownloadURL, deleteObject } from '@/src/lib/firebase';
import { cn } from '@/src/lib/utils';
import { Product } from '@/src/services/productService';
import toast from 'react-hot-toast';

interface ProductsViewProps {
  products: Product[];
  onRefresh: () => void;
}

type ProductFormState = {
  name: string;
  slug: string;
  category: string;
  price: string;
  sizeOz: string;
  currentInventory: string;
  reorderThreshold: string;
  heatLevel: string;
  shortDescription: string;
  imageUrl: string;
  tagsText: string;
  ingredientsText: string;
  flavorNotesText: string;
  pairingsText: string;
  stripePriceId: string;
  featured: boolean;
  active: boolean;
};

const defaultFormState: ProductFormState = {
  name: '',
  slug: '',
  category: 'Spicy',
  price: '0',
  sizeOz: '4',
  currentInventory: '0',
  reorderThreshold: '10',
  heatLevel: '0',
  shortDescription: '',
  imageUrl: '',
  tagsText: 'Spicy',
  ingredientsText: '',
  flavorNotesText: '',
  pairingsText: '',
  stripePriceId: '',
  featured: false,
  active: true,
};

const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const splitList = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const hydrateForm = (product: Product): ProductFormState => ({
  name: product.name,
  slug: product.slug || product.id,
  category: product.category || 'Spicy',
  price: String(product.price ?? 0),
  sizeOz: String(product.sizeOz ?? 4),
  currentInventory: String(product.currentInventory ?? 0),
  reorderThreshold: String(product.reorderThreshold ?? 10),
  heatLevel: String(product.heatLevel ?? 0),
  shortDescription: product.shortDescription || '',
  imageUrl: product.imageUrl || '',
  tagsText: (product.tags || []).join(', '),
  ingredientsText: (product.ingredients || []).join(', '),
  flavorNotesText: (product.flavorNotes || []).join(', '),
  pairingsText: (product.pairings || []).join(', '),
  stripePriceId: product.stripePriceId || '',
  featured: Boolean(product.featured),
  active: product.active !== false,
});

export const ProductsView: React.FC<ProductsViewProps> = ({ products, onRefresh }) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<ProductFormState>(defaultFormState);

  const filteredProducts = products.filter((product) => {
    const lowStockThreshold = product.reorderThreshold || 10;
    const matchesInventory = !showLowStockOnly || product.currentInventory < lowStockThreshold;
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      product.name.toLowerCase().includes(query) ||
      (product.category || '').toLowerCase().includes(query) ||
      product.slug.toLowerCase().includes(query);

    return matchesInventory && matchesSearch;
  });

  const closeEditor = () => {
    setEditingId(null);
    setFormData(defaultFormState);
    setIsEditorOpen(false);
  };

  const handleFieldChange = (field: keyof ProductFormState, value: string | boolean) => {
    setFormData((current) => {
      const next = { ...current, [field]: value } as ProductFormState;
      if (field === 'name' && !editingId) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
      toast.error('Upload a PNG, JPEG, or WebP image.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
      toast.error('Product images must be 5 MB or smaller.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      handleFieldChange('imageUrl', downloadURL);
      toast.success('Image uploaded.');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Unable to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    const slug = slugify(formData.slug || formData.name);

    if (!formData.name.trim()) return toast.error('Product name is required.');
    if (!slug) return toast.error('A valid slug is required.');
    if (!formData.shortDescription.trim()) return toast.error('Short description is required.');
    if (!formData.imageUrl.trim()) return toast.error('Product image is required.');

    const productPayload = {
      name: formData.name.trim(),
      slug,
      category: formData.category,
      price: Number(formData.price) || 0,
      sizeOz: Number(formData.sizeOz) || 0,
      currentInventory: Number(formData.currentInventory) || 0,
      reorderThreshold: Number(formData.reorderThreshold) || 0,
      heatLevel: Number(formData.heatLevel) || 0,
      shortDescription: formData.shortDescription.trim(),
      imageUrl: formData.imageUrl.trim(),
      tags: Array.from(new Set([...splitList(formData.tagsText), formData.category])),
      ingredients: splitList(formData.ingredientsText),
      flavorNotes: splitList(formData.flavorNotesText),
      pairings: splitList(formData.pairingsText),
      stripePriceId: formData.stripePriceId.trim(),
      featured: formData.featured,
      active: formData.active,
      updatedAt: Timestamp.now(),
    };

    setIsSaving(true);
    try {
      if (editingId) {
        if (editingId === slug) {
          await setDoc(doc(db, 'products', editingId), productPayload, { merge: true });
        } else {
          const nextDocRef = doc(db, 'products', slug);
          const existingSlugDoc = await getDoc(nextDocRef);
          if (existingSlugDoc.exists()) {
            setIsSaving(false);
            return toast.error('That slug is already in use by another product.');
          }

          const originalProduct = products.find((product) => product.id === editingId);
          await setDoc(nextDocRef, { ...productPayload, createdAt: originalProduct?.createdAt || Timestamp.now() });
          await deleteDoc(doc(db, 'products', editingId));
        }
        toast.success('Product updated.');
      } else {
        const newDocRef = doc(db, 'products', slug);
        const existingProduct = await getDoc(newDocRef);
        if (existingProduct.exists()) {
          setIsSaving(false);
          return toast.error('That slug is already in use by another product.');
        }

        await setDoc(newDocRef, { ...productPayload, createdAt: Timestamp.now() });
        toast.success('Product created.');
      }

      closeEditor();
      onRefresh();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Unable to save product.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;

    try {
      if (product.imageUrl && product.imageUrl.includes('firebasestorage')) {
        try {
          await deleteObject(ref(storage, product.imageUrl));
        } catch (imageError) {
          console.error('Error deleting image from storage:', imageError);
        }
      }

      await deleteDoc(doc(db, 'products', product.id));
      toast.success('Product deleted.');
      onRefresh();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Unable to delete product.');
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-parchment/20" size={14} />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search provisions..." className="bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-5 text-[11px] uppercase tracking-[0.2em] text-brand-parchment w-full md:w-72" />
          </div>
          <button onClick={() => setShowLowStockOnly((current) => !current)} className={cn('px-6 py-2.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-black transition-all flex items-center gap-3 group border', showLowStockOnly ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/30' : 'bg-white/5 border-white/10 text-brand-parchment/60 hover:text-brand-gold hover:border-brand-gold/30')}>
            <Filter size={14} className="group-hover:rotate-180 transition-transform duration-500" />
            {showLowStockOnly ? 'Showing Low Stock' : 'Filter Inventory'}
          </button>
        </div>
        <button onClick={() => { setEditingId(null); setFormData(defaultFormState); setIsEditorOpen(true); }} className="btn-primary flex items-center gap-3 self-start lg:self-auto">
          <Plus size={18} strokeWidth={3} />
          Add New Provision
        </button>
      </div>

      <AnimatePresence>
        {isEditorOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="card-premium p-12 overflow-hidden border-brand-gold/20 bg-brand-charcoal/40 backdrop-blur-2xl">
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-1">
                <h3 className="text-3xl font-serif text-brand-parchment">{editingId ? 'Edit Provision' : 'New Provision'}</h3>
                <p className="text-[9px] uppercase tracking-[0.3em] text-brand-gold/40 font-black">Catalog management</p>
              </div>
              <button onClick={closeEditor} className="p-2 text-brand-parchment/20 hover:text-brand-gold transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-7 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Product Name</label>
                    <input value={formData.name} onChange={(e) => handleFieldChange('name', e.target.value)} className="input-premium block w-full" />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Slug</label>
                    <input value={formData.slug} onChange={(e) => handleFieldChange('slug', slugify(e.target.value))} className="input-premium block w-full" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Category</label>
                    <select value={formData.category} onChange={(e) => handleFieldChange('category', e.target.value)} className="input-premium block w-full appearance-none">
                      <option value="Spicy">Spicy</option>
                      <option value="Savory">Savory</option>
                      <option value="Herbal">Herbal</option>
                      <option value="Citrus">Citrus</option>
                      <option value="Bundles">Bundles</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Stripe Price ID (Unused)</label>
                    <input value={formData.stripePriceId} onChange={(e) => handleFieldChange('stripePriceId', e.target.value)} className="input-premium block w-full" />
                    <p className="text-[10px] leading-relaxed text-brand-parchment/35">
                      Checkout uses Firestore pricing. Keep this blank unless a future Stripe catalog sync is added.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Short Description</label>
                  <textarea rows={3} value={formData.shortDescription} onChange={(e) => handleFieldChange('shortDescription', e.target.value)} className="input-premium block w-full resize-none leading-relaxed" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  {[
                    { label: 'Price ($)', field: 'price', step: '0.01' },
                    { label: 'Size (oz)', field: 'sizeOz', step: '1' },
                    { label: 'Inventory', field: 'currentInventory', step: '1' },
                    { label: 'Reorder At', field: 'reorderThreshold', step: '1' },
                    { label: 'Heat (0-5)', field: 'heatLevel', step: '1' },
                  ].map(({ label, field, step }) => (
                    <div key={field} className="space-y-3">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">{label}</label>
                      <input type="number" step={step} value={formData[field as keyof ProductFormState] as string} onChange={(e) => handleFieldChange(field as keyof ProductFormState, e.target.value)} className="input-premium block w-full" />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Tags</label>
                    <textarea rows={3} value={formData.tagsText} onChange={(e) => handleFieldChange('tagsText', e.target.value)} className="input-premium block w-full resize-none" placeholder="Spicy, Citrus, Best Sellers" />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Ingredients</label>
                    <textarea rows={3} value={formData.ingredientsText} onChange={(e) => handleFieldChange('ingredientsText', e.target.value)} className="input-premium block w-full resize-none" placeholder="Sea salt, habanero, lime zest" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Flavor Notes</label>
                    <textarea rows={3} value={formData.flavorNotesText} onChange={(e) => handleFieldChange('flavorNotesText', e.target.value)} className="input-premium block w-full resize-none" placeholder="Bright, smoky, earthy" />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Pairings</label>
                    <textarea rows={3} value={formData.pairingsText} onChange={(e) => handleFieldChange('pairingsText', e.target.value)} className="input-premium block w-full resize-none" placeholder="Steak, eggs, roasted potatoes" />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Product Image</label>
                    <label className="cursor-pointer group/upload">
                      <input type="file" className="hidden" accept={ALLOWED_PRODUCT_IMAGE_TYPES.join(',')} onChange={handleImageUpload} disabled={isUploading} />
                      <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-black text-brand-gold/60 group-hover/upload:text-brand-gold transition-colors">
                        {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        {isUploading ? 'Uploading...' : 'Upload Image'}
                      </div>
                    </label>
                  </div>
                  <input value={formData.imageUrl} onChange={(e) => handleFieldChange('imageUrl', e.target.value)} className="input-premium block w-full text-[11px]" placeholder="https://..." />
                  <div className="aspect-square rounded-sm border border-white/10 overflow-hidden bg-white/5 relative">
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-brand-parchment/10 space-y-4">
                        <Package size={48} strokeWidth={1} />
                        <p className="text-[9px] uppercase tracking-widest font-black">Image Preview</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-8 rounded-sm bg-white/[0.02] border border-white/5 space-y-6">
                  {[
                    { label: 'Featured Product', description: 'Homepage merchandising emphasis', field: 'featured' },
                    { label: 'Active Product', description: 'Visible in storefront listings', field: 'active' },
                  ].map(({ label, description, field }) => (
                    <div key={field} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/60">{label}</label>
                        <p className="text-[8px] text-brand-parchment/20 uppercase tracking-widest font-black">{description}</p>
                      </div>
                      <button onClick={() => handleFieldChange(field as keyof ProductFormState, !formData[field as keyof ProductFormState])} className={cn('w-12 h-6 rounded-full transition-all duration-500 relative', formData[field as keyof ProductFormState] ? 'bg-brand-gold' : 'bg-white/10')}>
                        <motion.div animate={{ x: formData[field as keyof ProductFormState] ? 24 : 4 }} className={cn('absolute top-1 w-4 h-4 rounded-full shadow-sm', formData[field as keyof ProductFormState] ? 'bg-brand-black' : 'bg-brand-parchment/40')} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-6 mt-12 pt-10 border-t border-white/5">
              <button onClick={closeEditor} className="px-8 py-3 text-[10px] uppercase tracking-[0.3em] font-black text-brand-parchment/40 hover:text-brand-parchment transition-colors">
                Discard Changes
              </button>
              <button onClick={handleSave} disabled={isSaving || isUploading} className="btn-primary px-12 disabled:opacity-50">
                {isSaving ? 'Saving...' : editingId ? 'Update Provision' : 'Publish Provision'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card-premium overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.01]">
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Provision</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black text-center">Category</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Price</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Inventory</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black">Visibility</th>
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-white/[0.02] transition-all group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-6">
                    <img src={product.imageUrl} className="w-16 h-16 object-cover rounded-sm border border-white/10" alt={product.name} />
                    <div>
                      <p className="text-base text-brand-parchment font-black group-hover:text-brand-gold transition-colors duration-500">{product.name}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <p className="text-[9px] text-brand-parchment/30 uppercase tracking-[0.2em] font-bold">{product.sizeOz}oz Jar</p>
                        <span className="text-[9px] text-brand-parchment/20 uppercase tracking-[0.2em] font-bold">{product.slug}</span>
                        {product.featured && <p className="text-[8px] text-brand-gold uppercase tracking-widest font-black">Featured</p>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-8 text-center">
                  <span className="px-5 py-2 rounded-full bg-brand-gold/5 text-brand-gold text-[8px] uppercase tracking-[0.2em] font-black border border-brand-gold/10">{product.category || 'Uncategorized'}</span>
                </td>
                <td className="px-10 py-8">
                  <span className="text-base text-brand-parchment font-black tracking-tighter">${product.price.toFixed(2)}</span>
                </td>
                <td className="px-10 py-8">
                  <div className="flex items-center gap-4">
                    <div className={cn('w-1.5 h-1.5 rounded-full', product.currentInventory < (product.reorderThreshold || 10) ? 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)] animate-pulse' : 'bg-green-400/40')} />
                    <span className={cn('text-lg font-serif', product.currentInventory < (product.reorderThreshold || 10) ? 'text-red-400' : 'text-brand-parchment/60')}>{product.currentInventory}</span>
                  </div>
                </td>
                <td className="px-10 py-8">
                  <span className={cn('px-4 py-1.5 rounded-full text-[8px] uppercase tracking-[0.2em] font-black border', product.active ? 'bg-green-400/5 text-green-400 border-green-400/10' : 'bg-white/5 text-brand-parchment/40 border-white/10')}>
                    {product.active ? 'Active' : 'Hidden'}
                  </span>
                </td>
                <td className="px-10 py-8 text-right">
                  <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <button onClick={() => { setEditingId(product.id); setFormData(hydrateForm(product)); setIsEditorOpen(true); }} className="p-3 rounded-full bg-white/5 text-brand-parchment/30 hover:text-brand-gold hover:bg-brand-gold/10 transition-all duration-500" title="Edit Provision">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(product)} className="p-3 rounded-full bg-white/5 text-brand-parchment/30 hover:text-red-400 hover:bg-red-400/10 transition-all duration-500" title="Delete Provision">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-10 py-20 text-center text-brand-parchment/30 text-sm">
                  No products match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
