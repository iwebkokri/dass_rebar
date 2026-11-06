// Where would a dragged thing land? Pure DOM maths for the canvas (runs inside the iframe). Returns the parent node id, the slot index
// (in the CURRENT list, i.e. before the dragged node is removed) and the rectangle for the drop indicator, in document coordinates.
import { WIDGETS } from '@/lib/builder/schema.mjs';
import type { DragPayload, Target } from './protocol';

export type Box = { x: number; y: number; w: number; h: number };
export type DropResult = { parentId: string | null; index: number; line?: Box; box?: Box };

const abs = (r: DOMRect): Box => ({ x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height });

function closestOf(el: Element | null, type: string, skip: Element | null): Element | null {
  let cur = el?.closest(`[data-ntype="${type}"]`) ?? null;
  while (cur && skip && (skip === cur || skip.contains(cur))) cur = cur.parentElement?.closest(`[data-ntype="${type}"]`) ?? null;
  return cur;
}

const kidsOf = (parent: Element) => Array.from(parent.children).filter((c) => c.hasAttribute('data-nid'));

function slotOf(kids: Element[], x: number, y: number, horizontal: boolean) {
  for (let i = 0; i < kids.length; i++) {
    const r = kids[i].getBoundingClientRect();
    const mid = horizontal ? r.left + r.width / 2 : r.top + r.height / 2;
    if ((horizontal ? x : y) < mid) return i;
  }
  return kids.length;
}

function lineFor(container: Element, kids: Element[], index: number, horizontal: boolean): Box | undefined {
  if (!kids.length) return undefined;
  const c = container.getBoundingClientRect();
  const edge = index < kids.length ? kids[index].getBoundingClientRect() : kids[kids.length - 1].getBoundingClientRect();
  if (horizontal) {
    const x = index < kids.length ? edge.left : edge.right;
    return abs(new DOMRect(x - 2, c.top, 4, c.height));
  }
  const y = index < kids.length ? edge.top : edge.bottom;
  return abs(new DOMRect(c.left, y - 2, c.width, 4));
}

/** What kind of drop zone does this drag need? */
function zoneOf(drag: DragPayload, typeOf: (id: string) => string | undefined): 'widget' | 'column' | 'row' | 'section' {
  if (drag.kind === 'structure' || drag.kind === 'saved') return 'section';
  if (drag.kind === 'widget') return 'widget';
  const t = typeOf(drag.id);
  if (t === 'section' || t === 'row' || t === 'column') return t;
  return 'widget';
}

export function computeDrop(x: number, y: number, drag: DragPayload, active: Target, typeOf: (id: string) => string | undefined): DropResult | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const docEl = el.closest('[data-doc]');
  const activeDoc = document.querySelector(`[data-doc="${active}"]`);
  if (!activeDoc) return null;
  const dragEl = drag.kind === 'move' ? document.querySelector(`[data-nid="${drag.id}"]`) : null;
  const zone = zoneOf(drag, typeOf);

  if (zone === 'section') {
    const secs = Array.from(activeDoc.children).filter((c) => c.getAttribute('data-ntype') === 'section');
    const index = slotOf(secs, x, y, false);
    if (!secs.length) return { parentId: null, index: 0, box: abs(activeDoc.getBoundingClientRect()) };
    return { parentId: null, index, line: lineFor(activeDoc, secs, index, false) };
  }

  if (docEl && docEl !== activeDoc) return null;

  if (zone === 'row') {
    const sec = closestOf(el, 'section', dragEl);
    if (!sec) return null;
    const inner = sec.querySelector(':scope > .dr-inner') || sec;
    const rows = kidsOf(inner);
    const index = slotOf(rows, x, y, false);
    return { parentId: sec.getAttribute('data-nid'), index, ...(rows.length ? { line: lineFor(inner, rows, index, false) } : { box: abs(inner.getBoundingClientRect()) }) };
  }

  if (zone === 'column') {
    const row = closestOf(el, 'row', dragEl);
    if (!row) return null;
    const cols = kidsOf(row);
    const index = slotOf(cols, x, y, true);
    return { parentId: row.getAttribute('data-nid'), index, line: lineFor(row, cols, index, true) };
  }

  // widget
  let col = closestOf(el, 'column', dragEl);
  if (!col) {
    const sec = closestOf(el, 'section', dragEl);
    if (!sec) return null;
    let best: Element | null = null;
    let bestD = Infinity;
    sec.querySelectorAll('[data-ntype="column"]').forEach((c) => {
      if (dragEl && (dragEl === c || dragEl.contains(c))) return;
      const r = c.getBoundingClientRect();
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = c; }
    });
    col = best;
  }
  if (!col) return null;
  const kids = kidsOf(col).filter((k) => k !== dragEl || true);
  const horizontal = getComputedStyle(col).flexDirection.startsWith('row');
  const index = slotOf(kids, x, y, horizontal);
  const parentId = col.getAttribute('data-nid');
  if (!kids.length) return { parentId, index: 0, box: abs(col.getBoundingClientRect()) };
  // a widget can't be dropped into a container that doesn't accept it
  return { parentId, index, line: lineFor(col, kids, index, horizontal) };
}

export const isWidgetType = (type: string) => !!(WIDGETS as any)[type] && !['section', 'row', 'column'].includes(type);
