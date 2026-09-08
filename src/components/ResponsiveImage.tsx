import React from 'react';

export interface ResponsiveImageSources {
  avif?: string;
  webp?: string;
}

interface ResponsiveImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'height' | 'src' | 'width'> {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  sources?: ResponsiveImageSources;
  priority?: boolean;
  pictureClassName?: string;
}

/**
 * Keeps image loading behavior consistent while allowing final photography to
 * opt into generated AVIF/WebP srcsets without changing page markup again.
 */
export const ResponsiveImage = React.forwardRef<HTMLImageElement, ResponsiveImageProps>(function ResponsiveImage({
  src,
  alt,
  width,
  height,
  sizes,
  sources,
  priority = false,
  pictureClassName,
  loading = priority ? 'eager' : 'lazy',
  decoding = 'async',
  ...imageProps
}, ref) {
  const image = (
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading={loading}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={decoding}
      {...imageProps}
    />
  );

  if (!sources?.avif && !sources?.webp) return image;

  return (
    <picture className={pictureClassName}>
      {sources.avif && <source type="image/avif" srcSet={sources.avif} sizes={sizes} />}
      {sources.webp && <source type="image/webp" srcSet={sources.webp} sizes={sizes} />}
      {image}
    </picture>
  );
});
