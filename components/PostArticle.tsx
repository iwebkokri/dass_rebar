import Link from 'next/link';
import PostBody from '@/components/PostBody';
import PostCommentForm from '@/components/PostCommentForm';
import { getThread } from '@/lib/comments';
import { cardDate } from '@/lib/format';
import { getAdjacentPosts, type PostCard } from '@/lib/content';
import { isFuture, stampToLocalDate } from '@/lib/post-time';

const FONT = "var(--font-inter), 'Helvetica Neue', Arial, sans-serif";
const HEADING = 'var(--font-manrope), sans-serif';

const chip = {
  display: 'inline-block', padding: '5px 12px', border: '1px solid #C3C9D0', borderRadius: '999px', background: '#FFFFFF',
  fontSize: '13px', fontWeight: 600, color: '#182845', textDecoration: 'none',
} as const;

/** A single article: hero, cover, body, tags / categories, previous / next, and the comment thread + form. */
export default function PostArticle({ post, preview = false }: { post: PostCard; preview?: boolean }) {
  const thread = getThread(post.id);
  const { prev, next } = getAdjacentPosts(post);
  const hidden = post.status !== 'published' || isFuture(post.published_at);
  const metaBits = [post.date, post.categories[0]?.name.toUpperCase() ?? (post.category ? post.category.toUpperCase() : ''), post.authorName ? `BY ${post.authorName.toUpperCase()}` : ''].filter(Boolean);

  return (
    <article style={{ fontFamily: FONT, color: '#182845', background: '#F4F5F7' }}>
      {preview && hidden && (
        <div role="status" style={{ background: '#7F5F47', color: '#FFFFFF', padding: '10px 32px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>
          Preview — this article is {post.status === 'draft' ? 'a draft' : 'scheduled'} and not visible to visitors yet.
        </div>
      )}
      <header style={{ background: '#182845', color: '#F4F5F7' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '64px 32px 72px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <nav aria-label="Breadcrumb" style={{ fontSize: '13px', letterSpacing: '0.08em', color: '#919CA4' }}>
            <Link href="/" style={{ color: '#DCDFE3' }}>HOME</Link> / <Link href="/insights" style={{ color: '#DCDFE3' }}>BLOG</Link>
          </nav>
          <span style={{ fontSize: '13px', letterSpacing: '0.1em', color: '#B0A18E' }}>{metaBits.join(' · ')}</span>
          <h1 style={{ margin: 0, fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.05, fontWeight: 800, fontFamily: HEADING, letterSpacing: '-0.02em' }}>{post.title}</h1>
          {post.excerpt && <p style={{ margin: 0, fontSize: '20px', lineHeight: 1.55, color: '#DCDFE3' }}>{post.excerpt}</p>}
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px 96px' }}>
        {post.cover_image && <img src={post.cover_image} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', borderRadius: '20px' }} />}
        <PostBody text={post.body} />

        {(post.categories.length > 0 || post.tags.length > 0) && (
          <div style={{ margin: '48px 0 0', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {post.categories.map((c) => (
              <Link key={`c-${c.slug}`} href={`/insights?category=${encodeURIComponent(c.slug)}`} style={{ ...chip, background: '#182845', borderColor: '#182845', color: '#FFFFFF' }}>{c.name}</Link>
            ))}
            {post.tags.map((t) => (<span key={`t-${t.slug}`} style={{ ...chip, color: '#4A5568' }}>#{t.name}</span>))}
          </div>
        )}

        {(prev || next) && (
          <nav aria-label="More articles" style={{ margin: '40px 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {prev ? (
              <Link href={prev.url} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '18px 20px', background: '#FFFFFF', border: '1px solid #C3C9D0', borderRadius: '12px', color: '#182845', textDecoration: 'none' }}>
                <span style={{ fontSize: '12px', letterSpacing: '0.08em', color: '#4A5568' }}>← PREVIOUS</span>
                <strong style={{ fontFamily: HEADING, fontSize: '18px', lineHeight: 1.25 }}>{prev.title}</strong>
              </Link>
            ) : <span />}
            {next ? (
              <Link href={next.url} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '18px 20px', background: '#FFFFFF', border: '1px solid #C3C9D0', borderRadius: '12px', color: '#182845', textDecoration: 'none', textAlign: 'right' }}>
                <span style={{ fontSize: '12px', letterSpacing: '0.08em', color: '#4A5568' }}>NEXT →</span>
                <strong style={{ fontFamily: HEADING, fontSize: '18px', lineHeight: 1.25 }}>{next.title}</strong>
              </Link>
            ) : <span />}
          </nav>
        )}

        <p style={{ margin: '40px 0 0' }}><Link href="/insights" style={{ fontWeight: 700 }}>← All articles</Link></p>

        {(thread.length > 0 || !!post.comments_enabled) && (
          <section id="comments" aria-labelledby="comments-h" style={{ margin: '64px 0 0', paddingTop: '40px', borderTop: '1px solid #C3C9D0' }}>
            <h2 id="comments-h" style={{ margin: 0, fontFamily: HEADING, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {thread.length > 0 ? `${thread.length} comment${thread.length === 1 ? '' : 's'}` : 'Comments'}
            </h2>

            {thread.length > 0 && (
              <ol style={{ listStyle: 'none', margin: '24px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {thread.map((c) => (
                  <li key={c.id} id={`comment-${c.id}`} style={{ marginLeft: `${c.depth * 28}px`, padding: '16px 20px', background: '#FFFFFF', border: '1px solid #C3C9D0', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'baseline' }}>
                      <strong style={{ fontSize: '16px' }}>{c.author_name}</strong>
                      <span style={{ fontSize: '12px', letterSpacing: '0.06em', color: '#4A5568' }}>{cardDate(stampToLocalDate(c.created_at))}</span>
                    </div>
                    {/* plain text only — React escapes it; line breaks are kept */}
                    <p style={{ margin: '8px 0 0', fontSize: '16px', lineHeight: 1.65, color: '#2B3A55', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</p>
                  </li>
                ))}
              </ol>
            )}

            {post.comments_enabled && !preview ? (
              <div style={{ margin: '36px 0 0' }}>
                <h3 style={{ margin: '0 0 16px', fontFamily: HEADING, fontSize: '22px', fontWeight: 800 }}>Leave a comment</h3>
                <PostCommentForm slug={post.slug} />
              </div>
            ) : !post.comments_enabled ? (
              <p style={{ margin: '28px 0 0', color: '#4A5568' }}>Comments are closed on this article.</p>
            ) : null}
          </section>
        )}
      </div>
    </article>
  );
}
