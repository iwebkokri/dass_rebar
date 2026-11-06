// Fill an EMPTY database with the starter content from the original site.
//   npm run seed
// Safe to re-run: a table that already has rows is left alone.
import { openDatabase, getDatabasePath } from '../lib/db-core.mjs';
import { slugify } from '../lib/slug.mjs';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { sanitizeDoc } from '../lib/builder/sanitize.mjs';
import { pathToFileURL } from 'node:url';
import { BAR_DATA, FEATURED_PROJECTS, OTHER_PROJECTS, POSTS, PRODUCTS, ROSTER_TITLES, SETTINGS } from '../db/seed-data.mjs';

const db = openDatabase();
const count = (table) => db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
const report = [];

function insertAll(table, rows, fn) {
  if (count(table) > 0) {
    report.push(`${table}: already has data, skipped`);
    return;
  }
  db.exec('BEGIN');
  try {
    rows.forEach(fn);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  report.push(`${table}: added ${rows.length}`);
}

insertAll('posts', POSTS, (p) =>
  db
    .prepare(
      `INSERT INTO posts (slug, title, category, excerpt, cover_image, external_url, published_at, status, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)`
    )
    .run(p.slug, p.title, p.category, p.excerpt, p.cover_image, p.external_url, p.published_at, p.featured)
);

const projects = [
  ...FEATURED_PROJECTS.map((p, i) => ({ ...p, featured: 1, roster: 0, sort_order: i + 1 })),
  ...OTHER_PROJECTS.map(([title, location], i) => ({ title, category: '', location, address: '', images: [], featured: 0, roster: ROSTER_TITLES.includes(title) ? 1 : 0, sort_order: i + 1 })),
];
const usedSlugs = new Set();
insertAll('projects', projects, (p) => {
  let slug = slugify(p.title);
  for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(p.title)}-${n}`;
  usedSlugs.add(slug);
  db.prepare(
    `INSERT INTO projects (slug, title, category, location, address, images, featured, roster, sort_order, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(slug, p.title, p.category, p.location, p.address, JSON.stringify(p.images), p.featured, p.roster, p.sort_order);
});

insertAll('products', PRODUCTS, (p, i) =>
  db.prepare('INSERT INTO products (kind, name, sizes, description, image, sort_order, published) VALUES (?, ?, ?, ?, ?, ?, 1)').run(p.kind, p.name, p.sizes, p.description, p.image, i + 1)
);

insertAll('bar_data', BAR_DATA, ([size, mass, dia, area, perim, onRequest], i) =>
  db.prepare('INSERT INTO bar_data (bar_size, mass_kg_m, nominal_diameter_mm, area_mm2, perimeter_mm, on_request, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(size, mass, dia, area, perim, onRequest, i + 1)
);

const addSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(SETTINGS)) addSetting.run(k, v);
report.push('settings: defaults ensured');

// ---- builder content: pages, header/footer templates, menus -------------------------------------------------------------
// Definitions live in db/pages/*.mjs, db/templates/*.mjs and db/menus/*.mjs (auto-discovered; each has a default export).
// Only what is missing is added.   --reset-pages        rewrites every discovered definition
//                                   --only=home,about   rewrites just those files (names without .mjs)
const resetAll = process.argv.includes('--reset-pages');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);
const rewrite = (name) => resetAll || only.includes(name);
const clean = (nodes) => sanitizeDoc({ v: 1, nodes }, { isAdmin: true }).doc;

async function discover(dir) {
  const out = [];
  let files = [];
  try { files = readdirSync(path.join(process.cwd(), 'db', dir)).filter((f) => f.endsWith('.mjs')).sort(); } catch { return out; }
  for (const f of files) {
    const name = f.replace(/\.mjs$/, '');
    try {
      const mod = await import(pathToFileURL(path.join(process.cwd(), 'db', dir, f)).href);
      out.push({ name, value: mod.default });
    } catch (err) {
      report.push(`${dir}/${f}: FAILED to load — ${err.message}`);
    }
  }
  return out;
}

