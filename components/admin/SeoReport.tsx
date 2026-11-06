import { band } from '@/lib/builder/seo-analysis.mjs';
import './seo-report.css';

export type SeoCheck = { id: string; group: 'seo' | 'ai'; status: 'pass' | 'warn' | 'fail'; message: string; fix: string };
export type SeoResult = { checks: SeoCheck[]; scores: { seo: number; ai: number }; stats: { words: number; h1: number; headings: number; images: number; links: number; faqs: number } };

const ORDER = { fail: 0, warn: 1, pass: 2 } as const;
const MARK = { pass: '✓', warn: '!', fail: '✕' } as const;
const TITLE = { seo: 'Search engine (SEO)', ai: 'AI & answer engines (GEO · AEO · AIO)' } as const;

/** Presentational: scores + the checks, problems first. Used by the admin page settings (server-computed) and the builder (live). */
export default function SeoReport({ result, className }: { result: SeoResult; className?: string }) {
  return (
    <div className={`se-report${className ? ` ${className}` : ''}`}>
      <div className="se-scores">
        <div className="se-score" data-band={band(result.scores.seo)}><b>{result.scores.seo}</b><span>SEO score</span></div>
        <div className="se-score" data-band={band(result.scores.ai)}><b>{result.scores.ai}</b><span>AI-readiness</span></div>
      </div>
      {(['seo', 'ai'] as const).map((g) => {
        const list = result.checks.filter((c) => c.group === g).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
        return (
          <section key={g} className="se-group" aria-label={TITLE[g]}>
            <h4>{TITLE[g]}</h4>
            <ul className="se-checks">
              {list.map((c) => (
                <li key={c.id} className="se-check" data-s={c.status} data-id={c.id}>
                  <span className="se-dot" aria-hidden>{MARK[c.status]}</span>
                  <span>
                    {c.message}
                    {c.status !== 'pass' && c.fix ? <span className="se-fix">{c.fix}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="se-stats">{result.stats.words} words · {result.stats.headings} headings · {result.stats.images} images · {result.stats.links} links · {result.stats.faqs} FAQ</p>
    </div>
  );
}
