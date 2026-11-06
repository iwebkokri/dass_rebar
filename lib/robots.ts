// robots.txt text, generated from SEO → Robots & AI crawlers and the "discourage search engines" switch. Used by /robots.txt and
// by the preview in the admin.
import { AI_BOTS } from './seo-core.mjs';
import type { SeoSettings } from './seo';

const KEEP_OUT = ['/admin', '/api/', '/builder-frame'];

export function buildRobotsTxt(seo: SeoSettings): string {
  const out: string[] = [];
  if (seo.general.noindexSite) {
    out.push('# The site owner has asked search engines and AI crawlers to stay away (Studio CMS → SEO → General).', 'User-agent: *', 'Disallow: /');
  } else {
    out.push('# Search engines', 'User-agent: *', 'Allow: /', ...KEEP_OUT.map((p) => `Disallow: ${p}`));
    out.push('', '# AI and answer-engine crawlers (Studio CMS → SEO → Robots & AI crawlers)');
    for (const b of AI_BOTS as { ua: string }[]) {
      out.push('', `User-agent: ${b.ua}`);
      if (seo.robots.bots[b.ua] === 'disallow') out.push('Disallow: /');
      else out.push('Allow: /', ...KEEP_OUT.map((p) => `Disallow: ${p}`)); // a named group does not inherit the "*" group, so repeat the keep-out paths
    }
    if (seo.robots.extra) out.push('', '# Extra rules', seo.robots.extra);
    out.push('', `Sitemap: ${seo.base}/sitemap.xml`);
  }
  return out.join('\n') + '\n';
}
