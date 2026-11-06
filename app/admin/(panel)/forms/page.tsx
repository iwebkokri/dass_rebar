import type { Metadata } from 'next';
import Link from 'next/link';
import '@/app/admin/css/forms.css';
import { deleteForm, duplicateForm } from '@/app/admin/forms/actions';
import ConfirmButton from '@/components/admin/ConfirmButton';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { requireCap } from '@/lib/auth';
import { formType, formUsage, listForms, submissionCounts } from '@/lib/forms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Forms' };

export default async function Forms({ searchParams }: { searchParams: Promise<FlashParams> }) {
  await requireCap('manage_site');
  const forms = listForms();
  const counts = submissionCounts();

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Forms</h1>
          <p>Build your own forms, then add them to any page with the “Custom form” widget. Entries arrive under Submissions.</p>
        </div>
        <div className="sc-actions">
          <Link className="sc-btn sc-btn-primary" href="/admin/forms/new">New form</Link>
        </div>
      </div>

      <Flash params={await searchParams} />

      <div className="sc-tablewrap">
        {forms.length === 0 ? (
          <div className="sc-empty">No custom forms yet. <Link className="sc-rowlink" href="/admin/forms/new">Create the first one</Link>.</div>
        ) : (
          <table className="sc-table">
            <thead><tr><th>Name</th><th>Slug</th><th className="sc-num">Fields</th><th className="sc-num">Submissions</th><th>Used on</th><th /></tr></thead>
            <tbody>
              {forms.map((f) => {
                const used = formUsage(f.id);
                const n = counts[formType(f.slug)] ?? 0;
                const warning = used.length
                  ? `“${f.name}” is placed on: ${used.map((u) => u.title).join(', ')}. Those pages will show an empty spot where the form was. Delete it anyway? Past submissions are kept.`
                  : `Delete the form “${f.name}”? Past submissions are kept.`;
                return (
                  <tr key={f.id}>
                    <td><Link className="sc-rowlink" href={`/admin/forms/${f.id}`}>{f.name}</Link></td>
                    <td className="sc-muted">{f.slug}</td>
                    <td className="sc-num">{f.fields.length}</td>
                    <td className="sc-num">{n ? <Link className="sc-rowlink" href={`/admin/submissions?type=${encodeURIComponent(formType(f.slug))}`}>{n}</Link> : <span className="sc-muted">0</span>}</td>
                    <td className="sc-muted">{used.length ? used.map((u) => u.title).join(', ') : '—'}</td>
                    <td className="sc-num">
                      <span className="fm-rowactions">
                        <Link className="sc-btn sc-btn-sm" href={`/admin/forms/${f.id}`}>Edit</Link>
                        <form action={duplicateForm.bind(null, f.id)}><button className="sc-btn sc-btn-sm" type="submit">Duplicate</button></form>
                        <form action={deleteForm.bind(null, f.id)}><ConfirmButton className="sc-btn sc-btn-sm sc-btn-danger" message={warning}>Delete</ConfirmButton></form>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
