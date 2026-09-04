import React, { useState } from 'react';
import { Filter, Plus, Edit, Trash2, X, Upload, Loader2, Package, Search, AlertTriangle, CheckCircle2, ArrowUp, ArrowDown, ImagePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, storage, doc, getDoc, setDoc, deleteDoc, Timestamp, ref, uploadBytes, getDownloadURL, deleteObject } from '@/src/lib/firebase';
import { cn } from '@/src/lib/utils';
import { Product, ProductMedia, ProductMediaRole } from '@/src/services/productService';
import { PRODUCT_DATA_VERSION, auditProductCatalog, getHeatLabel, validateProductForPublication } from '@/src/lib/productCatalog';
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
  imageAlt: string;
  imageType: 'photograph' | 'illustrative';
  imageRole: ProductMediaRole;
  galleryItems: ProductMedia[];
  tagsText: string;
  ingredientsText: string;
  allergenStatement: string;
  crossContactStatement: string;
  storageInstructions: string;
  shelfLife: string;
  dietaryClaimsText: string;
  dietaryClaimsApproved: boolean;
  productFactsApproved: boolean;
  flavorNotesText: string;
  pairingsText: string;
  stripePriceId: string;
  subscriptionEligible: boolean;
  subscriptionPriceMonthly: string;
  subscriptionPriceEveryTwoMonths: string;
  subscriptionPriceEveryThreeMonths: string;
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
  imageAlt: '',
  imageType: 'photograph',
  imageRole: 'jar-front',
  galleryItems: [],
  tagsText: 'Spicy',
  ingredientsText: '',
  allergenStatement: '',
  crossContactStatement: '',
  storageInstructions: '',
  shelfLife: '',
  dietaryClaimsText: '',
  dietaryClaimsApproved: false,
  productFactsApproved: false,
  flavorNotesText: '',
  pairingsText: '',
  stripePriceId: '',
  subscriptionEligible: false,
  subscriptionPriceMonthly: '',
  subscriptionPriceEveryTwoMonths: '',
  subscriptionPriceEveryThreeMonths: '',
  featured: false,
  active: false,
};

const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PRODUCT_GALLERY_IMAGES = 4;
const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const splitList = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const hydrateForm = (product: Product): ProductFormState => {
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  const primary = gallery[0];
  const galleryItems = primary?.url === product.imageUrl
    ? gallery.slice(1)
    : gallery.filter((item) => item.url !== product.imageUrl);

  return ({
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
  imageAlt: product.imageAlt || '',
  imageType: product.imageType || 'photograph',
  imageRole: primary?.role || (product.imageType === 'illustrative' ? 'ingredient-art' : 'jar-front'),
  galleryItems,
  tagsText: (product.tags || []).join(', '),
  ingredientsText: (product.ingredients || []).join(', '),
  allergenStatement: product.allergenStatement || '',
  crossContactStatement: product.crossContactStatement || '',
  storageInstructions: product.storageInstructions || '',
  shelfLife: product.shelfLife || '',
  dietaryClaimsText: (product.dietaryClaims || []).join(', '),
  dietaryClaimsApproved: product.dietaryClaimsApproved === true,
  productFactsApproved: product.productFactsApproved === true,
  flavorNotesText: (product.flavorNotes || []).join(', '),
  pairingsText: (product.pairings || []).join(', '),
  stripePriceId: product.stripePriceId || '',
  subscriptionEligible: product.subscriptionEligible === true,
  subscriptionPriceMonthly: product.subscriptionPriceIds?.monthly || '',
  subscriptionPriceEveryTwoMonths: product.subscriptionPriceIds?.every_two_months || '',
  subscriptionPriceEveryThreeMonths: product.subscriptionPriceIds?.every_three_months || '',
  featured: Boolean(product.featured),
  active: product.active !== false,
  });
};

