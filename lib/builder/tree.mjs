// Pure (immutable) operations on builder documents. Used by the editor, the seed script and the server.
import { CHILD_TYPES, WIDGETS, defaultProps } from './schema.mjs';

export const EMPTY_DOC = () => ({ v: 1, nodes: [] });

export function newId() {
  const abc = 'abcdefghijklmnopqrstuvwxyz';
  const first = abc[Math.floor(Math.random() * 26)];
  return first + Math.random().toString(36).slice(2, 9).padEnd(7, '0');
}

export function makeNode(type, props = {}, children) {
  const node = { id: newId(), type, props: { ...defaultProps(type), ...props } };
  if (WIDGETS[type]?.container) node.children = children || [];
  else if (children) node.children = children;
  return node;
}

/** Column spans for a "structure" such as [4, 8]: desktop as given, tablet stacks wide rows, mobile always stacks. */
function spans(structure) {
  const n = structure.length;
  return structure.map((d) => ({ d, t: n >= 3 ? 6 : d, m: 12 }));
}

export function makeRow(structure = [12]) {
  return makeNode('row', {}, spans(structure).map((span) => makeNode('column', { span }, [])));
}

export function makeSection(structure = [12]) {
  return makeNode('section', {}, [makeRow(structure)]);
}

export function walk(nodes, fn, parent = null) {
  for (const n of nodes || []) {
    if (fn(n, parent) === false) return false;
    if (n.children && walk(n.children, fn, n) === false) return false;
  }
  return true;
}

export function findNode(nodes, id) {
  let hit = null;
  const search = (list, parent) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.id === id) { hit = { node: n, parent, index: i, siblings: list }; return true; }
      if (n.children && search(n.children, n)) return true;
    }
    return false;
  };
  search(nodes, null);
  return hit;
}

export function pathTo(nodes, id) {
  const path = [];
  const search = (list) => {
    for (const n of list) {
      path.push(n);
      if (n.id === id) return true;
      if (n.children && search(n.children)) return true;
      path.pop();
    }
    return false;
  };
  return search(nodes) ? path : [];
}

export function canContain(parentType, childType) {
  if (parentType === null) return childType === 'section';
  return !!CHILD_TYPES[parentType]?.includes(childType);
}

/** Deep copy with fresh ids (used by duplicate / paste / saved sections). */
export function cloneNode(node) {
  return { ...node, id: newId(), props: JSON.parse(JSON.stringify(node.props || {})), ...(node.children ? { children: node.children.map(cloneNode) } : {}) };
}

function mapChildren(nodes, parentId, fn) {
  if (parentId === null) return fn(nodes);
  let changed = false;
  const next = nodes.map((n) => {
    if (n.id === parentId) { changed = true; return { ...n, children: fn(n.children || []) }; }
    if (n.children) {
      const kids = mapChildren(n.children, parentId, fn);
      if (kids !== n.children) { changed = true; return { ...n, children: kids }; }
    }
    return n;
  });
  return changed ? next : nodes;
}

export function insertNode(nodes, parentId, index, node) {
  return mapChildren(nodes, parentId, (list) => {
    const copy = list.slice();
    copy.splice(Math.max(0, Math.min(index, copy.length)), 0, node);
    return copy;
  });
}

export function removeNode(nodes, id) {
  const found = findNode(nodes, id);
  let next = removeNodeRaw(nodes, id);
  // removing a column: stretch the remaining columns so the row still adds up to 12
  if (found && found.node.type === 'column' && found.parent) next = updateNode(next, found.parent.id, fillRow);
  return normalize(next);
}

export function updateNode(nodes, id, fn) {
  const go = (list) => {
    let changed = false;
    const next = list.map((n) => {
      if (n.id === id) { changed = true; return fn(n); }
      if (n.children) {
        const kids = go(n.children);
        if (kids !== n.children) { changed = true; return { ...n, children: kids }; }
      }
      return n;
    });
    return changed ? next : list;
  };
  return go(nodes);
}

export const setProp = (nodes, id, key, value) =>
  updateNode(nodes, id, (n) => {
    const props = { ...(n.props || {}) };
    if (value === undefined || value === null || value === '') delete props[key];
    else props[key] = value;
    return { ...n, props };
  });

