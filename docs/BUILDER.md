# Builder + Admin architecture (read this before touching the builder or the admin)

Stack: Next.js 16 (App Router, TypeScript `strict:false`), Node >= 22.13, SQLite via `node:sqlite`. Windows dev box. One DB file `data/dassrebar.db`.
`npx tsc --noEmit -p .` must stay clean. The user's dev server runs on http://localhost:3000 (do NOT stop it; do not run `next build` while it is
running — use `npx tsc --noEmit -p .` to type-check).

## 1. Page documents
A page is a JSON tree stored in `pages.content` (also `templates.content`): `{ v:1, nodes: Node[] }`, `Node = { id, type, props, children? }`.
Structure is enforced: **section > row > column > (widget | row)**.

* `lib/builder/schema.mjs` — THE registry. `WIDGETS[type] = { type, label, icon, category, defaults, controls[], needs? }`. A *control* declares one
  setting: `{ kind, key, label, tab:'content'|'style'|'advanced', group?, default?, options?, responsive?, css?:[{sel,prop,tpl}], condition?, inline?, ... }`.
  The editor's settings panel, the CSS output and the server validation are ALL generated from these declarations.
  Dynamic widgets are declared in `lib/builder/defs/dynamic.mjs`; helpers (`o`, `ctl`, `typo`) live in `lib/builder/defs/helpers.mjs`.
* `lib/builder/css.mjs` — `buildCss(nodes)` turns control `css` rules into per-node CSS (`.dr-n-<id>{...}`, with `@media (max-width:1024px)` tablet and
  `767px` mobile). Responsive values are `{d,t,m}` (desktop is the base). Values are validated; bad ones are dropped.
* `lib/builder/tree.mjs` — immutable tree ops (insert/move/remove/duplicate/setProp/applyStructure...), `makeNode`, `collectNeeds`.
* `lib/builder/sanitize.mjs` — `sanitizeDoc(doc,{isAdmin,prev})` validates EVERYTHING before it is stored (schema-driven; rich text through sanitize-html;
  URLs via `safeUrl`). Never store a document without passing it through this.
* `lib/builder/url.mjs` — `safeUrl`, `safeMediaUrl` (client-safe).
* `components/builder/Render.tsx` — `RenderDoc` / `RenderNodes` / `RenderNode`: ONE renderer for the public site (server) and the editor canvas (client).
  Each node renders `<div class="dr-n dr-n-<id> dr-t-<type> ...">`.
* `components/builder/widgets/` — widget React components, registered in `widgets/index.ts` (`COMPONENTS[type]`). Signature `({ node, ctx })` (`WidgetProps`).
  Use `<Txt node k ctx .../>` for any text a user should edit inline (plain on the public site, click-to-edit in the editor), `<BLink>` for links,
  `<Icon name>`. `ctx.data` holds datasets (see 2). `ctx.edit` is only set inside the editor — widgets must work without it.
  Interactive widgets (forms, calculators, sliders) are client components (`'use client'`).
