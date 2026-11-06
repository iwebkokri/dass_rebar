# SEO, AI-visibility and tracking tools

Everything here lives in the admin (**Studio CMS**) and the page builder. Nothing needs a plugin or a build step.

| Admin screen | Who | What it is for |
|---|---|---|
| **SEO & AI** (`/admin/seo`) | administrators | titles, business profile, crawler rules, llms.txt, structured-data preview, 404 monitor |
| **Tracking & code** (`/admin/tracking`) | administrators | Google Analytics / Tag Manager / Ads, Meta, LinkedIn, TikTok, Clarity, custom CSS and code |
| Page settings → *AI answer & structured data*, *Advanced search & social settings* | editors + administrators | per-page fields, the SEO & AI check |
| Post editor → same fields | editors, authors (own posts) + administrators | per-article fields |
| Builder → **SEO & AI** tab | editors + administrators | the key fields and a live analysis while you edit |

## The four goals, in plain terms

* **SEO** – classic search: good titles / descriptions, canonical URLs, sitemap, robots, structured data, no broken pages.
* **GEO** (generative-engine optimisation) – being *found and cited* by ChatGPT, Perplexity, Claude, Gemini: crawler rules you control, `llms.txt`, a complete business profile (Organization / LocalBusiness data), clean text.
* **AEO** (answer-engine optimisation) – being the *quotable answer*: a 40–60 word direct answer per page, FAQ structured data, question-style headings, lists and tables.
* **AIO** (AI Overviews) – the same signals for Google's AI summaries: snippet-friendly robots tags (`max-snippet:-1`, `max-image-preview:large`), structured data, scannable content.

## Tracking & code

### Tracking IDs
Paste only the **ID**; the vendor's standard snippet is generated for you.

| Field | Format | Result |
|---|---|---|
| Google Analytics 4 | `G-XXXXXXXXXX` | gtag.js loader + `config` |
| Google Tag Manager | `GTM-XXXXXXX` | loader in `<head>` **and** the `<noscript>` iframe right after `<body>` |
| Google Ads / Google tag | `AW-123456789` | same gtag.js; optional **conversion label** is sent as a conversion each time a form is submitted |
| Meta (Facebook) Pixel | digits | `PageView`, `Lead` on form submit, `<noscript>` pixel |
| LinkedIn Insight Tag | digits | insight tag + `<noscript>` pixel |
| TikTok Pixel | letters/digits | pixel + `page()`; `SubmitForm` on form submit |
| Microsoft Clarity | letters/digits | Clarity tag |

* Every ID is checked against a strict pattern when saved **and again on every read**. A malformed value (anything that could carry script) is rejected with a message and **nothing at all is saved** until it is fixed. IDs are also embedded with `JSON.stringify`.
* If both Tag Manager and Analytics 4 are set, both load — a hint reminds you that GA4 is usually configured *inside* GTM (otherwise visits count twice).
* **Form conversions.** Every site form (contact, quote, calculator, newsletter, custom forms) fires a browser event `dr:form-success` after a successful submit (`lib/submit-form.ts`). The snippets forward it to GA4 (`generate_lead`), Google Ads (conversion), Meta (`Lead`), TikTok (`SubmitForm`) and the GTM data layer (`dr_form_success`, so a GTM trigger can use it).
* **Signed-in users are not tracked** (checkbox, on by default). It applies to the built-in trackers only, evaluated per request (pages are rendered on demand, so there is no caching problem). Your own custom code below is always output.

