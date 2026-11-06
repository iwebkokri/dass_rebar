// Editor state: three documents (page / header / footer), selection, undo/redo. All edits are immutable tree operations.
import {
  applyStructure, canContain, cloneNode, duplicateNode, findNode, insertNode, makeNode, makeRow, makeSection, moveNode, removeNode, setProp, updateNode,
} from '@/lib/builder/tree.mjs';
import { WIDGETS } from '@/lib/builder/schema.mjs';
import type { BNode } from '@/lib/builder/types';
import type { Docs, Target } from './protocol';

export type State = {
  docs: Docs;
  active: Target;
  selectedId: string | null;
  past: Docs[];
  future: Docs[];
  dirty: Record<Target, boolean>;
  coalesce: { key: string; at: number } | null;
};

export type Action =
  | { type: 'select'; id: string | null }
  | { type: 'switch'; target: Target }
  | { type: 'setProp'; id: string; key: string; value: any }
  | { type: 'setItemProp'; id: string; key: string; index: number; field: string; value: any }
  | { type: 'drop'; payload: any; parentId: string | null; index: number; saved?: Record<string, BNode[]> }
  | { type: 'addAuto'; widget: string }
  | { type: 'addSavedAuto'; id: string; link: boolean; saved: Record<string, BNode[]> }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string }
  | { type: 'moveBy'; id: string; delta: number }
  | { type: 'selectParent'; id: string }
  | { type: 'structure'; id: string; structure: number[] }
  | { type: 'addRow'; id: string }
  | { type: 'addColumn'; id: string }
  | { type: 'addNestedRow'; id: string }
  | { type: 'addSection'; index: number; structure: number[] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; target: Target; nodes: BNode[] }
  | { type: 'saved'; targets: Target[] };

export const initialState = (docs: Docs, active: Target = 'page'): State => ({
  docs, active, selectedId: null, past: [], future: [], dirty: { page: false, header: false, footer: false }, coalesce: null,
});

/** Which document holds this node? */
export function locate(docs: Docs, id: string): Target | null {
  for (const t of ['page', 'header', 'footer'] as Target[]) {
    const nodes = docs[t];
    if (nodes && findNode(nodes, id)) return t;
  }
  return null;
}

function commit(s: State, target: Target, nodes: BNode[], opts: { coalesceKey?: string; selectedId?: string | null } = {}): State {
  const now = Date.now();
  const merge = !!opts.coalesceKey && s.coalesce?.key === opts.coalesceKey && now - s.coalesce.at < 1200;
  return {
    ...s,
    docs: { ...s.docs, [target]: nodes },
    past: merge ? s.past : [...s.past.slice(-99), s.docs],
    future: [],
    dirty: { ...s.dirty, [target]: true },
    coalesce: opts.coalesceKey ? { key: opts.coalesceKey, at: now } : null,
    selectedId: opts.selectedId !== undefined ? opts.selectedId : s.selectedId,
  };
}

const widgetNode = (type: string) => makeNode(type);

/** Where should a widget go when the user clicks it in the palette? */
function autoPlace(nodes: BNode[], selectedId: string | null): { parentId: string | null; index: number } {
  const sel = selectedId ? findNode(nodes, selectedId) : null;
  if (sel) {
    if (sel.node.type === 'column') return { parentId: sel.node.id, index: (sel.node.children || []).length };
    if (sel.parent?.type === 'column') return { parentId: sel.parent.id, index: sel.index + 1 };
    if (sel.node.type === 'row' && sel.node.children?.length) return { parentId: sel.node.children[0].id, index: (sel.node.children[0].children || []).length };
    if (sel.node.type === 'section') {
      const row = sel.node.children?.[0];
      const col = row?.children?.[0];
      if (col) return { parentId: col.id, index: (col.children || []).length };
    }
  }
  const lastSection = nodes[nodes.length - 1];
  const lastRow = lastSection?.children?.[lastSection.children.length - 1];
  const lastCol = lastRow?.children?.[lastRow.children.length - 1];
  if (lastCol) return { parentId: lastCol.id, index: (lastCol.children || []).length };
  return { parentId: null, index: nodes.length };
}

