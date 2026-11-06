// /llms.txt — a short, link-rich map of the site for AI assistants (https://llmstxt.org). Switch it off in SEO → AI & llms.txt.
import { buildLlmsTxt } from '@/lib/llms';

export const dynamic = 'force-dynamic';

export function GET() {
  const text = buildLlmsTxt();
  if (text === null) return new Response('Not found\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
}
