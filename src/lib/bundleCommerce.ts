export type BundleComponent = {
  productId: string;
  quantity: number;
};

export type BundleDefinition = {
  id: string;
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  active?: unknown;
  sellingPrice?: unknown;
  imageUrl?: unknown;
  imageAlt?: unknown;
  imageType?: unknown;
  stripeTaxCode?: unknown;
  components?: unknown;
};

export type BundleProduct = {
  id: string;
  name: string;
  price: number;
  sizeOz: number;
  currentInventory: number;
  reservedInventory?: number;
  imageUrl?: string;
  imageAlt?: string;
  stripeTaxCode?: string;
};

export type ResolvedBundleComponent = {
  productId: string;
  name: string;
  quantity: number;
  sizeOz: number;
  unitPrice: number;
};

export type ResolvedBundle = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sellingPrice: number;
  compareAtPrice: number;
  savingsAmount: number;
  savingsPercent: number;
  availableStock: number;
  sizeOz: number;
  imageUrl: string;
  imageAlt: string;
  imageType: 'photograph' | 'illustrative';
  stripeTaxCode: string;
  components: ResolvedBundleComponent[];
};

const money = (value: number) => Number(value.toFixed(2));

export function resolveBundle(
  definition: BundleDefinition,
  products: Map<string, BundleProduct>,
): { bundle?: ResolvedBundle; error?: string } {
  const name = typeof definition.name === 'string' ? definition.name.trim() : '';
  const slug = typeof definition.slug === 'string' ? definition.slug.trim() : '';
  const description = typeof definition.description === 'string' ? definition.description.trim() : '';
  const imageUrl = typeof definition.imageUrl === 'string' ? definition.imageUrl.trim() : '';
  const imageAlt = typeof definition.imageAlt === 'string' ? definition.imageAlt.trim() : '';
  const imageType = definition.imageType === 'photograph' ? 'photograph' : definition.imageType === 'illustrative' ? 'illustrative' : '';
  const sellingPrice = Number(definition.sellingPrice);
  const rawComponents = Array.isArray(definition.components) ? definition.components : [];

  if (definition.active !== true) return { error: 'Bundle is not active.' };
  if (!name || !slug || !description || !imageUrl || !imageAlt || !imageType) return { error: 'Bundle details are incomplete.' };
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return { error: 'Bundle selling price is invalid.' };
  if (rawComponents.length < 2 || rawComponents.length > 12) return { error: 'Bundle must contain between 2 and 12 component products.' };

  const seen = new Set<string>();
  const components: ResolvedBundleComponent[] = [];
  let compareAtPrice = 0;
  let sizeOz = 0;
  let availableStock = Number.POSITIVE_INFINITY;

  for (const raw of rawComponents) {
    if (!raw || typeof raw !== 'object') return { error: 'Bundle contains an invalid component.' };
    const productId = typeof (raw as BundleComponent).productId === 'string' ? (raw as BundleComponent).productId.trim() : '';
    const quantity = Number((raw as BundleComponent).quantity);
    if (!productId || seen.has(productId) || !Number.isInteger(quantity) || quantity <= 0 || quantity > 20) {
      return { error: 'Bundle component ids and quantities must be unique and valid.' };
    }
    const product = products.get(productId);
    if (!product) return { error: `Bundle component ${productId} is unavailable.` };
    seen.add(productId);
    compareAtPrice += product.price * quantity;
    sizeOz += product.sizeOz * quantity;
    availableStock = Math.min(
      availableStock,
      Math.floor(Math.max(0, product.currentInventory - Number(product.reservedInventory || 0)) / quantity),
    );
    components.push({ productId, name: product.name, quantity, sizeOz: product.sizeOz, unitPrice: product.price });
  }

  compareAtPrice = money(compareAtPrice);
  if (sellingPrice > compareAtPrice) return { error: 'Bundle selling price cannot exceed its component value.' };
  const savingsAmount = money(compareAtPrice - sellingPrice);
  const savingsPercent = compareAtPrice > 0 ? Math.round((savingsAmount / compareAtPrice) * 100) : 0;

  return {
    bundle: {
      id: definition.id,
      slug,
      name,
      description,
      sellingPrice: money(sellingPrice),
      compareAtPrice,
      savingsAmount,
      savingsPercent,
      availableStock: Number.isFinite(availableStock) ? availableStock : 0,
      sizeOz,
      imageUrl,
      imageAlt,
      imageType,
      stripeTaxCode: typeof definition.stripeTaxCode === 'string' ? definition.stripeTaxCode.trim() : '',
      components,
    },
  };
}
