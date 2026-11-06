import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ConfirmButton from '@/components/admin/ConfirmButton';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { requireCap } from '@/lib/auth';
import { all, get, run } from '@/lib/db';
import { stamp } from '@/lib/format';
import { can } from '@/lib/roles';
import { dbReady } from '@/lib/schema-ready';
import { customFormLabels, isCustomType, typeLabel } from '@/lib/submissions';
import { deleteSubmission, updateSubmission } from '../../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Submission' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<FlashParams> };

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function SubmissionDetail({ params, searchParams }: Props) {
  const user = await requireCap('view_submissions');
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const s = get<any>('SELECT * FROM submissions WHERE id = ?', Number(id));
  if (!s) notFound();
  const ready = dbReady(); // the email / Lead Manager logs need the newer tables
  const fwd = !ready ? undefined : get<{ status: string; http_status: number | null; response: string; error: string; reason: string; attempts: number; next_attempt_at: string | null; created_at: string; sent_at: string | null }>(
    'SELECT status, http_status, response, error, reason, attempts, next_attempt_at, created_at, sent_at FROM lead_forwards WHERE submission_id = ?', s.id);
  const attr: Record<string, string> = (() => { try { return JSON.parse(s.attribution || '{}'); } catch { return {}; } })();
  const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].filter((k) => attr[k]);
  const mails = !ready ? [] : all<{ id: number; kind: string; to_addr: string; status: string; error: string; attempts: number; next_attempt_at: string | null; created_at: string; sent_at: string | null }>(
    'SELECT id, kind, to_addr, status, error, attempts, next_attempt_at, created_at, sent_at FROM mail_log WHERE submission_id = ? ORDER BY id', s.id);

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
            {(s.source_url || s.source_label) && (
              <>
                <dt>Sent from</dt>
                <dd>
                  {s.source_url ? <Link href={s.source_url} target="_blank" rel="noopener" className="sc-rowlink">{s.source_url}</Link> : null}
                  {s.source_label ? <span className="sc-badge" style={{ marginLeft: s.source_url ? 8 : 0 }}>{s.source_label}</span> : null}
                </dd>
              </>
            )}
            {(utm.length > 0 || attr.landing_url || attr.referrer) && (
              <>
                <dt>Campaign</dt>
                <dd data-section="attribution">
                  {utm.length > 0 ? utm.map((k) => <span key={k} className="sc-badge" style={{ marginRight: 6 }}>{k.replace('utm_', '')}: {attr[k]}</span>) : <span className="sc-muted">no campaign tags</span>}
                  {attr.landing_url ? <div style={{ marginTop: 6 }}><span className="sc-muted">First page: </span><a className="sc-rowlink" href={attr.landing_url} target="_blank" rel="noopener noreferrer">{attr.landing_url}</a></div> : null}
                  {attr.referrer ? <div><span className="sc-muted">Came from: </span><a className="sc-rowlink" href={attr.referrer} target="_blank" rel="noopener noreferrer">{attr.referrer}</a></div> : null}
                </dd>
              </>
            )}
          </dl>
        </div>

        {fwd && (
          <div className="sc-card" data-section="lead-manager">
            <h2>Lead Manager</h2>
            <p style={{ margin: 0 }}>
              <span className={`sc-badge ${fwd.status === 'accepted' ? 'sc-badge-ok' : fwd.status === 'skipped' ? '' : fwd.status === 'failed' && fwd.next_attempt_at ? 'sc-badge-warn' : 'sc-badge-new'}`}>{fwd.status === 'failed' && fwd.next_attempt_at ? 'retrying' : fwd.status}</span>{' '}
              {fwd.status === 'accepted' ? 'Recorded in Lead Manager' : fwd.status === 'skipped' ? fwd.reason : fwd.error || 'Waiting to be sent'}
              <span className="sc-muted"> · {stamp(fwd.sent_at || fwd.created_at)}{fwd.http_status ? ` · HTTP ${fwd.http_status}` : ''}{fwd.attempts > 1 ? ` · ${fwd.attempts} attempts` : ''}</span>
              {can(user, 'manage_integrations') ? <> · <Link className="sc-rowlink" href="/admin/lead-manager?tab=log">delivery log</Link></> : null}
            </p>
          </div>
        )}

        {ready && <div className="sc-card" data-section="email-delivery">
          <h2>Email notification</h2>
          {mails.length === 0 ? (
            <p className="sc-muted" style={{ margin: 0 }}>No email was sent for this submission{can(user, 'manage_email') ? <> — see <Link className="sc-rowlink" href="/admin/email">Email</Link>.</> : '.'}</p>
          ) : (
            <ul className="sc-stack" style={{ gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
              {mails.map((m) => (
                <li key={m.id}>
                  <span className={`sc-badge ${m.status === 'sent' ? 'sc-badge-ok' : m.status === 'failed' && !m.next_attempt_at ? 'sc-badge-new' : 'sc-badge-warn'}`}>{m.status === 'failed' && m.next_attempt_at ? 'retrying' : m.status}</span>{' '}
                  {m.kind === 'autoreply' ? 'Auto-reply to the customer' : 'Lead notification'} → {m.to_addr || '—'}{' '}
                  <span className="sc-muted">· {stamp(m.sent_at || m.created_at)}{m.attempts > 1 ? ` · ${m.attempts} attempts` : ''}</span>
                  {m.status !== 'sent' && m.error ? <div className="sc-muted" style={{ fontSize: 12 }}>{m.error}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </div>}

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
