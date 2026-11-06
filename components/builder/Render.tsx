// The builder renderer. The SAME code renders a page on the public site (server) and inside the editor canvas (client).
import { WIDGETS } from '@/lib/builder/schema.mjs';
import { buildCss } from '@/lib/builder/css.mjs';
import { safeMediaUrl } from '@/lib/builder/url.mjs';
import type { BNode, BuilderCtx } from '@/lib/builder/types';
import { COMPONENTS } from './widgets';

const TAGS = ['section', 'div', 'header', 'footer', 'main', 'article', 'aside'];

function wrapperProps(node: BNode, ctx: BuilderCtx, extra = '') {
  const p = node.props || {};
  const anim = !ctx.edit && p.animation ? ` dr-anim dr-anim-${p.animation}` : '';
  const cls = `dr-n dr-n-${node.id} dr-t-${node.type}${extra}${p.cssClass ? ` ${p.cssClass}` : ''}${anim}`;
  const out: Record<string, any> = { className: cls };
  if (p.anchor) out.id = p.anchor;
  if (anim && p.animDelay) out.style = { transitionDelay: `${Number(p.animDelay) || 0}ms` };
  if (ctx.edit) {
    out['data-nid'] = node.id;
    out['data-ntype'] = node.type;
  }
  return out;
}

function Layers({ node }: { node: BNode }) {
  const p = node.props || {};
  const video = safeMediaUrl(p.bgVideo);
  if (!video && !p.overlay) return null;
  return (
    <div className="dr-bgl" aria-hidden="true">
      {video ? <video src={video} muted loop autoPlay playsInline preload="metadata" /> : null}
      {p.overlay ? <div className="dr-ovl" /> : null}
    </div>
  );
}

export function RenderNodes({ nodes, ctx }: { nodes: BNode[]; ctx: BuilderCtx }) {
  return <>{(nodes || []).map((n) => <RenderNode key={n.id} node={n} ctx={ctx} />)}</>;
}

export function RenderNode({ node, ctx }: { node: BNode; ctx: BuilderCtx }) {
  const def = (WIDGETS as Record<string, any>)[node.type];
  if (!def) return null;
  const p = node.props || {};

  if (node.type === 'section') {
    const Tag = (TAGS.includes(p.tag) ? p.tag : 'section') as any;
    const full = p.contentMode === 'full';
    return (
      <Tag {...wrapperProps(node, ctx)}>
        <Layers node={node} />
        <div className={`dr-inner ${full ? 'dr-full' : 'dr-boxed'}`}>
          <RenderNodes nodes={node.children || []} ctx={ctx} />
          {ctx.edit && !(node.children || []).length ? <div className="dr-empty">Empty section — use the layout picker to add a row</div> : null}
        </div>
      </Tag>
    );
  }

  if (node.type === 'row') {
    return (
      <div {...wrapperProps(node, ctx)}>
        <RenderNodes nodes={node.children || []} ctx={ctx} />
      </div>
    );
  }

  if (node.type === 'column') {
    const layered = !!(safeMediaUrl(p.bgVideo) || p.overlay);
    return (
      <div {...wrapperProps(node, ctx, layered ? ' dr-has-layers' : '')}>
        <Layers node={node} />
        <RenderNodes nodes={node.children || []} ctx={ctx} />
        {ctx.edit && !(node.children || []).length ? <div className="dr-empty" data-empty="column">Drop a widget here</div> : null}
      </div>
    );
  }

  const Widget = COMPONENTS[node.type];
  const dynamic = def.category === 'dynamic' || def.category === 'site' ? ' dr-w-live' : '';
  return (
    <div {...wrapperProps(node, ctx, ` dr-w${dynamic}`)}>
      {Widget ? <Widget node={node} ctx={ctx} /> : null}
    </div>
  );
}

/** A whole document: its nodes + the CSS generated from their settings. */
export function RenderDoc({ nodes, ctx }: { nodes: BNode[]; ctx: BuilderCtx }) {
  const css = buildCss(nodes);
  return (
    <>
      {css ? <style data-dr-css dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <RenderNodes nodes={nodes} ctx={ctx} />
    </>
  );
}
