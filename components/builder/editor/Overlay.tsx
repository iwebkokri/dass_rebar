'use client';

// Selection / hover outlines, the element toolbar and the drop indicator. Drawn in a layer above the page (never inside the
// page's own elements), so the page's layout is never disturbed by editing.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { STRUCTURES, WIDGETS } from '@/lib/builder/schema.mjs';
import type { FromCanvas } from './protocol';
import type { Box } from './dnd';
import { I } from './ui';

type Rect = Box & { type: string };

function measure(id: string | null): Rect | null {
  if (!id) return null;
  const el = document.querySelector<HTMLElement>(`[data-nid="${CSS.escape(id)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height, type: el.getAttribute('data-ntype') || '' };
}

const same = (a: Rect | null, b: Rect | null) => (!a && !b) || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.type === b.type);

const label = (type: string) => (WIDGETS as any)[type]?.label || type;

type Props = {
  selectedId: string | null;
  hoverId: string | null;
  dropLine: Box | null | undefined;
  dropBox: Box | null | undefined;
  dragging: boolean;
  post: (m: FromCanvas) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  rev: unknown;
};

export default function Overlay({ selectedId, hoverId, dropLine, dropBox, dragging, post, onDragStart, onDragEnd, rev }: Props) {
  const [sel, setSel] = useState<Rect | null>(null);
  const [hov, setHov] = useState<Rect | null>(null);
  const [layout, setLayout] = useState(false);
  const raf = useRef(0);

  const refresh = () => {
    const s = measure(selectedId);
    const h = hoverId && hoverId !== selectedId ? measure(hoverId) : null;
    setSel((p) => (same(p, s) ? p : s));
    setHov((p) => (same(p, h) ? p : h));
  };

  useLayoutEffect(refresh, [selectedId, hoverId, rev]);
  useEffect(() => { setLayout(false); }, [selectedId]);
  useEffect(() => {
    const tick = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(refresh); };
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    const iv = setInterval(tick, 250); // catches images loading / fonts / animations changing layout
    return () => { window.removeEventListener('scroll', tick); window.removeEventListener('resize', tick); clearInterval(iv); cancelAnimationFrame(raf.current); };
  }, [selectedId, hoverId]);

  const type = sel?.type || '';
  const canUp = true;
  const flip = sel ? sel.y - window.scrollY < 30 : false;

  return (
    <div className="dr-ov" aria-hidden={false}>
      {hov && !dragging && <div className="dr-ov-box dr-ov-hov" style={{ left: hov.x, top: hov.y, width: hov.w, height: hov.h }}><span className="dr-ov-tag">{label(hov.type)}</span></div>}
      {sel && !dragging && (
        <>
          <div className={`dr-ov-box dr-ov-sel dr-ov-sel--${type}`} style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }} />
          <div className={`dr-ov-tb${flip ? ' is-flip' : ''}`} style={{ left: Math.max(4, Math.min(sel.x, document.documentElement.clientWidth - 260)), top: flip ? sel.y + 2 : sel.y - 28 }} onMouseDown={(e) => e.stopPropagation()}>
            <span className="dr-ov-name">{label(type)}</span>
            {type !== 'section' && <button type="button" title="Select parent" onClick={() => post({ t: 'action', id: selectedId!, action: 'parent' })}><I name="parent" size={14} /></button>}
            <button type="button" title="Drag to move" className="dr-ov-drag" draggable onDragStart={(e) => onDragStart(selectedId!, e)} onDragEnd={onDragEnd}><I name="drag" size={14} /></button>
            {canUp && <button type="button" title={type === 'column' ? 'Move left' : 'Move up'} onClick={() => post({ t: 'action', id: selectedId!, action: 'up' })}><I name={type === 'column' ? 'left' : 'up'} size={14} /></button>}
            {canUp && <button type="button" title={type === 'column' ? 'Move right' : 'Move down'} onClick={() => post({ t: 'action', id: selectedId!, action: 'down' })}><I name={type === 'column' ? 'right' : 'down'} size={14} /></button>}
            {type === 'section' && <button type="button" title="Add a row" onClick={() => post({ t: 'action', id: selectedId!, action: 'addRow' })}>+ Row</button>}
            {type === 'row' && <button type="button" title="Change columns" onClick={() => setLayout((v) => !v)}>Columns</button>}
            {type === 'row' && <button type="button" title="Add a column" onClick={() => post({ t: 'action', id: selectedId!, action: 'addColumn' })}>+ Col</button>}
            {type === 'column' && <button type="button" title="Add a row inside this column" onClick={() => post({ t: 'action', id: selectedId!, action: 'addNestedRow' })}>+ Row</button>}
            {type === 'section' && <button type="button" title="Save as reusable section" onClick={() => post({ t: 'action', id: selectedId!, action: 'saveSection' })}>Save</button>}
            <button type="button" title="Duplicate" onClick={() => post({ t: 'action', id: selectedId!, action: 'duplicate' })}><I name="copy" size={14} /></button>
            <button type="button" title="Delete" className="dr-ov-del" onClick={() => post({ t: 'action', id: selectedId!, action: 'delete' })}><I name="trash" size={14} /></button>
          </div>
          {layout && type === 'row' && (
            <div className="dr-ov-pop" style={{ left: sel.x + 8, top: sel.y + (flip ? 34 : 4) }} onMouseDown={(e) => e.stopPropagation()}>
              {STRUCTURES.map((st: number[]) => (
                <button key={st.join('-')} type="button" title={st.join(' + ')} className="dr-ov-struct" onClick={() => { post({ t: 'structure', id: selectedId!, structure: st }); setLayout(false); }}>
                  {st.map((n, i) => <i key={i} style={{ flex: n }} />)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {dropLine && <div className="dr-drop-line" style={{ left: dropLine.x, top: dropLine.y, width: dropLine.w, height: dropLine.h }} />}
      {dropBox && <div className="dr-drop-box" style={{ left: dropBox.x, top: dropBox.y, width: dropBox.w, height: dropBox.h }} />}
    </div>
  );
}
