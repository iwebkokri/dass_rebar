'use client';

// Floating formatting bar shown above selected text inside a rich-text element (bold, italic, links, headings, lists).
import { useEffect, useRef, useState } from 'react';

type Pos = { x: number; y: number };

const inRich = (n: Node | null) => (n && (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest('[data-editable="rich"]')) || null;

export default function RichToolbar() {
  const [pos, setPos] = useState<Pos | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const saved = useRef<Range | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.execCommand('defaultParagraphSeparator', false, 'p');
    const update = () => {
      if (link !== null) return; // keep the bar while typing a URL
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !inRich(sel.anchorNode)) { setPos(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) { setPos(null); return; }
      setPos({ x: Math.max(8, Math.min(r.left + r.width / 2, document.documentElement.clientWidth - 150)), y: r.top + window.scrollY });
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => { document.removeEventListener('selectionchange', update); window.removeEventListener('scroll', update); };
  }, [link]);

  useEffect(() => { if (link !== null) input.current?.focus(); }, [link]);

  if (!pos) return null;
  const exec = (cmd: string, arg?: string) => document.execCommand(cmd, false, arg);
  const block = (tag: string) => exec('formatBlock', tag);
  const btn = (label: React.ReactNode, title: string, run: () => void, extra = '') => (
    <button type="button" title={title} className={extra} onMouseDown={(e) => { e.preventDefault(); run(); }}>{label}</button>
  );

  const applyLink = () => {
    const url = (link || '').trim();
    const sel = document.getSelection();
    if (saved.current && sel) { sel.removeAllRanges(); sel.addRange(saved.current); }
    if (url) {
      const safe = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(url) ? url : /^[\w.-]+\.[a-z]{2,}/i.test(url) ? `https://${url}` : '';
      if (safe) exec('createLink', safe);
    } else exec('unlink');
    setLink(null);
  };

  return (
    <div className="dr-rtb" style={{ left: pos.x, top: pos.y - 44 }} onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>
      {link === null ? (
        <>
          {btn(<b>B</b>, 'Bold', () => exec('bold'))}
          {btn(<i>I</i>, 'Italic', () => exec('italic'))}
          {btn(<u>U</u>, 'Underline', () => exec('underline'))}
          {btn('Link', 'Add link', () => { const s = document.getSelection(); saved.current = s && s.rangeCount ? s.getRangeAt(0).cloneRange() : null; setLink(''); })}
          <span className="dr-rtb-sep" />
          {btn('H2', 'Heading', () => block('h2'))}
          {btn('H3', 'Sub-heading', () => block('h3'))}
          {btn('P', 'Paragraph', () => block('p'))}
          {btn('• List', 'Bullet list', () => exec('insertUnorderedList'))}
          {btn('1. List', 'Numbered list', () => exec('insertOrderedList'))}
          {btn('Clear', 'Remove formatting', () => exec('removeFormat'))}
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); applyLink(); }} className="dr-rtb-link">
          <input ref={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… or /page (empty removes)" onKeyDown={(e) => { if (e.key === 'Escape') setLink(null); }} />
          <button type="submit">Apply</button>
        </form>
      )}
    </div>
  );
}
