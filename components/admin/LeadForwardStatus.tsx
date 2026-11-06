// Status line about forwarding to Lead Manager. Dashboard: only a warning when forwards are failing. Lead Manager page (always): the
// full status, including "Leads are saved here but are not being sent to Lead Manager" when it is not set up.
import Link from 'next/link';
import { forwardStatus } from '@/lib/leadmanager';

export default function LeadForwardStatus({ always = false }: { always?: boolean }) {
  let s: ReturnType<typeof forwardStatus>;
  try {
    s = forwardStatus();
  } catch {
    return null;
  }
  const failing =
    s.failing > 0 ? (
      <div className="sc-flash sc-flash-err em-status" role="alert" data-lm-status="failures">
        <strong>{s.failing} lead{s.failing === 1 ? '' : 's'} could not be sent to Lead Manager</strong> in the last 7 days. They are safe under Submissions.{' '}
        <Link className="sc-rowlink" href="/admin/lead-manager?tab=log&status=failed">Open the delivery log →</Link>
      </div>
    ) : null;

  if (!always) return failing;
  return (
    <>
      {s.configured ? (
        <div className="sc-flash sc-flash-ok em-status" role="status" data-lm-status="ok">
          <strong>Forwarding to Lead Manager is on.</strong> New enquiries are also sent to {s.host}{s.source === 'env' ? ' (address from the server’s LEADMANAGER_URL setting)' : ''}.
          {s.retrying ? ` ${s.retrying} lead${s.retrying === 1 ? ' is' : 's are'} waiting to be retried.` : ''}
        </div>
      ) : (
        <div className="sc-flash sc-flash-warn em-status" role="status" data-lm-status="unconfigured">
          <strong>Leads are saved here but are not being sent to Lead Manager.</strong> {s.problems[0] || ''}
        </div>
      )}
      {failing}
    </>
  );
}
