import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductSnapshot, getHeatLabel, isProductPublishReady, validateProductForPublication } from './productCatalog.js';

const validProduct = {
  name: 'Approved Salt', slug: 'approved-salt', category: 'Savory', shortDescription: 'Approved description',
  imageUrl: '/products/approved.webp', price: 12, sizeOz: 3, currentInventory: 10, reorderThreshold: 3,
  heatLevel: 2, heatLabel: 'Medium', ingredients: ['Sea salt', 'Pepper'],
  allergenStatement: 'Approved allergen statement', crossContactStatement: 'Approved cross-contact statement',
  storageInstructions: 'Approved storage instructions', shelfLife: 'Approved shelf-life guidance',
  dietaryClaims: ['Vegan'], dietaryClaimsApproved: true, productFactsApproved: true, productDataVersion: 1,
};

test('publication validation accepts a complete, approved product', () => {
  assert.equal(isProductPublishReady(validProduct), true);
  assert.deepEqual(validateProductForPublication(validProduct), []);
});

test('publication validation reports missing regulated facts', () => {
  const issues = validateProductForPublication({ ...validProduct, ingredients: [], productFactsApproved: false });
  assert.deepEqual(issues.map((issue) => issue.field), ['ingredients', 'productFactsApproved']);
});

test('heat labels are deterministic and validated', () => {
  assert.equal(getHeatLabel(5), 'Extreme');
  assert.equal(getHeatLabel(6), '');
  assert.equal(isProductPublishReady({ ...validProduct, heatLabel: 'Hot' }), false);
});

test('order snapshots copy product facts and cannot drift with later edits', () => {
  const source = { ...validProduct, ingredients: [...validProduct.ingredients], dietaryClaims: [...validProduct.dietaryClaims] };
  const snapshot = createProductSnapshot(source, 'approved-salt', 2);
  source.ingredients[0] = 'Changed later';
  source.dietaryClaims[0] = 'Changed later';
  assert.equal(snapshot.ingredients[0], 'Sea salt');
  assert.equal(snapshot.dietaryClaims[0], 'Vegan');
  assert.equal(snapshot.quantity, 2);
});