/** Insert a new widget; if no column exists yet, wrap it in a fresh section. */
function insertWidget(nodes: BNode[], widget: BNode, place: { parentId: string | null; index: number }) {
  if (place.parentId !== null) {
    const parent = findNode(nodes, place.parentId);
    if (parent && canContain(parent.node.type, widget.type)) return { nodes: insertNode(nodes, place.parentId, place.index, widget), id: widget.id };
  }
  const section = makeSection([12]);
  const col = section.children![0].children![0];
  col.children = [widget];
  return { nodes: insertNode(nodes, null, nodes.length, section), id: widget.id };
}

export function reducer(s: State, a: Action): State {
  const active = s.active;
  const cur = s.docs[active] || [];

  switch (a.type) {
    case 'select': return { ...s, selectedId: a.id, active: a.id ? locate(s.docs, a.id) ?? s.active : s.active };
    case 'switch': return s.docs[a.target] ? { ...s, active: a.target, selectedId: null } : s;

    case 'setProp': {
      const t = locate(s.docs, a.id);
      if (!t) return s;
      return commit(s, t, setProp(s.docs[t]!, a.id, a.key, a.value), { coalesceKey: `${a.id}:${a.key}` });
    }
    case 'setItemProp': {
      const t = locate(s.docs, a.id);
      if (!t) return s;
      const nodes = updateNode(s.docs[t]!, a.id, (n) => {
        const list = Array.isArray(n.props?.[a.key]) ? [...n.props[a.key]] : [];
        list[a.index] = { ...(list[a.index] || {}), [a.field]: a.value };
        return { ...n, props: { ...n.props, [a.key]: list } };
      });
      return commit(s, t, nodes, { coalesceKey: `${a.id}:${a.key}:${a.index}:${a.field}` });
    }

    case 'addAuto': {
      const widget = widgetNode(a.widget);
      const { nodes, id } = insertWidget(cur, widget, autoPlace(cur, s.selectedId));
      return commit(s, active, nodes, { selectedId: id });
    }
    case 'addSavedAuto': {
      const src = a.saved[a.id];
      if (!src) return s;
      const sel = s.selectedId ? findNode(cur, s.selectedId) : null;
      let index = cur.length;
      if (sel) {
        let n = sel;
        while (n.parent) n = findNode(cur, n.parent.id)!;
        index = n.index + 1;
      }
      const add = a.link ? [linkedSection(a.id)] : src.map(cloneNode);
      let nodes = cur;
      add.forEach((sec, i) => { nodes = insertNode(nodes, null, index + i, sec); });
      return commit(s, active, nodes, { selectedId: add[0]?.id ?? null });
    }

    case 'drop': {
      const p = a.payload;
      if (p.kind === 'move') {
        const t = locate(s.docs, p.id);
        if (!t || t !== active) return s;
        return commit(s, t, moveNode(s.docs[t]!, p.id, a.parentId, a.index), { selectedId: p.id });
      }
      if (p.kind === 'widget') {
        const widget = widgetNode(p.type);
        const { nodes, id } = insertWidget(cur, widget, { parentId: a.parentId, index: a.index });
        return commit(s, active, nodes, { selectedId: id });
      }
      if (p.kind === 'structure') {
        const sec = makeSection(p.structure);
        return commit(s, active, insertNode(cur, null, a.index, sec), { selectedId: sec.id });
      }
      if (p.kind === 'saved') {
        const src = a.saved?.[p.id];
        if (!src) return s;
        const add = p.link ? [linkedSection(p.id)] : src.map(cloneNode);
        let nodes = cur;
        add.forEach((sec, i) => { nodes = insertNode(nodes, null, a.index + i, sec); });
        return commit(s, active, nodes, { selectedId: add[0]?.id ?? null });
      }
      return s;
    }

    case 'remove': {
      const t = locate(s.docs, a.id);
      if (!t) return s;
      return commit(s, t, removeNode(s.docs[t]!, a.id), { selectedId: null });
    }
    case 'duplicate': {
      const t = locate(s.docs, a.id);
      if (!t) return s;
      const r = duplicateNode(s.docs[t]!, a.id);
      return commit(s, t, r.nodes, { selectedId: r.newId });
    }
    case 'moveBy': {
      const t = locate(s.docs, a.id);
      if (!t) return s;
      const f = findNode(s.docs[t]!, a.id);
      if (!f) return s;
      const to = f.index + a.delta;
      if (to < 0 || to >= f.siblings.length) return s;
      // moveNode's index is "before this slot in the current list"
      return commit(s, t, moveNode(s.docs[t]!, a.id, f.parent ? f.parent.id : null, a.delta > 0 ? to + 1 : to));
    }
    case 'selectParent': {
      const t = locate(s.docs, a.id);
      const f = t ? findNode(s.docs[t]!, a.id) : null;
      return f?.parent ? { ...s, selectedId: f.parent.id } : s;
    }

    case 'structure': {
      const t = locate(s.docs, a.id);
      if (!t) return s;
      return commit(s, t, applyStructure(s.docs[t]!, a.id, a.structure));
    }
    case 'addRow': {
      const t = locate(s.docs, a.id);
      if (!t) return s;
      const f = findNode(s.docs[t]!, a.id);
      if (!f) return s;
      const row = makeRow([12]);
      return commit(s, t, insertNode(s.docs[t]!, a.id, (f.node.children || []).length, row), { selectedId: row.id });
    }
    case 'addColumn': {
      const t = locate(s.docs, a.id);
      if (!t) return s;
      const f = findNode(s.docs[t]!, a.id);
      if (!f || f.node.type !== 'row') return s;
      const n = (f.node.children || []).length;
      if (n >= 6) return s;
      const even = Array.from({ length: n + 1 }, (_, i) => Math.floor(12 / (n + 1)) + (i >= n + 1 - (12 % (n + 1)) ? 1 : 0));
      return commit(s, t, applyStructure(s.docs[t]!, a.id, even));
    }
    case 'addNestedRow': {
      const t = locate(s.docs, a.id);
      if (!t) return s;
      const f = findNode(s.docs[t]!, a.id);
      if (!f || f.node.type !== 'column') return s;
      const row = makeRow([6, 6]);
      return commit(s, t, insertNode(s.docs[t]!, a.id, (f.node.children || []).length, row), { selectedId: row.id });
    }
    case 'addSection': {
      const sec = makeSection(a.structure);
      return commit(s, active, insertNode(cur, null, a.index, sec), { selectedId: sec.id });
    }

    case 'undo': {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { ...s, docs: prev, past: s.past.slice(0, -1), future: [s.docs, ...s.future].slice(0, 100), dirty: { page: true, header: true, footer: true }, coalesce: null, selectedId: s.selectedId && locate(prev, s.selectedId) ? s.selectedId : null };
    }
    case 'redo': {
      if (!s.future.length) return s;
      const next = s.future[0];
      return { ...s, docs: next, past: [...s.past, s.docs], future: s.future.slice(1), dirty: { page: true, header: true, footer: true }, coalesce: null, selectedId: s.selectedId && locate(next, s.selectedId) ? s.selectedId : null };
    }
    case 'replace': return commit(s, a.target, a.nodes, { selectedId: null });
    case 'saved': return { ...s, dirty: { ...s.dirty, ...Object.fromEntries(a.targets.map((t) => [t, false])) } };
    default: return s;
  }
}

/** A "linked" saved section: a section holding a single `template` widget. */
function linkedSection(templateId: string): BNode {
  const section = makeSection([12]);
  section.children![0].children![0].children = [makeNode('template', { templateId })];
  return section;
}

export const widgetLabel = (type: string) => (WIDGETS as any)[type]?.label || type;
