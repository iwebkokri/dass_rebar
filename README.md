# Dass Rebar — Website (Next.js + Node.js + Studio CMS + visual page builder)

Next.js 16 (App Router, TypeScript) running as a **Node.js server**, with a **SQLite database** in the project's `data/` folder, a
WordPress-style admin (**Studio CMS** at `/admin`) and an Elementor-style **front-end page builder**.
Requires **Node.js 22.13 or newer** (the database uses Node's built-in SQLite, so there is nothing to compile).

## Run it locally

```bash
npm install
npm run seed                                   # fills data/dassrebar.db with the site's pages, header/footer, menus and content (only what is missing)
npm run admin:create -- you@example.com        # creates your login; prints a password once (or pass your own as the 2nd argument; --role=editor|author)
npm run dev                                    # http://localhost:3000   ·   admin: http://localhost:3000/admin
```

Production build: `npm run build && npm start`. After pulling changes that delete or rename routes, restart `npm run dev`.

## How the site works

**Every public page is a document in the database** — sections › rows › columns › widgets — drawn by one renderer. The header and
footer are documents too (templates). There is no page text hard-coded in the code any more: edit it in the builder.

* Sign in, open any page on the site and click **Edit with builder** in the black bar at the top (or Pages → *Edit with builder*).
* In the builder: click any text to type on the page; select an element for its settings (Content / Style / Advanced, per-device
  values for desktop / tablet / mobile); drag elements from the left panel, or drag existing ones by the handle on their toolbar;
  add sections with the **+** between sections; change a row's columns from its toolbar; use **Layers** to navigate, **Undo/Redo**
  (Ctrl+Z / Ctrl+Y), **Save** (Ctrl+S). Click the dimmed header or footer to edit it. **Save** to library turns a section into a reusable
  saved section (insert it as a copy, or as a live link that updates everywhere). Revisions of every save are listed under **Page**.
* Widgets: heading, text, image, button, spacer, divider, icon, icon box, list, counter, accordion, social icons, video (upload,
  YouTube, Vimeo), image gallery with lightbox, hero slider, map, custom HTML (administrators only), saved section, navigation menu,
  logo, and the CMS-driven ones — projects, insights, products, bar-data table & diagrams, weight calculator, quote wizard, contact
  form, newsletter, and *Custom form* (built under Forms).

Architecture notes for developers: [`docs/BUILDER.md`](docs/BUILDER.md).

## Studio CMS (`/admin`)

| Area | What it does |
|---|---|
| **Dashboard** | At-a-glance counts, quick draft, recent pages / submissions / activity |
| **Pages** | List with Published / Draft / Scheduled / Trash tabs, search, bulk actions; new page (blank, duplicate, saved layout); settings: path, status, schedule, layout (with / without header & footer), SEO, social image, revisions |
| **Posts**, **Categories**, **Tags**, **Comments** | Articles with categories & tags, scheduling, authors, SEO, revisions; public comments with moderation (pending / approved / spam / trash) and replies |
| **Media** | Upload (images, video up to 50 MB, documents), grid / list, folders, alt text & captions, replace file, "used in" warnings; the picker is used everywhere an image is chosen |
| **Templates** | Header, footer, saved sections, page layouts; choose which header / footer is active |
| **Menus** | Drag-and-drop menu builder (nesting → dropdowns), used by the navigation widget |
| **Forms**, **Submissions** | Build forms (field types, required, options, success message / redirect); entries from every form are stored, filterable, exportable as CSV; customer files are private |
| **Projects / Products / Bar data** | The data behind the CMS-driven widgets |
| **Users** | Administrator / Editor / Author roles (see below), password reset, reassign content on delete |
| **Redirects** | 301 / 302 / 307 / 308 with hit counts, CSV import, loop checks; created automatically when a page path changes |
| **Import / Export** | JSON export of pages, templates, menus, forms, posts, projects … and a validated, dry-run-first import |
| **Activity log** | Who changed what, when |
| **Settings** | Site title / tagline / logo / favicon, contact details, SEO defaults, brand colour palette (offered by the builder), notification recipients, bar-data diagrams |

**Roles** — *Administrator*: everything. *Editor*: pages & the builder, all posts, media, comments, submissions, projects, products
(not users, settings, header/footer, redirects, import/export). *Author*: their own posts and media only.

## Where things are

| | |
|---|---|
| `app/(site)/[[...slug]]/` | the public site: one catch-all route renders the page stored at that path |
| `app/admin/` | Studio CMS; `app/admin/builder/` is the page builder, `app/builder-frame/` the editable canvas it embeds |
| `components/builder/` | renderer, widgets (`widgets/`), base styles (`builder.css`, `dynamic.css`) and the editor (`editor/`) |
| `lib/builder/` | the widget & control schema, CSS generator, tree operations, server-side sanitiser |
| `db/` | the site's pages, templates and menus as code (`db/pages`, `db/templates`, `db/menus`) — used by `npm run seed` |
| `data/` | **your content** — `dassrebar.db`, `uploads/`, `private/`. Git-ignored |

The public pages read the database on every request, so an edit shows up immediately and replacing the database file needs no rebuild.
To restore a page to its original design: `npm run seed -- --only=about` (rewrites just that definition; `--reset-pages` rewrites all).

## Environment variables

See [`.env.example`](.env.example). All optional. Important: `DATA_DIR` (where the database lives), `SITE_URL`, and the `SMTP_*` lines for
emailed notifications. Without SMTP, submissions are still saved and shown in the CMS.

## Deploying to Hostinger

> **Plan:** Hostinger runs Node.js apps only on **Business** and **Cloud** plans — not Premium/Single. Deploy to Cloud.

1. **Create a Node.js web app** in hPanel (Next.js preset), from a Git repo or an uploaded zip of this project (leave out `node_modules`, `.next*` and `data`).
2. **Node version:** choose **22.x or 24.x**.
3. **Commands:** install `npm install` · build `npm run build` · start `npm start`.
4. **Environment variables:** at least `DATA_DIR` pointing to a folder **outside** the app folder (e.g. `/home/<user>/dassrebar-data`), plus `SITE_URL=https://yourdomain` and the `SMTP_*` values if you want emails.
5. **Move the database:** stop the app, upload the contents of your local `data/` folder (`dassrebar.db`, `uploads/`, `private/`) into `DATA_DIR`, start it.
   Starting from nothing instead? Run `npm run seed` over SSH (with `DATA_DIR` set) to create all pages, the header / footer and menus, then `npm run admin:create -- you@example.com`.
6. Open `https://yourdomain/admin`, sign in, send a test form submission, and check **Submissions**.

**Back up** the `DATA_DIR` folder regularly — it is the whole site (content, pages and uploads). The database is one file, so a copy is a backup.

## Security notes

- Passwords are hashed with scrypt; login is rate-limited (8 failures / 15 min per IP and per email). Sessions are random tokens stored hashed, in an `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie, 7-day expiry.
- Every admin page, route and action checks the session **and the role's capability** itself. Customer files are never public.
- Everything the page builder saves is validated on the server against the widget schema: unknown elements / settings are dropped, rich text goes through an allow-list sanitiser, links must be http(s) / mailto / tel / site paths, colours and sizes are pattern-checked, and "Custom HTML" can only be added or changed by administrators. Two editors saving the same page are detected (no silent overwrite).
- Public forms: honeypot field, rate limit, size and file-type limits. Uploaded files are verified by content, not file name; SVG uploads are refused.
- Visitor IP addresses are used only as hashed rate-limit keys and are not stored with submissions. `/admin` and the builder canvas are `noindex` and uncached.

## Brand

Navy `#182845`, light grey `#DCDFE3`, steel `#919CA4`, brown `#7F5F47` (buttons), tan `#B0A18E`, olive `#8D8E55` (editable under Settings → Design).
#   d a s s _ r e b a r  
 