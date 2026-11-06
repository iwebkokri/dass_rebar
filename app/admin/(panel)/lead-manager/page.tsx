import type { Metadata } from 'next';
import Link from 'next/link';
import '@/app/admin/css/email.css';
import { resendLeadForward, saveLeadManager, sendTestLeadAction } from '@/app/admin/lead-manager/actions';
import DbNotReady from '@/components/admin/DbNotReady';
import LeadForwardStatus from '@/components/admin/LeadForwardStatus';
import { requireCap } from '@/lib/auth';
import { stamp } from '@/lib/format';
import { listForwards, resumeForwardRetries } from '@/lib/leadmanager';
import { LM_TYPE_LABEL, allowInsecure, getLmConfig, type LmTypes } from '@/lib/leadmanager-settings';
import { dbReady } from '@/lib/schema-ready';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Lead Manager' };

type SP = { tab?: string; ok?: string; error?: string; status?: string; page?: string };
const TABS = [['settings', 'Settings'], ['log', 'Delivery log']] as const;
const PER_PAGE = 40;

export default async function LeadManagerPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireCap('manage_integrations');
  resumeForwardRetries();
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as string) : 'settings';
  const ready = dbReady();

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Lead Manager</h1>
          <p>Every customer enquiry is also recorded in your lead-management software, right after it is saved here.</p>
        </div>
      </div>

      {sp.ok && <div className="sc-flash sc-flash-ok" role="status">{sp.ok.slice(0, 600)}</div>}
      {sp.error && <div className="sc-flash sc-flash-err" role="alert">{sp.error.slice(0, 700)}</div>}
      {!ready && <DbNotReady what="The delivery log and the test lead" />}
      <LeadForwardStatus always />

      <nav className="sc-tabs" aria-label="Lead Manager sections">
        {TABS.map(([k, label]) => <Link key={k} href={`/admin/lead-manager?tab=${k}`} aria-current={tab === k ? 'true' : undefined}>{label}</Link>)}
      </nav>

      {tab === 'settings' && <SettingsTab ready={ready} />}
      {tab === 'log' && (ready ? <LogTab status={sp.status} page={Number(sp.page) || 1} /> : <p className="sc-muted">The delivery log appears here once the database update has finished.</p>)}
    </>
  );
}

function SettingsTab({ ready }: { ready: boolean }) {
  const cfg = getLmConfig(); // contains secrets: only host + masked values are ever rendered below
  const types = cfg.types;
  return (
    <>
      <section className="sc-card em-callout" aria-labelledby="lm-how">
        <h2 id="lm-how">How it works</h2>
        <ul className="em-points">
          <li><strong>The enquiry is saved first</strong> (Submissions), then emailed to you <em>and</em> sent to Lead Manager — the two never depend on each other, and neither can slow down or break the visitor’s form.</li>
          <li><strong>If Lead Manager is down</strong>, the lead is retried automatically (after 1 minute, 10 minutes and 1 hour) and stays in the delivery log with a <em>Resend</em> button. A lead is never created twice.</li>
          <li><strong>Customer files stay private</strong> — Lead Manager only gets a note (“2 files”) and the link to the lead in this CMS.</li>
        </ul>
      </section>

      {cfg.envUrl && (
        <div className="sc-flash sc-flash-warn" role="status">
          The address currently comes from the server’s <code>LEADMANAGER_URL</code> setting (host <strong>{cfg.host}</strong>). Saving an address below replaces it.
        </div>
      )}

      <form action={saveLeadManager} className="sc-stack em-form">
        <section className="sc-card sc-form" aria-labelledby="lm-conn">
          <h2 id="lm-conn" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Connection</h2>
          <div className="sc-field is-wide">
            <label className="sc-check"><input type="checkbox" name="enabled" value="1" defaultChecked={cfg.enabled} /> Send new enquiries to Lead Manager</label>
          </div>
          <div className="sc-field is-wide">
            <label htmlFor="lm-url">Webhook address</label>
            <input id="lm-url" name="url" className="sc-input" autoComplete="off" spellCheck={false} maxLength={600}
              placeholder={cfg.url ? `${cfg.masked}  — saved; paste a new address to replace it` : 'https://leadmanager.example.com/api/webhooks/custom/<token>'} />
            <span className="sc-help">
              The full address from Lead Manager (it ends in a secret token, so it is stored encrypted and never shown again — only the host is).
              Must start with <code>https://</code>.{allowInsecure() ? ' (Local testing switch is on: http and private addresses are allowed.)' : ''}
              {cfg.unreadable ? <strong style={{ color: 'var(--sc-danger)' }}> The saved address can’t be read on this server any more — please enter it again.</strong> : null}
            </span>
            {cfg.source === 'admin' && <label className="sc-check" style={{ marginTop: 6 }}><input type="checkbox" name="clear_url" value="1" /> Remove the saved address</label>}
          </div>
          <div className="sc-field is-wide">
            <label htmlFor="lm-key">API key (optional)</label>
            <input id="lm-key" name="key" type="password" className="sc-input" autoComplete="new-password" maxLength={400}
              placeholder={cfg.hasKey ? '•••••••••• saved — leave empty to keep it' : 'Only if Lead Manager gave you one'} />
            <span className="sc-help">Sent as <code>Authorization: Bearer …</code> only when a key is saved.{cfg.envKey ? ' (Currently from LEADMANAGER_KEY on the server.)' : ''}</span>
            {cfg.hasKey && !cfg.envKey && <label className="sc-check" style={{ marginTop: 6 }}><input type="checkbox" name="clear_key" value="1" /> Remove the saved key</label>}
          </div>
        </section>

        <section className="sc-card sc-form" aria-labelledby="lm-what">
          <h2 id="lm-what" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>What is sent</h2>
          <div className="sc-field is-wide">
            <span className="sc-label">Built-in forms</span>
            {(Object.keys(LM_TYPE_LABEL) as Array<keyof LmTypes>).map((k) => (
              <label key={k} className="sc-check"><input type="checkbox" name={`t_${k}`} value="1" defaultChecked={types[k]} /> {LM_TYPE_LABEL[k]}{k === 'newsletter' ? ' — subscriptions, not enquiries (off by default)' : ''}</label>
            ))}
            <span className="sc-help">Forms you built under <Link className="sc-rowlink" href="/admin/forms">Forms</Link> (also inside popups) have their own “Send to Lead Manager” switch.</span>
          </div>
          <div className="sc-field is-wide">
            <label className="sc-check"><input type="checkbox" name="skip_staff" value="1" defaultChecked={cfg.skipStaff} /> Skip submissions made by signed-in staff</label>
            <span className="sc-help">So the team testing the forms does not fill the lead list. Such submissions appear in the log as “skipped”.</span>
          </div>
        </section>

        <div className="sc-settings-save"><button className="sc-btn sc-btn-primary" type="submit">Save Lead Manager settings</button></div>
      </form>

      <section className="sc-card em-test" aria-labelledby="lm-test">
        <h2 id="lm-test">Send a test lead</h2>
        <p className="sc-muted" style={{ marginTop: 0 }}>
          Sends <strong>one real lead</strong> named “Test Person (website test)” with the form name “Admin test” to Lead Manager, using the settings currently saved, and shows
          the status and answer it gave back. You can delete it in Lead Manager afterwards.
        </p>
        <form action={sendTestLeadAction}>
          <button type="submit" className="sc-btn sc-btn-primary" disabled={!cfg.configured || !ready} title={!ready ? 'Restart the app first (database update)' : cfg.configured ? undefined : 'Save the webhook address first'}>Send test lead</button>
        </form>
      </section>
    </>
  );
}

