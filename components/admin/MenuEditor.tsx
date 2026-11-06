'use client';

// Menu tree editor: add pages / posts / custom links, expandable item cards, reorder (buttons + drag & drop), indent / outdent, live preview.
import { useMemo, useState, useTransition } from 'react';
import { saveMenu } from '@/app/admin/menus/actions';
import type { MenuItem } from '@/lib/builder/types';
import useUnsavedGuard from './useUnsavedGuard';

type Item = { id: string; label: string; url: string; description?: string; newTab?: boolean; cta?: boolean; dark?: boolean; sepBefore?: boolean; children: Item[] };
type PageRow = { id: number; title: string; path: string };
type PostRow = { id: number; title: string; slug: string; external_url: string };
type Pos = 'before' | 'after' | 'into';

const MAX_ITEMS = 100;
const newId = () => `m${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const urlOk = (u: string) => !u || /^(\/(?!\/)|#|\?|https?:\/\/|mailto:|tel:)/i.test(u.trim());

function toItems(list: MenuItem[] | undefined): Item[] {
  return (list || []).map((m, i) => ({ ...m, id: m.id || `i${i}${Math.random().toString(36).slice(2, 6)}`, label: m.label || '', url: m.url || '', children: toItems(m.children) }));
}
const count = (list: Item[]): number => list.reduce((n, i) => n + 1 + count(i.children), 0);

function locate(list: Item[], id: string, parent: Item | null = null): { list: Item[]; index: number; parent: Item | null } | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { list, index: i, parent };
    const r = locate(list[i].children, id, list[i]);
    if (r) return r;
  }
  return null;
}
const contains = (item: Item, id: string): boolean => item.children.some((c) => c.id === id || contains(c, id));

/** Returns false when the move isn't allowed (own descendant, or it would nest deeper than two levels). */
function applyDrop(draft: Item[], dragId: string, targetId: string, pos: Pos): boolean {
  if (dragId === targetId) return false;
  const d = locate(draft, dragId);
  const t = locate(draft, targetId);
  if (!d || !t) return false;
  const node = d.list[d.index];
  if (contains(node, targetId)) return false;
  let mode = pos;
  if (mode === 'into' && t.parent) mode = 'after'; // can't nest under a child
  const depth = mode === 'into' ? 1 : t.parent ? 1 : 0;
  if (depth === 1 && node.children.length) return false;
  d.list.splice(d.index, 1);
  const t2 = locate(draft, targetId)!;
  if (mode === 'into') t2.list[t2.index].children.push(node);
  else t2.list.splice(t2.index + (mode === 'after' ? 1 : 0), 0, node);
  return true;
}

type Props = { menu: { id: number; name: string; slug: string; items: MenuItem[] }; pages: PageRow[]; posts: PostRow[] };

export default function MenuEditor({ menu, pages, posts }: Props) {
  const [init] = useState(() => toItems(menu.items));
  const [name, setName] = useState(menu.name);
  const [items, setItems] = useState<Item[]>(init);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(() => JSON.stringify({ n: menu.name, i: init }));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<'pages' | 'posts' | 'link'>('pages');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [link, setLink] = useState({ label: '', url: '' });
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; pos: Pos } | null>(null);

  const total = count(items);
  const dirty = useMemo(() => JSON.stringify({ n: name, i: items }) !== saved, [name, items, saved]);
  useUnsavedGuard(dirty, 'You have unsaved menu changes. Leave without saving?');

  const mutate = (fn: (draft: Item[]) => void) =>
    setItems((prev) => {
      const draft = clone(prev);
      fn(draft);
      return draft;
    });

  const ops = {
    patch: (id: string, p: Partial<Item>) => mutate((d) => { const l = locate(d, id); if (l) Object.assign(l.list[l.index], p); }),
    up: (id: string) => mutate((d) => { const l = locate(d, id); if (l && l.index > 0) [l.list[l.index - 1], l.list[l.index]] = [l.list[l.index], l.list[l.index - 1]]; }),
    down: (id: string) => mutate((d) => { const l = locate(d, id); if (l && l.index < l.list.length - 1) [l.list[l.index + 1], l.list[l.index]] = [l.list[l.index], l.list[l.index + 1]]; }),
    indent: (id: string) => mutate((d) => {
      const l = locate(d, id);
      if (!l || l.parent || l.index === 0 || l.list[l.index].children.length) return;
      const [it] = l.list.splice(l.index, 1);
      l.list[l.index - 1].children.push(it);
    }),
    outdent: (id: string) => mutate((d) => {
      const l = locate(d, id);
      if (!l || !l.parent) return;
      const [it] = l.list.splice(l.index, 1);
      const p = locate(d, l.parent.id)!;
      p.list.splice(p.index + 1, 0, it);
    }),
    remove: (id: string) => {
      const l = locate(items, id);
      if (!l) return;
      const it = l.list[l.index];
      if (it.children.length && !window.confirm(`Remove “${it.label || 'this item'}” and its ${it.children.length} sub-item(s)?`)) return;
      mutate((d) => { const x = locate(d, id); if (x) x.list.splice(x.index, 1); });
    },
    toggle: (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
  };

  const add = (list: Array<{ label: string; url: string }>) => {
    const room = MAX_ITEMS - total;
    if (room <= 0) return setStatus({ ok: false, text: `A menu can have at most ${MAX_ITEMS} items.` });
    const fresh: Item[] = list.slice(0, room).map((x) => ({ id: newId(), label: x.label, url: x.url, children: [] }));
    mutate((d) => { d.push(...fresh); });
    if (fresh.length === 1) setOpen((s) => new Set(s).add(fresh[0].id));
    setStatus(null);
  };

  const needle = q.trim().toLowerCase();
  const pageUrl = (p: PageRow) => (p.path ? `/${p.path}` : '/');
  const postUrl = (p: PostRow) => p.external_url || `/insights/${p.slug}`;
  const pageList = pages.filter((p) => !needle || p.title.toLowerCase().includes(needle) || p.path.toLowerCase().includes(needle));
  const postList = posts.filter((p) => !needle || p.title.toLowerCase().includes(needle));

  const addPicked = () => {
    if (tab === 'pages') add(pages.filter((p) => picked.has(`p${p.id}`)).map((p) => ({ label: p.title, url: pageUrl(p) })));
    else add(posts.filter((p) => picked.has(`b${p.id}`)).map((p) => ({ label: p.title, url: postUrl(p) })));
    setPicked(new Set());
  };
  const togglePick = (k: string) => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const save = () =>
    start(async () => {
      const r = await saveMenu(menu.id, name, items);
      if (!('error' in r)) {
        const next = toItems(r.items);
        setItems(next);
        setName(r.name);
        setSaved(JSON.stringify({ n: r.name, i: next }));
        setStatus({ ok: true, text: 'Saved — the site now uses this menu.' });
      } else {
        setStatus({ ok: false, text: r.error });
      }
    });

  // ---- drag & drop
  const onDragOverHead = (e: React.DragEvent<HTMLDivElement>, id: string, depth: number) => {
    if (!drag || drag === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    const pos: Pos = depth > 0 ? (y < 0.5 ? 'before' : 'after') : y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'into';
    if (!over || over.id !== id || over.pos !== pos) setOver({ id, pos });
  };
  const onDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    const dragId = drag;
    const pos = over?.id === id ? over.pos : 'after';
    setDrag(null);
    setOver(null);
    if (!dragId) return;
    const draft = clone(items);
    if (applyDrop(draft, dragId, id, pos)) {
      setItems(draft);
      setStatus(null);
    } else {
      setStatus({ ok: false, text: 'That move isn’t possible — menus nest two levels deep, and an item can’t go inside itself.' });
    }
  };

  const renderItem = (it: Item, depth: number, index: number, siblings: number): React.ReactNode => {
    const isOpen = open.has(it.id);
    const cls = over?.id === it.id && drag ? ` mn-over-${over.pos}` : '';
    const bad = !urlOk(it.url) || (!it.url.trim() && !it.children.length);
    return (
      <li key={it.id} className={`mn-item${depth ? ' is-child' : ''}${drag === it.id ? ' is-dragging' : ''}`}>
        <div
          className={`mn-head${cls}${isOpen ? ' is-open' : ''}`}
          draggable
          onDragStart={(e) => { setDrag(it.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.id); }}
          onDragEnd={() => { setDrag(null); setOver(null); }}
          onDragOver={(e) => onDragOverHead(e, it.id, depth)}
          onDragLeave={() => setOver((o) => (o?.id === it.id ? null : o))}
          onDrop={(e) => onDrop(e, it.id)}
        >
          <span className="mn-grip" aria-hidden="true" title="Drag to reorder">⠿</span>
          <button type="button" className="mn-title" onClick={() => ops.toggle(it.id)} aria-expanded={isOpen}>
            <strong>{it.label || 'Untitled item'}</strong>
            <span className="sc-faint">{it.url || (it.children.length ? 'dropdown' : 'no link')}</span>
            {it.cta && <span className="sc-badge">Button</span>}
            {it.dark && <span className="sc-badge">Highlight</span>}
            {it.newTab && <span className="sc-badge">New tab</span>}
            {it.children.length > 0 && <span className="sc-badge sc-badge-ok">{it.children.length} sub-item{it.children.length > 1 ? 's' : ''}</span>}
            {bad && <span className="sc-badge sc-badge-warn">Check link</span>}
          </button>
          <span className="mn-btns">
            <button type="button" className="sc-btn sc-btn-sm" onClick={() => ops.up(it.id)} disabled={index === 0} aria-label="Move up" title="Move up">↑</button>
            <button type="button" className="sc-btn sc-btn-sm" onClick={() => ops.down(it.id)} disabled={index === siblings - 1} aria-label="Move down" title="Move down">↓</button>
            <button type="button" className="sc-btn sc-btn-sm" onClick={() => ops.indent(it.id)} disabled={depth > 0 || index === 0 || it.children.length > 0} aria-label="Nest under the item above" title={it.children.length ? 'Move its sub-items out first' : 'Nest under the item above (becomes a dropdown entry)'}>→</button>
            <button type="button" className="sc-btn sc-btn-sm" onClick={() => ops.outdent(it.id)} disabled={depth === 0} aria-label="Move out one level" title="Move out one level">←</button>
            <button type="button" className="sc-btn sc-btn-sm" onClick={() => ops.toggle(it.id)} aria-label={isOpen ? 'Collapse' : 'Edit'} title={isOpen ? 'Collapse' : 'Edit'}>{isOpen ? '▴' : '▾'}</button>
            <button type="button" className="sc-btn sc-btn-sm sc-btn-danger" onClick={() => ops.remove(it.id)} aria-label="Remove" title="Remove">×</button>
          </span>
        </div>

        {isOpen && (
          <div className="mn-body">
            <div className="sc-field">
              <label htmlFor={`l-${it.id}`}>Label</label>
              <input id={`l-${it.id}`} className="sc-input" value={it.label} maxLength={120} onChange={(e) => ops.patch(it.id, { label: e.target.value })} />
            </div>
            <div className="sc-field">
              <label htmlFor={`u-${it.id}`}>Link</label>
              <input id={`u-${it.id}`} className="sc-input" value={it.url} maxLength={2000} placeholder="/about, https://…, mailto:…" onChange={(e) => ops.patch(it.id, { url: e.target.value })} />
              {!urlOk(it.url) && <span className="sc-help" style={{ color: 'var(--sc-danger)' }}>Must start with https://, http://, mailto:, tel:, / or #.</span>}
              {it.children.length > 0 && <span className="sc-help">Optional for a dropdown heading.</span>}
            </div>
            {depth > 0 && (
              <div className="sc-field is-wide">
                <label htmlFor={`d-${it.id}`}>Description</label>
                <input id={`d-${it.id}`} className="sc-input" value={it.description || ''} maxLength={200} placeholder="Shown under the label in the dropdown" onChange={(e) => ops.patch(it.id, { description: e.target.value })} />
              </div>
            )}
            <div className="mn-checks">
              <label className="sc-check"><input type="checkbox" checked={!!it.newTab} onChange={(e) => ops.patch(it.id, { newTab: e.target.checked })} /> Open in a new tab</label>
              {depth === 0 && <label className="sc-check"><input type="checkbox" checked={!!it.cta} onChange={(e) => ops.patch(it.id, { cta: e.target.checked })} /> Show as a button (call to action)</label>}
              {depth === 0 && <label className="sc-check"><input type="checkbox" checked={!!it.sepBefore} onChange={(e) => ops.patch(it.id, { sepBefore: e.target.checked })} /> Divider before this item</label>}
              {depth > 0 && <label className="sc-check"><input type="checkbox" checked={!!it.dark} onChange={(e) => ops.patch(it.id, { dark: e.target.checked })} /> Highlight (dark tile)</label>}
            </div>
          </div>
        )}

        {it.children.length > 0 && (
          <ul className="mn-list mn-sub">{it.children.map((c, j) => renderItem(c, depth + 1, j, it.children.length))}</ul>
        )}
      </li>
    );
  };

  const megaItem = items.find((i) => i.children.length);

  return (
    <div className="mn-wrap">
      <aside className="mn-add sc-card">
        <h2>Add menu items</h2>
        <div className="mn-tabs" role="tablist">
          {(['pages', 'posts', 'link'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => { setTab(t); setPicked(new Set()); }}>
              {t === 'pages' ? 'Pages' : t === 'posts' ? 'Posts' : 'Custom link'}
            </button>
          ))}
        </div>

        {tab !== 'link' ? (
          <>
            <input className="sc-input" type="search" placeholder={`Search ${tab}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${tab}`} />
            <div className="mn-pick">
              {tab === 'pages' && pageList.map((p) => (
                <label key={p.id} className="mn-pick-row">
                  <input type="checkbox" checked={picked.has(`p${p.id}`)} onChange={() => togglePick(`p${p.id}`)} />
                  <span><strong>{p.title || '(untitled)'}</strong><small>{pageUrl(p)}</small></span>
                </label>
              ))}
              {tab === 'posts' && postList.map((p) => (
                <label key={p.id} className="mn-pick-row">
                  <input type="checkbox" checked={picked.has(`b${p.id}`)} onChange={() => togglePick(`b${p.id}`)} />
                  <span><strong>{p.title}</strong><small>{postUrl(p)}</small></span>
                </label>
              ))}
              {((tab === 'pages' && !pageList.length) || (tab === 'posts' && !postList.length)) && <div className="sc-muted mn-none">{needle ? 'Nothing matches.' : `No published ${tab} yet.`}</div>}
            </div>
            <button type="button" className="sc-btn" disabled={!picked.size} onClick={addPicked}>Add to menu{picked.size ? ` (${picked.size})` : ''}</button>
          </>
        ) : (
          <div className="sc-stack" style={{ gap: 12 }}>
            <div className="sc-field">
              <label htmlFor="mn-l">Label</label>
              <input id="mn-l" className="sc-input" value={link.label} maxLength={120} onChange={(e) => setLink({ ...link, label: e.target.value })} />
            </div>
            <div className="sc-field">
              <label htmlFor="mn-u">Link</label>
              <input id="mn-u" className="sc-input" value={link.url} maxLength={2000} placeholder="https://…, /page, #section, tel:…" onChange={(e) => setLink({ ...link, url: e.target.value })} />
              {!urlOk(link.url) && <span className="sc-help" style={{ color: 'var(--sc-danger)' }}>Must start with https://, http://, mailto:, tel:, / or #.</span>}
            </div>
            <button type="button" className="sc-btn" disabled={!link.label.trim() || !link.url.trim() || !urlOk(link.url)} onClick={() => { add([{ label: link.label.trim(), url: link.url.trim() }]); setLink({ label: '', url: '' }); }}>Add to menu</button>
          </div>
        )}
      </aside>

      <section className="mn-main">
        <div className="sc-card mn-bar">
          <div className="sc-field" style={{ flex: '1 1 240px' }}>
            <label htmlFor="mn-name">Menu name</label>
            <input id="mn-name" className="sc-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="sc-field">
            <span className="sc-label">Used by widgets as</span>
            <code className="mn-slug">{menu.slug}</code>
          </div>
          <div className="mn-save">
            <button type="button" className="sc-btn sc-btn-primary" onClick={save} disabled={pending || !dirty}>{pending ? 'Saving…' : 'Save menu'}</button>
            {dirty && !pending && <span className="sc-badge sc-badge-warn">Unsaved changes</span>}
          </div>
          {status && <div className={`sc-flash ${status.ok ? 'sc-flash-ok' : 'sc-flash-err'}`} role={status.ok ? 'status' : 'alert'} style={{ flexBasis: '100%', margin: 0 }}>{status.text}</div>}
        </div>

        <div className="sc-card mn-preview" aria-label="Menu preview">
          <div className="mn-pv-label">Preview <span className="sc-faint">· desktop bar; the first item with sub-items opens as the dropdown</span></div>
          {items.length === 0 ? (
            <div className="sc-muted">The menu is empty.</div>
          ) : (
            <>
              <div className="mn-pv-bar">
                {items.map((it) => (
                  <span key={it.id} className="mn-pv-wrap">
                    {it.sepBefore && <span className="mn-pv-sep" />}
                    {it.cta ? <span className="mn-pv-cta">{it.label || '…'}</span> : <span className="mn-pv-link">{it.label || '…'}{it.children.length ? ' ▾' : ''}</span>}
                  </span>
                ))}
              </div>
              {megaItem && (
                <div className="mn-pv-mega">
                  {megaItem.children.map((c) => (
                    <div key={c.id} className={`mn-pv-tile${c.dark ? ' is-dark' : ''}`}>
                      <strong>{c.label || '…'}</strong>
                      {c.description && <small>{c.description}</small>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mn-hint sc-faint">
          {total} / {MAX_ITEMS} items · drag the ⠿ handle to reorder (drop in the middle of an item to nest it), or use the arrow buttons. → nests under the item above, ← moves back out.
        </div>

        {items.length === 0 ? (
          <div className="sc-card sc-empty">Nothing here yet — add pages, posts or a custom link from the left.</div>
        ) : (
          <ul className="mn-list">{items.map((it, i) => renderItem(it, 0, i, items.length))}</ul>
        )}
      </section>
    </div>
  );
}