* `components/builder/builder.css` (base look of every widget; brand: navy #182845, brown #7F5F47 / #6B4F3A, tan #B0A18E, greys #4A5568 / #3A4658 / #F4F5F7 / #E3E6EA)
  and `components/builder/dynamic.css` (append styles for CMS-driven widgets here; prefix every class `dr-`). Both are imported by `app/layout.tsx`.
* DSL for writing page content as code: `db/dsl.mjs` (`section, row, col, w.<widget>(props), cols, span, stack, band`). Responsive props `{d,t,m}`.
  Dimension props (padding / margin / radius / borderWidth) are `{t,r,b,l}` in px, responsive -> `{d:{t,r,b,l},t:{...},m:{...}}`.
  Sizes are strings: `'48px'`, `'clamp(34px,3.8vw,52px)'`. Colours: hex / rgba / `var(--x)`. Select props must equal one of the control's option values.
  Columns: `span:{d:6,t:12,m:12}` of 12 (a row is flex-wrap; a column's width is span/12 of the row including gaps, so large gaps never overflow a phone). A column is a flex column (props `direction:'row'`, `gap`, `wrap`, `colAlign`, `justify`).
  Section: `contentMode:'boxed'|'full'`, `boxWidth`, `tag`, `anchor`, background props; boxed content gets a 32px side gutter (20px on mobile) from builder.css.

## 2. Data for dynamic widgets
`lib/builder/data.ts` `loadBuilderData(needs)` -> `BuilderData` (`lib/builder/types.ts`): posts, projects, products, bars, diagrams, menus, forms, templates, categories.
Each widget def lists `needs: ['projects']`; `PageShell` loads only what the page uses. Widgets read `ctx.data.<x>` — never query the DB from a widget.
Saved sections ('section' templates) can be referenced by id or by the slug of their name (`w.template({ templateId: 'cta-band' })`).

## 3. Rendering a page (public)
`components/builder/PageShell.tsx` (server): admin bar for signed-in editors + active header template + `<main>` + active footer template.
`lib/pages.ts`: `getPageByPath`, `getActiveTemplate('header'|'footer')`, `listTemplates`. Page `layout:'canvas'` hides header and footer.
The public site is the catch-all route app/(site)/[[...slug]]/page.tsx -> PageShell (nothing is hard-coded).

## 4. Seeding page content as code
Seed files are auto-discovered by `scripts/seed.mjs`:
* `db/pages/<name>.mjs` — default export `{ path, title, seoTitle?, seoDescription?, focusKeyword?, answerSummary?, layout?, content: Node[] }` (`path` '' = home).
  `answerSummary` is the 40–60 word direct answer used for structured data / llms.txt (see docs/SEO-AND-TRACKING.md).
* `db/templates/<name>.mjs` — default export array of `{ kind: 'header'|'footer'|'section'|'page', name, content }`.
* `db/menus/<name>.mjs` — default export array of `{ slug, name, items }`; item = `{ label, url, description?, cta?, dark?, sepBefore?, children? }`.

`npm run seed -- --only=<file name without .mjs>[,<more>]` rewrites ONLY those definitions (use this; never `--reset-pages` — it rewrites everyone's).
`npm run seed -- --seo-fields` is the safe one for a live site: it fills an EMPTY focus keyword / answer summary on existing pages and changes nothing else (content included).
The seed script validates through `sanitizeDoc`, which silently drops invalid props — always check the rendered result.

## 5. Roles & permissions
`lib/roles.ts`: roles administrator / editor / author; `can(user, 'cap')`. In pages, actions and routes use `requireCap('cap')` from `lib/auth.ts`
(`requireUser()` = any signed-in user). EVERY admin page, route handler and server action must call one itself (layouts are not enough).
Authors may only edit their own posts / media: check `author_id` / `user_id === user.id` unless `can(user, 'edit_others_posts' | 'edit_others_media')`.

## 6. Admin conventions (app/admin)
Dark "Studio CMS" UI, classes prefixed `sc-` in `app/admin/admin.css` (`sc-head`, `sc-card`, `sc-btn`, `sc-btn-primary`, `sc-input`, `sc-field`, `sc-form`,
`sc-tablewrap` / `sc-table`, `sc-badge`, `sc-flash-*`, `sc-tabs`, `sc-empty`, `sc-actions`, `sc-pager` ...). Pages live in `app/admin/(panel)/<area>/page.tsx`
(the sidebar is already wired in `(panel)/layout.tsx` — don't edit the layout or the nav; routes are fixed, see section 8). Server actions go in
`app/admin/<area>/actions.ts` (own file per area: `'use server'`, start with `requireCap`, validate, `revalidatePath`, redirect back with `?saved=1` / `?error=...`
— see `components/admin/Flash.tsx`, `app/admin/actions.ts`, `lib/admin/resources.ts`, `components/admin/Field.tsx` for the existing patterns).
Client-only UI pieces go in `components/admin/<Area>*.tsx`. Put area-specific CSS in `app/admin/css/<area>.css` and import it from your pages
(don't grow admin.css). Log notable changes with `logActivity(user, 'action', 'entity', id, 'summary')` from `lib/activity.ts`.
DB: `lib/db.ts` (`all / get / run / transaction`). The schema is in `lib/db-core.mjs` (MIGRATIONS 1-2 are done and shared; 3 = SEO / AI fields + 404 log, 4 = emailer + popups; a migration may be a function that checks what exists first — see 3). If you truly need a schema change,
APPEND a new migration (never edit 1-2) and keep it minimal; prefer `settings` rows (`getSetting / setSetting`) over new tables.
Never put unescaped user text into HTML; never `dangerouslySetInnerHTML` user text.

## 7. Verifying
Type-check: `npx tsc --noEmit -p .`. Screenshots / behaviour: playwright-core + Edge exist in the scratchpad `pw/` folder
(`node shot.mjs <url> <out.png> [w] [h] [full]`). To log in to /admin use a test admin created in a COPY of the DB: copy `data/` to a scratch folder, set
`DATA_DIR` to it, run `npm run admin:create -- test@example.com <password>` with that DATA_DIR, and start a second dev server on another port
(`DATA_DIR=<scratch> npx next dev -p 33xx`) — do NOT use or modify the user's real `data/` for logins or test writes. Page-content seeding
(`npm run seed -- --only=...`) DOES target the real DB (no login needed) — that is intended.

## 8. Admin routes (fixed)
`/admin` (dashboard) · `/admin/pages`, `/admin/pages/new`, `/admin/pages/[id]` · `/admin/templates` · `/admin/posts`, `/admin/posts/new`, `/admin/posts/[id]` ·
`/admin/categories`, `/admin/tags` · `/admin/comments` · `/admin/media` · `/admin/menus` · `/admin/forms`, `/admin/forms/[id]` · `/admin/submissions` (existing) ·
`/admin/projects`, `/admin/products`, `/admin/bar-data` (existing) · `/admin/users` · `/admin/redirects` · `/admin/tools` · `/admin/activity` · `/admin/settings` · `/admin/account` ·
`/admin/builder/<target>` (the page builder; `page-<id>` or `tpl-<id>`) — owned by the builder, not by the area agents.

## 9. Contracts between areas (build to these even if the other side isn't finished yet)
* **Media** (`components/admin/MediaField.tsx`, `components/admin/MediaPicker.tsx`, `lib/media.ts`) — owner: media agent, who delivers `MediaField` FIRST.
  `<MediaField name="og_image" defaultValue={url} kind="image" label="Social image" />` is a client form field (hidden `<input name>` holding the URL + preview + Choose/Remove buttons
  that open the picker). `<MediaPicker open kind="image"|"video"|"any" onPick={(m)=>...} onClose={...} />` where `m = { id, url, alt, title, kind, mime, width, height }`.
  The picker lists `GET /api/media?kind=&q=&folder=&page=` (JSON, auth + `upload_media`) and uploads with `POST /api/media` (multipart, field `file`, returns the media record).
  Until it exists, other areas may use a plain text URL input and swap in MediaField later.
* **Redirects** — `lib/redirects.ts` exports `findRedirect(path)` (done) and `createRedirect(fromPath, toUrl, code = 301)` (redirects agent adds). Pages admin calls it when a page path changes.
* **Forms** — custom-form widget posts multipart to `/api/forms` with `type=form`, `form_id=<forms.id>`, one field per form field named by its `id`, plus the honeypot `website`.
  The forms agent implements the server side and the admin; the widget agent implements the front-end widget (`type: 'form'`).
* **Posts** — `PostCard` (lib/content.ts) gains `categorySlugs: string[]`, `categories: {slug,name}[]`; `getPosts()` only returns published posts whose `published_at <= now`.
  The single-post page body is the server component `components/PostArticle.tsx` (posts agent). The insights widget filters by `props.category` (category slug) using `categorySlugs`.
* **Colours** — `getSetting('design_palette')` is JSON `[["#182845","Navy"],...]` (settings agent); the builder falls back to `PALETTE` in schema.mjs.
* **Site settings** keys (settings agent): `site_title`, `site_tagline`, `site_logo`, `site_favicon`, `seo_default_description`, `seo_default_og_image`, `contact_phone`, `contact_email`, `contact_address`, `design_palette`.
* **Page saves** from the builder go through `app/admin/builder/actions.ts` (builder owner). The pages admin only edits page *settings* (title, path, status, layout, SEO) — never the content tree.
  The builder's "SEO & AI" tab edits four page fields (`seo_title`, `seo_description`, `focus_keyword`, `answer_summary`) and saves them with the page (`SaveInput.page.seo`, validated with `cleanContentSeo`);
  conflict detection is unchanged (it still compares `pages.updated_at`).
* **Accordion** (`accordion` widget) has a switch prop `faqSchema` ("Add FAQ structured data"). Accordions with it ON are turned into one `FAQPage` JSON-LD object on the public page
  (answers as plain text, duplicates removed). Nothing else about rendering changed.
* **Page columns added by migration 3** (all `TEXT NOT NULL DEFAULT ''` unless noted): `focus_keyword, canonical_url, nofollow INTEGER, og_title, og_description, twitter_card, schema_type,
  answer_summary, breadcrumb_title, custom_jsonld` (also on `posts`, plus `posts.noindex`), and, on `pages` only, the administrator-only `code_css, code_head, code_footer`.
  `pages.noindex` remains THE "hide from search engines" flag. Editors may edit all of these except `custom_jsonld` (`manage_seo`) and the `code_*` columns (`manage_code`) — enforced in the server actions.
* **Roles**: new capabilities `manage_seo` (site-wide SEO / AI settings, llms.txt, robots, 404 monitor) and `manage_code` (tracking IDs, custom CSS / JS / HTML) — administrators only.
* **Public head / body code** comes from the root layout (`components/site/SiteCode.tsx`) and `proxy.ts` (it tells the layout whether a request is the public site, /admin or the builder canvas). Never add
  tracking or custom code anywhere else.
