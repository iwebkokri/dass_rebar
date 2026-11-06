'use client';

// "Elements" tab: structures (new sections), widgets by category and saved sections. Drag onto the page or click to add.
import { useState } from 'react';
import { CATEGORIES, STRUCTURES, WIDGETS } from '@/lib/builder/schema.mjs';
import type { BNode } from '@/lib/builder/types';
import type { DragPayload } from './protocol';
import { I } from './ui';

type Props = {
  isAdmin: boolean;
  sections: { id: number; name: string }[];
  onAdd: (type: string) => void;
  onAddStructure: (structure: number[]) => void;
  onAddSaved: (id: string, link: boolean) => void;
  onDragStart: (p: DragPayload) => void;
  onDragEnd: () => void;
};

export default function Palette({ isAdmin, sections, onAdd, onAddStructure, onAddSaved, onDragStart, onDragEnd }: Props) {
  const [q, setQ] = useState('');
  const match = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  const widgets = Object.values(WIDGETS as Record<string, any>).filter((w) => !['section', 'row', 'column'].includes(w.type) && (!w.adminOnly || isAdmin));

  const drag = (payload: DragPayload) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData('text/plain', 'dr-new'); e.dataTransfer.effectAllowed = 'copy'; onDragStart(payload); },
    onDragEnd,
  });

  return (
    <div className="be-palette">
      <input className="be-input be-search" placeholder="Search elements…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search elements" />
      {!q.trim() && (
        <section>
          <h3>Layout</h3>
          <p className="be-muted">Drag a layout onto the page for a new section.</p>
          <div className="be-structs">
            {STRUCTURES.map((st: number[]) => (
              <button key={st.join('-')} type="button" className="be-struct" title={`${st.join(' + ')} columns`} onClick={() => onAddStructure(st)} {...drag({ kind: 'structure', structure: st })}>
                {st.map((n, i) => <i key={i} style={{ flex: n }} />)}
              </button>
            ))}
          </div>
        </section>
      )}
      {CATEGORIES.map(([cat, label]: [string, string]) => {
        const list = widgets.filter((w) => w.category === cat && match(`${w.label} ${w.type}`));
        if (!list.length) return null;
        return (
          <section key={cat}>
            <h3>{label}</h3>
            <div className="be-tiles">
              {list.map((w) => (
                <button key={w.type} type="button" className="be-tile" title={`Add ${w.label}`} onClick={() => onAdd(w.type)} {...drag({ kind: 'widget', type: w.type })}>
                  <I name={w.icon} size={22} />
                  <span>{w.label}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {sections.filter((s) => match(s.name)).length > 0 && (
        <section>
          <h3>Saved sections</h3>
          <div className="be-saved">
            {sections.filter((s) => match(s.name)).map((s) => (
              <div key={s.id} className="be-saved-row" {...drag({ kind: 'saved', id: String(s.id), link: false })}>
                <I name="library" size={16} />
                <span>{s.name}</span>
                <button type="button" title="Insert a copy you can edit freely" onClick={() => onAddSaved(String(s.id), false)}>Copy</button>
                <button type="button" title="Insert a live link — editing the saved section updates every page" onClick={() => onAddSaved(String(s.id), true)}>Link</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export type _Unused = BNode;
