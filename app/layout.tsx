import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';
import '@/components/builder/builder.css';
import '@/components/builder/dynamic.css';
import SiteCodeBody from '@/components/site/SiteCodeBody';
import { resolveSiteCode } from '@/components/site/SiteCode';
import { rootMetadata } from '@/lib/seo';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' });

// Title template, description, icons, social card, verification codes and the "discourage search engines" switch come from
// Studio CMS (Settings + SEO) with the original values as fallbacks.
export async function generateMetadata(): Promise<Metadata> {
  return rootMetadata();
}

// The public site (header + footer) lives in app/(site)/layout.tsx; the CMS in app/admin/layout.tsx.
// Tracking IDs and custom code are added by resolveSiteCode(): public pages only (see proxy.ts + docs/SEO-AND-TRACKING.md).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const code = await resolveSiteCode();
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <head>{code.head}</head>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before React loads. */}
      <body suppressHydrationWarning>
        <SiteCodeBody id="dr-body-code" html={code.bodyOpen} />
        {children}
        <SiteCodeBody id="dr-footer-code" html={code.footer} />
      </body>
    </html>
  );
}
