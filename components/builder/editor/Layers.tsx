'use client';

// Navigator: the tree of the document being edited. Click to select, hover to highlight on the page, arrows to reorder.
import { useState } from 'react';
import { WIDGETS } from '@/lib/builder/schema.mjs';
import type { BNode } from '@/lib/builder/types';
import { I } from './ui';

const snippet = (n: BNode) => {
  const p = n.props || {};
  const raw = p.text || p.title || p.label || p.html || p.number || '';
  return typeof raw === 'string' ? raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 28) : '';
};

type Props = {
  nodes: BNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onMove: (id: string, delta: number) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
};

function Row({ node, depth, props, openMap, toggle }: { node: BNode; depth: number; props: Props; openMap: Record<string, boolean>; toggle: (id: string) => void }) {
  const def: any = (WIDGETS as any)[node.type];
  const kids = node.children || [];
  const open = openMap[node.id] !== false;
  const sel = props.selectedId === node.id;
  return (
    <>
      <div className={`be-layer${sel ? ' is-sel' : ''}`} style={{ paddingLeft: 8 + depth * 14 }} onMouseEnter={() => props.onHover(node.id)} onMouseLeave={() => props.onHover(null)}>
        <button type="button" className={`be-layer-twist${kids.length ? '' : ' is-leaf'}${open ? ' is-open' : ''}`} onClick={() => toggle(node.id)} aria-label={open ? 'Collapse' : 'Expand'}><I name="chevron" size={10} /></button>
        <button type="button" className="be-layer-main" onClick={() => props.onSelect(node.id)}>
          <I name={def?.icon || 'grid'} size={14} />
          <span>{def?.label || node.type}</span>
          {snippet(node) && <em>{snippet(node)}</em>}
        </button>
        <span className="be-layer-btns">
          <button type="button" title="Move up" onClick={() => props.onMove(node.id, -1)}><I name="up" size={11} /></button>
          <button type="button" title="Move down" onClick={() => props.onMove(node.id, 1)}><I name="down" size={11} /></button>
          <button type="button" title="Duplicate" onClick={() => props.onDuplicate(node.id)}><I name="copy" size={11} /></button>
          <button type="button" title="Delete" onClick={() => props.onRemove(node.id)}><I name="trash" size={11} /></button>
        </span>
      </div>
      {open && kids.map((k) => <Row key={k.id} node={k} depth={depth + 1} props={props} openMap={openMap} toggle={toggle} />)}
    </>
  );
}

export default function Layers(props: Props) {
  const [openMap, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((m) => ({ ...m, [id]: m[id] === false }));
  if (!props.nodes.length) return <p className="be-muted" style={{ padding: 16 }}>Nothing here yet. Add a section from the Elements tab.</p>;
  return <div className="be-layers">{props.nodes.map((n) => <Row key={n.id} node={n} depth={0} props={props} openMap={openMap} toggle={toggle} />)}</div>;
}
