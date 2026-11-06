import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import '@/app/admin/css/posts.css';
import '@/app/admin/css/seo.css';
import { postsAction, restoreRevision, savePost } from '@/app/admin/posts/actions';
import ConfirmButton from '@/components/admin/ConfirmButton';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import MediaField from '@/components/admin/MediaField';
import PostBodyEditor from '@/components/admin/PostBodyEditor';
import PostPublishBox from '@/components/admin/PostPublishBox';
import PostTermsBox from '@/components/admin/PostTermsBox';
import PostTitleFields from '@/components/admin/PostTitleFields';
import SeoFields from '@/components/admin/SeoFields';
import SeoReport from '@/components/admin/SeoReport';
import type { AdminUser } from '@/lib/auth';
import { all, get } from '@/lib/db';
import { stamp } from '@/lib/format';
import { nowStamp, stampToLocalInput } from '@/lib/post-time';
import { allTerms, canEditPost, listRevisions, postState, termsOfPost, type PostRow } from '@/lib/posts';
import { can } from '@/lib/roles';
import { analyzePost } from '@/lib/seo';

/** Add-new / edit screen of a post. The page itself has already called requireCap('edit_posts'). */
export default async function PostEditor({ idParam, user, flash }: { idParam: string; user: AdminUser; flash: FlashParams }) {
  const isNew = idParam === 'new';
  if (!isNew && !/^\d+$/.test(idParam)) notFound();
  const row = isNew ? undefined : get<PostRow>('SELECT * FROM posts WHERE id = ?', Number(idParam));
  if (!isNew && !row) notFound();
  if (row && !canEditPost(user, row)) redirect('/admin/posts?error=' + encodeURIComponent('You can only edit your own posts.'));

  const trashed = row?.status === 'trash';
  const state = row ? postState(row) : 'draft';
  const terms = row ? termsOfPost(row.id, row.category) : { categoryIds: [] as number[], primaryId: 0, tags: [] as string[] };
  const categories = allTerms('category');
  const tagSuggestions = all<{ name: string }>(
    "SELECT t.name FROM terms t LEFT JOIN post_terms pt ON pt.term_id = t.id WHERE t.taxonomy = 'tag' GROUP BY t.id ORDER BY COUNT(pt.post_id) DESC, t.name COLLATE NOCASE LIMIT 40"
  ).map((r) => r.name);
  const canOthers = can(user, 'edit_others_posts');
  const authors = canOthers ? all<{ id: number; name: string; email: string }>('SELECT id, name, email FROM users ORDER BY name COLLATE NOCASE, email') : [];
  const revisions = row ? listRevisions(row.id) : [];
  const authorName = row?.author_id ? get<{ n: string }>("SELECT COALESCE(NULLIF(name, ''), email) AS n FROM users WHERE id = ?", row.author_id)?.n ?? '' : '';
  const analysis = row && !trashed ? analyzePost(row, authorName) : null;

  const viewUrl = row ? (row.external_url ? row.external_url : state === 'published' ? `/insights/${row.slug}` : `/insights/${row.slug}?preview=1`) : '';
  const back = row ? `/admin/posts/${row.id}` : '/admin/posts';

  return (
    <>
      <div className="sc-head">
        <div>
          <p style={{ margin: 0 }}><Link href="/admin/posts" className="sc-muted">← Posts</Link></p>
          <h1>{isNew ? 'Add new post' : 'Edit post'}</h1>
        </div>
        {!isNew && (
          <div className="sc-actions">
            <Link className="sc-btn" href="/admin/posts/new">Add new</Link>
          </div>
        )}
      </div>

      <Flash params={flash} />

      {/* Separate forms for the buttons that must not save the article (HTML forms can't be nested; buttons attach with form="…") */}
      <form id="post-actions" action={postsAction}><input type="hidden" name="back" value="/admin/posts" /></form>
      <form id="post-actions-here" action={postsAction}><input type="hidden" name="back" value={back} /></form>

      {trashed && row && (
        <div className="sc-flash sc-flash-warn po-trashed" role="status">
          <span>This post is in the Trash and can’t be edited.</span>
          <span className="sc-actions">
            <button type="submit" form="post-actions-here" name="op" value={`restore:${row.id}`} className="sc-btn sc-btn-sm">Restore</button>
            {can(user, 'delete_posts') && <button type="submit" form="post-actions" name="op" value={`delete:${row.id}`} className="sc-btn sc-btn-sm sc-btn-danger">Delete permanently</button>}
          </span>
        </div>
      )}

      <form action={savePost.bind(null, idParam)} className="po-layout">
        <fieldset className="po-fieldset" disabled={trashed}>
          <div className="po-main">
            <div className="sc-card">
              <PostTitleFields title={row?.title ?? ''} slug={row?.slug ?? ''} isNew={isNew} excerpt={row?.excerpt ?? ''} />
            </div>

            <div className="sc-card po-box">
              <h2>Article text</h2>
              <PostBodyEditor defaultValue={row?.body ?? ''} />
            </div>

            <div className="sc-card po-box">
              <h2>External link <span className="sc-faint">(optional)</span></h2>
              <div className="sc-field">
                <input className="sc-input" name="external_url" maxLength={500} defaultValue={row?.external_url ?? ''} placeholder="https://dassrebar.com/…" aria-label="External link" />
                <span className="sc-help">If set, the article card links to this address instead of an article page on this site (the text above is then not shown). Leave empty to publish the article here.</span>
              </div>
            </div>

            <div className="sc-card po-box">
              <h2>Search &amp; social</h2>
              <div className="po-seo">
                <div className="sc-field">
                  <label htmlFor="po-seo-title">SEO title</label>
                  <input className="sc-input" id="po-seo-title" name="seo_title" maxLength={200} defaultValue={row?.seo_title ?? ''} placeholder="Defaults to the post title" />
                </div>
                <div className="sc-field">
                  <label htmlFor="po-seo-desc">SEO description</label>
                  <textarea className="sc-textarea" id="po-seo-desc" name="seo_description" rows={3} maxLength={400} defaultValue={row?.seo_description ?? ''} placeholder="Defaults to the excerpt. About 150–160 characters works best." />
                </div>
                <MediaField name="og_image" defaultValue={row?.og_image ?? ''} kind="image" label="Social image" help="Shown when the link is shared. Defaults to the cover image." />
              </div>
            </div>

            <SeoFields
              kind="post"
              canJsonLd={can(user, 'manage_seo')}
              values={{
                focus_keyword: row?.focus_keyword ?? '', canonical_url: row?.canonical_url ?? '', nofollow: row?.nofollow ?? 0, noindex: row?.noindex ?? 0,
                og_title: row?.og_title ?? '', og_description: row?.og_description ?? '', twitter_card: row?.twitter_card ?? '', schema_type: row?.schema_type ?? '',
                answer_summary: row?.answer_summary ?? '', breadcrumb_title: row?.breadcrumb_title ?? '', custom_jsonld: row?.custom_jsonld ?? '',
              }}
            />
          </div>

          <aside className="po-side">
            <PostPublishBox
              isNew={isNew}
              postId={row?.id ?? 0}
              status={row?.status === 'published' ? 'published' : 'draft'}
              wasPublished={row?.status === 'published'}
              publishedAtLocal={row && (row.status === 'published' || row.published_at > nowStamp()) ? stampToLocalInput(row.published_at) : ''}
              canPublish={can(user, 'publish_posts')}
              canDelete={can(user, 'delete_posts')}
              viewUrl={viewUrl}
              external={!!row?.external_url}
              updatedLabel={row ? stamp(row.updated_at) : ''}
            />

            <PostTermsBox
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              selected={terms.categoryIds}
              primary={terms.primaryId}
              tags={terms.tags}
              tagSuggestions={tagSuggestions}
              canAddCategory={can(user, 'manage_terms')}
            />

            {analysis && (
              <section className="sc-card po-box" id="seo-report">
                <h2>SEO &amp; AI check</h2>
                <SeoReport result={analysis} />
                <p className="sc-help" style={{ marginBottom: 0 }}>Based on the last saved version.</p>
              </section>
            )}

            <section className="sc-card po-box">
              <h2>Cover image</h2>
              <MediaField name="cover_image" defaultValue={row?.cover_image ?? ''} kind="image" />
            </section>

            <section className="sc-card po-box po-options">
              <h2>Options</h2>
              <label className="sc-check"><input type="checkbox" name="featured" defaultChecked={!!row?.featured} /> Feature on the Insights page</label>
              <label className="sc-check"><input type="checkbox" name="comments_enabled" defaultChecked={row ? !!row.comments_enabled : true} /> Allow comments</label>
              {canOthers && (
                <div className="sc-field">
                  <label htmlFor="po-author">Author</label>
                  <select className="sc-select" id="po-author" name="author_id" defaultValue={String(row?.author_id ?? user.id)}>
                    {row && row.author_id === null && <option value="0">— none —</option>}
                    {authors.map((a) => (<option key={a.id} value={a.id}>{a.name || a.email}</option>))}
                  </select>
                </div>
              )}
            </section>
          </aside>
        </fieldset>
      </form>

      {row && revisions.length > 0 && (
        <section className="sc-card po-box po-revisions" id="revisions">
          <h2>Revisions</h2>
          <p className="sc-help" style={{ marginTop: 0 }}>Every save keeps the previous version of the title and text. Restoring one first keeps the current version too.</p>
          <ul>
            {revisions.map((r) => (
              <li key={r.id}>
                <details>
                  <summary>
                    <span className="po-rev-when">{stamp(r.created_at)}</span>
                    <span className="sc-muted"> · {r.title || '(untitled)'} · {r.content.trim().split(/\s+/).filter(Boolean).length} words{r.user_name ? ` · saved over by ${r.user_name}` : ''}</span>
                  </summary>
                  <pre className="sc-pre po-rev-text">{r.content.slice(0, 6000) || '(empty)'}{r.content.length > 6000 ? '\n…' : ''}</pre>
                  {!trashed && (
                    <form action={restoreRevision.bind(null, row.id, r.id)}>
                      <ConfirmButton className="sc-btn sc-btn-sm" message="Restore this version? The current text is kept as a revision.">Restore this version</ConfirmButton>
                    </form>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
