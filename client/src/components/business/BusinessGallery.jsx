import { useCallback, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { getImage } from '@/lib/imageSources';

/**
 * Responsive gallery + accessible lightbox.
 * Adapts to however many images exist (1 → single hero image, 2 → split, 3+ → mosaic).
 * Lightbox: arrow keys, Escape (Radix), focus trap/return (Radix), swipe on touch devices.
 */
export function BusinessGallery({ images = [], name }) {
  const [index, setIndex] = useState(null);
  const open = index !== null;
  const count = images.length;

  const go = useCallback(
    (delta) => setIndex((i) => (i === null ? i : (i + delta + count) % count)),
    [count],
  );

  useEffect(() => {
    if (!open || count < 2) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, count, go]);

  if (!count) return null;

  const tile = (key, i, cls, sizes) => (
    <button
      key={`${key}-${i}`}
      type="button"
      onClick={() => setIndex(i)}
      className={`group relative block overflow-hidden rounded-2xl ${cls}`}
      aria-label={`Open photo ${i + 1} of ${count}${name ? ` for ${name}` : ''}`}
    >
      <ImageWithFallback
        imageKey={key}
        sizes={sizes}
        className="h-full w-full"
        imgClassName="transition-transform duration-700 group-hover:scale-105"
        priority={i === 0}
      />
      <span
        className="absolute inset-0 bg-navy-900/0 transition-colors group-hover:bg-navy-900/10"
        aria-hidden="true"
      />
    </button>
  );

  return (
    <section aria-label="Photo gallery">
      {count === 1 ? (
        tile(images[0], 0, 'aspect-[16/9] w-full', '(min-width: 1024px) 66vw, 100vw')
      ) : count === 2 ? (
        <div className="grid grid-cols-2 gap-3">
          {images.map((k, i) => tile(k, i, 'aspect-[4/3]', '50vw'))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 md:aspect-[2.1/1] md:grid-rows-2">
          {tile(
            images[0],
            0,
            'col-span-4 aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-auto',
            '(min-width: 768px) 50vw, 100vw',
          )}
          {images
            .slice(1, 5)
            .map((k, i) =>
              tile(
                k,
                i + 1,
                count === 4 && i === 2
                  ? 'col-span-4 aspect-[2/1] md:col-span-2 md:aspect-auto'
                  : `aspect-square md:aspect-auto ${count === 3 ? 'col-span-2' : 'col-span-2 md:col-span-1'}`,
                '25vw',
              ),
            )}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setIndex(0)}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold text-navy hover:bg-sand"
        >
          <Expand className="h-4 w-4" aria-hidden="true" />
          View {count} {count === 1 ? 'photo' : 'photos'}
        </button>
      </div>

      <Dialog.Root open={open} onOpenChange={(o) => !o && setIndex(null)}>
        <AnimatePresence>
          {open && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-[90] bg-navy-900/95"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-[91] flex flex-col focus:outline-none"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
                    <Dialog.Title className="text-sm font-semibold text-white/80">
                      {name ? `${name} — ` : ''}Photo {index + 1} of {count}
                    </Dialog.Title>
                    <Dialog.Description className="sr-only">
                      Use the arrow keys to move between photos. Press Escape to close.
                    </Dialog.Description>
                    <Dialog.Close
                      className="grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/10"
                      aria-label="Close gallery"
                    >
                      <X className="h-6 w-6" aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-6 sm:px-16">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.figure
                        key={index}
                        className="flex h-full w-full flex-col items-center justify-center"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.22 }}
                        drag={count > 1 ? 'x' : false}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.4}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -60) go(1);
                          else if (info.offset.x > 60) go(-1);
                        }}
                      >
                        <img
                          src={getImage(images[index], { width: 2400 }).src}
                          srcSet={getImage(images[index]).srcSet}
                          sizes="100vw"
                          alt={getImage(images[index]).alt}
                          className="max-h-[78vh] w-auto max-w-full select-none rounded-xl object-contain"
                          draggable={false}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.srcset = '';
                            e.currentTarget.src = '/placeholders/image-fallback.svg';
                          }}
                        />
                        <figcaption className="mt-3 max-w-2xl text-center text-sm text-white/70">
                          {getImage(images[index]).alt}
                        </figcaption>
                      </motion.figure>
                    </AnimatePresence>
                    {count > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => go(-1)}
                          className="absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 sm:left-4"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => go(1)}
                          className="absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 sm:right-4"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="h-6 w-6" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </section>
  );
}
