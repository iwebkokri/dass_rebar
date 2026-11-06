'use server';

// Lead Manager page actions (administrators only: manage_integrations). Every action starts with requireCap.
// Nothing returned or redirected here ever contains the webhook URL or the API key.
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { resendForward, sendTestLead } from '@/lib/leadmanager';
import { saveLmSettings } from '@/lib/leadmanager-settings';

const text = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? '').replace(/\u0000/g, '').slice(0, max);

function go(tab: string, params: Record<string, string>): never {
  const qs = new URLSearchParams({ tab, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }).toString();
  redirect(`/admin/lead-manager?${qs}`);
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  if (!host) return '';
  return `${h.get('x-forwarded-proto') || (/^(localhost|127\.)/.test(host) ? 'http' : 'https')}://${host}`;
}

export async function saveLeadManager(fd: FormData) {
  const user = await requireCap('manage_integrations');
  const r = saveLmSettings({
    enabled: fd.get('enabled') === '1',
    skipStaff: fd.get('skip_staff') === '1',
    types: { contact: fd.get('t_contact') === '1', quote: fd.get('t_quote') === '1', calculator: fd.get('t_calculator') === '1', newsletter: fd.get('t_newsletter') === '1' },
    url: text(fd, 'url', 600), // blank = keep the saved one
    clearUrl: fd.get('clear_url') === '1',
    key: text(fd, 'key', 400), // blank = keep the saved one
    clearKey: fd.get('clear_key') === '1',
  });
  if (!r.ok) go('settings', { error: r.error || 'Could not save.' });
  logActivity(user, 'update', 'integration', 'lead-manager', 'Lead Manager settings');
  revalidatePath('/admin', 'layout');
  go('settings', { ok: 'Lead Manager settings saved. Use “Send test lead” to check the connection.' });
}

export async function sendTestLeadAction() {
  const user = await requireCap('manage_integrations');
  const r = await sendTestLead(await requestOrigin());
  logActivity(user, 'test', 'integration', 'lead-manager', `Test lead: ${r.status}${r.http ? ` (HTTP ${r.http})` : ''}`);
  const detail = `${r.http ? `HTTP ${r.http}` : 'no response'}${r.response ? ` — ${r.response}` : ''}`;
  if (r.status === 'accepted') go('settings', { ok: `Test lead accepted by Lead Manager (${detail}). Look for “Test Person (website test)” in your lead list.` });
  go('settings', { error: `The test lead was not accepted: ${r.error || 'unknown error'} (${detail})` });
}

export async function resendLeadForward(fd: FormData) {
  await requireCap('manage_integrations');
  const id = Number(fd.get('id'));
  if (!Number.isInteger(id) || id < 1) go('log', { error: 'Unknown entry.' });
  const r = await resendForward(id, await requestOrigin());
  const st = text(fd, 'status', 12);
  const extra = ['accepted', 'failed', 'skipped', 'refused'].includes(st) ? { status: st } : {};
  const detail = `${r.http ? `HTTP ${r.http}` : ''}${r.response ? ` — ${r.response}` : ''}`.trim();
  if (r.status === 'accepted') go('log', { ...extra, ok: `Sent. ${detail}`.trim() });
  go('log', { ...extra, error: `Not accepted: ${r.error || 'unknown error'} ${detail}`.trim() });
}
