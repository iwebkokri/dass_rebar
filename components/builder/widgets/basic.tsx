import type { WidgetProps } from '@/lib/builder/types';
import { BLink, Icon, Txt, asArray, safeMediaUrl } from '../util';

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'p', 'span'];

export function Heading({ node, ctx }: WidgetProps) {
  const p = node.props;
  const tag = HEADING_TAGS.includes(p.tag) ? p.tag : 'h2';
  const text = <Txt node={node} k="text" ctx={ctx} as={tag} className={`dr-heading dr-heading--${tag}`} placeholder="Heading" />;
  return p.link ? <BLink href={p.link} newTab={p.newTab} ctx={ctx} className="dr-linkwrap">{text}</BLink> : text;
}

export function TextWidget({ node, ctx }: WidgetProps) {
  return <Txt node={node} k="html" ctx={ctx} as="div" className="dr-richtext" rich placeholder="Write your text…" />;
}

export function ImageWidget({ node, ctx }: WidgetProps) {
  const p = node.props;
  const src = safeMediaUrl(p.src);
  if (!src) return ctx.edit ? <div className="dr-img-ph">Choose an image in the panel →</div> : null;
  const img = <img src={src} alt={p.alt || ''} loading="lazy" decoding="async" />;
  return (
    <figure className="dr-image">
      {p.link ? <BLink href={p.link} newTab={p.newTab} ctx={ctx}>{img}</BLink> : img}
      {p.caption || ctx.edit ? <Txt node={node} k="caption" ctx={ctx} as="figcaption" placeholder="Caption (optional)" multiline={false} /> : null}
    </figure>
  );
}

export function ButtonWidget({ node, ctx }: WidgetProps) {
  const p = node.props;
  const cls = `dr-btn dr-btn--${p.variant || 'solid'} dr-btn--${p.size || 'md'}${p.fullWidth ? ' dr-btn--full' : ''}`;
  return (
    <BLink href={p.url} newTab={p.newTab} ctx={ctx} className={cls}>
      <Txt node={node} k="label" ctx={ctx} as="span" multiline={false} placeholder="Button" />
      {p.icon ? <Icon name={p.icon} size={18} /> : null}
    </BLink>
  );
}

export function Spacer() {
  return <div className="dr-spacer" aria-hidden="true" />;
}

export function Divider() {
  return <hr className="dr-divider" />;
}

export function IconWidget({ node, ctx }: WidgetProps) {
  const icon = <Icon name={node.props.icon} />;
  return <div className="dr-icon">{node.props.link ? <BLink href={node.props.link} ctx={ctx}>{icon}</BLink> : icon}</div>;
}

export function IconBox({ node, ctx }: WidgetProps) {
  const p = node.props;
  const body = (
    <div className={`dr-ib dr-ib--${p.layout === 'left' ? 'left' : 'top'}`}>
      {p.icon ? <span className="dr-ib-icon"><Icon name={p.icon} /></span> : null}
      <span className="dr-ib-body">
        <Txt node={node} k="title" ctx={ctx} as="span" className="dr-ib-title" multiline={false} placeholder="Title" />
        <Txt node={node} k="text" ctx={ctx} as="span" className="dr-ib-text" placeholder="Text" />
      </span>
    </div>
  );
  return p.link ? <BLink href={p.link} ctx={ctx} className="dr-linkwrap">{body}</BLink> : body;
}

export function ListWidget({ node, ctx }: WidgetProps) {
  const p = node.props;
  const items = asArray<{ text: string }>(p.items);
  const marker = p.marker || 'check';
  return (
    <ul className={`dr-list dr-list--${marker}`}>
      {items.map((it, i) => (
        <li key={i} className="dr-li">
          {marker === 'check' ? <span className="dr-li-mark"><Icon name="check" size={20} /></span> : null}
          {marker === 'dot' ? <span className="dr-li-mark dr-li-dot" aria-hidden="true" /> : null}
          {marker === 'number' ? <span className="dr-li-mark dr-li-num">{i + 1}.</span> : null}
          <Txt node={node} k="items" ctx={ctx} as="span" item={{ key: 'items', index: i, field: 'text' }} multiline={false} placeholder="List item" />
        </li>
      ))}
    </ul>
  );
}

export function Counter({ node, ctx }: WidgetProps) {
  return (
    <div className="dr-counter">
      <div className="dr-num">
        <Txt node={node} k="prefix" ctx={ctx} multiline={false} placeholder="" />
        <Txt node={node} k="number" ctx={ctx} multiline={false} placeholder="0" />
        <Txt node={node} k="suffix" ctx={ctx} multiline={false} placeholder="" />
      </div>
      <Txt node={node} k="label" ctx={ctx} as="div" className="dr-lbl" placeholder="Label" />
    </div>
  );
}

export function Accordion({ node, ctx }: WidgetProps) {
  const p = node.props;
  const items = asArray<{ title: string; body: string }>(p.items);
  return (
    <div className="dr-acc">
      {items.map((it, i) => (
        <details key={i} className="dr-acc-item" open={ctx.edit ? true : p.openFirst && i === 0}>
          <summary className="dr-acc-title">
            <Txt node={node} k="items" ctx={ctx} as="span" item={{ key: 'items', index: i, field: 'title' }} multiline={false} placeholder="Title" />
            <Icon name="chevron-down" size={20} className="dr-acc-chev" />
          </summary>
          <Txt node={node} k="items" ctx={ctx} as="div" className="dr-acc-body" item={{ key: 'items', index: i, field: 'body' }} placeholder="Content" />
        </details>
      ))}
    </div>
  );
}

const SOCIAL_LABEL: Record<string, string> = { linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook', x: 'X', youtube: 'YouTube', mail: 'Email', phone: 'Phone', globe: 'Website' };

export function SocialIcons({ node, ctx }: WidgetProps) {
  const items = asArray<{ network: string; url: string }>(node.props.items);
  return (
    <div className="dr-soc">
      {items.map((it, i) => (
        <BLink key={i} href={it.url} ctx={ctx} label={SOCIAL_LABEL[it.network] || it.network} className="dr-soc-a">
          <Icon name={it.network} size={18} />
        </BLink>
      ))}
    </div>
  );
}

export function Logo({ node, ctx }: WidgetProps) {
  const p = node.props;
  const src = safeMediaUrl(p.src);
  return (
    <BLink href={p.link || '/'} ctx={ctx} className="dr-logo-link" label={p.alt || 'Home'}>
      {src ? <img src={src} alt={p.alt || ''} className="dr-logo-img" /> : <span className="dr-img-ph">Logo</span>}
      {p.tagline || ctx.edit ? <Txt node={node} k="tagline" ctx={ctx} as="span" className="dr-tagline" placeholder="Tagline" /> : null}
    </BLink>
  );
}
