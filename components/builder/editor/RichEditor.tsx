'use client';

// Small rich-text editor for the settings panel (the same text can also be edited directly on the page).
import { useEffect, useRef } from 'react';
import { cleanRichHtml } from '../richtext';

export default function RichEditor({ value, onChange }: { value: string; onChange: (v: string | undefined) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  const exec = (cmd: string, arg?: string) => { ref.current?.focus(); document.execCommand(cmd, false, arg); commit(); };
  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const html = cleanRichHtml(el.innerHTML);
    if (html !== value) onChange(html || undefined);
  };
  const tb = (label: React.ReactNode, title: string, run: () => void) => (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); run(); }}>{label}</button>
  );

  return (
    <div className="be-rich">
      <div className="be-rich-bar">
        {tb(<b>B</b>, 'Bold', () => exec('bold'))}
        {tb(<i>I</i>, 'Italic', () => exec('italic'))}
        {tb('H2', 'Heading', () => exec('formatBlock', 'h2'))}
        {tb('H3', 'Sub-heading', () => exec('formatBlock', 'h3'))}
        {tb('P', 'Paragraph', () => exec('formatBlock', 'p'))}
        {tb('• List', 'Bullet list', () => exec('insertUnorderedList'))}
        {tb('1. List', 'Numbered list', () => exec('insertOrderedList'))}
        {tb('Link', 'Link', () => { const url = window.prompt('Link address (https://…, /page, mailto:…)'); if (url) exec('createLink', url); })}
      </div>
      <div ref={ref} className="be-rich-area" contentEditable suppressContentEditableWarning onInput={commit} onBlur={commit} />
    </div>
  );
}
