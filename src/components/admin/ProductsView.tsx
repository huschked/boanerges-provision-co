import React, { useState } from 'react';
import { Filter, Plus, Edit, Trash2, X, Upload, Loader2, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, storage, doc, collection, addDoc, updateDoc, deleteDoc, Timestamp, ref, uploadBytes, getDownloadURL, deleteObject } from '@/src/lib/firebase';
import { cn } from '@/src/lib/utils';
import { Product } from '@/src/services/productService';

interface ProductsViewProps {
  products: Product[];
  onRefresh: () => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ products, onRefresh }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    price: 0,
    currentInventory: 0,
    category: 'Spicy',
    sizeOz: 4,
    shortDescription: '',
    featured: false,
    active: true,
    tags: ['Spicy']
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      const updatedTags = Array.from(new Set([...(formData.tags || []), formData.category as string]));
      const finalData = { ...formData, tags: updatedTags };

      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), finalData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...finalData,
          slug: formData.name?.toLowerCase().replace(/ /g, '-'),
          createdAt: Timestamp.now(),
          active: true
        });
      }
      setIsAdding(false);
      setEditingId(null);
      onRefresh();
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const handleDelete = async (product: Product) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        // Delete image from storage if it exists and is from firebase
        if (product.imageUrl && product.imageUrl.includes('firebasestorage')) {
            try {
                const imageRef = ref(storage, product.imageUrl);
                await deleteObject(imageRef);
            } catch (e) {
                console.error("Error deleting image from storage:", e);
                // Continue with product deletion even if image delete fails
            }
        }
        await deleteDoc(doc(db, 'products', product.id));
        onRefresh();
      } catch (error) {
        console.error("Error deleting product:", error);
      }
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <button className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/60 hover:text-brand-gold hover:border-brand-gold/30 transition-all flex items-center gap-3 group">
            <Filter size={14} className="group-hover:rotate-180 transition-transform duration-500" /> 
            Filter Inventory
          </button>
        </div>
        <button 
          onClick={() => {
            setFormData({
              name: '',
              price: 0,
              currentInventory: 0,
              category: 'Spicy',
              sizeOz: 4,
              shortDescription: '',
              imageUrl: '',
              featured: false,
              active: true,
              tags: ['Spicy']
            });
            setIsAdding(true);
          }}
          className="btn-primary flex items-center gap-3"
        >
          <Plus size={18} strokeWidth={3} /> 
          Add New Provision
        </button>
      </div>

      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card-premium p-12 overflow-hidden border-brand-gold/20 bg-brand-charcoal/40 backdrop-blur-2xl"
          >
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-1">
                <h3 className="text-3xl font-serif text-brand-parchment">{editingId ? 'Edit Provision' : 'New Provision'}</h3>
                <p className="text-[9px] uppercase tracking-[0.3em] text-brand-gold/40 font-black">Refine your artisanal catalog</p>
              </div>
              <button 
                onClick={() => { setIsAdding(false); setEditingId(null); }}
                className="p-2 text-brand-parchment/20 hover:text-brand-gold transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-7 space-y-8">
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Product Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Smoked Bourbon Honey"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="input-premium block w-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Category</label>
                    <div className="relative">
                      <select 
                        value={formData.category || 'Spicy'}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="input-premium block w-full appearance-none pr-10"
                      >
                        <option value="Spicy">Spicy</option>
                        <option value="Savory">Savory</option>
                        <option value="Herbal">Herbal</option>
                        <option value="Citrus">Citrus</option>
                        <option value="Bundles">Bundles</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-gold/40">
                        <Filter size={12} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Size (oz)</label>
                    <input 
                      type="number" 
                      value={formData.sizeOz}
                      onChange={e => setFormData({...formData, sizeOz: parseInt(e.target.value)})}
                      className="input-premium block w-full"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Short Description</label>
                  <textarea 
                    rows={4}
                    placeholder="A brief, evocative description for the catalog..."
                    value={formData.shortDescription}
                    onChange={e => setFormData({...formData, shortDescription: e.target.value})}
                    className="input-premium block w-full resize-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Price ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                      className="input-premium block w-full"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Stock Level</label>
                    <input 
                      type="number" 
                      value={formData.currentInventory}
                      onChange={e => setFormData({...formData, currentInventory: parseInt(e.target.value)})}
                      className="input-premium block w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/30">Product Image</label>
                    <label className="cursor-pointer group/upload">
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                      <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-black text-brand-gold/60 group-hover/upload:text-brand-gold transition-colors">
                        {isUploading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Upload size={12} />
                        )}
                        {isUploading ? 'Uploading...' : 'Upload Image'}
                      </div>
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Or paste Image URL (https://...)"
                      value={formData.imageUrl}
                      onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                      className="input-premium block w-full text-[11px]"
                    />
                  </div>

                  <div className="aspect-square rounded-sm border border-white/10 overflow-hidden bg-white/5 relative group/preview">
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover/preview:scale-110" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-brand-parchment/10 space-y-4">
                        <Package size={48} strokeWidth={1} />
                        <p className="text-[9px] uppercase tracking-widest font-black">Image Preview</p>
                      </div>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 size={24} className="animate-spin text-brand-gold" />
                          <p className="text-[9px] uppercase tracking-widest font-black text-brand-gold">Processing...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-8 rounded-sm bg-white/[0.02] border border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-brand-parchment/60">Featured Product</label>
                      <p className="text-[8px] text-brand-parchment/20 uppercase tracking-widest font-black">Storefront Highlight</p>
                    </div>
                    <button 
                      onClick={() => setFormData({...formData, featured: !formData.featured})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all duration-500 relative",
                        formData.featured ? "bg-brand-gold" : "bg-white/10"
                      )}
                    >
                      <motion.div 
                        animate={{ x: formData.featured ? 24 : 4 }}
                        className={cn("absolute top-1 w-4 h-4 rounded-full shadow-sm", formData.featured ? "bg-brand-black" : "bg-brand-parchment/40")}
                      />
                    </button>
                  </div>
                  <p className="text-[9px] text-brand-parchment/30 leading-relaxed italic">Featured products appear prominently on the storefront homepage.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-6 mt-12 pt-10 border-t border-white/5">
              <button 
                onClick={() => { setIsAdding(false); setEditingId(null); }}
                className="px-8 py-3 text-[10px] uppercase tracking-[0.3em] font-black text-brand-parchment/40 hover:text-brand-parchment transition-colors"
              >
                Discard Changes
              </button>
              <button 
                onClick={handleSave}
                className="btn-primary px-12"
              >
                {editingId ? 'Update Provision' : 'Publish Provision'}
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
              <th className="px-10 py-8 text-[9px] uppercase tracking-[0.3em] text-brand-parchment/30 font-black text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-white/[0.02] transition-all group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-6">
                    <div className="relative group/img">
                      <div className="absolute -inset-2 bg-brand-gold/5 rounded-sm blur-lg opacity-0 group-hover/img:opacity-100 transition-opacity duration-700" />
                      <img src={product.imageUrl} className="w-16 h-16 object-cover rounded-sm border border-white/10 relative z-10 group-hover/img:scale-110 transition-transform duration-700" alt={product.name} />
                    </div>
                    <div>
                      <p className="text-base text-brand-parchment font-black group-hover:text-brand-gold transition-colors duration-500">{product.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[9px] text-brand-parchment/30 uppercase tracking-[0.2em] font-bold">{product.sizeOz}oz Jar</p>
                        {product.featured && <span className="w-1 h-1 rounded-full bg-brand-gold" />}
                        {product.featured && <p className="text-[8px] text-brand-gold uppercase tracking-widest font-black">Featured</p>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-8 text-center">
                  <span className="px-5 py-2 rounded-full bg-brand-gold/5 text-brand-gold text-[8px] uppercase tracking-[0.2em] font-black border border-brand-gold/10 group-hover:bg-brand-gold/10 transition-all duration-500">
                    {product.category || 'Uncategorized'}
                  </span>
                </td>
                <td className="px-10 py-8">
                  <span className="text-base text-brand-parchment font-black tracking-tighter">${product.price.toFixed(2)}</span>
                </td>
                <td className="px-10 py-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-1.5 h-1.5 rounded-full ${product.currentInventory < 10 ? 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)] animate-pulse' : 'bg-green-400/40'}`} />
                    <span className={`text-lg font-serif ${product.currentInventory < 10 ? 'text-red-400' : 'text-brand-parchment/60'}`}>{product.currentInventory}</span>
                  </div>
                </td>
                <td className="px-10 py-8 text-right">
                  <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                    <button 
                      onClick={() => { 
                        setEditingId(product.id); 
                        setFormData({
                          ...product,
                          category: product.category || 'Spicy'
                        }); 
                      }}
                      className="p-3 rounded-full bg-white/5 text-brand-parchment/30 hover:text-brand-gold hover:bg-brand-gold/10 transition-all duration-500"
                      title="Edit Provision"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(product)}
                      className="p-3 rounded-full bg-white/5 text-brand-parchment/30 hover:text-red-400 hover:bg-red-400/10 transition-all duration-500"
                      title="Delete Provision"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