### Custom CSS, header / body / footer code
* **Custom CSS** – applied on every public page *and shown inside the page builder canvas*, so you see your styling while editing. (A page's own CSS also shows in the canvas.)
* **Header code** – inside `<head>`. Real elements are created for `script`, `style`, `link`, `meta`, `noscript` and `base`; anything else (`<div>`, `<img>`, stray text) is invalid in `<head>` and is ignored, with a note after saving. Inline event attributes (`onload=…`) and `style=` attributes are dropped on these elements – use a script instead.
* **Body-open code** – immediately after `<body>` (Next.js puts one empty hidden marker element before it; the GTM `<noscript>` is the first real element).
* **Footer code** – just before `</body>`.
* Per page: the page settings screen has **CSS / Header code / Footer code for this page only**.

**Where it is *not* output:** `/admin/*` and the builder canvas never get trackers or custom scripts (the canvas gets custom CSS only). `proxy.ts` tags each request as `site`, `admin` or `frame`; the root layout (`components/site/SiteCode.tsx`) reads that tag. The tag is set by the server and overwrites anything a browser sends. Plain links (not client-side navigation) lead from the public admin bar to the admin, so a tracker that is already running can't follow an editor into it.

**Why administrators only (`manage_code`):** custom JavaScript/HTML is output **exactly as typed** on every public page and runs for every visitor with the site's own privileges. That is as powerful as server access, so it is not available to editors; the server enforces this on every save (a forged form field from an editor is ignored), and imports only carry it when an administrator imports. Only paste code from sources you trust. Custom *CSS* is cleaned only for the one thing that could break out of its `<style>` element (`</style`).

**Consent.** This site does **not** include a cookie-consent banner. Analytics and advertising pixels set cookies and share visitor data with third parties. For visitors in the EU, UK or Canada you will likely need consent before these load — use a consent tool (for example Tag Manager's consent mode with a CMP). That is not built in.

## SEO & AI settings (`/admin/seo`)

* **General** – title format (`%page% %sep% %site% %tagline%`) and separator, default description and social image, Twitter/X handle, language/region for Open Graph, verification codes (Google, Bing, Yandex, Pinterest, Facebook domain; paste the code or the whole meta tag), and **Discourage search engines** (noindex + nofollow everywhere, robots.txt `Disallow: /`, empty sitemap, llms.txt off, with a red banner so it isn't forgotten at launch). A title that already contains the site name is used as written, never repeated.
* **Business profile** – type (Organization / LocalBusiness / ProfessionalService …), names, logo, description, founding year, contact, address, latitude/longitude, opening hours (`Mo-Fr 07:00-17:00`), service areas, profile links (`sameAs`). Empty fields fall back to Settings (site title, logo, phone, email).
* **Robots & AI crawlers** – allow or block GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended, CCBot, Bytespider, Meta-ExternalAgent, Amazonbot, cohere-ai (default: allow, which maximises generative visibility), plus extra raw `robots.txt` lines. `/robots.txt` is generated from this; `/admin`, `/api/` and the builder are always disallowed; the sitemap is listed. Blocking a crawler also costs you citations from that service — it is your choice and is shown as a warning in the analysis.
* **AI & llms.txt** – `/llms.txt` (llmstxt.org: site name, one-line summary, **Pages** with each page's direct answer, **Insights**, **Contact**) and `/llms-full.txt` (the full text of every page and article, plus the data behind the Products / Projects / Bar-data widgets). Both exclude drafts, trash, scheduled pages and anything noindex, are rebuilt on every request (cached 60 s) and can be switched off.
* **Structured data** – a read-only preview of exactly the JSON-LD a chosen page or article will output.
* **404 monitor** – every public "page not found" (path, hits, last seen, referrer), most-hit first. *Create redirect* turns an entry into a 301 in one step (it uses the normal redirect rules: no loops, no shadowing a live page); *Ignore*, *Remove*, *Clear list*. Bot probes (`wp-login.php`, `.env`, …) and static-file requests are not recorded; the list keeps the 500 most recent paths.

`sitemap.xml` includes `lastmod`, and leaves out noindex pages/articles, pages whose canonical points elsewhere, and everything while the site is hidden.

## Per-page and per-article fields

| Field | Effect |
|---|---|
| SEO title / Meta description | `<title>` (with the site format) and `<meta name="description">` |
| Focus keyword | only used by the analysis |
| Direct answer (40–60 words) | structured-data `description` + `abstract`, llms.txt; **not** shown on the page |
| Structured data type | Web page / About / Contact / Collection (auto from the address if empty); articles: BlogPosting / Article / NewsArticle |
| Breadcrumb title | last item of the breadcrumb |
| Canonical URL | `<link rel="canonical">` (default: the page's own address) |
| noindex / nofollow | robots meta (`index/noindex`, `follow/nofollow`); noindex also removes it from the sitemap and llms.txt |
| Social title / description / card | Open Graph + Twitter tags |
| Custom JSON-LD *(administrators)* | extra objects appended to the generated data; must be valid JSON |
| CSS / Header / Footer code *(administrators, pages only)* | that page only |

Metadata also carries `robots` with `max-snippet:-1`, `max-image-preview:large`, `max-video-preview:-1` on indexable pages, Open Graph `article` data for posts (published/modified time, author, section, tags), and the canonical URL as an absolute address built from `SITE_URL`.

## Structured data (JSON-LD) emitted on public pages

One `<script type="application/ld+json">` per object, escaped so `<` can never close the script:

* **Home:** Organization / LocalBusiness (from the business profile) + WebSite + WebPage.
* **Other pages:** the page type (AboutPage, ContactPage, CollectionPage or WebPage) with the business referenced by `@id`, plus **BreadcrumbList** (parent titles are looked up from published pages).
* **Articles:** BlogPosting (headline, description, image, dates, author, publisher, `mainEntityOfPage`) + BreadcrumbList.
* **FAQPage** – only from accordion widgets whose **Add FAQ structured data** switch is on (answers as plain text, duplicate questions removed). Use it only for genuine FAQs.
* Custom JSON-LD is appended. Drafts/previews output none.

## The SEO & AI check

`lib/builder/seo-analysis.mjs` is one pure function used in the browser (live, in the builder) and on the server (page settings, the Pages list). Each check is *pass*, *warn* or *fail* with a fix hint; the two scores (0–100) average them (pass = 1, warn = ½, fail = 0).

* **SEO:** title length, description length, focus keyword in title / description / address / H1 / opening text / a subheading, exactly one H1, heading order, word count, images without alt text, empty or `#` links and internal links, canonical validity, noindex warning, social image.
* **AI-readiness:** 40–60 word direct answer, FAQ block with schema on, question-style headings, lists/tables, short paragraphs, complete business profile, author + dates (articles), llms.txt on, AI crawlers allowed, structured data generated.

These are practical, explainable checks, not a promise about rankings.

## Import / export

*Import / Export → pages / posts / settings* carry all of the new fields. Tracking IDs are re-validated on import; custom code (`code_*` settings and the page `code_*` columns) and custom JSON-LD are only imported by an administrator; the SEO blobs (`seo_general`, `seo_entity`, `seo_robots`, `seo_llms`) are cleaned like a normal save.

## Developer map

| | |
|---|---|
| `proxy.ts` | tags requests `site` / `admin` / `frame` (+ page id for the canvas) |
| `components/site/SiteCode.tsx`, `SiteCodeBody.tsx`, `app/layout.tsx` | head / body-open / footer output |
| `lib/html-snippet.mjs` | head-code tokenizer, CSS / raw-HTML cleaners |
| `lib/tracking-core.mjs`, `lib/tracking.ts` | ID validators, vendor snippets, settings read |
| `lib/seo-core.mjs`, `lib/seo.ts` | settings shapes + cleaners, Next.js metadata, JSON-LD wrappers |
| `lib/builder/seo-schema.mjs`, `content-text.mjs`, `seo-analysis.mjs` | pure: JSON-LD, text extraction, analysis (shared server + browser) |
| `lib/llms.ts`, `lib/robots.ts`, `lib/seo-log.ts` | llms.txt, robots.txt, 404 log |
| `app/robots.txt/route.ts`, `app/llms*.txt/route.ts`, `app/sitemap.ts` | the public files |
| `app/admin/(panel)/seo`, `…/tracking`, `app/admin/seo/actions.ts`, `app/admin/tracking/actions.ts` | admin screens + actions (each calls `requireCap`) |
| `components/admin/SeoFields.tsx`, `SeoReport.tsx`, `TrackingForm.tsx`, `components/builder/editor/SeoPanel.tsx` | UI |
| DB migration 3 in `lib/db-core.mjs` | new columns + `not_found_log` (additive, checks what exists, safe to re-run) |

Settings keys: `track_*`, `code_css|head|body|footer`, `seo_general|entity|robots|llms` (JSON), `seo_default_description`, `seo_default_og_image`.

`npm run seed -- --seo-fields` gives existing pages the focus keyword / direct answer from `db/pages/*.mjs` **where they are still empty**, without touching content.
