export const PRODUCT_DATA_VERSION = 1;

export const HEAT_LABELS = ['No Heat', 'Mild', 'Medium', 'Hot', 'Very Hot', 'Extreme'] as const;

export type ProductValidationIssue = {
  field: string;
  label: string;
  message: string;
};

type ProductRecord = Record<string, unknown>;

const requiredText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const finitePositive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const wholeNonNegative = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const nonEmptyTextList = (value: unknown) =>
  Array.isArray(value) && value.length > 0 && value.every((item) => requiredText(item));

export const getHeatLabel = (level: unknown) => {
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level > 5) return '';
  return HEAT_LABELS[level];
};

export const validateProductForPublication = (product: ProductRecord): ProductValidationIssue[] => {
  const issues: ProductValidationIssue[] = [];
  const add = (field: string, label: string, message: string) => issues.push({ field, label, message });

  if (!requiredText(product.name)) add('name', 'Product name', 'Enter the exact customer-facing product name.');
  if (!requiredText(product.slug)) add('slug', 'Slug', 'Enter a unique product URL slug.');
  if (!requiredText(product.category)) add('category', 'Category', 'Choose a storefront category.');
  if (!requiredText(product.shortDescription)) add('shortDescription', 'Short description', 'Add a factual storefront description.');
  if (!requiredText(product.imageUrl)) add('imageUrl', 'Primary image', 'Add the approved primary product image.');
  if (!finitePositive(product.price)) add('price', 'Price', 'Enter a price greater than $0.');
  if (!finitePositive(product.sizeOz)) add('sizeOz', 'Net weight', 'Enter the exact net weight in ounces.');
  if (!wholeNonNegative(product.currentInventory)) add('currentInventory', 'Inventory', 'Inventory must be a whole number of zero or more.');
  if (!wholeNonNegative(product.reorderThreshold)) add('reorderThreshold', 'Reorder threshold', 'Reorder threshold must be a whole number of zero or more.');

  const expectedHeatLabel = getHeatLabel(product.heatLevel);
  if (!expectedHeatLabel) {
    add('heatLevel', 'Heat rating', 'Choose a whole-number heat rating from 0 through 5.');
  } else if (product.heatLabel !== expectedHeatLabel) {
    add('heatLabel', 'Heat label', `Heat level ${product.heatLevel} must use the label “${expectedHeatLabel}”.`);
  }

  if (!nonEmptyTextList(product.ingredients)) {
    add('ingredients', 'Ingredients', 'Enter ingredients in the exact order approved for the label.');
  }
  if (!requiredText(product.allergenStatement)) {
    add('allergenStatement', 'Allergen statement', 'Enter the approved allergen statement, including an explicit none statement when applicable.');
  }
  if (!requiredText(product.crossContactStatement)) {
    add('crossContactStatement', 'Cross-contact statement', 'Enter the approved shared-facility or cross-contact statement.');
  }
  if (!requiredText(product.storageInstructions)) {
    add('storageInstructions', 'Storage guidance', 'Enter customer storage instructions.');
  }
  if (!requiredText(product.shelfLife)) {
    add('shelfLife', 'Shelf life', 'Enter the approved shelf-life guidance.');
  }
  if (!Array.isArray(product.dietaryClaims) || !product.dietaryClaims.every((claim) => requiredText(claim))) {
    add('dietaryClaims', 'Dietary claims', 'Use a list of approved claims, or an empty list when no claims are made.');
  }
  if (product.dietaryClaimsApproved !== true) {
    add('dietaryClaimsApproved', 'Dietary-claim approval', 'Confirm that the dietary claims were reviewed and approved.');
  }
  if (product.productFactsApproved !== true) {
    add('productFactsApproved', 'Product-fact approval', 'Confirm that label, allergen, storage, and shelf-life facts were reviewed and approved.');
  }
  if (product.productDataVersion !== PRODUCT_DATA_VERSION) {
    add('productDataVersion', 'Data version', 'Save this product using the current product-fact schema.');
  }

  return issues;
};

export const isProductPublishReady = (product: ProductRecord) =>
  validateProductForPublication(product).length === 0;

export const createProductSnapshot = (product: ProductRecord, productId: string, quantity: number) => ({
  productId,
  name: String(product.name),
  price: Number(product.price),
  quantity,
  imageUrl: String(product.imageUrl),
  sizeOz: Number(product.sizeOz),
  heatLevel: Number(product.heatLevel),
  heatLabel: String(product.heatLabel),
  ingredients: [...(product.ingredients as string[])],
  allergenStatement: String(product.allergenStatement),
  crossContactStatement: String(product.crossContactStatement),
  storageInstructions: String(product.storageInstructions),
  shelfLife: String(product.shelfLife),
  dietaryClaims: [...(product.dietaryClaims as string[])],
  productDataVersion: Number(product.productDataVersion),
});

export const auditProductCatalog = (products: Array<ProductRecord & { id?: string }>) =>
  products.map((product) => ({
    id: product.id || String(product.slug || ''),
    name: requiredText(product.name) ? String(product.name) : 'Unnamed product',
    active: product.active === true,
    issues: validateProductForPublication(product),
  }));
