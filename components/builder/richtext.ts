// Client-side tidy-up of contentEditable output (the server sanitises again on save — this just keeps the stored HTML clean).
const KEEP = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'S', 'A', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'CODE']);
const RENAME: Record<string, string> = { B: 'STRONG', I: 'EM', DIV: 'P' };

export function cleanRichHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out = document.createElement('div');
  const copy = (from: Node, to: Node) => {
    from.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) { to.appendChild(document.createTextNode(child.textContent || '')); return; }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = RENAME[el.tagName] || el.tagName;
      if (!KEEP.has(tag)) { copy(el, to); return; } // unknown wrapper (span, font…): keep the content
      const next = document.createElement(tag);
      if (tag === 'A') {
        const href = el.getAttribute('href') || '';
        if (/^(https?:|mailto:|tel:|\/|#)/i.test(href)) next.setAttribute('href', href);
        if (el.getAttribute('target') === '_blank') next.setAttribute('target', '_blank');
      }
      copy(el, next);
      to.appendChild(next);
    });
  };
  copy(doc.body, out);
  // a bare text node at the top level becomes a paragraph
  if (out.firstChild && out.firstChild.nodeType === Node.TEXT_NODE) {
    const p = document.createElement('p');
    while (out.firstChild && (out.firstChild.nodeType === Node.TEXT_NODE || (out.firstChild as HTMLElement).tagName === 'A' || (out.firstChild as HTMLElement).tagName === 'STRONG' || (out.firstChild as HTMLElement).tagName === 'EM')) p.appendChild(out.firstChild);
    out.insertBefore(p, out.firstChild);
  }
  return out.innerHTML.replace(/<p><\/p>/g, '').trim();
}
