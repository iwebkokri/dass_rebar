'use client';

// In-canvas inline editing. The element is uncontrolled while it has focus (React never touches its children), which avoids
// the cursor jumping and DOM-reconciliation errors you get from controlled contentEditable.
import { createElement, useLayoutEffect, useRef } from 'react';
import type { BuilderCtx, BNode } from '@/lib/builder/types';
import { cleanRichHtml } from './richtext';

type Props = {
  node: BNode;
  k: string;
  as?: string;
  className?: string;
  ctx: BuilderCtx;
  rich?: boolean;
  multiline?: boolean;
  placeholder?: string;
  /** Repeater item address, when this text lives inside an array prop. */
  item?: { key: string; index: number; field: string };
  value?: string;
  style?: React.CSSProperties;
};

export default function EditableText({ node, k, as = 'span', className = '', ctx, rich, multiline = true, placeholder = 'Type here…', item, value: given, style }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const value = given !== undefined ? given : String(item ? '' : node.props?.[k] ?? '');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (rich) { if (el.innerHTML !== value) el.innerHTML = value; }
    else if (el.textContent !== value) el.textContent = value;
  }, [value, rich]);

  const commit = () => {
    const el = ref.current;
    if (!el || !ctx.edit) return;
    const next = rich ? cleanRichHtml(el.innerHTML) : el.innerText.replace(/ /g, ' ').replace(/\n+$/, '');
    if (next === value) return;
    if (item) ctx.edit.setItemProp(node.id, item.key, item.index, item.field, next);
    else ctx.edit.setProp(node.id, k, next);
  };

  return createElement(as, {
    ref,
    className: `${className} dr-editable`.trim(),
    style,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    'data-ph': placeholder,
    'data-editable': rich ? 'rich' : 'text',
    onBlur: commit,
    onPaste: (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, rich || multiline ? text : text.replace(/\s+/g, ' '));
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { (e.currentTarget as HTMLElement).blur(); return; }
      if (e.key === 'Enter' && !rich) {
        e.preventDefault();
        if (multiline && e.shiftKey === false) document.execCommand('insertLineBreak');
        else if (!multiline) (e.currentTarget as HTMLElement).blur();
      }
    },
  });
}
