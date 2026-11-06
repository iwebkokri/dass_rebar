import type { FieldDef } from '@/lib/admin/resources';
import { parseImages } from '@/lib/content';
import MediaField from './MediaField';
import MediaGalleryField from './MediaGalleryField';

/** One form control for a field definition (server component — values are plain props, no client JS). */
export default function Field({ def, value }: { def: FieldDef; value: unknown }) {
  const id = `f-${def.name}`;
  const v = value ?? def.default ?? '';
  const cls = `sc-field${def.wide ? ' is-wide' : ''}`;
  const label = (
    <label htmlFor={id}>
      {def.label}
      {def.required && <span className="sc-req"> *</span>}
    </label>
  );
  const help = def.help ? <span className="sc-help">{def.help}</span> : null;

  switch (def.type) {
    case 'checkbox':
      return (
        <div className={cls}>
          <label className="sc-check">
            <input type="checkbox" id={id} name={def.name} defaultChecked={Number(v) === 1} /> {def.label}
          </label>
          {help}
        </div>
      );

    case 'textarea':
      return (
        <div className={cls}>
          {label}
          <textarea className="sc-textarea" id={id} name={def.name} defaultValue={String(v)} rows={def.rows ?? 4} maxLength={def.maxLength} placeholder={def.placeholder} />
          {help}
        </div>
      );

    case 'select':
      return (
        <div className={cls}>
          {label}
          <select className="sc-select" id={id} name={def.name} defaultValue={String(v)}>
            {def.options?.map(([val, text]) => (<option key={val} value={val}>{text}</option>))}
          </select>
          {help}
        </div>
      );

    case 'image': {
      const current = String(value ?? '');
      // Pick from the media library (hidden `<name>__pick`) or upload directly (`<name>__file`, also registered in the library).
      return (
        <div className={cls}>
          <MediaField name={`${def.name}__pick`} defaultValue={current} kind="image" label={def.label} />
          <label className="sc-help" htmlFor={id}>…or upload from your computer</label>
          <input className="sc-input" id={id} type="file" name={`${def.name}__file`} accept="image/jpeg,image/png,image/webp,image/gif,image/avif" />
          <span className="sc-help">JPG, PNG, WebP, GIF or AVIF, up to 8 MB.{def.help ? ` ${def.help}` : ''}</span>
        </div>
      );
    }

    case 'gallery': {
      const images = parseImages(String(value ?? '[]'));
      return (
        <div className={cls}>
          <MediaGalleryField name={def.name} defaultValue={images} label={def.label} help={def.help} />
        </div>
      );
    }

    default:
      return (
        <div className={cls}>
          {label}
          <input className="sc-input" id={id} type={def.type} name={def.name} defaultValue={String(v)} required={def.required} maxLength={def.maxLength} placeholder={def.placeholder} />
          {help}
        </div>
      );
  }
}
