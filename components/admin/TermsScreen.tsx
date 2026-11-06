import Link from 'next/link';
import '@/app/admin/css/posts.css';
import { saveTerm, termsAction } from '@/app/admin/terms/actions';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import PostRowButton from '@/components/admin/PostRowButton';
import PostSelectAll from '@/components/admin/PostSelectAll';
import { all } from '@/lib/db';

type Term = { id: number; name: string; slug: string; description: string; n: number };

/** Shared screen of /admin/categories and /admin/tags (the page has already called requireCap('manage_terms')). */
export default function TermsScreen({ taxonomy, flash, editId }: { taxonomy: 'category' | 'tag'; flash: FlashParams; editId: number }) {
  const isCat = taxonomy === 'category';
  const base = isCat ? '/admin/categories' : '/admin/tags';
  const noun = isCat ? 'category' : 'tag';
  const rows = all<Term>(
    `SELECT t.id, t.name, t.slug, t.description,
       (SELECT COUNT(*) FROM post_terms pt JOIN posts p ON p.id = pt.post_id WHERE pt.term_id = t.id AND p.status != 'trash') AS n
     FROM terms t WHERE t.taxonomy = ? ORDER BY t.name COLLATE NOCASE`,
    taxonomy
  );
  const editing = editId ? rows.find((r) => r.id === editId) : undefined;
  const save = saveTerm.bind(null, taxonomy);
  const act = termsAction.bind(null, taxonomy);

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>{isCat ? 'Categories' : 'Tags'}</h1>
          <p>{isCat ? 'Group articles by topic. The first category of a post is the label on its card.' : 'Free-form keywords for articles. Tags are also created while writing a post.'}</p>
        </div>
      </div>

      <Flash params={flash} />

      <div className="po-terms">
        <section className="sc-card po-box po-terms-form">
          <h2>{editing ? `Edit ${noun}` : `Add new ${noun}`}</h2>
          <form action={save} className="po-stack" key={editing?.id ?? 'new'}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="sc-field">
              <label htmlFor="t-name">Name <span className="sc-req">*</span></label>
              <input className="sc-input" id="t-name" name="name" required maxLength={60} defaultValue={editing?.name ?? ''} />
            </div>
            <div className="sc-field">
              <label htmlFor="t-slug">Slug</label>
              <input className="sc-input" id="t-slug" name="slug" maxLength={80} defaultValue={editing?.slug ?? ''} placeholder="created-from-the-name" />
              <span className="sc-help">Used in links{isCat ? ' (for example /insights?category=…)' : ''}. Lower case letters, numbers and dashes.</span>
            </div>
            <div className="sc-field">
              <label htmlFor="t-desc">Description</label>
              <textarea className="sc-textarea" id="t-desc" name="description" rows={3} maxLength={400} defaultValue={editing?.description ?? ''} />
            </div>
            <div className="sc-actions">
              <button type="submit" className="sc-btn sc-btn-primary">{editing ? 'Update' : `Add ${noun}`}</button>
              {editing && <Link className="sc-btn" href={base}>Cancel</Link>}
            </div>
          </form>
        </section>

        <div className="po-terms-list">
          <form id="bulk-form" action={act} className="po-bulk" style={{ marginBottom: 12 }}>
            <select className="sc-select" name="bulk" aria-label="Bulk action" defaultValue="">
              <option value="">Bulk actions</option>
              <option value="delete">Delete</option>
            </select>
            <button className="sc-btn sc-btn-sm" type="submit">Apply</button>
            <span className="sc-faint">{rows.length} {rows.length === 1 ? noun : isCat ? 'categories' : 'tags'}</span>
          </form>

          <div className="sc-tablewrap">
            {rows.length === 0 ? (
              <div className="sc-empty">No {isCat ? 'categories' : 'tags'} yet.</div>
            ) : (
              <table className="sc-table po-table">
                <thead>
                  <tr>
                    <th className="po-check"><PostSelectAll form="bulk-form" /></th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Slug</th>
                    <th className="po-num">Posts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className={t.id === editing?.id ? 'po-editing' : undefined}>
                      <td className="po-check"><input type="checkbox" name="ids" value={t.id} form="bulk-form" aria-label={`Select ${t.name}`} /></td>
                      <td className="po-title-cell">
                        <form action={act}>
                          <Link className="sc-rowlink" href={`${base}?edit=${t.id}`}>{t.name}</Link>
                          <div className="po-actions">
                            <Link className="po-act" href={`${base}?edit=${t.id}`}>Edit</Link>
                            <PostRowButton op={`delete:${t.id}`} confirm={`Delete “${t.name}”? ${t.n ? `It will be removed from ${t.n} post${t.n === 1 ? '' : 's'}; the posts themselves are kept.` : ''}`} className="po-act-danger">Delete</PostRowButton>
                          </div>
                        </form>
                      </td>
                      <td className="sc-muted">{t.description || '—'}</td>
                      <td className="sc-muted">{t.slug}</td>
                      <td className="po-num">{isCat && t.n ? <Link className="po-link" href={`/admin/posts?cat=${encodeURIComponent(t.slug)}`}>{t.n}</Link> : t.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
