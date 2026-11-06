import type { WidgetProps } from '@/lib/builder/types';
import { safeMediaUrl, asArray } from '../util';
import { RenderNodes } from '../Render';
import { buildCss } from '@/lib/builder/css.mjs';
import GalleryClient from './GalleryClient';

function embedUrl(source: string, url: string): string {
  const u = (url || '').trim();
  if (source === 'youtube') {
    const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/);
    return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : '';
  }
  if (source === 'vimeo') {
    const m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : '';
  }
  return '';
}

export function VideoWidget({ node, ctx }: WidgetProps) {
  const p = node.props;
  const source = p.source || 'youtube';
  if (source === 'file') {
    const src = safeMediaUrl(p.src);
    if (!src) return ctx.edit ? <div className="dr-img-ph">Choose a video file in the panel →</div> : null;
    const poster = safeMediaUrl(p.poster);
    return (
      <div className="dr-video">
        <video src={src} poster={poster || undefined} controls={p.controls !== false} loop={!!p.loop} muted={!!p.autoplay} autoPlay={!!p.autoplay && !ctx.edit} playsInline preload="metadata" />
      </div>
    );
  }
  const src = embedUrl(source, p.url);
  if (!src) return ctx.edit ? <div className="dr-img-ph">Paste a {source === 'vimeo' ? 'Vimeo' : 'YouTube'} link in the panel →</div> : null;
  return (
    <div className="dr-video">
      <iframe src={src} title="Video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}

export function GalleryWidget({ node, ctx }: WidgetProps) {
  const images = asArray<{ src: string; alt: string }>(node.props.images)
    .map((i) => ({ src: safeMediaUrl(i.src), alt: i.alt || '' }))
    .filter((i) => i.src);
  if (!images.length) return ctx.edit ? <div className="dr-img-ph">Add images in the panel →</div> : null;
  return <GalleryClient images={images} lightbox={!!node.props.lightbox && !ctx.edit} />;
}

export function MapWidget({ node, ctx }: WidgetProps) {
  const q = String(node.props.query || '').trim().slice(0, 200);
  if (!q) return ctx.edit ? <div className="dr-img-ph">Enter an address in the panel →</div> : null;
  const zoom = Math.max(1, Math.min(20, Number(node.props.zoom) || 14));
  return (
    <div className="dr-map">
      <iframe title={`Map: ${q}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&output=embed`} />
    </div>
  );
}

export function HtmlWidget({ node, ctx }: WidgetProps) {
  const code = String(node.props.code || '');
  if (ctx.edit) return <div className="dr-img-ph">Custom HTML — {code.length} characters (runs on the live site)</div>;
  return <div className="dr-html" dangerouslySetInnerHTML={{ __html: code }} />;
}

/** A saved section placed on a page: a live link to the template. */
export function TemplateWidget({ node, ctx }: WidgetProps) {
  const nodes = ctx.data.templates?.[String(node.props.templateId)];
  if (!nodes) return ctx.edit ? <div className="dr-img-ph">Choose a saved section in the panel →</div> : null;
  // a saved section can't contain another saved section (avoids loops)
  const inner = { ...ctx, edit: undefined };
  const css = buildCss(nodes);
  return (
    <div className="dr-tpl">
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <RenderNodes nodes={nodes.filter((n) => n.type !== 'template')} ctx={inner} />
    </div>
  );
}
