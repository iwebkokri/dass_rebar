'use client';

// The builder shell: toolbar, side panels (Elements / Settings / Layers / Page) and the iframe that hosts the live, editable page.
// It owns ALL document state (undo/redo, dirty tracking, saving); the iframe (CanvasApp) only renders and reports intent.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { findNode, pathTo } from '@/lib/builder/tree.mjs';
import type { BNode, Device } from '@/lib/builder/types';
import MediaPicker from '@/components/admin/MediaPicker';
import { listRevisions, loadRevision, saveBuilderDocs, saveSectionAsTemplate, type SaveInput } from '@/app/admin/builder/actions';
import { fromCanvas as _f, isFromCanvas, toCanvas, type DragPayload, type FromCanvas, type Docs, type Target } from './protocol';
import { initialState, locate, reducer } from './reducer';
import Palette from './Palette';
import Settings from './Settings';
import Layers from './Layers';
import SeoPanel, { type SeoFieldsState, type SeoInit } from './SeoPanel';
import PopupPanel from './PopupPanel';
import { savePopupSettings } from '@/app/admin/popups/actions';
import type { PopupSettings } from '@/lib/popups-shared';
import { type CtlCx, type Lists } from './controls';
import { I } from './ui';
import './editor.css';

export type BuilderInit = {
  kind: 'page' | 'template';
  id: number;
  title: string;
  status: string;
  path: string;
  templateKind: string | null;
  base: string;
  docs: Docs;
  headerMeta: { id: number; base: string } | null;
  footerMeta: { id: number; base: string } | null;
  canPublish: boolean;
  canManageSite: boolean;
  isAdmin: boolean;
  lists: Lists;
  saved: Record<string, BNode[]>;
  palette: [string, string][];
  urls: { back: string; view: string; settings: string };
  /** search + AI fields and site context for the "SEO & AI" tab (pages only) */
  seo: SeoInit | null;
  /** popup settings for the "Popup" tab (popups only) */
  popup: { settings: PopupSettings } | null;
};

const DEVICE_WIDTH: Record<Device, string> = { d: '100%', t: '820px', m: '390px' };
type Tab = 'elements' | 'settings' | 'layers' | 'page' | 'seo' | 'popup';
type Toast = { text: string; kind: 'ok' | 'err' | 'warn' } | null;

