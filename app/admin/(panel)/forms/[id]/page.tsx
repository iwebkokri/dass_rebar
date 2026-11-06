import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '@/app/admin/css/forms.css';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import FormBuilder from '@/components/admin/FormBuilder';
import { requireCap } from '@/lib/auth';
import { formType, formUsage, getForm, submissionCounts } from '@/lib/forms';
import { DEFAULT_SUBMIT_LABEL, DEFAULT_SUCCESS } from '@/lib/forms-shared';
import type { FormField } from '@/lib/builder/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Form' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<FlashParams> };

const STARTER: FormField[] = [
  { id: 'name', type: 'text', label: 'Name', required: true, width: 'half' },
  { id: 'email', type: 'email', label: 'Email', required: true, width: 'half' },
  { id: 'message', type: 'textarea', label: 'Message', required: true, width: 'full' },
];

export default async function FormEditor({ params, searchParams }: Props) {
  await requireCap('manage_site');
  const { id } = await params;
  const isNew = id === 'new';
  if (!isNew && !/^\d+$/.test(id)) notFound();
  const form = isNew ? undefined : getForm(Number(id));
  if (!isNew && !form) notFound();

  const initial = form
    ? { name: form.name, slug: form.slug, fields: form.fields, settings: form.settings }
    : { name: '', slug: '', fields: STARTER, settings: { submitLabel: DEFAULT_SUBMIT_LABEL, successMessage: DEFAULT_SUCCESS } };
  const subs = form ? submissionCounts()[formType(form.slug)] ?? 0 : 0;

  return (
    <>
      <div className="sc-head">
        <div>
          <p style={{ margin: 0 }}><Link href="/admin/forms" className="sc-muted">← Forms</Link></p>
          <h1>{form ? form.name : 'New form'}</h1>
          <p>Add and arrange the fields, choose what happens after sending, then place the form on a page.</p>
        </div>
      </div>

      <Flash params={await searchParams} />

      <FormBuilder
        key={form?.id ?? 'new'}
        id={form ? form.id : 'new'}
        initial={initial}
        usage={form ? formUsage(form.id) : []}
        submissions={subs}
        submissionsHref={form ? `/admin/submissions?type=${encodeURIComponent(formType(form.slug))}` : '/admin/submissions'}
      />
    </>
  );
}
