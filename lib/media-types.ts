// Media library rules + shared types. Client-safe: NO node imports here (the picker and the library import this in the browser).

export type MediaKind = 'image' | 'video' | 'audio' | 'file';
/** What a picker / field is asking for. */
export type PickKind = 'image' | 'video' | 'any';

export type MediaItem = {
  id: number;
  url: string;
  storage: 'upload' | 'public';
  filename: string;
  original_name: string;
  mime: string;
  kind: MediaKind;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  title: string;
  caption: string;
  folder: string;
  user_id: number | null;
  created_at: string;
  author?: string;
  /** current user may edit alt / title / caption / folder */
  editable: boolean;
  /** current user may delete the record + file or replace the file (never for storage 'public') */
  deletable: boolean;
};

/** What `onPick` receives. */
export type PickedMedia = Pick<MediaItem, 'id' | 'url' | 'alt' | 'title' | 'kind' | 'mime' | 'width' | 'height'>;

export type MediaList = { items: MediaItem[]; total: number; page: number; pages: number; folders: string[] };

const MB = 1024 * 1024;

type TypeRule = { mime: string; kind: MediaKind; max: number; label: string };

/** The allowlist: extension -> content type, kind and size limit. (No SVG: it can carry script.) */
export const MEDIA_TYPES: Record<string, TypeRule> = {
  jpg: { mime: 'image/jpeg', kind: 'image', max: 8 * MB, label: 'JPG' },
  png: { mime: 'image/png', kind: 'image', max: 8 * MB, label: 'PNG' },
  gif: { mime: 'image/gif', kind: 'image', max: 8 * MB, label: 'GIF' },
  webp: { mime: 'image/webp', kind: 'image', max: 8 * MB, label: 'WebP' },
  avif: { mime: 'image/avif', kind: 'image', max: 8 * MB, label: 'AVIF' },
  mp4: { mime: 'video/mp4', kind: 'video', max: 50 * MB, label: 'MP4' },
  webm: { mime: 'video/webm', kind: 'video', max: 50 * MB, label: 'WebM' },
  pdf: { mime: 'application/pdf', kind: 'file', max: 20 * MB, label: 'PDF' },
  doc: { mime: 'application/msword', kind: 'file', max: 20 * MB, label: 'DOC' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'file', max: 20 * MB, label: 'DOCX' },
  xls: { mime: 'application/vnd.ms-excel', kind: 'file', max: 20 * MB, label: 'XLS' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'file', max: 20 * MB, label: 'XLSX' },
  ppt: { mime: 'application/vnd.ms-powerpoint', kind: 'file', max: 20 * MB, label: 'PPT' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'file', max: 20 * MB, label: 'PPTX' },
  csv: { mime: 'text/csv; charset=utf-8', kind: 'file', max: 20 * MB, label: 'CSV' },
  txt: { mime: 'text/plain; charset=utf-8', kind: 'file', max: 20 * MB, label: 'TXT' },
  zip: { mime: 'application/zip', kind: 'file', max: 20 * MB, label: 'ZIP' },
};

/** Lower-case extension without the dot ('jpeg' is reported as 'jpg'); '' when there is none. */
export function extOf(name: string): string {
  const clean = name.split(/[?#]/)[0];
  const base = clean.slice(clean.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
  return ext === 'jpeg' || ext === 'jpe' ? 'jpg' : ext;
}

/** Content type for serving a stored file (by extension), or undefined if we don't serve that type. */
export const mimeForExt = (ext: string): string | undefined => MEDIA_TYPES[ext]?.mime;

/** Kind of a URL / file name, judged by its extension (unknown -> 'file'). */
export function kindOfName(name: string): MediaKind {
  return MEDIA_TYPES[extOf(name)]?.kind ?? 'file';
}

/** Does this picker kind allow a file of this media kind? */
export function kindAllowed(pick: PickKind, kind: MediaKind): boolean {
  return pick === 'any' || pick === kind;
}

/** The `accept` attribute for a file input. */
export function acceptFor(pick: PickKind): string {
  const exts = Object.entries(MEDIA_TYPES).filter(([, r]) => kindAllowed(pick, r.kind)).map(([e]) => `.${e}`);
  if (pick === 'image' || pick === 'any') exts.push('.jpeg');
  return exts.join(',');
}

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < MB) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / MB).toFixed(n < 10 * MB ? 1 : 0)} MB`;
}

/** Human summary of the limits, e.g. for the upload tab. */
export function limitsText(pick: PickKind): string {
  if (pick === 'image') return 'JPG, PNG, GIF, WebP or AVIF, up to 8 MB.';
  if (pick === 'video') return 'MP4 or WebM, up to 50 MB.';
  return 'Images (JPG, PNG, GIF, WebP, AVIF) up to 8 MB · video (MP4, WebM) up to 50 MB · PDF, Word, Excel, PowerPoint, CSV, TXT, ZIP up to 20 MB.';
}

/** Client-side pre-check (the server re-checks everything, including the file's real contents). Returns an error text or ''. */
export function precheckFile(file: { name: string; size: number }, pick: PickKind = 'any'): string {
  const ext = extOf(file.name);
  const rule = MEDIA_TYPES[ext];
  if (!rule) return `"${file.name}": this file type isn't allowed.`;
  if (!kindAllowed(pick, rule.kind)) return `"${file.name}": only ${pick === 'image' ? 'image' : 'video'} files can be chosen here.`;
  if (file.size > rule.max) return `"${file.name}" is larger than ${Math.round(rule.max / MB)} MB.`;
  if (file.size <= 0) return `"${file.name}" is empty.`;
  return '';
}

export const toPicked = (m: MediaItem): PickedMedia => ({ id: m.id, url: m.url, alt: m.alt, title: m.title, kind: m.kind, mime: m.mime, width: m.width, height: m.height });