const buildProductPayload = (formData: ProductFormState) => {
  const heatLevel = Number(formData.heatLevel);
  return {
    name: formData.name.trim(),
    slug: slugify(formData.slug || formData.name),
    category: formData.category,
    price: Number(formData.price),
    sizeOz: Number(formData.sizeOz),
    currentInventory: Number(formData.currentInventory),
    reorderThreshold: Number(formData.reorderThreshold),
    heatLevel,
    heatLabel: getHeatLabel(heatLevel),
    shortDescription: formData.shortDescription.trim(),
    imageUrl: formData.imageUrl.trim(),
    imageAlt: formData.imageAlt.trim(),
    imageType: formData.imageType,
    gallery: formData.imageUrl.trim() ? [
      { url: formData.imageUrl.trim(), alt: formData.imageAlt.trim(), type: formData.imageType, role: formData.imageRole },
      ...formData.galleryItems.map((item) => ({ ...item, url: item.url.trim(), alt: item.alt.trim() })),
    ] : [],
    tags: Array.from(new Set([...splitList(formData.tagsText), formData.category])),
    ingredients: splitList(formData.ingredientsText),
    allergenStatement: formData.allergenStatement.trim(),
    crossContactStatement: formData.crossContactStatement.trim(),
    storageInstructions: formData.storageInstructions.trim(),
    shelfLife: formData.shelfLife.trim(),
    dietaryClaims: splitList(formData.dietaryClaimsText),
    dietaryClaimsApproved: formData.dietaryClaimsApproved,
    productFactsApproved: formData.productFactsApproved,
    productDataVersion: PRODUCT_DATA_VERSION,
    flavorNotes: splitList(formData.flavorNotesText),
    pairings: splitList(formData.pairingsText),
    stripePriceId: formData.stripePriceId.trim(),
    subscriptionEligible: formData.subscriptionEligible,
    subscriptionPriceIds: {
      monthly: formData.subscriptionPriceMonthly.trim(),
      every_two_months: formData.subscriptionPriceEveryTwoMonths.trim(),
      every_three_months: formData.subscriptionPriceEveryThreeMonths.trim(),
    },
    featured: formData.featured,
    active: formData.active,
  };
};

