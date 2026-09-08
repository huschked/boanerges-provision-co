# Storefront image performance

WEB-046 establishes the image-delivery behavior now even though current product and editorial artwork will be replaced. Do not spend time manually polishing temporary images; run every approved replacement through this workflow before launch.

## Performance budgets

- Full-width hero fallback: 350 kB or less.
- Product, category, recipe, and editorial fallback: 200 kB or less.
- Logo and interface artwork: 100 kB or less where transparency and detail permit.
- No final source asset may exceed the 500 kB audit ceiling without a documented reason.
- Use the smallest sensible dimensions. A 1,600 px-wide source is normally sufficient for a full-width storefront image, while cards generally need no more than 1,200 px.

## Generate responsive formats

Keep the original file as the compatibility fallback. Generate responsive AVIF and WebP variants beside it:

```powershell
npm run images:optimize -- src/assets/final-hero.jpg --widths=640,960,1280,1600
```

For a directory or a separate output folder:

```powershell
npm run images:optimize -- public/products --widths=400,800,1200 --out-dir=public/optimized/products
```

The command never overwrites the input. It creates `<name>-<width>.webp` and `<name>-<width>.avif` files. Import those files and pass comma-separated srcsets to `ResponsiveImage.sources`:

```tsx
<ResponsiveImage
  src={fallback}
  sources={{
    avif: `${smallAvif} 640w, ${largeAvif} 1280w`,
    webp: `${smallWebp} 640w, ${largeWebp} 1280w`,
  }}
  alt="Approved descriptive alternative text"
  width={1600}
  height={1067}
  sizes="100vw"
  priority
/>
```

Only the primary above-the-fold hero should use `priority`. Everything below the fold should retain the component's default lazy loading. Always provide the final file's real intrinsic width and height so the browser can reserve its layout before download.

## Audit and final replacement checklist

Run `npm run images:audit` at any time to list oversized source files. Temporary artwork is reported but does not fail the command. Before launch, run the strict form and resolve every finding:

```powershell
npm run images:audit -- --strict
```

For each final replacement:

1. Crop it to the aspect ratio used by the page before optimization.
2. Generate AVIF and WebP widths appropriate to its rendered size.
3. Retain one compressed fallback and remove the superseded temporary file.
4. Update the `ResponsiveImage` width, height, sizes, source sets, and approved alt text.
5. Check desktop and mobile rendering with the browser cache disabled.
6. Confirm only the hero is high priority and below-the-fold files do not download before scrolling near them.
7. Run the strict image audit, production build, and mobile Lighthouse test.
