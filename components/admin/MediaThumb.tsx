import '@/app/admin/css/media.css';
import { MEDIA_TYPES, extOf, type MediaKind } from '@/lib/media-types';

type Thumbable = { url: string; kind: MediaKind; filename?: string; alt?: string };

/** Square-ish preview used by the picker, the field and the library: the image itself, or a file-type tile. */
export default function MediaThumb({ item, cacheBust, className = '' }: { item: Thumbable; cacheBust?: string | number; className?: string }) {
  if (item.kind === 'image') {
    const src = cacheBust ? `${item.url}${item.url.includes('?') ? '&' : '?'}v=${cacheBust}` : item.url;
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`mp-thumb ${className}`} src={src} alt="" loading="lazy" decoding="async" />;
  }
  const ext = extOf(item.filename || item.url);
  return (
    <span className={`mp-tile mp-tile-${item.kind} ${className}`} aria-hidden="true">
      <span className="mp-tile-glyph">{item.kind === 'video' ? '▶' : '▤'}</span>
      <span className="mp-tile-ext">{MEDIA_TYPES[ext]?.label ?? (ext ? ext.toUpperCase() : 'FILE')}</span>
    </span>
  );
}
