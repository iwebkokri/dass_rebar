// Identify uploads by their CONTENT (never trust the file name or the browser's content-type) and read image sizes. No native deps.
import { MEDIA_TYPES, extOf, type MediaKind } from './media-types';

export type Sniffed = { ext: string; mime: string; kind: MediaKind; width: number | null; height: number | null };

const ascii = (b: Buffer, from: number, to: number) => b.subarray(from, to).toString('latin1');

function imageFormat(b: Buffer): 'jpg' | 'png' | 'gif' | 'webp' | 'avif' | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 24 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 10 && (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a')) return 'gif';
  if (b.length > 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp';
  if (b.length > 16 && ascii(b, 4, 8) === 'ftyp') {
    const brands = ftypBrands(b);
    if (brands.includes('avif') || brands.includes('avis')) return 'avif';
  }
  return null;
}

/** Major + compatible brands of an ISO-BMFF `ftyp` box. */
function ftypBrands(b: Buffer): string[] {
  const size = Math.min(b.readUInt32BE(0) || 16, 256, b.length);
  const out = [ascii(b, 8, 12)];
  for (let i = 16; i + 4 <= size; i += 4) out.push(ascii(b, i, i + 4));
  return out;
}

// ---- dimensions -----------------------------------------------------------
function jpegSize(b: Buffer): [number, number] | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const m = b[i + 1];
    if (m === 0xff) {
      i++; // fill byte
      continue;
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += 2; // standalone markers
      continue;
    }
    const len = b.readUInt16BE(i + 2);
    const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (isSof) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function webpSize(b: Buffer): [number, number] | null {
  const chunk = ascii(b, 12, 16);
  if (chunk === 'VP8X' && b.length >= 30) return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
    const v = b.readUInt32LE(21);
    return [(v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1];
  }
  if (chunk === 'VP8 ' && b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  return null;
}

function avifSize(b: Buffer): [number, number] | null {
  const at = b.indexOf('ispe'); // image spatial extents box: version/flags(4) width(4) height(4)
  if (at < 4 || at + 16 > b.length) return null;
  return [b.readUInt32BE(at + 8), b.readUInt32BE(at + 12)];
}

function dims(b: Buffer, fmt: string): { width: number | null; height: number | null } {
  let wh: [number, number] | null = null;
  try {
    if (fmt === 'jpg') wh = jpegSize(b);
    else if (fmt === 'png') wh = [b.readUInt32BE(16), b.readUInt32BE(20)];
    else if (fmt === 'gif') wh = [b.readUInt16LE(6), b.readUInt16LE(8)];
    else if (fmt === 'webp') wh = webpSize(b);
    else if (fmt === 'avif') wh = avifSize(b);
  } catch {
    wh = null;
  }
  if (!wh || wh[0] < 1 || wh[1] < 1 || wh[0] > 65535 || wh[1] > 65535) return { width: null, height: null };
  return { width: wh[0], height: wh[1] };
}

// ---- documents ------------------------------------------------------------
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function looksLikeText(b: Buffer): boolean {
  const n = Math.min(b.length, 16 * 1024);
  for (let i = 0; i < n; i++) {
    const c = b[i];
    if (c === 0 || (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d && c !== 0x0c)) return false;
  }
  return true;
}

/**
 * Verify an upload against the allowlist by its real bytes. Images are identified by content alone (the stored extension follows the content);
 * everything else must also carry a matching extension. Returns null when the file is not allowed.
 */
export function sniffUpload(b: Buffer, originalName: string): Sniffed | null {
  const img = imageFormat(b);
  if (img) return { ext: img, mime: MEDIA_TYPES[img].mime, kind: 'image', ...dims(b, img) };

  const ext = extOf(originalName);
  const rule = MEDIA_TYPES[ext];
  if (!rule || rule.kind === 'image') return null;
  const ok = (fine: boolean): Sniffed | null => (fine ? { ext, mime: rule.mime, kind: rule.kind, width: null, height: null } : null);

  switch (ext) {
    case 'mp4': {
      if (b.length < 16 || ascii(b, 4, 8) !== 'ftyp') return null;
      const brands = ftypBrands(b);
      return ok(!brands.some((x) => ['avif', 'avis', 'heic', 'heix', 'mif1', 'msf1'].includes(x)));
    }
    case 'webm':
      return ok(b.length > 32 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 && b.subarray(0, 64).includes('webm'));
    case 'pdf':
      return ok(b.subarray(0, 1024).includes('%PDF-'));
    case 'doc':
    case 'xls':
    case 'ppt':
      return ok(b.length > 512 && b.subarray(0, 8).equals(OLE2));
    case 'docx':
    case 'xlsx':
    case 'pptx':
    case 'zip':
      return ok(b.length > 22 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04);
    case 'csv':
    case 'txt':
      return ok(b.length > 0 && looksLikeText(b));
    default:
      return null;
  }
}
