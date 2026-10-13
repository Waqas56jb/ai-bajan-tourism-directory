import { useState } from 'react';
import { FALLBACK_IMAGE, getImage } from '@/lib/imageSources';

/**
 * Responsive image that never shows a broken-image icon.
 *
 * - Pass `imageKey` (from imageSources.js) or a raw `src`.
 * - The wrapper reserves space (`aspect` class or explicit parent size) to avoid layout shift.
 * - `priority` = above-the-fold: eager loading + high fetch priority. Everything else lazy-loads.
 * - On error, swaps to a local, on-brand fallback illustration.
 */
export function ImageWithFallback({
  imageKey,
  src: srcProp,
  alt: altProp,
  sizes = '100vw',
  priority = false,
  className = '',
  imgClassName = '',
  aspect = '',
  decorative = false,
  width,
  style,
}) {
  const resolved = imageKey ? getImage(imageKey) : { src: srcProp, srcSet: undefined, alt: '' };
  const [failed, setFailed] = useState(false);
  const alt = decorative ? '' : (altProp ?? resolved.alt ?? '');
  const focal = resolved.record?.focal;

  const imgProps = {
    alt,
    loading: priority ? 'eager' : 'lazy',
    decoding: priority ? 'sync' : 'async',
    fetchpriority: priority ? 'high' : undefined,
    onError: () => setFailed(true),
    className: `h-full w-full object-cover ${imgClassName}`,
    style: focal ? { objectPosition: focal, ...style } : style,
    width,
  };

  return (
    <div
      className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} overflow-hidden bg-sand ${aspect} ${className}`}
    >
      {failed || !resolved.src ? (
        <img src={FALLBACK_IMAGE} {...imgProps} onError={undefined} />
      ) : resolved.webpSrcSet ? (
        <picture>
          <source type="image/webp" srcSet={resolved.webpSrcSet} sizes={sizes} />
          <img src={resolved.src} srcSet={resolved.srcSet} sizes={sizes} {...imgProps} />
        </picture>
      ) : (
        <img src={resolved.src} srcSet={resolved.srcSet} sizes={sizes} {...imgProps} />
      )}
    </div>
  );
}
