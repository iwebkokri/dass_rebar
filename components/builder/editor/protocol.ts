// Messages between the editor shell (parent window) and the canvas (iframe). Same-origin only.
import type { BNode, Device } from '@/lib/builder/types';

export type Target = 'page' | 'header' | 'footer';
export type Docs = { page: BNode[]; header: BNode[] | null; footer: BNode[] | null };

/** What is being dragged. */
export type DragPayload =
  | { kind: 'widget'; type: string }
  | { kind: 'structure'; structure: number[] }
  | { kind: 'saved'; id: string; link: boolean }
  | { kind: 'move'; id: string };

export type ToCanvas =
  | { t: 'state'; docs: Docs; active: Target; selectedId: string | null; hoverId: string | null; path: string; device: Device }
  | { t: 'drag'; payload: DragPayload | null }
  | { t: 'scrollTo'; id: string };

export type FromCanvas =
  | { t: 'ready' }
  | { t: 'select'; id: string | null }
  | { t: 'switch'; target: Target }
  | { t: 'setProp'; id: string; key: string; value: any }
  | { t: 'setItemProp'; id: string; key: string; index: number; field: string; value: any }
  | { t: 'drop'; payload: DragPayload; parentId: string | null; index: number }
  | { t: 'action'; id: string; action: 'duplicate' | 'delete' | 'up' | 'down' | 'parent' | 'addRow' | 'addColumn' | 'addNestedRow' | 'saveSection' }
  | { t: 'structure'; id: string; structure: number[] }
  | { t: 'addSection'; index: number; structure: number[] }
  | { t: 'library'; index: number }
  | { t: 'pickMedia'; id: string; key: string; kind: 'image' | 'video' }
  | { t: 'key'; key: string; ctrl: boolean; shift: boolean };

export const isFromCanvas = (d: any): d is FromCanvas => !!d && typeof d === 'object' && typeof d.t === 'string' && d.__dr === 'canvas';
export const isToCanvas = (d: any): d is ToCanvas => !!d && typeof d === 'object' && typeof d.t === 'string' && d.__dr === 'shell';

export const toCanvas = (msg: ToCanvas) => ({ ...msg, __dr: 'shell' });
export const fromCanvas = (msg: FromCanvas) => ({ ...msg, __dr: 'canvas' });
