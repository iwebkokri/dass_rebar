// Small helpers shared by builder widgets. Server- and client-safe (EditableText is only rendered while editing).
import { createElement } from 'react';
import Link from 'next/link';
import { ICONS } from '@/lib/builder/icons.mjs';
import { isInternal, safeMediaUrl, safeUrl } from '@/lib/builder/url.mjs';
import type { BNode, BuilderCtx } from '@/lib/builder/types';
import EditableText from './EditableText';

export { safeMediaUrl, safeUrl };

/** {year} in any text becomes the current year. */
export const tokens = (s: string) => s.replace(/\{year\}/g, String(new Date().getFullYear()));

type TxtProps = {
  node: BNode;
  k: string;
  ctx: BuilderCtx;
  as?: string;
  className?: string;
  rich?: boolean;
  multiline?: boolean;
  placeholder?: string;
  /** Text inside a repeater item: node.props[item.key][item.index][item.field] */
  item?: { key: string; index: number; field: string };
  style?: React.CSSProperties;
};

/** Text that is plain on the public site and click-to-edit inside the builder. */
export function Txt({ node, k, ctx, as = 'span', className = '', rich, multiline = true, placeholder, item, style }: TxtProps) {
  const raw = item ? node.props?.[item.key]?.[item.index]?.[item.field] : node.props?.[k];
  const value = typeof raw === 'string' ? raw : '';
  if (ctx.edit) {
    return <EditableText node={node} k={k} as={as} className={`${className}${rich ? '' : ' dr-pl'}`} ctx={ctx} rich={rich} multiline={multiline} placeholder={placeholder} item={item} value={value} style={style} />;
  }
  if (rich) return createElement(as, { className, style, dangerouslySetInnerHTML: { __html: value } });
  return createElement(as, { className: `${className} dr-pl`.trim(), style }, tokens(value));
}

/** A link that never navigates while editing (renders a span instead). */
export function BLink({ href, newTab, className, style, children, ctx, label }: { href?: string; newTab?: boolean; className?: string; style?: React.CSSProperties; children: React.ReactNode; ctx: BuilderCtx; label?: string }) {
  const url = safeUrl(href || '');
  if (!url || ctx.edit) return <span className={className} style={style}>{children}</span>;
  if (isInternal(url) && !newTab) return <Link href={url} className={className} style={style} aria-label={label}>{children}</Link>;
  return (
    <a href={url} className={className} style={style} aria-label={label} {...(newTab || /^https?:/i.test(url) ? { target: newTab ? '_blank' : undefined, rel: newTab ? 'noopener noreferrer' : undefined } : {})}>
      {children}
    </a>
  );
}

export function Icon({ name, size, className }: { name?: string; size?: number; className?: string }) {
  const body = name && (ICONS as Record<string, string>)[name];
  if (!body) return null;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: body }} />
  );
}

export const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
