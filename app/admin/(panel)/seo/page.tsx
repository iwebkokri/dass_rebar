import type { Metadata } from 'next';
import Link from 'next/link';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import MediaField from '@/components/admin/MediaField';
import { requireCap } from '@/lib/auth';
import { all, getSetting } from '@/lib/db';
import { stamp } from '@/lib/format';
import { buildLlmsTxt } from '@/lib/llms';
import { getPostBySlug } from '@/lib/content';
import { getPageById, pageDoc } from '@/lib/pages';
import { buildRobotsTxt } from '@/lib/robots';
import { getSeo, pageJsonLd, postJsonLd } from '@/lib/seo';
import { count404, list404 } from '@/lib/seo-log';
import { AI_BOTS, BUSINESS_TYPES, SEPARATORS, cleanEntity } from '@/lib/seo-core.mjs';
import { can } from '@/lib/roles';
import { create404Redirect, clear404Log, delete404, saveSeoEntity, saveSeoGeneral, saveSeoLlms, saveSeoRobots, set404Ignored } from '../../seo/actions';
import ConfirmButton from '@/components/admin/ConfirmButton';
import '../../css/settings.css';
import '../../css/seo.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'SEO & AI' };

const TABS = [
  ['general', 'General'],
  ['business', 'Business profile'],
  ['robots', 'Robots & AI crawlers'],
  ['ai', 'AI & llms.txt'],
  ['schema', 'Structured data'],
  ['404', '404 monitor'],
] as const;
type Tab = (typeof TABS)[number][0];

type SP = FlashParams & { tab?: string; pick?: string; show?: string };