export const ProductsView: React.FC<ProductsViewProps> = ({ products, onRefresh }) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<ProductFormState>(defaultFormState);
  const catalogAudit = auditProductCatalog(products as unknown as Array<Record<string, unknown> & { id?: string }>);
  const incompleteActiveProducts = catalogAudit.filter((result) => result.active && result.issues.length > 0);
  const publicationIssues = validateProductForPublication(buildProductPayload(formData));

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
      if (['sizeOz', 'heatLevel', 'ingredientsText', 'allergenStatement', 'crossContactStatement', 'storageInstructions', 'shelfLife'].includes(field)) {
        next.productFactsApproved = false;
      }
      if (field === 'dietaryClaimsText') {
        next.dietaryClaimsApproved = false;
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
      handleFieldChange('imageType', 'photograph');
      toast.success('Image uploaded.');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Unable to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (formData.galleryItems.length >= MAX_PRODUCT_GALLERY_IMAGES - 1) {
      toast.error(`A product gallery can contain up to ${MAX_PRODUCT_GALLERY_IMAGES} images including the primary image.`);
      e.target.value = '';
      return;
    }

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
      const storageRef = ref(storage, `products/gallery/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setFormData((current) => ({
        ...current,
        galleryItems: [...current.galleryItems, { url: downloadURL, alt: '', type: 'photograph', role: 'other' }],
      }));
      toast.success('Gallery image uploaded. Add its description and view type.');
    } catch (error) {
      console.error('Error uploading gallery image:', error);
      toast.error('Unable to upload gallery image.');
    } finally {
      e.target.value = '';
      setIsUploading(false);
    }
  };

  const addGalleryUrl = () => {
    if (formData.galleryItems.length >= MAX_PRODUCT_GALLERY_IMAGES - 1) {
      toast.error(`A product gallery can contain up to ${MAX_PRODUCT_GALLERY_IMAGES} images including the primary image.`);
      return;
    }
    setFormData((current) => ({
      ...current,
      galleryItems: [...current.galleryItems, { url: '', alt: '', type: 'photograph', role: 'other' }],
    }));
  };

  const updateGalleryItem = (index: number, field: keyof ProductMedia, value: string) => {
    setFormData((current) => ({
      ...current,
      galleryItems: current.galleryItems.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } as ProductMedia : item),
    }));
  };

  const moveGalleryItem = (index: number, direction: -1 | 1) => {
    setFormData((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.galleryItems.length) return current;
      const galleryItems = [...current.galleryItems];
      [galleryItems[index], galleryItems[nextIndex]] = [galleryItems[nextIndex], galleryItems[index]];
      return { ...current, galleryItems };
    });
  };

  const removeGalleryItem = (index: number) => {
    setFormData((current) => ({
      ...current,
      galleryItems: current.galleryItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSave = async () => {
    const slug = slugify(formData.slug || formData.name);

    if (!formData.name.trim()) return toast.error('Product name is required.');
    if (!slug) return toast.error('A valid slug is required.');
    if (formData.subscriptionEligible && ![formData.subscriptionPriceMonthly, formData.subscriptionPriceEveryTwoMonths, formData.subscriptionPriceEveryThreeMonths].some(value => value.trim().startsWith('price_'))) return toast.error('Add at least one recurring Stripe Price ID before enabling Subscribe & Save.');
    const productPayload = { ...buildProductPayload(formData), slug, updatedAt: Timestamp.now() };
    const issues = validateProductForPublication(productPayload);
    if (formData.active && issues.length > 0) {
      return toast.error(`Cannot activate this product: ${issues[0].message} (${issues.length} required item${issues.length === 1 ? '' : 's'} remaining.)`);
    }

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
      <div className={cn('border p-6 flex flex-col lg:flex-row lg:items-start justify-between gap-4', incompleteActiveProducts.length ? 'border-amber-400/30 bg-amber-400/[0.06]' : 'border-green-400/20 bg-green-400/[0.04]')}>
        <div className="flex items-start gap-3">
          {incompleteActiveProducts.length ? <AlertTriangle size={20} className="text-amber-300 mt-0.5 shrink-0" /> : <CheckCircle2 size={20} className="text-green-300 mt-0.5 shrink-0" />}
          <div>
            <p className="text-sm font-black text-brand-parchment">Catalog publication report</p>
            <p className="mt-1 text-sm text-brand-parchment/60">
              {incompleteActiveProducts.length
                ? `${incompleteActiveProducts.length} active product${incompleteActiveProducts.length === 1 ? '' : 's'} will be hidden from sale until required facts are completed.`
                : 'Every active product has the required approved facts.'}
            </p>
          </div>
        </div>
        {incompleteActiveProducts.length > 0 && (
          <ul className="text-xs text-amber-100/75 space-y-2 lg:max-w-xl">
            {incompleteActiveProducts.map((result) => (
              <li key={result.id}><strong>{result.name}:</strong> {result.issues.map((issue) => issue.label).join(', ')}</li>
            ))}
          </ul>
        )}
      </div>
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

                <div className="border border-brand-gold/20 bg-brand-gold/[0.03] p-6 space-y-5">
                  <label className="flex items-start gap-3 text-sm text-brand-parchment/75">
                    <input type="checkbox" checked={formData.subscriptionEligible} onChange={(e) => handleFieldChange('subscriptionEligible', e.target.checked)} className="mt-1 accent-brand-gold" />
                    <span><strong className="block text-brand-parchment">Eligible for Subscribe &amp; Save</strong><small className="text-brand-parchment/40">Only enable after at least one active recurring Stripe Price ID is configured.</small></span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      ['Every month', 'subscriptionPriceMonthly'],
                      ['Every 2 months', 'subscriptionPriceEveryTwoMonths'],
                      ['Every 3 months', 'subscriptionPriceEveryThreeMonths'],
                    ].map(([label, field]) => <label key={field} className="space-y-2"><span className="block text-[10px] uppercase tracking-widest text-brand-parchment/40 font-black">{label} Stripe Price ID</span><input value={formData[field as keyof ProductFormState] as string} onChange={(e) => handleFieldChange(field as keyof ProductFormState, e.target.value)} placeholder="price_..." className="input-premium block w-full" /></label>)}
                  </div>
                </div>

                <div className="border border-brand-gold/20 bg-brand-gold/[0.04] p-6 space-y-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-brand-gold">Required product facts</p>
                    <p className="mt-2 text-xs leading-relaxed text-brand-parchment/45">Use approved label and production information. Marketing notes below remain optional.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="space-y-3">
                      <span className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/40">Allergen Statement</span>
                      <textarea rows={3} value={formData.allergenStatement} onChange={(e) => handleFieldChange('allergenStatement', e.target.value)} className="input-premium block w-full resize-none" placeholder="Enter the approved statement; do not assume none" />
                    </label>
                    <label className="space-y-3">
                      <span className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/40">Cross-contact Statement</span>
                      <textarea rows={3} value={formData.crossContactStatement} onChange={(e) => handleFieldChange('crossContactStatement', e.target.value)} className="input-premium block w-full resize-none" placeholder="Enter the approved facility statement" />
                    </label>
                    <label className="space-y-3">
                      <span className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/40">Storage Guidance</span>
                      <textarea rows={3} value={formData.storageInstructions} onChange={(e) => handleFieldChange('storageInstructions', e.target.value)} className="input-premium block w-full resize-none" placeholder="Enter approved storage instructions" />
                    </label>
                    <label className="space-y-3">
                      <span className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/40">Shelf Life</span>
                      <textarea rows={3} value={formData.shelfLife} onChange={(e) => handleFieldChange('shelfLife', e.target.value)} className="input-premium block w-full resize-none" placeholder="Enter approved shelf-life guidance" />
                    </label>
                  </div>
                  <label className="space-y-3 block">
                    <span className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/40">Dietary Claims</span>
                    <textarea rows={2} value={formData.dietaryClaimsText} onChange={(e) => handleFieldChange('dietaryClaimsText', e.target.value)} className="input-premium block w-full resize-none" placeholder="Gluten-Free, Vegan — leave blank if making no claims" />
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-start gap-3 text-xs text-brand-parchment/65 leading-relaxed">
                      <input type="checkbox" checked={formData.productFactsApproved} onChange={(e) => handleFieldChange('productFactsApproved', e.target.checked)} className="mt-1 accent-brand-gold" />
                      I confirm the net weight, heat, ingredients, allergen, cross-contact, storage, and shelf-life facts are approved.
                    </label>
                    <label className="flex items-start gap-3 text-xs text-brand-parchment/65 leading-relaxed">
                      <input type="checkbox" checked={formData.dietaryClaimsApproved} onChange={(e) => handleFieldChange('dietaryClaimsApproved', e.target.checked)} className="mt-1 accent-brand-gold" />
                      I confirm the dietary claims are approved, including when no dietary claims are listed.
                    </label>
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
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_150px_150px] gap-4">
                    <input value={formData.imageAlt} onChange={(e) => handleFieldChange('imageAlt', e.target.value)} className="input-premium block w-full text-[11px]" placeholder="Describe the exact product and view" />
                    <select value={formData.imageType} onChange={(e) => handleFieldChange('imageType', e.target.value as ProductFormState['imageType'])} className="input-premium block w-full appearance-none">
                      <option value="photograph">Photograph</option>
                      <option value="illustrative">Illustrative</option>
                    </select>
                    <select value={formData.imageRole} onChange={(e) => handleFieldChange('imageRole', e.target.value as ProductMediaRole)} className="input-premium block w-full appearance-none" aria-label="Primary image view">
                      <option value="jar-front">Jar front</option>
                      <option value="salt-detail">Salt detail</option>
                      <option value="label-detail">Label detail</option>
                      <option value="in-use">Product in use</option>
                      <option value="ingredient-art">Ingredient art</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="aspect-square rounded-sm border border-white/10 overflow-hidden bg-white/5 relative">
                    {formData.imageUrl ? (
                      <><img src={formData.imageUrl} alt={formData.imageAlt || 'Product media preview'} className="w-full h-full object-cover" />{formData.imageType === 'illustrative' && <span className="absolute bottom-3 left-3 bg-brand-black/80 text-brand-parchment px-3 py-1 text-[8px] uppercase tracking-widest font-black">Illustrative image</span>}</>
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
                <div className={cn('p-6 border text-xs leading-relaxed', publicationIssues.length ? 'border-amber-400/25 bg-amber-400/[0.05] text-amber-100/70' : 'border-green-400/20 bg-green-400/[0.04] text-green-100/70')}>
                  <p className="font-black text-brand-parchment mb-2">{publicationIssues.length ? `${publicationIssues.length} required item${publicationIssues.length === 1 ? '' : 's'} remaining` : 'Ready to activate'}</p>
                  {publicationIssues.length > 0 && <ul className="list-disc pl-4 space-y-1">{publicationIssues.map((issue) => <li key={issue.field}>{issue.label}: {issue.message}</li>)}</ul>}
                  </div>
                </div>

                <div className="col-span-full border-t border-white/10 pt-8 space-y-5 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                    <div className="max-w-xl">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-black text-brand-gold">Additional gallery images</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-brand-parchment/35">Shown after the primary image in this exact order. Each image needs a specific description and view type.</p>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                      <label className="cursor-pointer text-[9px] uppercase tracking-widest font-black text-brand-gold/60 hover:text-brand-gold flex items-center gap-2">
                        <input type="file" className="hidden" accept={ALLOWED_PRODUCT_IMAGE_TYPES.join(',')} onChange={handleGalleryUpload} disabled={isUploading || formData.galleryItems.length >= MAX_PRODUCT_GALLERY_IMAGES - 1} />
                        {isUploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                        Upload
                      </label>
                      <button type="button" onClick={addGalleryUrl} className="text-[9px] uppercase tracking-widest font-black text-brand-gold/60 hover:text-brand-gold flex items-center gap-2">
                        <Plus size={12} /> Add URL
                      </button>
                    </div>
                  </div>

                  {formData.galleryItems.length === 0 ? (
                    <div className="border border-dashed border-white/10 px-6 py-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 text-brand-parchment/30">
                      <ImagePlus size={24} strokeWidth={1.5} className="shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] font-black text-brand-parchment/45">No additional views yet</p>
                        <p className="mt-1 text-[11px] leading-relaxed">Add jar, salt-texture, label, or product-in-use photography when available.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formData.galleryItems.map((item, index) => (
                        <div key={`${item.url}-${index}`} className="border border-white/10 bg-white/[0.02] p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 shrink-0 border border-white/10 bg-white/5 overflow-hidden">
                              {item.url ? <img src={item.url} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="m-5 text-brand-parchment/15" size={24} />}
                            </div>
                            <input value={item.url} onChange={(e) => updateGalleryItem(index, 'url', e.target.value)} className="input-premium min-w-0 flex-1 text-[10px]" placeholder="https://..." />
                            <div className="flex gap-1">
                              <button type="button" onClick={() => moveGalleryItem(index, -1)} disabled={index === 0} className="p-2 text-brand-parchment/40 hover:text-brand-gold disabled:opacity-20" aria-label="Move image earlier"><ArrowUp size={15} /></button>
                              <button type="button" onClick={() => moveGalleryItem(index, 1)} disabled={index === formData.galleryItems.length - 1} className="p-2 text-brand-parchment/40 hover:text-brand-gold disabled:opacity-20" aria-label="Move image later"><ArrowDown size={15} /></button>
                              <button type="button" onClick={() => removeGalleryItem(index)} className="p-2 text-red-300/50 hover:text-red-300" aria-label="Remove image"><Trash2 size={15} /></button>
                            </div>
                          </div>
                          <input value={item.alt} onChange={(e) => updateGalleryItem(index, 'alt', e.target.value)} className="input-premium block w-full text-[10px]" placeholder="Specific image description, such as jar back label with ingredient panel" />
                          <div className="grid grid-cols-2 gap-3">
                            <select value={item.type} onChange={(e) => updateGalleryItem(index, 'type', e.target.value)} className="input-premium block w-full appearance-none text-[10px]">
                              <option value="photograph">Photograph</option>
                              <option value="illustrative">Illustrative</option>
                            </select>
                            <select value={item.role} onChange={(e) => updateGalleryItem(index, 'role', e.target.value)} className="input-premium block w-full appearance-none text-[10px]">
                              <option value="jar-front">Jar front</option>
                              <option value="salt-detail">Salt detail</option>
                              <option value="label-detail">Label detail</option>
                              <option value="in-use">Product in use</option>
                              <option value="ingredient-art">Ingredient art</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                  <div className="flex flex-col items-start gap-2">
                    <span className={cn('px-4 py-1.5 rounded-full text-[8px] uppercase tracking-[0.2em] font-black border', product.active ? 'bg-green-400/5 text-green-400 border-green-400/10' : 'bg-white/5 text-brand-parchment/40 border-white/10')}>
                      {product.active ? 'Active' : 'Hidden'}
                    </span>
                    {validateProductForPublication(product as unknown as Record<string, unknown>).length > 0 ? (
                      <span className="text-[8px] uppercase tracking-widest font-black text-amber-300" title={validateProductForPublication(product as unknown as Record<string, unknown>).map((issue) => issue.message).join(' ')}>Needs facts</span>
                    ) : (
                      <span className="text-[8px] uppercase tracking-widest font-black text-green-300">Publish ready</span>
                    )}
                  </div>
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
