// Popups (server side). A popup is a builder document stored as a template of kind 'popup'; its settings are JSON in templates.settings and
// "active" (the switch) is templates.active. The server decides WHICH popups are sent with a page (status, schedule, path rules, signed-in
// visitors); the browser decides WHEN (triggers, device, frequency) — see components/site/PopupHost.tsx.
import { all, get } from './db';
import type { BNode } from './builder/types';
import { parseDoc } from './builder/tree.mjs';
import { dbReady, hasColumn } from './schema-ready';
import { clientSettings, normalisePopupSettings, pathMatches, type PopupClientSettings, type PopupSettings } from './popups-shared';

export type PopupStatus = 'active' | 'draft' | 'scheduled' | 'expired' | 'trash';
export type PopupRow = { id: number; name: string; active: number; settings: PopupSettings; content: string; created_at: string; updated_at: string };

/** Popups need migration 4's templates.settings column (a not-yet-migrated process must simply have none). */
export const popupsReady = () => dbReady() && hasColumn('templates', 'settings');

const minute = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

const hydrate = (r: any): PopupRow => {
  let raw: unknown = {};
  try {
    raw = JSON.parse(r.settings || '{}');
  } catch {
    /* corrupt settings: defaults */
  }
  return { id: r.id, name: r.name, active: r.active, settings: normalisePopupSettings(raw, r.name), content: r.content, created_at: r.created_at, updated_at: r.updated_at };
};

export function listPopups(): PopupRow[] {
  if (!popupsReady()) return [];
  return all<any>("SELECT id, name, active, settings, content, created_at, updated_at FROM templates WHERE kind = 'popup' ORDER BY name COLLATE NOCASE").map(hydrate);
}

export function getPopup(id: number): PopupRow | undefined {
  if (!popupsReady()) return undefined;
  const r = get<any>("SELECT id, name, active, settings, content, created_at, updated_at FROM templates WHERE id = ? AND kind = 'popup'", id);
  return r ? hydrate(r) : undefined;
}

export function popupStatus(p: Pick<PopupRow, 'active' | 'settings'>, now = minute()): PopupStatus {
  if (p.settings.trashed) return 'trash';
  if (!p.active) return 'draft';
  if (p.settings.start && p.settings.start > now) return 'scheduled';
  if (p.settings.end && p.settings.end <= now) return 'expired';
  return 'active';
}

/** A slug nobody else uses ("#popup:<slug>" links must be unambiguous). */
export function uniquePopupSlug(base: string, exceptId = 0): string {
  const taken = new Set(listPopups().filter((p) => p.id !== exceptId).map((p) => p.settings.slug));
  const root = base || 'popup';
  let slug = root;
  for (let n = 2; taken.has(slug); n++) slug = `${root}-${n}`;
  return slug;
}

const ruleMatches = (s: PopupSettings, path: string): boolean => {
  const hit = () => s.paths.some((r) => pathMatches(r, path));
  switch (s.pages) {
    case 'home': return path === '';
    case 'include': return hit();
    case 'exclude': return !hit();
    default: return true;
  }
};

export type EmittedPopup = {
  id: number;
  slug: string;
  name: string;
  s: PopupClientSettings;
  nodes: BNode[];
  /** Only for signed-in staff: shown by ?popup-preview=<id>, never on its own. */
  preview: boolean;
  /** The page rules allow automatic triggers here (false = it was sent only because a link on this page opens it). */
  autoOk: boolean;
};

/**
 * The popups to send with a public page. `refs` is the page's JSON (page + header + footer) — a popup that doesn't match the page rules is
 * still sent when a link on the page opens it ("#popup:<slug>"); then it can only be opened by that click. Signed-in staff additionally get
 * every other popup flagged `preview`, so "?popup-preview=<id>" works for drafts. Everyone else never receives a draft, an expired /
 * scheduled popup, or one whose rules exclude them.
 */
export function popupsForPage(path: string, o: { signedIn: boolean; staff: boolean; refs: string }): EmittedPopup[] {
  if (!popupsReady()) return [];
  const out: EmittedPopup[] = [];
  for (const p of listPopups()) {
    const s = p.settings;
    if (s.trashed) continue;
    const live = popupStatus(p) === 'active';
    const visitorOk = s.visitors !== 'guests' || !o.signedIn;
    const ruleOk = ruleMatches(s, path);
    const referenced = o.refs.includes(`#popup:${s.slug}`) || o.refs.includes(`#dr-popup-${p.id}`);
    const base = { id: p.id, slug: s.slug, name: p.name, s: clientSettings(s), nodes: parseDoc(p.content).nodes };
    if (live && visitorOk && (ruleOk || referenced)) out.push({ ...base, preview: false, autoOk: ruleOk });
    else if (o.staff) out.push({ ...base, preview: true, autoOk: false });
  }
  return out;
}