export default async function SeoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireCap('manage_seo');
  const sp = await searchParams;
  const tab: Tab = (TABS.map((t) => t[0]) as string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : 'general';
  const seo = getSeo();
  const open404 = count404();

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>SEO &amp; AI</h1>
          <p>Search engines (SEO), answer engines (AEO), generative AI (GEO) and AI Overviews (AIO): titles, structured data, crawler rules, llms.txt and a 404 monitor. Per-page fields are on each page’s settings and in the page builder.</p>
        </div>
      </div>

      <nav className="sc-tabs" aria-label="SEO sections">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/seo?tab=${k}`} aria-current={k === tab ? 'true' : undefined}>
            {label}{k === '404' && open404 ? ` (${open404})` : ''}
          </Link>
        ))}
      </nav>

      <Flash params={sp} />
      {seo.general.noindexSite && (
        <div className="sc-flash sc-flash-err" role="alert">
          <b>Search engines are discouraged from this whole site.</b> Every page is marked noindex, robots.txt disallows all crawlers and the sitemap and llms.txt are empty. Untick the box under General when you are ready to go live.
        </div>
      )}

      {tab === 'general' && <General seo={seo} />}
      {tab === 'business' && <Business seo={seo} />}
      {tab === 'robots' && <Robots seo={seo} />}
      {tab === 'ai' && <Ai seo={seo} />}
      {tab === 'schema' && <Schema pick={sp.pick} />}
      {tab === '404' && <NotFound showIgnored={sp.show === 'ignored'} canRedirect={can(user, 'manage_site')} />}
    </>
  );
}

// ======================================================================================== General
function General({ seo }: { seo: ReturnType<typeof getSeo> }) {
  const g = seo.general;
  const s = seo.site;
  const example = g.template.replace('%page%', 'About us').replace('%site%', s.title).replace('%sep%', g.sep).replace('%tagline%', s.tagline);
  return (
    <form action={saveSeoGeneral} className="sc-stack">
      <section className="sc-card sc-form" aria-labelledby="g-titles">
        <h2 id="g-titles" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Titles &amp; description</h2>
        <div className="sc-field">
          <label htmlFor="g-template">Title format</label>
          <input className="sc-input" id="g-template" name="template" defaultValue={g.template} maxLength={120} />
          <span className="sc-help">Tokens: <code>%page%</code> <code>%sep%</code> <code>%site%</code> <code>%tagline%</code>. Today it produces: <b>{example}</b></span>
        </div>
        <div className="sc-field">
          <label htmlFor="g-sep">Separator</label>
          <select className="sc-select" id="g-sep" name="sep" defaultValue={g.sep}>
            {(SEPARATORS as string[]).map((x) => (<option key={x} value={x}>{x}</option>))}
          </select>
          <span className="sc-help">The home page uses “{s.title} {g.sep} {s.tagline}”.</span>
        </div>
        <div className="sc-field is-wide">
          <label htmlFor="g-desc">Default description</label>
          <textarea className="sc-textarea" id="g-desc" name="seo_default_description" defaultValue={getSetting('seo_default_description')} rows={3} maxLength={320} placeholder={s.description} />
          <span className="sc-help">Used by pages without their own description (about 150–160 characters works best).</span>
        </div>
        <div className="sc-field is-wide"><MediaField name="seo_default_og_image__pick" defaultValue={s.defaultOgImage} kind="image" label="Default social sharing image" help="Shown when a page is shared and has no image of its own (1200×630 works well)." /></div>
      </section>

      <section className="sc-card sc-form" aria-labelledby="g-social">
        <h2 id="g-social" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Social</h2>
        <div className="sc-field">
          <label htmlFor="g-tw">Twitter / X handle</label>
          <input className="sc-input" id="g-tw" name="twitter" defaultValue={g.twitter} maxLength={16} placeholder="dassrebar" />
          <span className="sc-help">Without the @.</span>
        </div>
        <div className="sc-field">
          <label htmlFor="g-loc">Language / region for Open Graph</label>
          <input className="sc-input" id="g-loc" name="locale" defaultValue={g.locale} maxLength={5} placeholder="en_CA" />
        </div>
      </section>

      <section className="sc-card sc-form" aria-labelledby="g-verify">
        <h2 id="g-verify" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Site verification</h2>
        <p className="se-lead" style={{ gridColumn: '1 / -1', margin: 0 }}>Paste the code (or the whole meta tag) each service gives you. They are added to the home page and every other page’s head.</p>
        {([['v_google', 'Google Search Console', g.verify.google], ['v_bing', 'Bing Webmaster Tools', g.verify.bing], ['v_yandex', 'Yandex', g.verify.yandex], ['v_pinterest', 'Pinterest', g.verify.pinterest], ['v_facebook', 'Facebook domain', g.verify.facebook]] as const).map(([name, label, val]) => (
          <div className="sc-field" key={name}>
            <label htmlFor={name}>{label}</label>
            <input className="sc-input" id={name} name={name} defaultValue={val} maxLength={400} autoComplete="off" spellCheck={false} />
          </div>
        ))}
      </section>

      <section className="sc-card" aria-labelledby="g-vis">
        <h2 id="g-vis">Visibility</h2>
        <label className="sc-check"><input type="checkbox" name="noindexSite" defaultChecked={g.noindexSite} /> Discourage search engines from indexing this site</label>
        <p className="sc-help" style={{ marginTop: 8 }}>Adds “noindex, nofollow” to every page and makes robots.txt disallow everything. Use it while the site is being built or on a staging copy — and <b>remember to turn it off at launch</b>. (It asks politely; well-behaved crawlers respect it, but it is not a security measure.)</p>
      </section>

      <div className="sc-settings-save"><button className="sc-btn sc-btn-primary" type="submit">Save</button></div>
    </form>
  );
}

// ======================================================================================== Business
function Business({ seo }: { seo: ReturnType<typeof getSeo> }) {
  const e = cleanEntity(seo.entityRaw).entity;
  const s = seo.site;
  const f = (name: string, label: string, value: string, extra: { placeholder?: string; max?: number; help?: string; wide?: boolean; type?: string } = {}) => (
    <div className={`sc-field${extra.wide ? ' is-wide' : ''}`}>
      <label htmlFor={`b-${name}`}>{label}</label>
      <input className="sc-input" id={`b-${name}`} name={name} type={extra.type ?? 'text'} defaultValue={value} maxLength={extra.max ?? 200} placeholder={extra.placeholder} />
      {extra.help ? <span className="sc-help">{extra.help}</span> : null}
    </div>
  );
  return (
    <form action={saveSeoEntity} className="sc-stack">
      <section className="sc-card sc-form" aria-labelledby="b-who">
        <h2 id="b-who" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Who you are</h2>
        <p className="se-lead" style={{ gridColumn: '1 / -1', margin: 0 }}>This becomes the Organization / LocalBusiness structured data that search engines and AI assistants use to identify the business. Empty fields fall back to your Settings (site title, logo, phone, email).</p>
        <div className="sc-field">
          <label htmlFor="b-type">Business type</label>
          <select className="sc-select" id="b-type" name="type" defaultValue={e.type}>
            {(BUSINESS_TYPES as [string, string][]).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
          </select>
        </div>
        {f('name', 'Business name', e.name, { placeholder: s.title })}
        {f('legal', 'Legal name', e.legal, { placeholder: 'Dass Rebar Inc.' })}
        {f('founded', 'Year founded', e.founded, { max: 4, placeholder: '1985' })}
        <div className="sc-field is-wide">
          <label htmlFor="b-desc">Description</label>
          <textarea className="sc-textarea" id="b-desc" name="description" rows={3} maxLength={1000} defaultValue={e.description} placeholder={s.description} />
        </div>
        <div className="sc-field is-wide"><MediaField name="logo__pick" defaultValue={e.logo} kind="image" label="Logo" help={s.logo ? 'Empty uses the logo from Settings.' : 'Square or wide logo on a transparent or white background.'} /></div>
      </section>

      <section className="sc-card sc-form" aria-labelledby="b-contact">
        <h2 id="b-contact" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Contact &amp; location</h2>
        {f('email', 'Email', e.email, { placeholder: s.email || 'sales@example.com', type: 'email' })}
        {f('phone', 'Phone', e.phone, { placeholder: s.phone || '(905) 555-0100', max: 30 })}
        {f('street', 'Street address', e.street, { wide: true })}
        {f('city', 'City', e.city, { max: 100 })}
        {f('region', 'Province / state', e.region, { max: 100, placeholder: 'ON' })}
        {f('postal', 'Postal code', e.postal, { max: 20 })}
        {f('country', 'Country', e.country, { max: 60, placeholder: 'CA' })}
        {f('lat', 'Latitude', e.lat, { max: 12, placeholder: '43.6532' })}
        {f('lng', 'Longitude', e.lng, { max: 12, placeholder: '-79.3832' })}
        <div className="sc-field is-wide">
          <label htmlFor="b-hours">Opening hours</label>
          <textarea className="sc-textarea se-code" id="b-hours" name="hours" rows={4} defaultValue={e.hours.join('\n')} placeholder={'Mo-Fr 07:00-17:00\nSa 08:00-12:00'} />
          <span className="sc-help">One line per range: day(s) then 24-hour times, e.g. <code>Mo-Fr 07:00-17:00</code>. Days: Mo Tu We Th Fr Sa Su.</span>
        </div>
        <div className="sc-field is-wide">
          <label htmlFor="b-areas">Service areas</label>
          <textarea className="sc-textarea" id="b-areas" name="areas" rows={3} defaultValue={e.areas.join('\n')} placeholder={'Toronto\nGreater Toronto Area\nOntario'} />
          <span className="sc-help">One place per line — cities, regions or provinces you serve.</span>
        </div>
        <div className="sc-field is-wide">
          <label htmlFor="b-same">Profiles &amp; listings (sameAs)</label>
          <textarea className="sc-textarea" id="b-same" name="sameAs" rows={4} defaultValue={e.sameAs.join('\n')} placeholder={'https://www.linkedin.com/company/…\nhttps://www.facebook.com/…'} />
          <span className="sc-help">One full web address per line: social profiles, Google Business Profile, directories. Helps AI tools recognise it’s the same business.</span>
        </div>
      </section>
      <div className="sc-settings-save"><button className="sc-btn sc-btn-primary" type="submit">Save business profile</button></div>
    </form>
  );
}

// ======================================================================================== Robots
function Robots({ seo }: { seo: ReturnType<typeof getSeo> }) {
  return (
    <form action={saveSeoRobots} className="sc-stack">
      <section className="sc-card">
        <h2>AI &amp; answer-engine crawlers</h2>
        <p className="se-lead">Allowing a crawler lets that service learn from and cite your pages — the default, and best for being found in AI answers. Blocking one asks it to stay away (it adds a Disallow rule to robots.txt).</p>
        <div className="sc-tablewrap">
          <table className="se-bots">
            <thead><tr><th>Crawler</th><th>Service</th><th>What it does</th><th>Rule</th></tr></thead>
            <tbody>
              {(AI_BOTS as { ua: string; vendor: string; note: string }[]).map((b) => {
                const blocked = seo.robots.bots[b.ua] === 'disallow';
                return (
                  <tr key={b.ua}>
                    <td><code>{b.ua}</code></td>
                    <td>{b.vendor}</td>
                    <td className="sc-muted">{b.note}</td>
                    <td>
                      <div className="se-seg" role="radiogroup" aria-label={`${b.ua} rule`}>
                        <label><input type="radio" name={`bot_${b.ua}`} value="allow" defaultChecked={!blocked} /><span>Allow</span></label>
                        <label><input type="radio" name={`bot_${b.ua}`} value="disallow" defaultChecked={blocked} /><span>Disallow</span></label>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="sc-card">
        <h2>Extra robots.txt rules</h2>
        <div className="sc-field">
          <textarea className="sc-textarea se-code" name="extra" rows={5} defaultValue={seo.robots.extra} spellCheck={false} aria-label="Extra robots.txt rules" placeholder={'User-agent: AhrefsBot\nDisallow: /'} />
          <span className="sc-help">Added to the end of robots.txt exactly as written (one directive per line). /admin, /api/ and the builder are always kept out for everyone.</span>
        </div>
      </section>
      <div className="sc-settings-save"><button className="sc-btn sc-btn-primary" type="submit">Save crawler rules</button></div>
      <section className="sc-card">
        <h2>robots.txt <a className="sc-rowlink" href="/robots.txt" target="_blank" rel="noopener" style={{ fontSize: 13, fontWeight: 500 }}>open ↗</a></h2>
        <pre className="se-pre" aria-label="Current robots.txt">{buildRobotsTxt(seo)}</pre>
      </section>
    </form>
  );
}

// ======================================================================================== AI / llms.txt
function Ai({ seo }: { seo: ReturnType<typeof getSeo> }) {
  const text = buildLlmsTxt();
  const lines = (text ?? '').split('\n');
  return (
    <form action={saveSeoLlms} className="sc-stack">
      <section className="sc-card">
        <h2>llms.txt</h2>
        <p className="se-lead">A plain-text map of the site for AI assistants (<a className="sc-rowlink" href="https://llmstxt.org" target="_blank" rel="noopener">llmstxt.org</a>): who you are, your pages with their direct-answer summaries, your articles and how to contact you. A longer version with the full text of every page is served at /llms-full.txt. Drafts, trash, scheduled and noindex pages are never included.</p>
        <label className="sc-check"><input type="checkbox" name="enabled" defaultChecked={seo.llms.enabled} /> Serve /llms.txt and /llms-full.txt</label>
        <div className="sc-field" style={{ marginTop: 16 }}>
          <label htmlFor="ai-intro">Introduction</label>
          <textarea className="sc-textarea" id="ai-intro" name="intro" rows={5} maxLength={1500} defaultValue={seo.llms.intro} placeholder={seo.entity.description || seo.site.description} />
          <span className="sc-help">The first paragraph becomes the one-line summary under the site name; further paragraphs are added as details. Empty uses your business description.</span>
        </div>
        <div className="se-inline" style={{ marginTop: 14 }}>
          <button className="sc-btn sc-btn-primary" type="submit">Save</button>
          <a className="sc-btn" href="/llms.txt" target="_blank" rel="noopener">Open llms.txt ↗</a>
          <a className="sc-btn" href="/llms-full.txt" target="_blank" rel="noopener">Open llms-full.txt ↗</a>
        </div>
      </section>
      <section className="sc-card">
        <h2>Preview</h2>
        {text === null ? <p className="sc-muted" style={{ margin: 0 }}>{seo.general.noindexSite ? 'Not served: the whole site is hidden from search engines.' : 'Not served: llms.txt is switched off.'}</p> : <pre className="se-pre" aria-label="llms.txt preview">{lines.slice(0, 80).join('\n')}{lines.length > 80 ? '\n…' : ''}</pre>}
      </section>
    </form>
  );
}

// ======================================================================================== Structured data preview
function Schema({ pick }: { pick?: string }) {
  const pages = all<{ id: number; path: string; title: string }>("SELECT id, path, title FROM pages WHERE status = 'published' ORDER BY path");
  const posts = all<{ id: number; slug: string; title: string }>("SELECT id, slug, title FROM posts WHERE status = 'published' AND external_url = '' ORDER BY published_at DESC LIMIT 100");
  const m = /^(page|post):(\d+)$/.exec(pick ?? '');
  const postRow = m?.[1] === 'post' ? posts.find((p) => p.id === Number(m[2])) : undefined;
  const pageRow = (m?.[1] === 'page' ? pages.find((p) => p.id === Number(m[2])) : undefined) ?? pages.find((p) => p.path === '') ?? pages[0];

  let data: object[] = [];
  let label = '';
  if (postRow) {
    const card = getPostBySlug(postRow.slug, { preview: true });
    if (card) { data = postJsonLd({ ...(card as any), tags: card.tags }); label = `Article: ${postRow.title}`; }
  } else if (pageRow) {
    const full = getPageById(pageRow.id);
    if (full) { data = pageJsonLd(full, pageDoc(full).nodes); label = `Page: ${full.title} (/${full.path})`; }
  }
  const selected = postRow ? `post:${postRow.id}` : pageRow ? `page:${pageRow.id}` : '';
  return (
    <div className="sc-stack">
      <section className="sc-card">
        <h2>Generated structured data (JSON-LD)</h2>
        <p className="se-lead">This is exactly what each public page includes for search engines and AI tools: the business (full on the home page, referenced elsewhere), the page type, breadcrumbs, articles and — only where “Add FAQ structured data” is switched on — FAQs. Read-only: change the inputs on the Business profile tab and in each page’s settings.</p>
        <form method="get" action="/admin/seo" className="se-inline" id="schema-pick">
          <input type="hidden" name="tab" value="schema" />
          <select className="sc-select" aria-label="Page or article" defaultValue={selected} name="pick" style={{ maxWidth: 420 }}>
            <optgroup label="Pages">{pages.map((p) => (<option key={p.id} value={`page:${p.id}`}>{p.title} — /{p.path}</option>))}</optgroup>
            {posts.length ? <optgroup label="Articles">{posts.map((p) => (<option key={p.id} value={`post:${p.id}`}>{p.title}</option>))}</optgroup> : null}
          </select>
          <button className="sc-btn" type="submit">Show</button>
        </form>
        <p className="se-note" style={{ margin: '10px 0' }}>{label || 'No published page to preview yet.'} · {data.length} object{data.length === 1 ? '' : 's'}: {data.map((d: any) => d['@type']).join(', ') || '—'}</p>
        <pre className="se-pre" aria-label="Generated JSON-LD">{data.map((d) => JSON.stringify(d, null, 2)).join('\n\n')}</pre>
      </section>
    </div>
  );
}

// ======================================================================================== 404 monitor
function NotFound({ showIgnored, canRedirect }: { showIgnored: boolean; canRedirect: boolean }) {
  const rows = list404({ ignored: showIgnored });
  return (
    <div className="sc-stack">
      <section className="sc-card">
        <div className="pg-card-h" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>{showIgnored ? 'Ignored addresses' : 'Pages visitors could not find'}</h2>
          <span className="sc-faint">{rows.length} {rows.length === 1 ? 'address' : 'addresses'}</span>
        </div>
        <p className="se-lead">Every address that returned “page not found” on the public site, most-hit first. Fix real ones with a redirect to the right page. Obvious bot probes and image / script files are not listed. The list keeps the 500 most recent addresses.</p>
        <div className="se-inline" style={{ marginBottom: 12 }}>
          <Link className="sc-btn sc-btn-sm" href={showIgnored ? '/admin/seo?tab=404' : '/admin/seo?tab=404&show=ignored'}>{showIgnored ? '← Back to the list' : 'Show ignored'}</Link>
          {!showIgnored && rows.length > 0 && (
            <form action={clear404Log}><ConfirmButton className="sc-btn sc-btn-sm sc-btn-danger" message="Clear the whole list? (Ignored addresses are kept.)">Clear list</ConfirmButton></form>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="sc-empty">{showIgnored ? 'Nothing ignored.' : 'No missing pages recorded — nothing to fix.'}</div>
        ) : (
          <div className="sc-tablewrap">
            <table className="sc-table">
              <thead><tr><th>Address</th><th>Hits</th><th>Last seen</th><th>Came from</th><th>Fix</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="se-path">{r.path}</span></td>
                    <td>{r.hits}</td>
                    <td className="sc-muted">{stamp(r.last_seen)}</td>
                    <td className="sc-muted" style={{ wordBreak: 'break-all', maxWidth: 220 }}>{r.referrer || '—'}</td>
                    <td>
                      <div className="se-inline">
                        {!showIgnored && canRedirect && (
                          <form action={create404Redirect} className="se-inline">
                            <input type="hidden" name="id" value={r.id} />
                            <input className="sc-input" name="to" placeholder="/new-page" aria-label={`Redirect ${r.path} to`} required maxLength={2000} style={{ minWidth: 150 }} />
                            <button className="sc-btn sc-btn-sm sc-btn-primary" type="submit">Create redirect</button>
                          </form>
                        )}
                        <form action={set404Ignored}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="ignored" value={showIgnored ? '0' : '1'} />
                          <button className="sc-btn sc-btn-sm" type="submit">{showIgnored ? 'Stop ignoring' : 'Ignore'}</button>
                        </form>
                        <form action={delete404}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="show" value={showIgnored ? 'ignored' : ''} />
                          <button className="sc-btn sc-btn-sm" type="submit" aria-label={`Remove ${r.path} from the list`}>Remove</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
