import { useEffect, useState } from 'react';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}

/**
 * Product images are external URLs supplied by sellers. If one fails to load,
 * show a neutral fallback instead of a broken image icon.
 */
export function ProductImage({
  src,
  alt,
  className = '',
  eager = false,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const classes = ['product-image', className].filter(Boolean).join(' ');

  if (failed || !src) {
    return (
      <div
        className={`${classes} product-image--fallback`}
        role="img"
        aria-label={`${alt} — image unavailable`}
      >
        <span aria-hidden="true">{alt.charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div className={classes}>
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
