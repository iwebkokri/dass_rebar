// Small helpers for the dynamic (CMS-driven) widgets. Client- and server-safe: NO imports from lib/content or lib/db
// (the same widget code is bundled into the browser by the editor canvas).
import Link from 'next/link';
import { isInternal, safeUrl } from '@/lib/builder/url.mjs';

/** Empty-state box shown in the editor when a widget has nothing to render (nothing is rendered on the public site). */
export function EmptyBox({ edit, children }: { edit: boolean; children: React.ReactNode }) {
  return edit ? <div className="dr-img-ph">{children}</div> : null;
}

export const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

/** Second line on a project card: "799 Sheppard Avenue West, Toronto" (no repeat if the address already names the place). */
export function projectSubtitle(p: { address?: string; location?: string }): string {
  const address = p.address || '';
  const location = p.location || '';
  if (!address) return location;
  if (!location || address.toLowerCase().includes(location.toLowerCase())) return address;
  return `${address}, ${location}`;
}

/** Link that renders a plain element (no navigation) while editing. `edit` is a boolean here so client components can use it. */
export function SafeLink({ href, edit, className, children, newTab }: { href?: string; edit?: boolean; className?: string; children: React.ReactNode; newTab?: boolean }) {
  const url = safeUrl(href || '');
  if (!url || edit) return <span className={className}>{children}</span>;
  if (isInternal(url) && !newTab) return <Link href={url} className={className}>{children}</Link>;
  return (
    <a href={url} className={className} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

/** The anti-spam honeypot every public form carries (bots fill it, people never see it). Name must stay `website`. */
export function Honeypot(props: { value?: string; onChange?: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="dr-hp">
      <label>
        Leave this field empty
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          {...(props.onChange ? { value: props.value ?? '', onChange: (e) => props.onChange!(e.target.value) } : {})}
        />
      </label>
    </div>
  );
}

export const CheckIcon = () => (
  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#7F5F47" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M7 12.5l3.2 3.2L17 9" />
  </svg>
);
