import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';
import '@/components/builder/builder.css';
import '@/components/builder/dynamic.css';
import { SITE_DEFAULTS, getSiteSettings } from '@/lib/settings';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' });

// Title / description / icons / social image come from Settings (Studio CMS) with the original values as fallbacks.
export async function generateMetadata(): Promise<Metadata> {
  const s = getSiteSettings(); // defensive: returns empty strings if the database isn't readable
  const title = s.site_title || SITE_DEFAULTS.title;
  const tagline = s.site_tagline || SITE_DEFAULTS.tagline;
  return {
    metadataBase: new URL(process.env.SITE_URL || 'https://dassrebar.com'),
    title: { default: `${title} | ${tagline}`, template: `%s | ${title}` },
    description: s.seo_default_description || SITE_DEFAULTS.description,
    icons: { icon: s.site_favicon || SITE_DEFAULTS.favicon },
    ...(s.seo_default_og_image ? { openGraph: { siteName: title, type: 'website', images: [{ url: s.seo_default_og_image }] } } : {}),
  };
}

// The public site (header + footer) lives in app/(site)/layout.tsx; the CMS in app/admin/layout.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before React loads. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