function LogTab({ status, page }: { status?: string; page: number }) {
  const st = ['accepted', 'failed', 'skipped', 'refused'].includes(status || '') ? (status as string) : '';
  const { rows, total } = listForwards({ status: st || undefined, limit: PER_PAGE, offset: (Math.max(1, page) - 1) * PER_PAGE });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const link = (s: string, p = 1) => `/admin/lead-manager?tab=log${s ? `&status=${s}` : ''}${p > 1 ? `&page=${p}` : ''}`;
  const badge = (r: (typeof rows)[number]) =>
    r.status === 'accepted' ? <span className="sc-badge sc-badge-ok">accepted</span>
    : r.status === 'skipped' ? <span className="sc-badge" title={r.reason}>skipped</span>
    : r.status === 'refused' ? <span className="sc-badge sc-badge-new" title={r.error}>refused</span>
    : r.status === 'queued' ? <span className="sc-badge">sending…</span>
    : r.next_attempt_at ? <span className="sc-badge sc-badge-warn" title={r.error}>retrying {stamp(r.next_attempt_at)}</span>
    : <span className="sc-badge sc-badge-new" title={r.error}>failed</span>;

  return (
    <>
      <nav className="sc-tabs" aria-label="Filter by status">
        {([['', 'All'], ['accepted', 'Accepted'], ['failed', 'Failed'], ['refused', 'Refused'], ['skipped', 'Skipped']] as const).map(([k, label]) => <Link key={k} href={link(k)} aria-current={st === k ? 'true' : undefined}>{label}</Link>)}
      </nav>
      <div className="sc-tablewrap">
        {rows.length === 0 ? (
          <div className="sc-empty">Nothing here yet. Every enquiry — sent, skipped or failed — is listed with Lead Manager’s answer.</div>
        ) : (
          <table className="sc-table em-log">
            <thead><tr><th>When</th><th>Lead</th><th>Form</th><th>Result</th><th>HTTP</th><th>Answer</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="sc-muted" style={{ whiteSpace: 'nowrap' }}>{stamp(r.created_at)}</td>
                  <td>{r.submission_id ? <Link className="sc-rowlink" href={`/admin/submissions/${r.submission_id}`}>{r.name || `#${r.submission_id}`}</Link> : <span className="sc-muted">test lead</span>}</td>
                  <td className="sc-muted">{r.form_name || '—'}</td>
                  <td>{badge(r)}{r.attempts > 1 || r.status === 'failed' ? <span className="sc-faint"> · {r.attempts} attempt{r.attempts === 1 ? '' : 's'}</span> : null}</td>
                  <td>{r.http_status ?? '—'}</td>
                  <td>
                    {r.status === 'skipped' ? <span className="sc-muted">{r.reason}</span> : null}
                    {r.status !== 'skipped' && r.response ? <div className="em-resp" title={r.response}>{r.response}</div> : null}
                    {(r.status === 'failed' || r.status === 'refused') && r.error ? <div className="em-err">{r.error}</div> : null}
                  </td>
                  <td className="sc-num">
                    {r.kind === 'lead' && (
                      <form action={resendLeadForward}>
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={st} />
                        <button className="sc-btn sc-btn-sm" type="submit" title={r.status === 'accepted' ? 'Already accepted — sending again is safe: Lead Manager does not create a second lead' : undefined}>Resend</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pages > 1 && (
        <div className="sc-pager" style={{ marginTop: 14 }}>
          {page > 1 && <Link className="sc-btn sc-btn-sm" href={link(st, page - 1)}>← Newer</Link>}
          <span className="sc-muted"> Page {page} of {pages} </span>
          {page < pages && <Link className="sc-btn sc-btn-sm" href={link(st, page + 1)}>Older →</Link>}
        </div>
      )}
    </>
  );
}
