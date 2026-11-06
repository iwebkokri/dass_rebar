// Safety helpers for the Lead Manager webhook URL (no dependencies, no I/O — unit-testable).
//   * HTTPS only, no credentials in the URL, no loopback / private / link-local / internal hosts (SSRF hygiene),
//     unless LEADMANAGER_ALLOW_INSECURE=1 (a local-testing switch the site owner never needs).
//   * The URL contains a secret token in its path, so anything shown or logged is masked / redacted.

const V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function privateV4(h) {
  const m = V4.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local (cloud metadata lives here)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast / reserved / broadcast
  );
}

/** True for hosts that must never be reached from the server: loopback, private ranges, link-local, single-label and internal names. */
export function isPrivateHost(hostname) {
  let h = String(hostname || '').trim().toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (!h) return true;
  if (h.includes(':')) {
    // IPv6 literal
    if (h === '::' || h === '::1') return true;
    if (/^f[cd]/.test(h)) return true; // unique local fc00::/7
    if (/^fe[89ab]/.test(h)) return true; // link-local fe80::/10
    const mapped = /^(?:::ffff:|0:0:0:0:0:ffff:)(\d+\.\d+\.\d+\.\d+)$/.exec(h);
    if (mapped) return privateV4(mapped[1]);
    // URL() normalises ::ffff:127.0.0.1 to ::ffff:7f00:1 (and the old IPv4-compatible form ::7f00:1): decode the last 32 bits
    const hex = /^(?:::ffff:|0:0:0:0:0:ffff:|::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
    if (hex) {
      const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
      return privateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return false;
  }
  if (V4.test(h)) return privateV4(h);
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localdomain') || h.endsWith('.lan') || h.endsWith('.home.arpa')) return true;
  if (!h.includes('.')) return true; // single-label intranet names
  return false;
}

/** → { ok: true, url } (normalised) or { ok: false, error } */
export function validateWebhookUrl(raw, { allowInsecure = false } = {}) {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: false, error: 'Enter the webhook address.' };
  if (s.length > 500) return { ok: false, error: 'That address is too long.' };
  if (/[\u0000-\u001f\u007f\s<>"'\\]/.test(s)) return { ok: false, error: 'The address contains characters that are not allowed.' };
  let u;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, error: 'That is not a valid web address. It should look like https://leadmanager.example.com/api/webhooks/custom/<token>.' };
  }
  if (u.username || u.password) return { ok: false, error: 'The address must not contain a user name or password.' };
  if (u.protocol !== 'https:' && !(allowInsecure && u.protocol === 'http:')) return { ok: false, error: 'The webhook address must start with https:// — plain http is not accepted.' };
  if (!allowInsecure && isPrivateHost(u.hostname)) return { ok: false, error: 'That address points to a local or private network, which is not allowed. Use the public https:// address Lead Manager gave you.' };
  return { ok: true, url: u.toString() };
}

/** Show a webhook URL without its secret: only the scheme + host, never the path. */
export function maskUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/…/••••`;
  } catch {
    return '••••';
  }
}

export function urlHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/** Remove the URL, its path, every token-looking path segment, the query and the API key from any text before it is stored or shown. */
export function redactSecrets(text, { url = '', key = '' } = {}) {
  let out = String(text ?? '');
  const bits = new Set();
  if (url) {
    bits.add(url);
    try {
      const u = new URL(url);
      bits.add(u.href);
      if (u.pathname.length > 1) bits.add(u.pathname);
      for (const seg of u.pathname.split('/')) if (seg.length >= 6) bits.add(seg);
      if (u.search.length > 1) bits.add(u.search);
      bits.add(u.href.replace(/\/$/, ''));
    } catch {
      /* ignore */
    }
  }
  if (key && key.length >= 4) bits.add(key);
  // longest first, so a URL is replaced before the path inside it
  for (const b of [...bits].sort((a, c) => c.length - a.length)) if (b) out = out.split(b).join('••••');
  return out;
}
