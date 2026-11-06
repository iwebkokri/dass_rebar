import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ConfirmButton from '@/components/admin/ConfirmButton';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { requireCap } from '@/lib/auth';
import { get, run } from '@/lib/db';
import { stamp } from '@/lib/format';
import { customFormLabels, isCustomType, typeLabel } from '@/lib/submissions';
import { deleteSubmission, updateSubmission } from '../../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Submission' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<FlashParams> };

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function SubmissionDetail({ params, searchParams }: Props) {
  await requireCap('view_submissions');
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const s = get<any>('SELECT * FROM submissions WHERE id = ?', Number(id));
  if (!s) notFound();

  // Opening a new submission marks it as read.
  if (s.status === 'new') {
    run("UPDATE submissions SET status = 'read' WHERE id = ?", s.id);
    s.status = 'read';
  }

  const data = JSON.parse(s.data || '{}');
  const files: Array<{ name: string; file: string; size: number; field?: string }> = JSON.parse(s.attachments || '[]');
  const custom = isCustomType(s.type);
  const label = typeLabel(s.type, custom ? customFormLabels() : {});
  const show = (v: unknown) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? v.join(', ') : v && typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''));
  const reply = s.email ? `mailto:${s.email}?subject=${encodeURIComponent('Re: your Dass Rebar ' + label + ' request')}` : '';

  return (
    <>
      <div className="sc-head">
        <div>
          <p style={{ margin: 0 }}><Link href="/admin/submissions" className="sc-muted">← Submissions</Link></p>
          <h1>{s.name || s.email || `Submission #${s.id}`}</h1>
          <p>{stamp(s.created_at)} · <span className="sc-badge">{label}</span></p>
        </div>
        {reply && <a className="sc-btn sc-btn-primary" href={reply}>Reply by email</a>}
      </div>

      <Flash params={await searchParams} />

      <div className="sc-stack">
        <div className="sc-card">
          <dl className="sc-dl">
            {s.name && (<><dt>Name</dt><dd>{s.name}</dd></>)}
            {s.company && (<><dt>Company</dt><dd>{s.company}</dd></>)}
            {s.email && (<><dt>Email</dt><dd><a href={`mailto:${s.email}`} className="sc-rowlink">{s.email}</a></dd></>)}
            {s.phone && (<><dt>Phone</dt><dd><a href={`tel:${s.phone}`} className="sc-rowlink">{s.phone}</a></dd></>)}
            {s.type === 'contact' && (<><dt>Newsletter</dt><dd>{data.newsletter_consent ? 'Agreed to receive newsletters' : 'No'}</dd></>)}
            {s.type === 'quote' && (
              <>
                <dt>Project location</dt><dd>{data.project_location}</dd>
                <dt>Sector</dt><dd>{data.sector || '—'}</dd>
                <dt>They need</dt><dd>{data.need || '—'}</dd>
                <dt>Existing customer</dt><dd>{data.existing_customer || '—'}</dd>
              </>
            )}
            {s.type === 'calculator' && (
              <>
                <dt>Calculation</dt><dd>{data.bars} × {data.size} bars, {data.length_m} m each</dd>
                <dt>Total weight</dt><dd>{Number(data.total_kg).toLocaleString('en-CA')} kg ({(Number(data.total_kg) / 1000).toFixed(2)} t)</dd>
              </>
            )}
            {custom && Object.entries(data).map(([k, v]) => (<span key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd><pre className="sc-pre">{show(v) || '—'}</pre></dd></span>))}
            {s.message && !custom && (<><dt>{s.type === 'quote' ? 'Notes' : 'Message'}</dt><dd><pre className="sc-pre">{s.message}</pre></dd></>)}
          </dl>
        </div>

        {s.type === 'quote' && (data.items?.length > 0 || data.other_items) && (
          <div className="sc-card">
            <h2>Materials requested</h2>
            {data.items?.length > 0 && (
              <div className="sc-tablewrap" style={{ border: 0 }}>
                <table className="sc-table">
                  <thead><tr><th>Item</th><th className="sc-num">Quantity</th></tr></thead>
                  <tbody>{data.items.map((i: any, k: number) => (<tr key={k}><td>{i.label}</td><td className="sc-num sc-strong">{i.qty}</td></tr>))}</tbody>
                </table>
              </div>
            )}
            {data.other_items && (<p style={{ margin: '14px 0 0' }}><span className="sc-muted">Other items: </span>{data.other_items}</p>)}
          </div>
        )}

        {files.length > 0 && (
          <div className="sc-card">
            <h2>Attachments</h2>
            <div className="sc-stack" style={{ gap: 8 }}>
              {files.map((f) => (
                <div key={f.file}>
                  {f.field && <span className="sc-muted">{f.field}: </span>}<a className="sc-rowlink" href={`/admin/files/${s.id}/${encodeURIComponent(f.file)}`}>{f.name}</a> <span className="sc-muted">({kb(f.size)})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form action={updateSubmission.bind(null, s.id)} className="sc-card sc-form">
          <div className="sc-field">
            <label htmlFor="status">Status</label>
            <select className="sc-select" id="status" name="status" defaultValue={s.status}>
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="sc-field is-wide">
            <label htmlFor="notes">Internal notes</label>
            <textarea className="sc-textarea" id="notes" name="notes" rows={4} defaultValue={s.notes} maxLength={5000} placeholder="Only visible in the Studio CMS" />
          </div>
          <div className="sc-form-actions">
            <button className="sc-btn sc-btn-primary" type="submit">Save</button>
          </div>
        </form>

        <form action={deleteSubmission.bind(null, s.id)}>
          <ConfirmButton className="sc-btn sc-btn-danger" message="Delete this submission and its attachments? This can't be undone.">Delete submission</ConfirmButton>
        </form>
      </div>
    </>
  );
}
