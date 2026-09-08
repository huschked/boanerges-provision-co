import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResponsiveImage } from './ResponsiveImage';

test('renders a layout-stable lazy fallback by default', () => {
  const markup = renderToStaticMarkup(React.createElement(ResponsiveImage, {
    src: '/fallback.jpg',
    alt: 'Finishing salt jar',
    width: 800,
    height: 1000,
    sizes: '(min-width: 768px) 50vw, 100vw',
  }));

  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /decoding="async"/);
  assert.match(markup, /width="800"/);
  assert.match(markup, /height="1000"/);
  assert.doesNotMatch(markup, /<picture/);
});

test('renders modern source sets and gives priority images eager loading', () => {
  const markup = renderToStaticMarkup(React.createElement(ResponsiveImage, {
    src: '/hero.jpg',
    alt: 'Finishing salt collection',
    width: 1600,
    height: 1067,
    sizes: '100vw',
    priority: true,
    sources: {
      avif: '/hero-640.avif 640w, /hero-1600.avif 1600w',
      webp: '/hero-640.webp 640w, /hero-1600.webp 1600w',
    },
  }));

  assert.match(markup, /<picture/);
  assert.match(markup, /type="image\/avif"/);
  assert.match(markup, /type="image\/webp"/);
  assert.match(markup, /loading="eager"/);
  assert.match(markup, /fetchPriority="high"/);
});
