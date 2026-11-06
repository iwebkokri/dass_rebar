import { Fragment, type ReactNode } from 'react';

// Tiny, safe renderer for article text written in the Studio CMS. It never outputs raw HTML:
//   blank line  = new paragraph        ## Heading / ### Sub-heading
//   - item      = bullet list           **bold**   [link text](https://example.com)

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) return <a key={i} href={link[2]} style={{ color: '#7F5F47', fontWeight: 600 }}>{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function PostBody({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const h2 = { margin: '40px 0 0', fontFamily: 'var(--font-manrope), sans-serif', fontSize: '30px', lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.02em' } as const;
  const h3 = { margin: '28px 0 0', fontFamily: 'var(--font-manrope), sans-serif', fontSize: '22px', lineHeight: 1.2, fontWeight: 800 } as const;
  const p = { margin: '18px 0 0', fontSize: '18px', lineHeight: 1.7, color: '#2B3A55' } as const;

  return (
    <>
      {blocks.map((block, i) => {
        if (block.startsWith('### ')) return <h3 key={i} style={h3}>{inline(block.slice(4))}</h3>;
        if (block.startsWith('## ')) return <h2 key={i} style={h2}>{inline(block.slice(3))}</h2>;
        const lines = block.split('\n');
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i} style={{ ...p, paddingLeft: '24px' }}>
              {lines.map((l, j) => (<li key={j} style={{ margin: '6px 0' }}>{inline(l.slice(2))}</li>))}
            </ul>
          );
        }
        return <p key={i} style={p}>{lines.map((l, j) => (<Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>))}</p>;
      })}
    </>
  );
}
