// Banner about lead emails: "Leads are saved but no email is sent" when mail isn't set up, and a warning when recent emails failed.
// Used on the dashboard (problems only) and on the Email page (also shows the healthy state).
import Link from 'next/link';
import { mailStatus } from '@/lib/mailer';

export default function MailStatus({ canManage, always = false }: { canManage: boolean; always?: boolean }) {
  let s: ReturnType<typeof mailStatus>;
  try {
    s = mailStatus();
  } catch {
    return null; // database not ready: never break the page that shows this
  }

  const fix = canManage ? <Link className="sc-rowlink" href="/admin/email">Set up email →</Link> : <span className="sc-muted">Ask an administrator to set up email.</span>;
  const fails = canManage ? <Link className="sc-rowlink" href="/admin/email?tab=log&status=failed">Open the email log →</Link> : null;

  if (!s.configured) {
    return (
      <div className="sc-flash sc-flash-warn em-status" role="status" data-mail-status="unconfigured">
        <strong>Leads are saved, but no email is sent.</strong> {s.problems[0] || 'Email isn’t set up yet.'} {fix}
      </div>
    );
  }

  const failures =
    s.failed > 0 ? (
      <div className="sc-flash sc-flash-err em-status" role="alert" data-mail-status="failures">
        <strong>{s.failed} lead email{s.failed === 1 ? '' : 's'} could not be sent</strong> in the last 7 days. The leads are safe under Submissions{canManage ? ' — fix the problem, then press Resend in the log.' : '.'} {fails}
      </div>
    ) : null;

  if (always) {
    return (
      <>
        <div className="sc-flash sc-flash-ok em-status" role="status" data-mail-status="ok">
          <strong>Lead emails are on.</strong> New leads are sent to {s.to.join(', ')}{s.source === 'env' ? ' (using the server’s environment variables)' : ''}.
          {s.retrying ? ` ${s.retrying} email${s.retrying === 1 ? ' is' : 's are'} waiting to be retried.` : ''}
        </div>
        {failures}
      </>
    );
  }
  return failures;
}
