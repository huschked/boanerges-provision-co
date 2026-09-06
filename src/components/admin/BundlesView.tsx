import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { Gift, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '@/src/lib/firebase';
import { resolveBundle, type BundleDefinition } from '@/src/lib/bundleCommerce';
import { isProductPublishReady } from '@/src/lib/productCatalog';
import type { Product } from '@/src/services/productService';
import { bundleTemplates } from '@/src/data/bundleTemplates';

type BundleRecord = BundleDefinition & { id: string; components: Array<{ productId: string; quantity: number }> };
const emptyForm: BundleRecord = { id: '', name: '', slug: '', description: '', sellingPrice: '', imageUrl: '', imageAlt: '', imageType: 'illustrative', stripeTaxCode: '', active: false, components: [] };
const text = (value: unknown) => typeof value === 'string' ? value : '';
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const firestoreWriteError = (error: unknown, action: string) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return `Firestore denied ${action}. Deploy firestore.rules to the boanerges-provision-co Firebase project, then try again.`;
  }

  return `${action} failed${code ? ` (${code})` : ''}. Check the browser console for details.`;
};

export const BundlesView: React.FC<{ products: Product[]; refreshRevision?: number }> = ({ products, refreshRevision = 0 }) => {
  const [bundles, setBundles] = useState<BundleRecord[]>([]);
  const [form, setForm] = useState<BundleRecord>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const productIds = useMemo(() => new Set(products.map(product => product.id)), [products]);
  const productMap = useMemo(() => new Map(products.filter(product => product.active && isProductPublishReady(product as unknown as Record<string, unknown>)).map(product => [product.id, product])), [products]);
  const staleComponents = useMemo(() => form.components.filter(component => !productIds.has(component.productId)), [form.components, productIds]);
  const preview = resolveBundle({ ...form, active: true }, productMap);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const snapshot = await getDocs(collection(db, 'bundles'));
      setBundles(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as BundleRecord)));
    } catch (error) { console.error(error); setLoadError('Bundle definitions could not be loaded. Existing results may be incomplete.'); toast.error('Unable to load bundle definitions.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [refreshRevision]);

  const update = (field: keyof BundleRecord, value: unknown) => setForm(current => ({ ...current, [field]: value }));
  const toggleProduct = (productId: string, checked: boolean) => update('components', checked ? [...form.components, { productId, quantity: 1 }] : form.components.filter(component => component.productId !== productId));
  const updateQuantity = (productId: string, quantity: number) => update('components', form.components.map(component => component.productId === productId ? { ...component, quantity } : component));
  const removeComponent = (productId: string) => setForm(current => ({ ...current, components: current.components.filter(component => component.productId !== productId) }));
  const replaceComponent = (staleProductId: string, replacementProductId: string) => {
    if (!replacementProductId) return;
    setForm(current => {
      const stale = current.components.find(component => component.productId === staleProductId);
      if (!stale) return current;
      const withoutStale = current.components.filter(component => component.productId !== staleProductId);
      const replacement = withoutStale.find(component => component.productId === replacementProductId);
      const components = replacement
        ? withoutStale.map(component => component.productId === replacementProductId ? { ...component, quantity: Math.min(20, component.quantity + stale.quantity) } : component)
        : [...withoutStale, { productId: replacementProductId, quantity: stale.quantity }];
      return { ...current, components };
    });
  };

  const save = async () => {
    const id = slugify(form.id || text(form.slug) || text(form.name));
    if (!id) return toast.error('Bundle name and id are required.');
    if (form.active === true && !preview.bundle) return toast.error(preview.error || 'Complete this bundle before activation.');
    try {
      await setDoc(doc(db, 'bundles', id), { name: text(form.name).trim(), slug: slugify(text(form.slug) || id), description: text(form.description).trim(), sellingPrice: Number(form.sellingPrice), imageUrl: text(form.imageUrl).trim(), imageAlt: text(form.imageAlt).trim(), imageType: form.imageType === 'photograph' ? 'photograph' : 'illustrative', stripeTaxCode: text(form.stripeTaxCode).trim(), active: form.active === true, components: form.components, updatedAt: Timestamp.now() }, { merge: true });
      toast.success('Bundle definition saved.'); setEditing(false); setForm(emptyForm); await load();
    } catch (error) { console.error(error); toast.error(firestoreWriteError(error, 'Saving the bundle')); }
  };

  const remove = async (bundle: BundleRecord) => {
    if (!window.confirm(`Delete ${text(bundle.name)}?`)) return;
    try {
      await deleteDoc(doc(db, 'bundles', bundle.id));
      toast.success('Bundle deleted.');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(firestoreWriteError(error, 'Deleting the bundle'));
    }
  };

  const createTemplates = async () => {
    try {
      let created = 0;
      const existingIds = new Set(bundles.map(bundle => bundle.id));
      for (const template of bundleTemplates) {
        if (existingIds.has(template.id)) continue;
        await setDoc(doc(db, 'bundles', template.id), { ...template, components: template.components.map(component => ({ ...component })), active: false, imageType: 'illustrative', stripeTaxCode: '', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
        created += 1;
      }
      toast.success(created ? `${created} inactive bundle template${created === 1 ? '' : 's'} created.` : 'All starter templates already exist.');
      await load();
    } catch (error) { console.error(error); toast.error(firestoreWriteError(error, 'Creating bundle templates')); }
  };

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-brand-gold" /></div>;
  return <div className="space-y-8">
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6"><div><h3 className="text-3xl font-serif text-brand-parchment">Bundle Commerce</h3><p className="mt-2 text-sm text-brand-parchment/45">Selling value, savings, and stock are recalculated from live component records.</p></div><div className="flex flex-wrap gap-3"><button onClick={() => void createTemplates()} className="px-5 py-3 border border-brand-gold/30 text-brand-gold text-[10px] uppercase tracking-widest font-black">Create Starter Templates</button><button onClick={() => { setForm(emptyForm); setEditing(true); }} className="btn-primary flex items-center gap-2"><Plus size={16} /> New Bundle</button></div></div>
    {loadError && <div role="alert" className="flex flex-col gap-4 border border-red-400/25 bg-red-400/10 p-5 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"><p>{loadError}</p><button type="button" onClick={() => void load()} className="min-h-11 shrink-0 border border-red-300/30 px-5 py-3 text-[10px] font-black uppercase tracking-widest">Retry</button></div>}
    {editing && <section className="card-premium p-6 lg:p-10 space-y-8 border-brand-gold/20">
      <div className="flex justify-between"><h4 className="text-2xl font-serif text-brand-parchment">{form.id ? 'Edit Bundle' : 'New Bundle'}</h4><button onClick={() => setEditing(false)}><X className="text-brand-parchment/40" /></button></div>
      <div className="grid md:grid-cols-2 gap-5"><input className="input-premium" placeholder="Bundle name" value={text(form.name)} onChange={event => { update('name', event.target.value); if (!form.id) update('slug', slugify(event.target.value)); }} /><input className="input-premium" placeholder="URL slug" value={text(form.slug)} onChange={event => update('slug', slugify(event.target.value))} /><textarea className="input-premium md:col-span-2" placeholder="Customer-facing description" value={text(form.description)} onChange={event => update('description', event.target.value)} /><input type="number" min="0.01" step="0.01" className="input-premium" placeholder="Selling price" value={String(form.sellingPrice || '')} onChange={event => update('sellingPrice', event.target.value)} /><input className="input-premium" placeholder="Stripe tax code (optional default override)" value={text(form.stripeTaxCode)} onChange={event => update('stripeTaxCode', event.target.value)} /><input className="input-premium md:col-span-2" placeholder="Bundle image URL" value={text(form.imageUrl)} onChange={event => update('imageUrl', event.target.value)} /><input className="input-premium" placeholder="Specific image description" value={text(form.imageAlt)} onChange={event => update('imageAlt', event.target.value)} /><select className="input-premium" value={text(form.imageType) || 'illustrative'} onChange={event => update('imageType', event.target.value)}><option value="illustrative">Illustrative</option><option value="photograph">Photograph</option></select></div>
      <div className="space-y-4"><p className="text-[10px] uppercase tracking-widest text-brand-gold font-black">Components and quantities</p>
        {staleComponents.length > 0 && <div className="border border-amber-400/30 bg-amber-400/[0.05] p-5 space-y-4">
          <div><p className="text-sm font-black text-amber-200">This bundle references products that no longer exist under their saved IDs.</p><p className="mt-1 text-xs text-brand-parchment/50">Replace each reference with a current product or remove it before saving.</p></div>
          {staleComponents.map(component => <div key={component.productId} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,1fr)_auto] md:items-center">
            <div><p className="text-sm text-brand-parchment">Missing product</p><code className="text-xs text-amber-300/80 break-all">{component.productId}</code><p className="text-xs text-brand-parchment/40">Quantity: {component.quantity}</p></div>
            <select aria-label={`Replacement for ${component.productId}`} className="input-premium" defaultValue="" onChange={event => replaceComponent(component.productId, event.target.value)}><option value="" disabled>Choose replacement product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} ({product.id})</option>)}</select>
            <button type="button" onClick={() => removeComponent(component.productId)} className="px-4 py-3 border border-red-400/25 text-red-300 text-xs flex items-center justify-center gap-2"><Trash2 size={13} /> Remove</button>
          </div>)}
        </div>}
        <div className="grid md:grid-cols-2 gap-3">{products.map(product => { const component = form.components.find(item => item.productId === product.id); return <label key={product.id} className="border border-white/10 p-4 flex items-center gap-4"><input type="checkbox" checked={Boolean(component)} onChange={event => toggleProduct(product.id, event.target.checked)} /><span className="flex-1 text-sm text-brand-parchment">{product.name}<small className="block text-brand-parchment/35">${product.price.toFixed(2)} · {product.sizeOz} oz · {product.currentInventory} on hand</small></span>{component && <input aria-label={`${product.name} quantity`} type="number" min="1" max="20" className="input-premium w-20 py-2" value={component.quantity} onChange={event => updateQuantity(product.id, Number(event.target.value))} />}</label>; })}</div>
      </div>
      <div className={`border p-5 ${preview.bundle ? 'border-green-400/20 text-green-200' : 'border-amber-400/25 text-amber-200'}`}>{preview.bundle ? <p>Component value ${preview.bundle.compareAtPrice.toFixed(2)} · Selling price ${preview.bundle.sellingPrice.toFixed(2)} · Save ${preview.bundle.savingsAmount.toFixed(2)} ({preview.bundle.savingsPercent}%) · {preview.bundle.availableStock} currently available</p> : <p>{preview.error}</p>}</div>
      <label className="flex items-center gap-3 text-sm text-brand-parchment/70"><input type="checkbox" checked={form.active === true} onChange={event => update('active', event.target.checked)} /> Active and available to customers when component stock permits</label>
      <button onClick={save} className="btn-primary">Save Bundle</button>
    </section>}
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{bundles.map(bundle => <article key={bundle.id} className="card-premium p-6 space-y-4"><div className="flex justify-between"><Gift className="text-brand-gold" /><span className={bundle.active ? 'text-green-300 text-xs' : 'text-brand-parchment/35 text-xs'}>{bundle.active ? 'ACTIVE' : 'DRAFT'}</span></div><div><h4 className="text-xl font-serif text-brand-parchment">{text(bundle.name)}</h4><p className="text-sm text-brand-parchment/45">{bundle.components?.length || 0} component products · ${Number(bundle.sellingPrice || 0).toFixed(2)}</p></div><div className="flex gap-3"><button onClick={() => { setForm(bundle); setEditing(true); }} className="px-4 py-2 border border-brand-gold/30 text-brand-gold text-xs flex gap-2"><Pencil size={13} /> Edit</button><button onClick={() => void remove(bundle)} className="px-4 py-2 border border-red-400/20 text-red-300 text-xs flex gap-2"><Trash2 size={13} /> Delete</button></div></article>)}</div>
  </div>;
};
