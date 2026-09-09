import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { STOREFRONT_NAV, PAIRING_PRODUCTS, shopCategory, inCollection } from './merchandising.js';

test('curated featured filtering and legacy links cannot produce an accidental category', () => {
  assert.equal(shopCategory('Best Sellers'), 'Featured');
  assert.equal(shopCategory('typo'), 'All');
  assert.equal(shopCategory('spicy'), 'Spicy');
  assert.equal(inCollection({ featured: true }, 'Featured'), true);
  assert.equal(inCollection({ featured: false }, 'Featured'), false);
  assert.equal(inCollection({ featured: false }, 'Featured', true), true);
  assert.equal(inCollection({ category: 'Savory', tags: ['Citrus'] }, 'Citrus'), true);
});

test('navigation and static storefront CTA paths resolve to registered routes and deployment rewrites', () => {
  const root = process.cwd();
  const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
  const routes = Array.from(app.matchAll(/<Route path="([^"]+)"/g), m => m[1]);
  const matches = (path: string, patterns: string[]) => patterns.some(route => {
    const pattern = route.split('/').slice(1).map(segment => segment.startsWith(':') ? segment.endsWith('*') ? '(?:/.*)?' : '/[^/]+' : segment === '*' ? '/.*' : '/' + segment).join('');
    return new RegExp('^' + pattern + '$').test(path);
  });
  const rewrites = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')).rewrites.map((r: any) => r.source);
  const check = (destination: string, source: string) => {
    assert.notEqual(destination, '#', `${source}: placeholder must not masquerade as a link`);
    if (!destination.startsWith('/')) return;
    const url = new URL(destination, 'https://example.com');
    assert.ok(matches(url.pathname, routes), `${source}: missing route ${destination}`);
    if (url.pathname !== '/') assert.ok(matches(url.pathname, rewrites), `${source}: missing deployment rewrite ${destination}`);
    if (url.searchParams.has('category')) assert.equal(shopCategory(url.searchParams.get('category')), url.searchParams.get('category'), `${source}: invalid collection`);
  };
  STOREFRONT_NAV.forEach(link => check(link.path, 'navigation'));
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(join(dir, item.name)) : item.name.endsWith('.tsx') ? [join(dir, item.name)] : []);
  for (const file of [...walk(resolve(root, 'src/pages')), ...walk(resolve(root, 'src/components'))]) {
    const contents = readFileSync(file, 'utf8');
    for (const match of contents.matchAll(/\b(?:to|href)=["']([^"']+)["']/g)) check(match[1], file);
  }
});

test('every pairing has a real catalog product key and does not send Shop this Salt to the general shop', () => {
  const recipes = readFileSync(resolve('src/pages/Recipes.tsx'), 'utf8');
  const seed = readFileSync(resolve('seed.ts'), 'utf8');
  const productSlugs = Array.from(seed.matchAll(/slug:\s*"([^"]+)"/g), m => m[1]);
  for (const match of recipes.matchAll(/salt: '([^']+)'/g)) {
    assert.ok(PAIRING_PRODUCTS[match[1]], `Missing pairing for ${match[1]}`);
    assert.ok(productSlugs.includes(PAIRING_PRODUCTS[match[1]]), `Unknown product ${match[1]}`);
  }
  assert.ok(recipes.includes('to={`/product/${product.slug}`}'));
  assert.ok(recipes.includes('This salt is currently unavailable.'));
});