/** Move a node under `parentId` (null = top level) at `index`. Refuses invalid / circular moves. */
export function moveNode(nodes, id, parentId, index) {
  const found = findNode(nodes, id);
  if (!found) return nodes;
  const target = parentId === null ? null : findNode(nodes, parentId);
  if (parentId !== null && !target) return nodes;
  if (!canContain(target ? target.node.type : null, found.node.type)) return nodes;
  if (parentId !== null && (parentId === id || findNode([found.node], parentId))) return nodes;
  // index is relative to the list *after* removal when moving within the same parent
  let at = index;
  const sameParent = (found.parent ? found.parent.id : null) === parentId;
  if (sameParent && found.index < index) at -= 1;
  const removed = removeNodeRaw(nodes, id);
  return normalize(insertNode(removed, parentId, at, found.node));
}

function removeNodeRaw(nodes, id) {
  const go = (list) => {
    let changed = false;
    const next = [];
    for (const n of list) {
      if (n.id === id) { changed = true; continue; }
      if (n.children) {
        const kids = go(n.children);
        if (kids !== n.children) { changed = true; next.push({ ...n, children: kids }); continue; }
      }
      next.push(n);
    }
    return changed ? next : list;
  };
  return go(nodes);
}

export function duplicateNode(nodes, id) {
  const found = findNode(nodes, id);
  if (!found) return { nodes, newId: null };
  const copy = cloneNode(found.node);
  return { nodes: insertNode(nodes, found.parent ? found.parent.id : null, found.index + 1, copy), newId: copy.id };
}

/** A row with no columns is meaningless — drop it (recursively). */
export function normalize(nodes) {
  const go = (list) => {
    let changed = false;
    const out = [];
    for (const n of list) {
      let cur = n;
      if (n.children) {
        const kids = go(n.children);
        if (kids !== n.children) { changed = true; cur = { ...n, children: kids }; }
      }
      if (cur.type === 'row' && (!cur.children || cur.children.length === 0)) { changed = true; continue; }
      out.push(cur);
    }
    return changed ? out : list;
  };
  return go(nodes);
}

/** Scale a row's desktop column widths so they total 12 again (after a column was added / removed). */
export function fillRow(row) {
  const cols = row.children || [];
  if (!cols.length) return row;
  const total = cols.reduce((s, c) => s + (Number(c.props?.span?.d) || 0), 0);
  if (total === 12 || total === 0) return total === 0 ? rebalance(row) : row;
  let used = 0;
  const widths = cols.map((c, i) => {
    if (i === cols.length - 1) return Math.max(1, 12 - used);
    const w = Math.max(1, Math.round(((Number(c.props?.span?.d) || 1) * 12) / total));
    used += w;
    return w;
  });
  return { ...row, children: cols.map((c, i) => ({ ...c, props: { ...c.props, span: { ...(c.props.span || {}), d: widths[i] } } })) };
}

/** Give a row's columns equal desktop widths. */
export function rebalance(row) {
  const n = row.children.length;
  const base = Math.floor(12 / n);
  let rest = 12 - base * n;
  return {
    ...row,
    children: row.children.map((c, i) => {
      const d = base + (i >= n - rest ? 1 : 0);
      return { ...c, props: { ...c.props, span: { ...(c.props.span || {}), d, ...(n >= 3 ? { t: 6 } : { t: d }), m: 12 } } };
    }),
  };
}

/** Change a row to a new column structure, keeping content: extra old columns are merged into the last new one. */
export function applyStructure(nodes, rowId, structure) {
  return updateNode(nodes, rowId, (row) => {
    const cols = row.children || [];
    const next = structure.map((d, i) => {
      const existing = cols[i];
      const span = { d, t: structure.length >= 3 ? 6 : d, m: 12 };
      return existing ? { ...existing, props: { ...existing.props, span } } : makeNode('column', { span }, []);
    });
    const orphans = cols.slice(structure.length).flatMap((c) => c.children || []);
    if (orphans.length) next[next.length - 1] = { ...next[next.length - 1], children: [...(next[next.length - 1].children || []), ...orphans] };
    return { ...row, children: next };
  });
}

/** Which datasets do these nodes need loaded? */
export function collectNeeds(nodes, set = new Set()) {
  walk(nodes, (n) => { for (const need of WIDGETS[n.type]?.needs || []) set.add(need); });
  return set;
}

export function countNodes(nodes) {
  let n = 0;
  walk(nodes, () => { n++; });
  return n;
}

export function parseDoc(json) {
  try {
    const v = typeof json === 'string' ? JSON.parse(json) : json;
    if (v && typeof v === 'object' && Array.isArray(v.nodes)) return { v: 1, nodes: v.nodes };
  } catch { /* fall through */ }
  return EMPTY_DOC();
}
