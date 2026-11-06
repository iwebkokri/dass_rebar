'use client';

// Email → Settings: provider preset, SMTP login, sender, owner notification addresses, subject, links + time zone.
// The password is never sent to the browser: leave it empty to keep the saved one.
import { useState } from 'react';
import { saveMailSettings } from '@/app/admin/email/actions';
import { MAIL_PRESETS, SECURITY_LABEL, presetById, type MailSecurity } from '@/lib/mail-presets';

export type MailFormInit = {
  preset: string; host: string; port: string; security: MailSecurity; user: string; hasPassword: boolean; passwordUnreadable: boolean;
  fromName: string; fromEmail: string; notifyEmails: string; siteUrl: string; timezone: string; subject: string;
  usingEnv: boolean; envHost: string; defaultSubject: string; defaultTimezone: string; siteName: string; envSiteUrl: string;
};

export default function MailSettingsForm({ init }: { init: MailFormInit }) {
  const [preset, setPreset] = useState(init.preset || 'custom');
  const [host, setHost] = useState(init.host);
  const [port, setPort] = useState(init.port);
  const [security, setSecurity] = useState<MailSecurity>(init.security);
  const [user, setUser] = useState(init.user);
  const note = presetById(preset)?.note;

  const pick = (id: string) => {
    setPreset(id);
    const p = presetById(id);
    if (!p || id === 'custom') return;
    setHost(p.host);
    setPort(String(p.port));
    setSecurity(p.security);
    if (p.user) setUser(p.user);
  };

  return (
    <form action={saveMailSettings} className="sc-stack em-form">
      <input type="hidden" name="preset" value={preset} />

      <section className="sc-card em-callout" aria-labelledby="em-reply">
        <h2 id="em-reply">How lead emails work</h2>
        <ul className="em-points">
          <li><strong>Replies go to the customer.</strong> The email’s <em>Reply-To</em> is the customer’s own address, so pressing Reply — for you or anyone on the team — writes straight to them.</li>
          <li><strong>The From address stays on your own domain</strong> (shown as “Customer name via {init.siteName}”), so the mail is delivered and passes SPF / DKIM / DMARC. A customer’s address in From would be rejected or sent to spam.</li>
          <li>Leads are always saved under <strong>Submissions</strong>, even if an email can’t be sent.</li>
        </ul>
      </section>

      {init.usingEnv && (
        <div className="sc-flash sc-flash-warn" role="status">
          Right now mail is sent with the server’s environment variables (<code>SMTP_HOST={init.envHost}</code>). Fill in the mail server below to manage it here instead — the environment values are then ignored.
        </div>
      )}

      <section className="sc-card sc-form" aria-labelledby="em-server">
        <h2 id="em-server" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Mail server (SMTP)</h2>
        <div className="sc-field">
          <label htmlFor="em-preset">Provider</label>
          <select id="em-preset" className="sc-select" value={preset} onChange={(e) => pick(e.target.value)}>
            {MAIL_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        {note ? <p className="sc-help em-note is-wide">{note}</p> : null}
        <div className="sc-field">
          <label htmlFor="em-host">Server (host)</label>
          <input id="em-host" name="host" className="sc-input" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" maxLength={253} autoComplete="off" spellCheck={false} />
        </div>
        <div className="sc-field">
          <label htmlFor="em-port">Port</label>
          <input id="em-port" name="port" className="sc-input" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="465" />
        </div>
        <div className="sc-field">
          <label htmlFor="em-sec">Security</label>
          <select id="em-sec" name="security" className="sc-select" value={security} onChange={(e) => setSecurity(e.target.value as MailSecurity)}>
            {(Object.keys(SECURITY_LABEL) as MailSecurity[]).map((k) => <option key={k} value={k}>{SECURITY_LABEL[k]}</option>)}
          </select>
        </div>
        <div className="sc-field">
          <label htmlFor="em-user">Username</label>
          <input id="em-user" name="user" className="sc-input" value={user} onChange={(e) => setUser(e.target.value)} placeholder="leads@yourdomain.com" maxLength={254} autoComplete="off" spellCheck={false} />
        </div>
        <div className="sc-field is-wide">
          <label htmlFor="em-pass">Password</label>
          <input id="em-pass" name="password" type="password" className="sc-input" autoComplete="new-password" maxLength={500}
            placeholder={init.hasPassword ? '•••••••••• saved — leave empty to keep it' : 'Mailbox password / app password / API key'} />
          <span className="sc-help">
            Stored encrypted on the server (AES-256) and never shown again.
            {init.passwordUnreadable ? <strong style={{ color: 'var(--sc-danger)' }}> The saved password can’t be read on this server any more — please enter it again.</strong> : null}
          </span>
          {init.hasPassword && (
            <label className="sc-check" style={{ marginTop: 6 }}><input type="checkbox" name="clear_password" value="1" /> Remove the saved password</label>
          )}
        </div>
      </section>

      <section className="sc-card sc-form" aria-labelledby="em-sender">
        <h2 id="em-sender" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Sender and recipients</h2>
        <div className="sc-field">
          <label htmlFor="em-fname">From name</label>
          <input id="em-fname" name="from_name" className="sc-input" defaultValue={init.fromName} maxLength={60} placeholder={init.siteName} />
          <span className="sc-help">Used for the customer auto-reply and system notices. Lead emails show “Customer name via {init.siteName}”.</span>
        </div>
        <div className="sc-field">
          <label htmlFor="em-from">From address</label>
          <input id="em-from" name="from_email" type="email" className="sc-input" defaultValue={init.fromEmail} maxLength={254} placeholder="leads@yourdomain.com" />
          <span className="sc-help">Use an address on your own domain, ideally the mailbox you log in with. Empty = the username.</span>
        </div>
        <div className="sc-field is-wide">
          <label htmlFor="em-to">Send every new lead to</label>
          <textarea id="em-to" name="notify_emails" className="sc-textarea" rows={2} defaultValue={init.notifyEmails} maxLength={1000} placeholder="sales@dassrebar.com, estimating@dassrebar.com" />
          <span className="sc-help">One or more addresses, separated by commas. A form can override this in Forms → settings. Up to 10.</span>
        </div>
        <div className="sc-field is-wide">
          <label htmlFor="em-subj">Subject line</label>
          <input id="em-subj" name="subject" className="sc-input" defaultValue={init.subject} maxLength={200} placeholder={init.defaultSubject} />
          <span className="sc-help">Merge tags: <code>{'{form}'}</code> <code>{'{name}'}</code> <code>{'{email}'}</code> <code>{'{phone}'}</code> <code>{'{company}'}</code> <code>{'{type}'}</code> <code>{'{site}'}</code> <code>{'{id}'}</code>. Empty = “{init.defaultSubject}”.</span>
        </div>
      </section>

      <section className="sc-card sc-form" aria-labelledby="em-links">
        <h2 id="em-links" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Links and time</h2>
        <div className="sc-field">
          <label htmlFor="em-url">Public site address</label>
          <input id="em-url" name="site_url" className="sc-input" defaultValue={init.siteUrl} maxLength={300} placeholder={init.envSiteUrl || 'https://www.yourdomain.com'} />
          <span className="sc-help">Used for the “View in the CMS” and logo links inside emails. Empty = the SITE_URL environment variable{init.envSiteUrl ? ` (${init.envSiteUrl})` : ''}. Set it so links can’t depend on the visitor’s request.</span>
        </div>
        <div className="sc-field">
          <label htmlFor="em-tz">Time zone</label>
          <input id="em-tz" name="timezone" className="sc-input" defaultValue={init.timezone} maxLength={60} placeholder={init.defaultTimezone} />
          <span className="sc-help">Shown next to the “Received” time. Default {init.defaultTimezone}.</span>
        </div>
      </section>

      <div className="sc-settings-save"><button className="sc-btn sc-btn-primary" type="submit">Save email settings</button></div>
    </form>
  );
}
