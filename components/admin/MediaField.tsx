'use client';

// Form field that stores a media URL: <MediaField name="og_image" defaultValue={url} kind="image" label="Social image" />
// Renders a hidden <input name> (the URL, '' when empty), a preview and Choose / Remove buttons that open the MediaPicker.
import '@/app/admin/css/media.css';
import { useId, useState } from 'react';
import MediaPicker from './MediaPicker';
import { MEDIA_TYPES, extOf, kindOfName, type PickKind, type PickedMedia } from '@/lib/media-types';

type Props = {
  name: string;
  defaultValue?: string | null;
  kind?: PickKind;
  label?: string;
  help?: string;
  required?: boolean;
  /** Called after Choose / Remove (media is null on Remove, or when the URL was cleared). */
  onChange?: (url: string, media: PickedMedia | null) => void;
  className?: string;
};

export default function MediaField({ name, defaultValue = '', kind = 'image', label, help, required, onChange, className = '' }: Props) {
  const [url, setUrl] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const uid = useId();
  const nounLabel = kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'file';
  const fileKind = url ? kindOfName(url) : kind === 'any' ? 'file' : kind;
  const fname = url ? decodeURIComponentSafe(url.split('?')[0].split('/').pop() ?? '') : '';

  function pick(m: PickedMedia) {
    setUrl(m.url);
    setOpen(false);
    onChange?.(m.url, m);
  }

  return (
    <div className={`mp-field ${className}`.trim()}>
      {label && (
        <span className="mp-field-label" id={`${uid}-l`}>
          {label}
          {required && <span className="mp-req"> *</span>}
        </span>
      )}
      <input type="hidden" name={name} value={url} />
      <div className="mp-field-box" role="group" aria-labelledby={label ? `${uid}-l` : undefined}>
        <div className="mp-field-preview">
          {url && fileKind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" />
          ) : url && fileKind === 'video' ? (
            <video src={url} muted preload="metadata" />
          ) : url ? (
            <span className="mp-field-file">{MEDIA_TYPES[extOf(url)]?.label ?? 'FILE'}</span>
          ) : (
            <span className="mp-field-none">No {nounLabel}<br />selected</span>
          )}
        </div>
        <div className="mp-field-side">
          {url && <span className="mp-field-name" title={url}>{fname}</span>}
          <div className="mp-field-btns">
            <button type="button" className="mp-btn mp-btn-sm" onClick={() => setOpen(true)}>{url ? 'Change' : `Choose ${nounLabel}`}</button>
            {url && (
              <button
                type="button"
                className="mp-btn mp-btn-sm mp-btn-danger"
                onClick={() => {
                  setUrl('');
                  onChange?.('', null);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      {help && <span className="mp-field-help">{help}</span>}
      <MediaPicker open={open} kind={kind} onPick={pick} onClose={() => setOpen(false)} />
    </div>
  );
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
