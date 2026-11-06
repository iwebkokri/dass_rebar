// /llms-full.txt — the same map with the full text of every published, indexable page and article.
import { buildLlmsFull } from '@/lib/llms';

export const dynamic = 'force-dynamic';

export function GET() {
  const text = buildLlmsFull();
  if (text === null) return new Response('Not found\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
}