export default function BuilderShell({ init }: { init: BuilderInit }) {
  const [state, dispatch] = useReducer(reducer, init.docs, (d) => initialState(d));
  const [device, setDevice] = useState<Device>('d');
  const [tab, setTab] = useState<Tab>('elements');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [title, setTitle] = useState(init.title);
  const [titleDirty, setTitleDirty] = useState(false);
  const [status, setStatus] = useState(init.status);
  const [bases, setBases] = useState({ page: init.base, header: init.headerMeta?.base ?? '', footer: init.footerMeta?.base ?? '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [saved, setSaved] = useState(init.saved);
  const [lists, setLists] = useState(init.lists);
  const [picker, setPicker] = useState<{ kind: 'image' | 'video'; cb: (url: string, alt?: string) => void } | null>(null);
  const [library, setLibrary] = useState<{ index: number | null } | null>(null);
  const [naming, setNaming] = useState<{ id: string; name: string } | null>(null);
  const [revs, setRevs] = useState<{ id: number; created_at: string; email: string | null }[] | null>(null);
  const [seoFields, setSeoFields] = useState<SeoFieldsState | null>(init.seo?.fields ?? null);
  const [seoDirty, setSeoDirty] = useState(false);
  const [popup, setPopup] = useState<PopupSettings | null>(init.popup?.settings ?? null);
  const [popupDirty, setPopupDirty] = useState(false);

  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const miscRef = useRef({ title, titleDirty, status, bases, device, hoverId, seoFields, seoDirty, popup, popupDirty });
  miscRef.current = { title, titleDirty, status, bases, device, hoverId, seoFields, seoDirty, popup, popupDirty };

  const dirty = state.dirty.page || state.dirty.header || state.dirty.footer || titleDirty || seoDirty || popupDirty;
  const activeNodes = state.docs[state.active] || [];
  const selected = state.selectedId ? findNode(activeNodes, state.selectedId) : null;
  const trail = state.selectedId ? pathTo(activeNodes, state.selectedId) : [];

  const flash = useCallback((text: string, kind: 'ok' | 'err' | 'warn' = 'ok') => {
    setToast({ text, kind });
    setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 3800);
  }, []);

  // ---- talk to the canvas ----
  const send = useCallback(() => {
    const win = frame.current?.contentWindow;
    if (!win || !ready.current) return;
    const s = stateRef.current;
    win.postMessage(toCanvas({ t: 'state', docs: s.docs, active: s.active, selectedId: s.selectedId, hoverId: miscRef.current.hoverId, path: init.path, device: miscRef.current.device, popup: miscRef.current.popup }), location.origin);
  }, [init.path]);
  useEffect(send, [send, state.docs, state.active, state.selectedId, hoverId, device, popup]);

  const sendDrag = (payload: DragPayload | null) => frame.current?.contentWindow?.postMessage(toCanvas({ t: 'drag', payload }), location.origin);

  // ---- saving ----
  const save = useCallback(async (nextStatus?: 'draft' | 'published', force = false) => {
    const s = stateRef.current;
    const m = miscRef.current;
    const input: SaveInput = { force };
    if (init.kind === 'page') {
      if (s.dirty.page || m.titleDirty || m.seoDirty || nextStatus) input.page = { id: init.id, nodes: s.docs.page, base: m.bases.page, title: m.title, status: nextStatus, ...(m.seoDirty && m.seoFields ? { seo: m.seoFields } : {}) };
      if (s.dirty.header && init.headerMeta && s.docs.header) input.header = { id: init.headerMeta.id, nodes: s.docs.header, base: m.bases.header };
      if (s.dirty.footer && init.footerMeta && s.docs.footer) input.footer = { id: init.footerMeta.id, nodes: s.docs.footer, base: m.bases.footer };
    } else {
      input.template = { id: init.id, nodes: s.docs.page, base: m.bases.page };
    }
    if (!input.page && !input.header && !input.footer && !input.template) { flash('Nothing to save.', 'warn'); return; }
    setSaving(true);
    // popup settings (layout, triggers, rules) are stored separately from the content; they go first so a rejected value stops the save
    if (init.popup && m.popupDirty && m.popup) {
      const pr = await savePopupSettings(init.id, m.popup);
      if (!pr.ok) { setSaving(false); flash(pr.error || 'Could not save the popup settings.', 'err'); return; }
      if (pr.settings) setPopup(pr.settings);
      setPopupDirty(false);
    }
    const res = await saveBuilderDocs(input);
    setSaving(false);
    if (!res.ok) {
      if (res.conflict) setConflict(res.error || 'Changed elsewhere.');
      else flash(res.error || 'Could not save.', 'err');
      return;
    }
    const r = res.results;
    const targets: Target[] = [];
    const nb = { ...m.bases };
    if (r.page) { nb.page = r.page.updatedAt; targets.push('page'); if (r.page.status) setStatus(r.page.status); setTitleDirty(false); setSeoDirty(false); }
    if (r.template) { nb.page = r.template.updatedAt; targets.push('page'); }
    if (r.header) { nb.header = r.header.updatedAt; targets.push('header'); }
    if (r.footer) { nb.footer = r.footer.updatedAt; targets.push('footer'); }
    setBases(nb);
    dispatch({ type: 'saved', targets });
    const dropped = Object.values(r).reduce((n, x: any) => n + (x?.dropped || 0), 0);
    flash(dropped ? `Saved — ${dropped} invalid element${dropped > 1 ? 's were' : ' was'} removed.` : nextStatus === 'published' ? 'Published.' : 'Saved.', dropped ? 'warn' : 'ok');
  }, [init, flash]);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { if (stateRef.current.dirty.page || stateRef.current.dirty.header || stateRef.current.dirty.footer || miscRef.current.titleDirty || miscRef.current.seoDirty || miscRef.current.popupDirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // ---- actions shared by canvas messages, keyboard and panels ----
  const act = useCallback((id: string, action: Extract<FromCanvas, { t: 'action' }>['action']) => {
    switch (action) {
      case 'duplicate': dispatch({ type: 'duplicate', id }); break;
      case 'delete': dispatch({ type: 'remove', id }); break;
      case 'up': dispatch({ type: 'moveBy', id, delta: -1 }); break;
      case 'down': dispatch({ type: 'moveBy', id, delta: 1 }); break;
      case 'parent': dispatch({ type: 'selectParent', id }); break;
      case 'addRow': dispatch({ type: 'addRow', id }); break;
      case 'addColumn': dispatch({ type: 'addColumn', id }); break;
      case 'addNestedRow': dispatch({ type: 'addNestedRow', id }); break;
      case 'saveSection': setNaming({ id, name: '' }); break;
    }
  }, []);

  const handleKey = useCallback((key: string, ctrl: boolean, shift: boolean) => {
    const s = stateRef.current;
    if (ctrl && key === 's') { void save(); return; }
    if (ctrl && key === 'z') { dispatch({ type: shift ? 'redo' : 'undo' }); return; }
    if (ctrl && key === 'y') { dispatch({ type: 'redo' }); return; }
    if (ctrl && key === 'd' && s.selectedId) { dispatch({ type: 'duplicate', id: s.selectedId }); return; }
    if ((key === 'Delete' || key === 'Backspace') && s.selectedId) { dispatch({ type: 'remove', id: s.selectedId }); return; }
    if (key === 'Escape') dispatch({ type: 'select', id: null });
  }, [save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = !!(e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable="true"]');
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (mod && k === 's') { e.preventDefault(); handleKey('s', true, e.shiftKey); return; }
      if (inField) return;
      if ((mod && ['z', 'y', 'd'].includes(k)) || ['Delete', 'Backspace', 'Escape'].includes(k)) { e.preventDefault(); handleKey(k, mod, e.shiftKey); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleKey]);

  // ---- messages from the canvas ----
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || !isFromCanvas(e.data)) return;
      const m = e.data as FromCanvas;
      switch (m.t) {
        case 'ready': ready.current = true; send(); break;
        case 'select': dispatch({ type: 'select', id: m.id }); if (m.id) setTab((t) => (t === 'layers' || t === 'page' || t === 'seo' ? t : 'settings')); break;
        case 'switch': if (m.target === 'page' || init.canManageSite) dispatch({ type: 'switch', target: m.target }); break;
        case 'setProp': dispatch({ type: 'setProp', id: m.id, key: m.key, value: m.value }); break;
        case 'setItemProp': dispatch({ type: 'setItemProp', id: m.id, key: m.key, index: m.index, field: m.field, value: m.value }); break;
        case 'drop': dispatch({ type: 'drop', payload: m.payload, parentId: m.parentId, index: m.index, saved: savedRef.current }); sendDrag(null); break;
        case 'action': act(m.id, m.action); break;
        case 'structure': dispatch({ type: 'structure', id: m.id, structure: m.structure }); break;
        case 'addSection': dispatch({ type: 'addSection', index: m.index, structure: m.structure }); break;
        case 'library': setLibrary({ index: m.index }); break;
        case 'pickMedia': {
          const f = stateRef.current && locate(stateRef.current.docs, m.id);
          const node = f ? findNode(stateRef.current.docs[f]!, m.id) : null;
          setPicker({ kind: m.kind, cb: (url, alt) => { dispatch({ type: 'setProp', id: m.id, key: m.key, value: url }); if (alt && node && !node.node.props?.alt) dispatch({ type: 'setProp', id: m.id, key: 'alt', value: alt }); } });
          break;
        }
        case 'key': handleKey(m.key, m.ctrl, m.shift); break;
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [act, handleKey, send, init.canManageSite]);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  // ---- control context for the settings panel ----
  const cx: CtlCx = useMemo(() => ({
    device,
    lists,
    palette: init.palette,
    pickMedia: (kind, cb) => setPicker({ kind, cb: (url) => cb(url) }),
    editTemplate: (id) => { window.open(`/admin/builder/tpl-${id}`, '_blank'); },
  }), [device, lists, init.palette]);

  const loadRevs = async () => { setRevs(await listRevisions(init.kind === 'page' ? 'page' : 'template', init.id)); };
  const restore = async (id: number) => {
    const r = await loadRevision(id);
    if (r.ok && r.nodes) { dispatch({ type: 'replace', target: 'page', nodes: r.nodes }); flash('Revision loaded — review it and save to keep it.', 'warn'); }
  };

  const createSaved = async () => {
    if (!naming) return;
    const f = locate(state.docs, naming.id);
    const node = f ? findNode(state.docs[f]!, naming.id) : null;
    if (!node) return;
    const res = await saveSectionAsTemplate(naming.name, [node.node]);
    if (!res.ok) { flash(res.error || 'Could not save.', 'err'); return; }
    setSaved((s) => ({ ...s, [String(res.id)]: [JSON.parse(JSON.stringify(node.node))] }));
    setLists((l) => ({ ...l, sections: [...l.sections, { id: res.id!, name: res.name! }] }));
    setNaming(null);
    flash('Saved to your library.', 'ok');
  };

  const tabs: [Tab, string, string][] = [['elements', 'Elements', 'grid'], ['settings', 'Settings', 'settings'], ['layers', 'Layers', 'layers'], ['page', init.kind === 'page' ? 'Page' : 'Info', 'history'], ...(init.seo && seoFields ? ([['seo', 'SEO & AI', 'globe']] as [Tab, string, string][]) : []), ...(init.popup && popup ? ([['popup', 'Popup', 'settings']] as [Tab, string, string][]) : [])];
  const isPage = init.kind === 'page';

  return (
    <div className="be-root">
      <header className="be-top">
        <Link href={init.urls.back} className="be-back" title="Back to the admin" onClick={(e) => { if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) e.preventDefault(); }}><I name="back" size={16} /> Exit</Link>
        <div className="be-title">
          <strong>{title || 'Untitled'}</strong>
          <span className={`be-status be-status--${status}`}>{isPage ? status : init.templateKind}</span>
        </div>
        {isPage && (
          <div className="be-seg be-seg--top" role="group" aria-label="What to edit">
            {(['page', 'header', 'footer'] as Target[]).map((t) => (
              <button key={t} type="button" disabled={!state.docs[t] || (t !== 'page' && !init.canManageSite)} title={t !== 'page' && !init.canManageSite ? 'Only administrators can edit the header and footer' : undefined} className={state.active === t ? 'is-on' : ''} onClick={() => dispatch({ type: 'switch', target: t })}>{t === 'page' ? 'Page' : t === 'header' ? 'Header' : 'Footer'}{state.dirty[t] ? ' •' : ''}</button>
            ))}
          </div>
        )}
        <div className="be-seg be-seg--top" role="group" aria-label="Preview size">
          {(['d', 't', 'm'] as Device[]).map((d) => (
            <button key={d} type="button" title={d === 'd' ? 'Desktop' : d === 't' ? 'Tablet (820px)' : 'Mobile (390px)'} className={device === d ? 'is-on' : ''} onClick={() => setDevice(d)}><I name={d === 'd' ? 'desktop' : d === 't' ? 'tablet' : 'mobile'} size={16} /></button>
          ))}
        </div>
        <div className="be-spacer" />
        <button type="button" className="be-icon" title="Undo (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}><I name="undo" /></button>
        <button type="button" className="be-icon" title="Redo (Ctrl+Y)" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}><I name="redo" /></button>
        <a className="be-btn be-btn--ghost" href={init.urls.view} target="_blank" rel="noopener noreferrer"><I name="eye" size={15} /> Preview</a>
        <span className="be-dirty" aria-live="polite">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        {isPage && status !== 'published' ? (
          <>
            <button type="button" className="be-btn" disabled={saving || !dirty} onClick={() => save()}>Save draft</button>
            {init.canPublish && <button type="button" className="be-btn be-btn--primary" disabled={saving} onClick={() => save('published')}>Publish</button>}
          </>
        ) : (
          <button type="button" className="be-btn be-btn--primary" disabled={saving || !dirty} onClick={() => save()}>{isPage ? 'Update' : 'Save'}</button>
        )}
      </header>

      <div className="be-main">
        <aside className="be-side">
          <div className="be-sidetabs" role="tablist" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map(([k, label, icon]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => { setTab(k); if (k === 'page' && init.kind) void loadRevs(); }}>
                <I name={icon} size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="be-panel">
            {tab === 'elements' && (
              <Palette
                isAdmin={init.isAdmin}
                sections={lists.sections}
                onAdd={(type) => dispatch({ type: 'addAuto', widget: type })}
                onAddStructure={(structure) => dispatch({ type: 'addSection', index: activeNodes.length, structure })}
                onAddSaved={(id, link) => dispatch({ type: 'addSavedAuto', id, link, saved })}
                onDragStart={sendDrag}
                onDragEnd={() => sendDrag(null)}
              />
            )}
            {tab === 'settings' && (selected ? (
              <Settings key={selected.node.id} node={selected.node} trail={trail} device={device} cx={cx} onProp={(id, key, value) => dispatch({ type: 'setProp', id, key, value })} onSelect={(id) => dispatch({ type: 'select', id })} />
            ) : (
              <p className="be-muted" style={{ padding: 18 }}>Select an element on the page to change its settings. Click any text to edit it right on the page.</p>
            ))}
            {tab === 'layers' && (
              <Layers
                nodes={activeNodes}
                selectedId={state.selectedId}
                onSelect={(id) => { dispatch({ type: 'select', id }); frame.current?.contentWindow?.postMessage(toCanvas({ t: 'scrollTo', id }), location.origin); }}
                onHover={setHoverId}
                onMove={(id, delta) => dispatch({ type: 'moveBy', id, delta })}
                onDuplicate={(id) => dispatch({ type: 'duplicate', id })}
                onRemove={(id) => dispatch({ type: 'remove', id })}
              />
            )}
            {tab === 'popup' && init.popup && popup && <PopupPanel settings={popup} onChange={(n) => { setPopup(n); setPopupDirty(true); }} />}
            {tab === 'seo' && init.seo && seoFields && (
              <SeoPanel
                nodes={state.docs.page}
                title={title}
                path={init.path}
                init={init.seo}
                fields={seoFields}
                onField={(key, value) => { setSeoFields((f) => (f ? { ...f, [key]: value } : f)); setSeoDirty(true); }}
                settingsUrl={init.urls.settings}
              />
            )}
            {tab === 'page' && (
              <div className="be-pagetab">
                {isPage ? (
                  <>
                    <label className="be-field"><span className="be-label">Page title</span>
                      <input className="be-input" value={title} onChange={(e) => { setTitle(e.target.value); setTitleDirty(true); }} />
                    </label>
                    <p className="be-muted">Address: <code>/{init.path}</code></p>
                    <div className="be-links">
                      <Link href={init.urls.settings} target="_blank">Page settings, SEO &amp; schedule ↗</Link>
                      <a href={init.urls.view} target="_blank" rel="noopener noreferrer">View page ↗</a>
                    </div>
                    {isPage && status === 'published' && init.canPublish && (
                      <button type="button" className="be-btn be-btn--ghost" disabled={saving} onClick={() => { if (window.confirm('Switch this page back to a draft? Visitors will no longer see it.')) void save('draft'); }}>Switch to draft</button>
                    )}
                  </>
                ) : (
                  <p className="be-muted">Editing the <strong>{init.templateKind}</strong> “{title}”. {init.templateKind === 'section' ? 'Pages that include it as a linked saved section update when you save.' : ''}</p>
                )}
                <h4>Revisions</h4>
                {revs === null ? <p className="be-muted">Loading…</p> : revs.length === 0 ? <p className="be-muted">No revisions yet — one is stored every time you save.</p> : (
                  <ul className="be-revs">
                    {revs.map((r) => (
                      <li key={r.id}><span>{r.created_at.replace('T', ' ').slice(0, 16)} UTC<br /><small>{r.email || 'unknown'}</small></span><button type="button" className="be-btn be-btn--ghost" onClick={() => restore(r.id)}>Load</button></li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="be-stage">
          <div className="be-framewrap" style={{ width: DEVICE_WIDTH[device] }} data-device={device}>
            <iframe ref={frame} src={init.kind === 'page' ? `/builder-frame?p=${init.id}` : '/builder-frame'} title="Page canvas" className="be-frame" onLoad={() => { /* the canvas announces itself with {t:'ready'} */ }} />
          </div>
        </div>
      </div>

      {toast && <div className={`be-toast be-toast--${toast.kind}`} role="status">{toast.text}</div>}

      {conflict && (
        <div className="be-modal" role="dialog" aria-modal="true">
          <div className="be-modal-card">
            <h3>Someone else changed this</h3>
            <p>{conflict} Saving now would overwrite their work.</p>
            <div className="be-modal-actions">
              <button type="button" className="be-btn" onClick={() => setConflict(null)}>Cancel</button>
              <button type="button" className="be-btn be-btn--danger" onClick={() => { setConflict(null); void save(undefined, true); }}>Overwrite with my version</button>
            </div>
          </div>
        </div>
      )}

      {naming && (
        <div className="be-modal" role="dialog" aria-modal="true">
          <form className="be-modal-card" onSubmit={(e) => { e.preventDefault(); void createSaved(); }}>
            <h3>Save section to library</h3>
            <label className="be-field"><span className="be-label">Name</span><input className="be-input" autoFocus value={naming.name} onChange={(e) => setNaming({ ...naming, name: e.target.value })} placeholder="e.g. Contact call-to-action" /></label>
            <div className="be-modal-actions">
              <button type="button" className="be-btn" onClick={() => setNaming(null)}>Cancel</button>
              <button type="submit" className="be-btn be-btn--primary" disabled={!naming.name.trim()}>Save</button>
            </div>
          </form>
        </div>
      )}

      {library && (
        <div className="be-modal" role="dialog" aria-modal="true" onClick={() => setLibrary(null)}>
          <div className="be-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Saved sections</h3>
            {lists.sections.length === 0 ? <p className="be-muted">Nothing saved yet. Select a section and press “Save” on its toolbar.</p> : (
              <ul className="be-revs">
                {lists.sections.map((s) => (
                  <li key={s.id}><span>{s.name}</span>
                    <span className="be-row">
                      <button type="button" className="be-btn be-btn--ghost" onClick={() => { dispatch({ type: 'drop', payload: { kind: 'saved', id: String(s.id), link: false }, parentId: null, index: library.index ?? activeNodes.length, saved }); setLibrary(null); }}>Insert copy</button>
                      <button type="button" className="be-btn be-btn--ghost" onClick={() => { dispatch({ type: 'drop', payload: { kind: 'saved', id: String(s.id), link: true }, parentId: null, index: library.index ?? activeNodes.length, saved }); setLibrary(null); }}>Insert link</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="be-modal-actions"><button type="button" className="be-btn" onClick={() => setLibrary(null)}>Close</button></div>
          </div>
        </div>
      )}

      <MediaPicker open={!!picker} kind={picker?.kind || 'image'} onClose={() => setPicker(null)} onPick={(m) => { picker?.cb(m.url, m.alt); setPicker(null); }} />
    </div>
  );
}