let pagesWritten = 0;
for (const { name, value: def } of await discover('pages')) {
  try {
    const existing = db.prepare('SELECT id FROM pages WHERE path = ?').get(def.path);
    if (existing && !rewrite(name)) continue;
    const content = JSON.stringify(clean(def.content));
    if (existing) {
      db.prepare("UPDATE pages SET title = ?, content = ?, seo_title = ?, seo_description = ?, layout = ?, updated_at = datetime('now') WHERE id = ?")
        .run(def.title, content, def.seoTitle || '', def.seoDescription || '', def.layout || 'default', existing.id);
    } else {
      db.prepare("INSERT INTO pages (path, title, status, layout, content, seo_title, seo_description, published_at) VALUES (?, ?, 'published', ?, ?, ?, ?, datetime('now'))")
        .run(def.path, def.title, def.layout || 'default', content, def.seoTitle || '', def.seoDescription || '');
    }
    pagesWritten++;
  } catch (err) { report.push(`pages/${name}: FAILED — ${err.message}`); }
}
report.push(`pages: ${pagesWritten} written`);

let tplWritten = 0;
for (const { name: file, value: list } of await discover('templates')) {
  for (const t of list || []) {
    try {
      const existing = db.prepare('SELECT id FROM templates WHERE kind = ? AND name = ?').get(t.kind, t.name);
      if (existing && !rewrite(file)) continue;
      const content = JSON.stringify(clean(t.content));
      if (existing) db.prepare("UPDATE templates SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, existing.id);
      else {
        const live = t.kind === 'header' || t.kind === 'footer';
        const hasActive = live && db.prepare('SELECT 1 FROM templates WHERE kind = ? AND active = 1').get(t.kind);
        db.prepare('INSERT INTO templates (kind, name, content, active) VALUES (?, ?, ?, ?)').run(t.kind, t.name, content, live && !hasActive ? 1 : 0);
      }
      tplWritten++;
    } catch (err) { report.push(`templates/${file} (${t.name}): FAILED — ${err.message}`); }
  }
}
report.push(`templates: ${tplWritten} written`);

let menusWritten = 0;
for (const { name: file, value: list } of await discover('menus')) {
  for (const m of list || []) {
    const existing = db.prepare('SELECT 1 FROM menus WHERE slug = ?').get(m.slug);
    if (existing && !rewrite(file)) continue;
    const items = JSON.stringify(m.items);
    if (existing) db.prepare("UPDATE menus SET name = ?, items = ?, updated_at = datetime('now') WHERE slug = ?").run(m.name, items, m.slug);
    else db.prepare('INSERT INTO menus (slug, name, items) VALUES (?, ?, ?)').run(m.slug, m.name, items);
    menusWritten++;
  }
}
report.push(`menus: ${menusWritten} written`);

// ---- media library: register the images that ship in /public/images ----
const imgDir = path.join(process.cwd(), 'public', 'images');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml' };
let mediaAdded = 0;
try {
  for (const f of readdirSync(imgDir)) {
    const mime = MIME[path.extname(f).toLowerCase()];
    if (!mime) continue;
    const url = `/images/${f}`;
    if (db.prepare('SELECT 1 FROM media WHERE url = ?').get(url)) continue;
    const title = f.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    db.prepare("INSERT INTO media (url, storage, filename, original_name, mime, kind, size, title) VALUES (?, 'public', ?, ?, ?, 'image', ?, ?)").run(url, f, f, mime, statSync(path.join(imgDir, f)).size, title);
    mediaAdded++;
  }
} catch { /* no public/images folder */ }
report.push(`media: ${mediaAdded} registered`);

// ---- categories from the posts' existing category text ----
let termsAdded = 0;
for (const { category } of db.prepare("SELECT DISTINCT category FROM posts WHERE category != ''").all()) {
  const slug = slugify(category);
  if (!slug) continue;
  const have = db.prepare("SELECT id FROM terms WHERE taxonomy = 'category' AND slug = ?").get(slug);
  const termId = have ? have.id : Number(db.prepare("INSERT INTO terms (taxonomy, name, slug) VALUES ('category', ?, ?)").run(category, slug).lastInsertRowid);
  if (!have) termsAdded++;
  db.prepare('INSERT OR IGNORE INTO post_terms (post_id, term_id) SELECT id, ? FROM posts WHERE category = ?').run(termId, category);
}
report.push(`categories: ${termsAdded} added`);

console.log(`Database: ${getDatabasePath()}`);
for (const line of report) console.log(`  ${line}`);
console.log('\nNext: create your admin login ->  npm run admin:create -- you@example.com');
