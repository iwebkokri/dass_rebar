'use client';

// The editable page, running inside the editor's iframe. It owns no document state: the shell (parent window) sends the documents
// and selection; this renders them with the SAME renderer as the public site, in edit mode, and reports user intent back.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { buildCss } from '@/lib/builder/css.mjs';
import { STRUCTURES } from '@/lib/builder/schema.mjs';
import { findNode } from '@/lib/builder/tree.mjs';
import type { BNode, BuilderCtx, BuilderData } from '@/lib/builder/types';
import { RenderNode } from '../Render';
import { fromCanvas, isToCanvas, type DragPayload, type FromCanvas, type Target, type ToCanvas } from './protocol';
import { computeDrop, type DropResult } from './dnd';
import Overlay from './Overlay';
import RichToolbar from './RichToolbar';
import './canvas.css';

type StateMsg = Extract<ToCanvas, { t: 'state' }>;

function Strip({ index, empty, post }: { index: number; empty: boolean; post: (m: FromCanvas) => void }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <div className="dr-strip is-open" data-strip>
        <div className="dr-strip-panel">
          <span>Choose a layout</span>
          {STRUCTURES.map((st: number[]) => (
            <button key={st.join('-')} type="button" className="dr-strip-struct" title={st.join(' + ')} onClick={() => { post({ t: 'addSection', index, structure: st }); setOpen(false); }}>
              {st.map((n, i) => <i key={i} style={{ flex: n }} />)}
            </button>
          ))}
          <button type="button" className="dr-strip-link" onClick={() => { post({ t: 'library', index }); setOpen(false); }}>Saved sections</button>
          <button type="button" className="dr-strip-link" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`dr-strip${empty ? ' is-empty' : ''}`} data-strip>
      <button type="button" className="dr-strip-add" onClick={() => setOpen(true)} title="Add a section here">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        {empty ? ' Add your first section' : ''}
      </button>
    </div>
  );
}

