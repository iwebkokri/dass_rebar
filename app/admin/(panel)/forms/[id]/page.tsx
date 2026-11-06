import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '@/app/admin/css/forms.css';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import FormBuilder from '@/components/admin/FormBuilder';
import { requireCap } from '@/lib/auth';
import { FORM_TEMPLATES, templateById } from '@/lib/form-templates';
import { formType, formUsage, getForm, submissionCounts } from '@/lib/forms';
import { DEFAULT_SUBMIT_LABEL, DEFAULT_SUCCESS } from '@/lib/forms-shared';
import { getLmConfig } from '@/lib/leadmanager-settings';
import { getMailConfig } from '@/lib/mail-settings';
import { can } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Form' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<FlashParams & { template?: string }> };

export default async function FormEditor({ params, searchParams }: Props) {
  const user = await requireCap('manage_forms');
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === 'new';
  if (!isNew && !/^\d+$/.test(id)) notFound();
  const form = isNew ? undefined : getForm(Number(id));
  if (!isNew && !form) notFound();

  // New form: choose a starting point first.
  const tpl = isNew ? templateById(sp.template) : undefined;
  if (isNew && !tpl) {
    return (
      <>
        <div className="sc-head">
          <div>
            <p style={{ margin: 0 }}><Link href="/admin/forms" className="sc-muted">← Forms</Link></p>
            <h1>New form</h1>
            <p>Start from a template — you can change everything afterwards.</p>
          </div>
        </div>
        <Flash params={sp} />
        <div className="fm-templates">
          {FORM_TEMPLATES.map((t) => (
            <Link key={t.id} href={`/admin/forms/new?template=${t.id}`} className="sc-card fm-template">
              <strong>{t.label}</strong>
              <span className="sc-muted">{t.description}</span>
              <span className="sc-faint">{t.fields.length ? `${t.fields.length} fields` : 'No fields'}</span>
            </Link>
          ))}
        </div>
      </>
    );
  }

  const initial = form
    ? { name: form.name, slug: form.slug, fields: form.fields, settings: form.settings }
    : { name: tpl!.name, slug: '', fields: tpl!.fields, settings: { submitLabel: DEFAULT_SUBMIT_LABEL, successMessage: DEFAULT_SUCCESS, ...tpl!.settings } };
  const subs = form ? submissionCounts()[formType(form.slug)] ?? 0 : 0;
  const cfg = getMailConfig();

  return (
    <>
      <div className="sc-head">
        <div>
          <p style={{ margin: 0 }}><Link href="/admin/forms" className="sc-muted">← Forms</Link></p>
          <h1>{form ? form.name : 'New form'}</h1>
          <p>Add and arrange the fields, choose what happens after sending, then place the form on a page or in a popup.</p>
        </div>
      </div>

      <Flash params={sp} />

      <FormBuilder
        key={form?.id ?? `new-${tpl?.id}`}
        id={form ? form.id : 'new'}
        initial={initial}
        usage={form ? formUsage(form.id) : []}
        submissions={subs}
        submissionsHref={form ? `/admin/submissions?type=${encodeURIComponent(formType(form.slug))}` : '/admin/submissions'}
        canEmail={can(user, 'manage_email')}
        ownerAddresses={cfg.to}
        mailReady={cfg.configured}
        lmConfigured={getLmConfig().configured}
      />
    </>
  );
}
