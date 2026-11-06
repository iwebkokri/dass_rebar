// Loads the datasets that dynamic widgets need (projects, posts, menus …) — only the ones a page actually uses.
import { all } from '../db';
import { getBarData, getDiagrams, getPosts, getProducts, getProjects } from '../content';
import { parseDoc } from './tree.mjs';
import { slugify } from '../slug.mjs';
import { publicSettings } from '../forms-shared';
import type { BuilderData, FormDef, MenuItem } from './types';

export const ALL_NEEDS = ['posts', 'projects', 'products', 'bars', 'diagrams', 'menus', 'forms', 'templates', 'categories'];

const json = <T,>(s: string, fallback: T): T => {
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

export function loadBuilderData(needs: Iterable<string> | 'all'): BuilderData {
  const want = new Set(needs === 'all' ? ALL_NEEDS : needs);
  const data: BuilderData = {};
  if (want.has('posts')) data.posts = getPosts(60);
  if (want.has('projects')) data.projects = getProjects();
  if (want.has('products')) data.products = getProducts();
  if (want.has('bars')) data.bars = getBarData();
  if (want.has('diagrams')) data.diagrams = getDiagrams();
  if (want.has('menus')) {
    data.menus = {};
    for (const m of all<{ slug: string; items: string }>('SELECT slug, items FROM menus')) data.menus[m.slug] = json<MenuItem[]>(m.items, []);
  }
  if (want.has('forms')) {
    data.forms = {};
    for (const f of all<{ id: number; name: string; slug: string; fields: string; settings: string }>('SELECT * FROM forms')) {
      // only the settings the browser needs — never the owner's recipient addresses or the auto-reply text
      data.forms[String(f.id)] = { id: f.id, name: f.name, slug: f.slug, fields: json(f.fields, []), settings: publicSettings(json(f.settings, {})) } as FormDef;
    }
  }
  if (want.has('templates')) {
    data.templates = {};
    // a saved section can be referenced by id ('3') or by the slug of its name ('cta-band')
    for (const t of all<{ id: number; name: string; content: string }>("SELECT id, name, content FROM templates WHERE kind = 'section'")) {
      const nodes = parseDoc(t.content).nodes;
      data.templates[String(t.id)] = nodes;
      data.templates[slugify(t.name)] = nodes;
    }
  }
  if (want.has('categories')) data.categories = all<{ slug: string; name: string }>("SELECT slug, name FROM terms WHERE taxonomy = 'category' ORDER BY name");
  return data;
}