function Doc({ target, nodes, active, ctx, view, post }: { target: Target; nodes: BNode[]; active: boolean; ctx: BuilderCtx; view: BuilderCtx; post: (m: FromCanvas) => void }) {
  const css = useMemo(() => buildCss(nodes), [nodes]);
  return (
    <div className={`dr-doc dr-doc-${target} ${active ? 'is-active' : 'is-dim'}`} data-doc={target} title={active ? undefined : `Click to edit the ${target}`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {active ? (
        <>
          {nodes.map((n, i) => (
            <Fragment key={n.id}>
              <Strip index={i} empty={false} post={post} />
              <RenderNode node={n} ctx={ctx} />
            </Fragment>
          ))}
          <Strip index={nodes.length} empty={!nodes.length} post={post} />
        </>
      ) : (
        nodes.map((n) => <RenderNode key={n.id} node={n} ctx={view} />)
      )}
    </div>
  );
}

export default function CanvasApp({ data }: { data: BuilderData }) {
  const [st, setSt] = useState<StateMsg | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [drop, setDrop] = useState<DropResult | null>(null);

  const stRef = useRef<StateMsg | null>(null);
  const dragRef = useRef<DragPayload | null>(null);
  stRef.current = st;

  const post = useMemo(() => (m: FromCanvas) => window.parent.postMessage(fromCanvas(m), location.origin), []);

  const typeOf = (id: string) => {
    const s = stRef.current;
    if (!s) return undefined;
    for (const t of ['page', 'header', 'footer'] as Target[]) {
      const nodes = s.docs[t];
      const f = nodes && findNode(nodes, id);
      if (f) return f.node.type;
    }
    return undefined;
  };

  // ---- messages from the shell ----
  useEffect(() => {
    document.documentElement.classList.add('dr-editing');
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent || !isToCanvas(e.data)) return;
      const m = e.data as ToCanvas;
      if (m.t === 'state') { setSt(m); setHover(m.hoverId); }
      else if (m.t === 'drag') { dragRef.current = m.payload; setDrag(m.payload); if (!m.payload) setDrop(null); }
      else if (m.t === 'scrollTo') document.querySelector(`[data-nid="${CSS.escape(m.id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    window.addEventListener('message', onMsg);
    post({ t: 'ready' });
    return () => { window.removeEventListener('message', onMsg); document.documentElement.classList.remove('dr-editing'); };
  }, [post]);

  // ---- pointer, keyboard, drag handling (document-level, capture phase so widget handlers can't interfere) ----
  useEffect(() => {
    const chrome = '.dr-ov, .dr-rtb, .dr-strip';
    let raf = 0;
    let scroller = 0;
    let last = { x: 0, y: 0 };

    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(chrome)) return;
      const dim = t.closest('.is-dim[data-doc]');
      if (dim) { e.preventDefault(); post({ t: 'switch', target: dim.getAttribute('data-doc') as Target }); return; }
      const node = t.closest('[data-nid]');
      post({ t: 'select', id: node ? node.getAttribute('data-nid') : null });
    };
    const onClick = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(chrome)) e.preventDefault(); };
    const onSubmit = (e: Event) => e.preventDefault();
    const onDbl = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const img = t.closest('[data-ntype="image"]');
      if (img) post({ t: 'pickMedia', id: img.getAttribute('data-nid')!, key: 'src', kind: 'image' });
    };
    const onMove = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(chrome)) return;
      const active = t.closest('.is-active[data-doc]');
      const node = active ? t.closest('[data-nid]') : null;
      const id = node ? node.getAttribute('data-nid') : null;
      setHover((h) => (h === id ? h : id));
    };
    const onLeave = () => setHover(null);

    const onKey = (e: KeyboardEvent) => {
      const inText = !!(e.target as HTMLElement).closest?.('[contenteditable="true"], input, textarea');
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') { e.preventDefault(); post({ t: 'key', key: 's', ctrl: true, shift: e.shiftKey }); return; }
      if (inText) { if (e.key === 'Escape') (e.target as HTMLElement).blur(); return; }
      if (mod && (k === 'z' || k === 'y' || k === 'd')) { e.preventDefault(); post({ t: 'key', key: k, ctrl: true, shift: e.shiftKey }); return; }
      if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Escape') { e.preventDefault(); post({ t: 'key', key: e.key, ctrl: false, shift: false }); }
    };

    const compute = () => {
      raf = 0;
      const d = dragRef.current;
      const s = stRef.current;
      if (!d || !s) return;
      setDrop(computeDrop(last.x, last.y, d, s.active, typeOf));
    };
    const edgeScroll = () => {
      const d = dragRef.current;
      if (!d) { scroller = 0; return; }
      const h = window.innerHeight;
      if (last.y < 70) window.scrollBy(0, -(70 - last.y) / 3);
      else if (last.y > h - 70) window.scrollBy(0, (last.y - (h - 70)) / 3);
      scroller = requestAnimationFrame(edgeScroll);
    };
    const onDragOver = (e: DragEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = dragRef.current.kind === 'move' ? 'move' : 'copy';
      last = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(compute);
      if (!scroller) scroller = requestAnimationFrame(edgeScroll);
    };
    const onDrop = (e: DragEvent) => {
      const d = dragRef.current;
      const s = stRef.current;
      if (!d || !s) return;
      e.preventDefault();
      const r = computeDrop(e.clientX, e.clientY, d, s.active, typeOf);
      if (r) post({ t: 'drop', payload: d, parentId: r.parentId, index: r.index });
      dragRef.current = null;
      setDrag(null);
      setDrop(null);
    };
    const onDragLeave = (e: DragEvent) => { if (!e.relatedTarget) setDrop(null); };

    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('dblclick', onDbl, true);
    document.addEventListener('mousemove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    document.addEventListener('dragleave', onDragLeave);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('dblclick', onDbl, true);
      document.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('dragleave', onDragLeave);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scroller);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post]);

  const edit = useMemo(
    () => ({
      selectedId: st?.selectedId ?? null,
      setProp: (id: string, key: string, value: any) => post({ t: 'setProp', id, key, value }),
      setItemProp: (id: string, key: string, index: number, field: string, value: any) => post({ t: 'setItemProp', id, key, index, field, value }),
    }),
    [st?.selectedId, post]
  );

  if (!st) return <div className="dr-loading">Loading editor…</div>;

  const ctxEdit: BuilderCtx = { data, edit, path: st.path };
  const ctxView: BuilderCtx = { data, path: st.path };

  return (
    <div className="dr-edit-root">
      {(['header', 'page', 'footer'] as Target[]).map((t) => {
        const nodes = st.docs[t];
        return nodes ? <Doc key={t} target={t} nodes={nodes} active={st.active === t} ctx={ctxEdit} view={ctxView} post={post} /> : null;
      })}
      <Overlay
        selectedId={st.selectedId}
        hoverId={hover}
        dropLine={drop?.line}
        dropBox={drop?.box}
        dragging={!!drag}
        post={post}
        rev={st}
        onDragStart={(id, e) => {
          e.dataTransfer.setData('text/plain', 'dr-move');
          e.dataTransfer.effectAllowed = 'move';
          dragRef.current = { kind: 'move', id };
          setTimeout(() => setDrag({ kind: 'move', id }), 0); // hiding the handle in the same tick would cancel the drag
        }}
        onDragEnd={() => { dragRef.current = null; setDrag(null); setDrop(null); }}
      />
      <RichToolbar />
    </div>
  );
}
