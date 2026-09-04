import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBundle, type BundleProduct } from './bundleCommerce.ts';

const products = new Map<string, BundleProduct>([
  ['a', { id: 'a', name: 'Salt A', price: 10, sizeOz: 3, currentInventory: 8, reservedInventory: 2 }],
  ['b', { id: 'b', name: 'Salt B', price: 12, sizeOz: 3, currentInventory: 5, reservedInventory: 1 }],
]);
const definition = { id: 'starter', active: true, name: 'Starter', slug: 'starter', description: 'Three salts.', sellingPrice: 27, imageUrl: '/bundles/starter.png', imageAlt: 'Starter bundle', imageType: 'illustrative', components: [{ productId: 'a', quantity: 2 }, { productId: 'b', quantity: 1 }] };

test('resolves server-owned bundle value, savings, size, and component-limited stock', () => {
  const result = resolveBundle(definition, products);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.bundle && { compareAtPrice: result.bundle.compareAtPrice, savingsAmount: result.bundle.savingsAmount, savingsPercent: result.bundle.savingsPercent, sizeOz: result.bundle.sizeOz, availableStock: result.bundle.availableStock }, { compareAtPrice: 32, savingsAmount: 5, savingsPercent: 16, sizeOz: 9, availableStock: 3 });
});

test('rejects missing components, duplicate components, and prices above component value', () => {
  assert.match(resolveBundle({ ...definition, components: [{ productId: 'missing', quantity: 1 }, { productId: 'b', quantity: 1 }] }, products).error || '', /unavailable/);
  assert.match(resolveBundle({ ...definition, components: [{ productId: 'a', quantity: 1 }, { productId: 'a', quantity: 1 }] }, products).error || '', /unique/);
  assert.match(resolveBundle({ ...definition, sellingPrice: 100 }, products).error || '', /cannot exceed/);
});

test('recalculates price and sold-out state from current component records', () => {
  const changedProducts = new Map(products);
  changedProducts.set('a', { ...products.get('a')!, price: 11, currentInventory: 2, reservedInventory: 2 });
  const result = resolveBundle(definition, changedProducts).bundle!;
  assert.equal(result.compareAtPrice, 34);
  assert.equal(result.savingsAmount, 7);
  assert.equal(result.availableStock, 0);
});
