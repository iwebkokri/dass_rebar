import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ConfirmButton from '@/components/admin/ConfirmButton';
import Field from '@/components/admin/Field';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { RESOURCES } from '@/lib/admin/resources';
import { requireCap } from '@/lib/auth';
import { get } from '@/lib/db';
import { today } from '@/lib/format';
import { deleteResource, saveResource } from '../../../actions';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ resource: string; id: string }>; searchParams: Promise<FlashParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { resource, id } = await params;
  const r = RESOURCES[resource];
  return { title: r ? `${id === 'new' ? 'New' : 'Edit'} ${r.singular}` : 'Not found' };
}

export default async function ResourceEditor({ params, searchParams }: Props) {
  const { resource, id } = await params;
  await requireCap(resource === 'insights' ? 'edit_others_posts' : 'manage_content');
  const r = RESOURCES[resource];
  if (!r) notFound();

  const isNew = id === 'new';
  if (!isNew && !/^\d+$/.test(id)) notFound();
  const row = isNew ? undefined : get<any>(`SELECT * FROM ${r.table} WHERE id = ?`, Number(id));
  if (!isNew && !row) notFound();

  return (
    <>
      <div className="sc-head">
        <div>
          <p style={{ margin: 0 }}><Link href={`/admin/${r.key}`} className="sc-muted">← {r.label}</Link></p>
          <h1>{isNew ? `New ${r.singular}` : `Edit ${r.singular}`}</h1>
        </div>
      </div>

      <Flash params={await searchParams} />

      <form action={saveResource.bind(null, r.key, id)} className="sc-form sc-card">
        {r.fields.map((def) => (
          <Field key={def.name} def={def} value={row?.[def.name] ?? (def.type === 'date' ? today() : undefined)} />
        ))}
        <div className="sc-form-actions">
          <button className="sc-btn sc-btn-primary" type="submit">{isNew ? `Create ${r.singular}` : 'Save changes'}</button>
          <Link className="sc-btn" href={`/admin/${r.key}`}>Cancel</Link>
        </div>
      </form>

      {row && (
        <form action={deleteResource.bind(null, r.key, row.id)} style={{ marginTop: 18 }}>
          <ConfirmButton className="sc-btn sc-btn-danger" message={`Delete this ${r.singular}? This can't be undone.`}>Delete {r.singular}</ConfirmButton>
        </form>
      )}
    </>
  );
}
