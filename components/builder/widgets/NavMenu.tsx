'use client';

// Primary navigation: desktop bar with a mega-menu dropdown for any item that has children, and a hamburger panel on small screens.
// Responsive switching is plain CSS (see .dr-nav-desktop / .dr-menu-btn in globals.css).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MenuItem, WidgetProps } from '@/lib/builder/types';
import { Icon, Txt, asArray, safeUrl } from '../util';

const norm = (p: string) => ((p || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/');

function ItemLink({ item, className, onClick, active, children }: { item: MenuItem; className?: string; onClick?: () => void; active?: boolean; children?: React.ReactNode }) {
  const url = safeUrl(item.url) || '#';
  const aria = active ? 'page' : undefined;
  if (/^\/(?!\/)/.test(url) && !item.newTab) return <Link href={url} className={className} onClick={onClick} aria-current={aria}>{children ?? item.label}</Link>;
  return <a href={url} className={className} onClick={onClick} aria-current={aria} {...(item.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children ?? item.label}</a>;
}

export default function NavMenu({ node, ctx }: WidgetProps) {
  const p = node.props;
  const items: MenuItem[] = asArray<MenuItem>(ctx.data.menus?.[p.menu || 'primary']);
  const real = usePathname();
  const path = norm(ctx.path !== undefined ? ctx.path || '/' : real || '/');
  const [mega, setMega] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [mobileSub, setMobileSub] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // small delay so the pointer can cross the gap between the bar and the dropdown

  useEffect(() => { setMega(false); setMobile(false); setMobileSub(false); }, [real]);
  useEffect(() => {
    if (!mobile) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobile(false); };
    const mq = window.matchMedia('(min-width: 1180px)');
    const onChange = () => { if (mq.matches) setMobile(false); };
    document.addEventListener('keydown', onKey);
    mq.addEventListener('change', onChange);
    return () => { document.removeEventListener('keydown', onKey); mq.removeEventListener('change', onChange); };
  }, [mobile]);

  const isActive = (it: MenuItem) => {
    const u = norm(it.url);
    if (u === '/') return path === '/';
    return path === u || path.startsWith(u + '/') || (it.children || []).some((c) => norm(c.url) === path);
  };

  const megaItem = items.find((i) => (i.children || []).length);
  const closeMobile = () => { setMobile(false); setMobileSub(false); };

  if (!items.length) return ctx.edit ? <div className="dr-img-ph">This menu is empty — add items under Menus in the admin</div> : null;

  // layout "list": a plain vertical list of links (footer columns). No dropdown, no hamburger.
  if (p.layout === 'list') {
    return (
      <nav aria-label={p.menu || 'Menu'} className="dr-navlist">
        {items.map((it, k) => <ItemLink key={k} item={it} className="dr-navlist-a" active={isActive(it)} />)}
      </nav>
    );
  }

  return (
    <div className="dr-navwrap" onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }} onMouseLeave={() => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setMega(false), 180); }}>
      <nav aria-label="Primary" className="dr-nav-desktop">
        {items.map((it, k) => {
          const sep = it.sepBefore ? <span key={`s${k}`} aria-hidden="true" className="dr-nav-sep" /> : null;
          if (it.cta) return <span key={k} style={{ display: 'contents' }}>{sep}<ItemLink item={it} className="dr-nav-cta" /></span>;
          if ((it.children || []).length) {
            return (
              <span key={k} style={{ display: 'contents' }}>
                {sep}
                <button type="button" className="dr-nav-btn" aria-expanded={mega} aria-controls={`mega-${node.id}`} data-active={isActive(it) ? 'true' : 'false'} onClick={() => setMega((v) => !v)} onPointerEnter={(e) => { if (e.pointerType === 'mouse') setMega(true); }}>
                  {it.label}
                  <Icon name="chevron-down" size={14} />
                </button>
              </span>
            );
          }
          const active = isActive(it);
          return <span key={k} style={{ display: 'contents' }}>{sep}<ItemLink item={it} className="dr-nav-link" active={active} /></span>;
        })}
      </nav>

      <button type="button" className="dr-menu-btn" onClick={() => { setMobile((v) => !v); setMobileSub(false); }} aria-expanded={mobile} aria-controls={`mobile-${node.id}`} aria-label={mobile ? 'Close menu' : 'Open menu'}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">{mobile ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
      </button>

      {mobile && (
        <nav id={`mobile-${node.id}`} aria-label="Mobile" className="dr-mobile-panel">
          {items.map((it, k) => {
            if (it.cta) return <ItemLink key={k} item={it} className="dr-m-cta" onClick={closeMobile} />;
            if ((it.children || []).length) {
              return (
                <div key={k}>
                  <button type="button" className="dr-m-item" aria-expanded={mobileSub} data-active={isActive(it) ? 'true' : 'false'} onClick={() => setMobileSub((v) => !v)}>
                    {it.label}
                    <Icon name="chevron-down" size={18} className="dr-m-chev" />
                  </button>
                  {mobileSub && (
                    <div className="dr-m-sub">
                      {(it.children || []).map((c, j) => (
                        <ItemLink key={j} item={c} className={`dr-m-sublink${c.dark ? ' dr-m-sublink--dark' : ''}`} onClick={closeMobile}>
                          <strong>{c.label}</strong>
                          {c.description ? <small>{c.description}</small> : null}
                        </ItemLink>
                      ))}
                      {p.megaLabel && safeUrl(p.megaUrl) ? <Link href={safeUrl(p.megaUrl)} className="dr-m-all" onClick={closeMobile}>{p.megaLabel}</Link> : null}
                    </div>
                  )}
                </div>
              );
            }
            return <ItemLink key={k} item={it} className="dr-m-item" active={isActive(it)} onClick={closeMobile} />;
          })}
        </nav>
      )}

      {mega && megaItem && (
        <div id={`mega-${node.id}`} className="dr-mega">
          <div className="dr-mega-in">
            <div className="dr-mega-intro">
              {(p.megaEyebrow || ctx.edit) && <Txt node={node} k="megaEyebrow" ctx={ctx} as="span" className="dr-mega-eyebrow" multiline={false} placeholder="EYEBROW" />}
              {(p.megaIntro || ctx.edit) && <Txt node={node} k="megaIntro" ctx={ctx} as="p" className="dr-mega-text" placeholder="Intro text" />}
              {(p.megaLabel || ctx.edit) && <Link href={safeUrl(p.megaUrl) || '#'} className="dr-mega-link"><Txt node={node} k="megaLabel" ctx={ctx} multiline={false} placeholder="Link label" /></Link>}
            </div>
            <div className="dr-mega-grid">
              {(megaItem.children || []).map((c, j) => (
                <ItemLink key={j} item={c} className={`dr-mega-tile${c.dark ? ' dr-mega-tile--dark' : ''}`} onClick={() => setMega(false)}>
                  <strong>{c.label}</strong>
                  {c.description ? <small>{c.description}</small> : null}
                </ItemLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
