'use client';

// Article text editor for the site's safe mini-markup (see components/PostBody.tsx):
//   blank line = new paragraph · ## Heading · ### Sub-heading · - bullet · **bold** · [link text](https://…)
// A formatting toolbar edits the text in place; the Preview tab renders it with the real PostBody component.
import '@/app/admin/css/posts.css';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import PostBody from '@/components/PostBody';

type Props = { name?: string; defaultValue?: string; maxLength?: number };

export default function PostBodyEditor({ name = 'body', defaultValue = '', maxLength = 200_000 }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<[number, number] | null>(null); // selection to restore after the next render

  useEffect(() => {
    const sel = pending.current;
    if (sel && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(sel[0], sel[1]);
      pending.current = null;
    }
  }, [value]);

  function apply(next: string, from: number, to: number) {
    if (next === value) {
      ref.current?.setSelectionRange(from, to); // nothing re-renders when the text is unchanged
      return;
    }
    pending.current = [from, to];
    setValue(next.slice(0, maxLength));
  }

  /** Wrap the selection (or a placeholder) in before/after; if it is already wrapped, unwrap it. */
  function wrap(before: string, after: string, placeholder: string) {
    const el = ref.current;
    if (!el) return;
    const [s, e] = [el.selectionStart, el.selectionEnd];
    const sel = value.slice(s, e);
    if (sel.startsWith(before) && sel.endsWith(after) && sel.length >= before.length + after.length) {
      const inner = sel.slice(before.length, sel.length - after.length);
      apply(value.slice(0, s) + inner + value.slice(e), s, s + inner.length);
      return;
    }
    const text = sel || placeholder;
    apply(value.slice(0, s) + before + text + after + value.slice(e), s + before.length, s + before.length + text.length);
  }

  function link() {
    const el = ref.current;
    if (!el) return;
    const [s, e] = [el.selectionStart, el.selectionEnd];
    const sel = value.slice(s, e) || 'link text';
    let url = window.prompt('Link address (https://… or /page)', 'https://')?.trim();
    if (!url) return;
    if (/^www\./i.test(url)) url = `https://${url}`;
    if (!/^(https?:\/\/|\/(?!\/))\S+$/i.test(url) || /[)]/.test(url)) {
      window.alert('Enter a web address starting with https:// (or a path starting with /), without spaces or “)”.');
      return;
    }
    const md = `[${sel.replace(/[\[\]]/g, '')}](${url})`;
    apply(value.slice(0, s) + md + value.slice(e), s + 1, s + 1 + sel.replace(/[\[\]]/g, '').length);
  }

  /** Apply a block format ('## ', '### ', '- ' or none) to every line touched by the selection, keeping blocks separated by blank lines. */
  function block(prefix: '## ' | '### ' | '- ' | '') {
    const el = ref.current;
    if (!el) return;
    const [s, e] = [el.selectionStart, el.selectionEnd];
    const start = value.lastIndexOf('\n', s - 1) + 1;
    let end = value.indexOf('\n', e);
    if (end === -1) end = value.length;
    const lines = value.slice(start, end).split('\n');
    const strip = (l: string) => l.replace(/^(#{2,3} |- )/, '');
    const allHave = prefix !== '' && lines.filter((l) => l.trim()).every((l) => l.startsWith(prefix));
    let out: string;
    if (prefix === '' || allHave) out = lines.map(strip).join('\n');
    else if (prefix === '- ') out = lines.map((l) => (l.trim() ? `- ${strip(l)}` : l)).join('\n');
    else out = prefix + lines.map(strip).filter((l) => l.trim()).join(' '); // a heading is one line
    const before = value.slice(0, start);
    const after = value.slice(end);
    const lead = prefix && before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    const trail = prefix && after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
    const text = before + lead + out + trail + after;
    const pos = before.length + lead.length;
    apply(text, pos, pos + out.length);
  }

  function onKey(ev: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    if (ev.key === 'b') { ev.preventDefault(); wrap('**', '**', 'bold text'); }
    else if (ev.key === 'k') { ev.preventDefault(); link(); }
  }

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const tools: { label: string; title: string; run: () => void; cls?: string }[] = [
    { label: 'B', title: 'Bold (Ctrl+B)', run: () => wrap('**', '**', 'bold text'), cls: 'is-bold' },
    { label: 'Link', title: 'Link (Ctrl+K)', run: link },
    { label: 'H2', title: 'Heading', run: () => block('## ') },
    { label: 'H3', title: 'Sub-heading', run: () => block('### ') },
    { label: '• List', title: 'Bullet list', run: () => block('- ') },
    { label: 'Plain', title: 'Back to a normal paragraph', run: () => block('') },
  ];

  return (
    <div className="pe-wrap">
      <div className="pe-head">
        <div className="pe-tabs" role="tablist" aria-label="Editor mode">
          <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'is-on' : ''} onClick={() => setTab('write')}>Write</button>
          <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'is-on' : ''} onClick={() => setTab('preview')}>Preview</button>
        </div>
        {tab === 'write' && (
          <div className="pe-bar" role="toolbar" aria-label="Formatting">
            {tools.map((t) => (
              <button key={t.label} type="button" className={`pe-tool ${t.cls ?? ''}`} title={t.title} onMouseDown={(e) => e.preventDefault()} onClick={t.run}>{t.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* The textarea stays mounted (just hidden) while previewing, so the form always submits the text. */}
      <textarea
        ref={ref}
        name={name}
        className="sc-textarea pe-textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        hidden={tab !== 'write'}
        rows={22}
        maxLength={maxLength}
        spellCheck
        aria-label="Article text"
        placeholder={'Write the article here.\n\nLeave a blank line between paragraphs. Use the buttons above for headings, bold text, links and lists.'}
      />

      {tab === 'preview' && (
        <div className="pe-preview" aria-label="Preview">
          {value.trim() ? <div className="pe-preview-inner"><PostBody text={value} /></div> : <p className="pe-empty">Nothing to preview yet.</p>}
        </div>
      )}

      <div className="pe-foot">
        <span>{words.toLocaleString()} word{words === 1 ? '' : 's'}</span>
        <span className="pe-help">Blank line = new paragraph · <code>## Heading</code> · <code>### Sub-heading</code> · <code>- bullet</code> · <code>**bold**</code> · <code>[text](https://…)</code></span>
      </div>
    </div>
  );
}
