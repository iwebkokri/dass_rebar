// URL checks that are safe to run anywhere (browser, public renderer, server). No dependencies.

/** href: http(s), mailto, tel, root-relative paths, ?query and #anchors only. */
export function safeUrl(v) {
  if (typeof v !== 'string') return '';
  const u = v.trim();
  if (!u || u.length > 2000 || /[\u0000-\u001f\u007f<>"'\\]/.test(u)) return '';
  if (/^(\/(?!\/)|#|\?)/.test(u)) return u;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  return '';
}

/** Media src: no mailto / tel / #. */
export function safeMediaUrl(v) {
  const u = safeUrl(v);
  return /^(\/(?!\/)|https?:\/\/)/i.test(u) ? u : '';
}

export const isInternal = (u) => /^\/(?!\/)/.test(u);
