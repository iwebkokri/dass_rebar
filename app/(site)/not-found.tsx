import { headers } from 'next/headers';
import Link from 'next/link';
import PageShell from '@/components/builder/PageShell';
import { log404 } from '@/lib/seo-log';

export default async function NotFound() {
  // Every public "page not found" ends up here (the catch-all page, a missing article, …): record it for SEO → 404 monitor.
  const h = await headers();
  if (h.get('x-dr-surface') === 'site') log404(h.get('x-dr-path') ?? '', h.get('referer') ?? '');
  return (
    <PageShell path="404" nodes={[]}>
      <section style={{ padding: '120px 32px', textAlign: 'center', background: '#F4F5F7' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: '#6B4F3A' }}>ERROR 404</p>
        <h1 style={{ margin: '14px 0 12px', fontFamily: 'var(--font-manrope), sans-serif', fontSize: 'clamp(40px, 5vw, 72px)', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.02em' }}>Page not found</h1>
        <p style={{ margin: '0 auto 28px', maxWidth: 520, fontSize: 18, lineHeight: 1.6, color: '#3A4658' }}>The page you are looking for has moved or no longer exists.</p>
        <Link href="/" className="dr-btn dr-btn--solid dr-btn--md">Back to the home page</Link>
      </section>
    </PageShell>
  );
}
