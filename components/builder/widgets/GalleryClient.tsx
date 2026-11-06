'use client';

import { useEffect, useState } from 'react';

export default function GalleryClient({ images, lightbox }: { images: { src: string; alt: string }[]; lightbox: boolean }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i + images.length - 1) % images.length));
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, images.length]);

  return (
    <>
      <div className="dr-gal">
        {images.map((img, i) =>
          lightbox ? (
            <button key={i} type="button" className="dr-gal-item" onClick={() => setOpen(i)} aria-label={`Open image ${i + 1}: ${img.alt || 'photo'}`}>
              <img src={img.src} alt={img.alt} loading="lazy" decoding="async" />
            </button>
          ) : (
            <div key={i} className="dr-gal-item"><img src={img.src} alt={img.alt} loading="lazy" decoding="async" /></div>
          )
        )}
      </div>
      {open !== null && (
        <div className="dr-lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={() => setOpen(null)}>
          <button type="button" className="dr-lb-close" aria-label="Close" onClick={() => setOpen(null)}>×</button>
          {images.length > 1 && <button type="button" className="dr-lb-nav dr-lb-prev" aria-label="Previous image" onClick={(e) => { e.stopPropagation(); setOpen((open + images.length - 1) % images.length); }}>‹</button>}
          <img src={images[open].src} alt={images[open].alt} onClick={(e) => e.stopPropagation()} />
          {images.length > 1 && <button type="button" className="dr-lb-nav dr-lb-next" aria-label="Next image" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % images.length); }}>›</button>}
        </div>
      )}
    </>
  );
}
