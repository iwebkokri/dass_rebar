// Brand colour list helpers (pure — safe to import from client components).
export type PaletteEntry = [string, string];
export const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Parse + validate a palette JSON string; returns null when it isn't a usable list. */
export function parsePalette(raw: string): PaletteEntry[] | null {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    const out: PaletteEntry[] = [];
    for (const e of v.slice(0, 48)) {
      if (!Array.isArray(e) || typeof e[0] !== 'string' || !HEX.test(e[0].trim())) continue;
      out.push([e[0].trim(), String(e[1] ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40)]);
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}
