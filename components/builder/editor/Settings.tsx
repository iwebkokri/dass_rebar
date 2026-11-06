'use client';

// The settings panel for the selected element, generated from the schema: Content / Style / Advanced tabs, collapsible groups,
// per-device values for responsive controls.
import { useMemo, useState } from 'react';
import { WIDGETS, controlsFor, propValue } from '@/lib/builder/schema.mjs';
import type { BNode, Device } from '@/lib/builder/types';
import { ControlField, type CtlCx } from './controls';
import { I } from './ui';

const TABS: [string, string][] = [['content', 'Content'], ['style', 'Style'], ['advanced', 'Advanced']];

function visible(c: any, node: BNode) {
  const cond = c.condition;
  if (!cond) return true;
  const v = propValue(node, cond.key);
  if ('eq' in cond) return v === cond.eq;
  if ('in' in cond) return cond.in.includes(v);
  if (cond.truthy) return !!v && !(typeof v === 'object' && !Object.keys(v).length);
  return true;
}

type Props = {
  node: BNode;
  trail: BNode[];
  device: Device;
  cx: CtlCx;
  onProp: (id: string, key: string, value: any) => void;
  onSelect: (id: string) => void;
};

export default function Settings({ node, trail, device, cx, onProp, onSelect }: Props) {
  const [tab, setTab] = useState('content');
  const def: any = (WIDGETS as any)[node.type];
  const controls = useMemo(() => controlsFor(node.type), [node.type]);
  const inTab: any[] = controls.filter((c: any) => c.tab === tab && visible(c, node));
  const groups: Record<string, any[]> = {};
  for (const c of inTab as any[]) (groups[c.group || (tab === 'content' ? def?.label || 'Content' : 'General')] ||= []).push(c);
  const hasStyle = controls.some((c: any) => c.tab === 'style');

  return (
    <div className="be-settings">
      <div className="be-crumbs">
        {trail.map((n, i) => (
          <span key={n.id}>
            {i > 0 && <I name="chevron" size={10} />}
            <button type="button" className={n.id === node.id ? 'is-on' : ''} onClick={() => onSelect(n.id)}>{(WIDGETS as any)[n.type]?.label || n.type}</button>
          </span>
        ))}
      </div>
      <div className="be-tabs" role="tablist">
        {TABS.filter(([k]) => k !== 'style' || hasStyle).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div className="be-groups">
        {Object.keys(groups).length === 0 && <p className="be-muted">Nothing to set here.</p>}
        {Object.entries(groups).map(([g, list], gi) => (
          <details key={`${tab}-${g}`} className="be-group" open={gi === 0 || tab === 'content'}>
            <summary>{g}</summary>
            <div className="be-group-body">
              {list.map((c: any) => (
                <ControlField key={c.key} c={c} cx={cx} value={node.props?.[c.key] ?? (c.default !== undefined && !c.css ? c.default : undefined)} onChange={(v) => onProp(node.id, c.key, v)} />
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
