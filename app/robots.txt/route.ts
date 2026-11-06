// robots.txt, generated from SEO → Robots & AI crawlers (and the "discourage search engines" switch in SEO → General).
import { buildRobotsTxt } from '@/lib/robots';
import { getSeo } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(buildRobotsTxt(getSeo()), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
