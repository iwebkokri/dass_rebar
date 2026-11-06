// Shown instead of an error when a feature needs database tables that a still-running (older) server process has not created yet.
// Migrations run when the app starts, so one restart finishes the job (see lib/schema-ready.ts).
import { NOT_READY_MESSAGE } from '@/lib/schema-ready';

export default function DbNotReady({ what }: { what?: string }) {
  return (
    <div className="sc-flash sc-flash-warn" role="status" data-db-status="not-ready">
      <strong>{NOT_READY_MESSAGE}</strong> {what ? `${what} needs` : 'This part needs'} a one-time database update that happens when the app starts. Stop the server and start it again (<code>npm run dev</code>, or restart the app in hPanel), then reload this page. Your leads and settings are safe.
    </div>
  );
}
