import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import '@/app/admin/css/email.css';
import { resendLog, saveMailDesign, sendTest } from '@/app/admin/email/actions';
import MailPreview from '@/components/admin/MailPreview';
import MailSettingsForm from '@/components/admin/MailSettingsForm';
import DbNotReady from '@/components/admin/DbNotReady';
import MailStatus from '@/components/admin/MailStatus';
import MediaField from '@/components/admin/MediaField';
import { requireCap } from '@/lib/auth';
import { renderAutoReply, renderOwnerEmail, sampleAutoReply, sampleLead } from '@/lib/email-template';
import { stamp } from '@/lib/format';
import { DEFAULT_SUBJECT, DEFAULT_TZ, getMailConfig, getMailStored, getTemplateSettings } from '@/lib/mail-settings';
import { buildSiteView, listMailLog, resumeRetries } from '@/lib/mailer';
import { dbReady } from '@/lib/schema-ready';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Email' };

type SP = { tab?: string; ok?: string; error?: string; status?: string; page?: string };
const TABS = [['settings', 'Settings'], ['design', 'Design & preview'], ['log', 'Email log']] as const;
const PER_PAGE = 40;

export default async function EmailPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireCap('manage_email');
  resumeRetries();
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as string) : 'settings';
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  const origin = host ? `${h.get('x-forwarded-proto') || (/^(localhost|127\.)/.test(host) ? 'http' : 'https')}://${host}` : '';

  const stored = getMailStored();
  const cfg = getMailConfig();
  const ready = dbReady();

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Email</h1>
          <p>Where new leads are emailed, how those emails look, and a log of everything that was sent.</p>
        </div>
      </div>

      {sp.ok && <div className="sc-flash sc-flash-ok" role="status">{sp.ok.slice(0, 600)}</div>}
      {sp.error && <div className="sc-flash sc-flash-err" role="alert">{sp.error.slice(0, 700)}</div>}
      {!ready && <DbNotReady what="The email log and test emails" />}
      <MailStatus canManage always />

      <nav className="sc-tabs" aria-label="Email sections">
        {TABS.map(([k, label]) => <Link key={k} href={`/admin/email?tab=${k}`} aria-current={tab === k ? 'true' : undefined}>{label}</Link>)}
      </nav>

      {tab === 'settings' && (
        <>
          <MailSettingsForm
            init={{
              preset: stored.preset, host: stored.host, port: stored.port, security: stored.security, user: stored.user,
              hasPassword: stored.hasPassword, passwordUnreadable: stored.passwordUnreadable, fromName: stored.fromName, fromEmail: stored.fromEmail,
              notifyEmails: stored.notifyEmails, siteUrl: stored.siteUrl, timezone: stored.timezone, subject: stored.subject,
              usingEnv: cfg.source === 'env', envHost: process.env.SMTP_HOST || '', defaultSubject: DEFAULT_SUBJECT, defaultTimezone: DEFAULT_TZ,
              siteName: cfg.siteName, envSiteUrl: process.env.SITE_URL || '',
            }}
          />

          <section className="sc-card em-test" aria-labelledby="em-test">
            <h2 id="em-test">Send a test email</h2>
            <p className="sc-muted" style={{ marginTop: 0 }}>Sends the designed email with sample lead data using the settings <strong>currently saved</strong>. If something is wrong you will see the exact error from the mail server.</p>
            <form action={sendTest} className="em-testform">
              <div className="sc-field" style={{ flex: '2 1 280px' }}>
                <label htmlFor="em-testto">Send to</label>
                <input id="em-testto" name="to" className="sc-input" placeholder={cfg.to.join(', ') || 'you@example.com'} maxLength={500} />
                <span className="sc-help">Empty = the lead notification address{cfg.to.length === 1 ? '' : 'es'} above.</span>
              </div>
              <div className="sc-field" style={{ flex: '1 1 200px' }}>
                <label htmlFor="em-testkind">Which email</label>
                <select id="em-testkind" name="kind" className="sc-select" defaultValue="owner">
                  <option value="owner">Owner notification</option>
                  <option value="autoreply">Customer auto-reply</option>
                </select>
              </div>
              <button type="submit" className="sc-btn sc-btn-primary" disabled={!cfg.sendable || !ready} title={!ready ? 'Restart the app first (database update)' : cfg.sendable ? undefined : 'Save a mail server and From address first'}>Send test email</button>
            </form>
          </section>
        </>
      )}

      {tab === 'design' && <DesignTab origin={origin} />}
      {tab === 'log' && (ready ? <LogTab status={sp.status} page={Number(sp.page) || 1} /> : <p className="sc-muted">The log appears here once the database update has finished.</p>)}
    </>
  );
}

