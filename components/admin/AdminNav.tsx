'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string; count?: number; sub?: boolean };
export type NavGroup = { heading?: string; items: NavItem[] };

export default function AdminNav({ groups }: { groups: NavGroup[] }) {
  const pathname = (usePathname() || '/admin').replace(/\/+$/, '') || '/admin';
  return (
    <nav className="sc-nav" aria-label="Studio CMS">
      {groups.map((g, gi) => (
        <div key={gi} className="sc-nav-group">
          {g.heading ? <span className="sc-nav-heading">{g.heading}</span> : null}
          {g.items.map((item) => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={item.sub ? 'sc-nav-sub' : undefined}>
                <span>{item.label}</span>
                {item.count ? <span className="sc-count">{item.count}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