function DesignTab({ origin }: { origin: string }) {
  const cfg = getMailConfig();
  const site = buildSiteView(cfg, origin);
  const tpl = getTemplateSettings();
  const stored = getMailStored();
  const owner = renderOwnerEmail(site, sampleLead(site)).html;
  const auto = renderAutoReply(site, sampleAutoReply(site, tpl.autoReplyIntro)).html;

  return (
    <div className="em-design">
      <form action={saveMailDesign} className="sc-card sc-form em-designform" aria-labelledby="em-design">
        <h2 id="em-design" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Design</h2>
        <div className="sc-field is-wide"><MediaField name="logo" defaultValue={stored.logo} kind="image" label="Logo in the email header" help="Use a light / white logo — it sits on the navy header band. Empty = the default white Dass Rebar logo." /></div>
        <div className="sc-field">
          <label htmlFor="em-accent">Button / accent colour</label>
          <input id="em-accent" name="accent" type="color" className="em-color" defaultValue={tpl.accent} />
          <span className="sc-help">Default brand brown #7F5F47.</span>
        </div>
        <div className="sc-field is-wide">
          <label htmlFor="em-footer">Footer text (optional)</label>
          <textarea id="em-footer" name="footer" className="sc-textarea" rows={2} defaultValue={stored.footer} maxLength={300} placeholder="e.g. MTO Designated Source for Materials · Mon–Fri 7:00–16:00" />
          <span className="sc-help">Shown under the business name, address and phone from Settings → Contact details.</span>
        </div>
        <div className="sc-field is-wide">
          <label htmlFor="em-intro">Customer auto-reply — message</label>
          <textarea id="em-intro" name="auto_reply_intro" className="sc-textarea" rows={4} defaultValue={stored.autoReplyIntro || tpl.autoReplyIntro} maxLength={600} />
          <span className="sc-help">Used by every form that has the auto-reply switched on (a form can write its own text). Merge tags: <code>{'{{name}}'}</code> <code>{'{{first_name}}'}</code> <code>{'{{form}}'}</code> <code>{'{{site}}'}</code>.</span>
        </div>
        <div className="is-wide"><button className="sc-btn sc-btn-primary" type="submit">Save design</button></div>
      </form>
      <div className="em-previewcol">
        <h2 style={{ margin: '0 0 10px' }}>Preview <span className="sc-faint" style={{ fontSize: 13, fontWeight: 400 }}>(sample data — save to see changes)</span></h2>
        <MailPreview owner={owner} autoReply={auto} />
      </div>
    </div>
  );
}

function LogTab({ status, page }: { status?: string; page: number }) {
  const st = status === 'sent' || status === 'failed' || status === 'queued' ? status : '';
  const { rows, total } = listMailLog({ status: st || undefined, limit: PER_PAGE, offset: (Math.max(1, page) - 1) * PER_PAGE });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const link = (s: string, p = 1) => `/admin/email?tab=log${s ? `&status=${s}` : ''}${p > 1 ? `&page=${p}` : ''}`;
  const KIND: Record<string, string> = { owner: 'Lead → owner', autoreply: 'Auto-reply', test: 'Test' };

  return (
    <>
      <nav className="sc-tabs" aria-label="Filter by status">
        {([['', 'All'], ['sent', 'Sent'], ['failed', 'Failed'], ['queued', 'Sending']] as const).map(([k, label]) => <Link key={k} href={link(k)} aria-current={st === k ? 'true' : undefined}>{label}</Link>)}
      </nav>
      <div className="sc-tablewrap">
        {rows.length === 0 ? (
          <div className="sc-empty">Nothing here yet. Every lead email — and every test — is listed with its result.</div>
        ) : (
          <table className="sc-table em-log">
            <thead><tr><th>When</th><th>Email</th><th>To</th><th>Subject</th><th>Result</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="sc-muted" style={{ whiteSpace: 'nowrap' }}>{stamp(r.created_at)}</td>
                  <td>{KIND[r.kind] || r.kind}{r.submission_id ? <> <Link className="sc-rowlink" href={`/admin/submissions/${r.submission_id}`}>#{r.submission_id}</Link></> : null}</td>
                  <td className="sc-muted">{r.to_addr || '—'}</td>
                  <td>{r.subject}</td>
                  <td>
                    {r.status === 'sent' ? <span className="sc-badge sc-badge-ok">sent</span>
                      : r.status === 'queued' ? <span className="sc-badge">sending…</span>
                      : r.next_attempt_at ? <span className="sc-badge sc-badge-warn" title={r.error}>retrying {stamp(r.next_attempt_at)}</span>
                      : <span className="sc-badge sc-badge-new" title={r.error}>failed</span>}
                    {r.attempts > 1 || r.status === 'failed' ? <span className="sc-faint"> · {r.attempts} attempt{r.attempts === 1 ? '' : 's'}</span> : null}
                    {r.status === 'failed' && r.error ? <div className="em-err">{r.error}</div> : null}
                  </td>
                  <td className="sc-num">
                    {r.status !== 'sent' && (
                      <form action={resendLog}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={st} /><button className="sc-btn sc-btn-sm" type="submit">Resend</button></form>
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
