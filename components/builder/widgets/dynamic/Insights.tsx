// `insights` widget — posts from the CMS as a card grid, a featured post + grid (the Insights page) or a list.
import type { WidgetProps } from '@/lib/builder/types';
import { EmptyBox, SafeLink, num, str } from './shared';

type Post = {
  id: number; title: string; excerpt?: string; cover_image?: string; date?: string; url: string; external?: boolean; featured?: number;
  category?: string; categorySlugs?: string[]; categories?: { slug: string; name: string }[];
};

const catName = (p: Post) => p.categories?.[0]?.name || p.category || '';
/** "NOV 3, 2026" -> "Nov 3, 2026" */
const shortDate = (d?: string) => (d ? d.charAt(0) + d.slice(1).toLowerCase() : '');

function Cover({ p, size }: { p: Post; size: 'sm' | 'lg' }) {
  if (p.cover_image) return <img className={`dr-card-img dr-card-img--169 dr-card-img--r16${size === 'sm' ? ' dr-card-img--flat' : ''}`} src={p.cover_image} alt="" loading="lazy" />;
  return (
    <div className="dr-post-ph dr-card-img--169">
      <span className={`dr-post-ph-t dr-post-ph-t--${size}`}>{catName(p).toUpperCase()}</span>
    </div>
  );
}

export default function Insights({ node, ctx }: WidgetProps) {
  const p = node.props || {};
  const edit = !!ctx.edit;
  const layout = str(p.layout, 'grid');
  const slug = str(p.category);
  let posts: Post[] = (ctx.data.posts as Post[]) || [];
  if (slug) posts = posts.filter((x) => (x.categorySlugs ? x.categorySlugs.includes(slug) : true));
  if (!posts.length) return <EmptyBox edit={edit}>No posts to show yet — publish some under Posts in the admin.</EmptyBox>;
  const limit = num(p.limit, 0);
  const cap = (list: Post[]) => (limit > 0 ? list.slice(0, limit) : list);
  const open = (x: Post) => ({ href: x.url, edit, newTab: !!x.external });

  if (layout === 'list') {
    return (
      <div className="dr-post-list">
        {cap(posts).map((x) => (
          <SafeLink key={x.id} {...open(x)} className="dr-post-row">
            {x.cover_image ? <img className="dr-post-row-img" src={x.cover_image} alt="" loading="lazy" /> : <div className="dr-post-row-img dr-post-row-ph">{catName(x).toUpperCase()}</div>}
            <div className="dr-post-row-body">
              <span className="dr-card-meta dr-card-meta--sm">{shortDate(x.date)}{catName(x) ? ` · ${catName(x)}` : ''}</span>
              <h3 className="dr-card-title dr-ct-post">{x.title}</h3>
              {x.excerpt ? <p className="dr-card-text">{x.excerpt}</p> : null}
            </div>
          </SafeLink>
        ))}
      </div>
    );
  }

  if (layout === 'featured') {
    const feat = posts.find((x) => x.featured) ?? posts[0];
    const rest = cap(posts.filter((x) => x !== feat));
    return (
      <div className="dr-post-wrap">
        <SafeLink {...open(feat)} className="dr-card dr-card--feat">
          {feat.cover_image ? <img className="dr-feat-img" src={feat.cover_image} alt="" loading="lazy" /> : null}
          <div className="dr-feat-body">
            <div className="dr-feat-meta">
              <span className="dr-feat-tag">LATEST</span>
              <span className="dr-feat-date">{feat.date}{catName(feat) ? ` · ${catName(feat).toUpperCase()}` : ''}</span>
            </div>
            <h2 className="dr-card-title dr-ct-feat">{feat.title}</h2>
            {feat.excerpt ? <p className="dr-feat-excerpt">{feat.excerpt}</p> : null}
            <span className="dr-more dr-more--lg">Read article →</span>
          </div>
        </SafeLink>
        {rest.length > 0 && (
          <div className="dr-post-grid">
            {rest.map((x) => (
              <SafeLink key={x.id} {...open(x)} className="dr-card dr-card--post-lg">
                <Cover p={x} size="lg" />
                <div className="dr-card-body dr-card-body--post">
                  <span className="dr-card-meta dr-card-meta--sm dr-card-meta--caps">{x.date}{catName(x) ? ` · ${catName(x)}` : ''}</span>
                  <h3 className="dr-card-title dr-ct-post dr-ct-post--lg">{x.title}</h3>
                  {x.excerpt ? <p className="dr-card-text">{x.excerpt}</p> : null}
                  <span className="dr-more">Read more →</span>
                </div>
              </SafeLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  // grid (home page insights strip)
  const showExcerpt = p.showExcerpt === true;
  return (
    <div className="dr-post-grid">
      {cap(posts).map((x) => (
        <SafeLink key={x.id} {...open(x)} className="dr-card dr-card--post">
          <Cover p={x} size="sm" />
          <div className="dr-card-body">
            <span className="dr-card-meta dr-card-meta--sm">{shortDate(x.date)}{catName(x) ? ` · ${catName(x)}` : ''}</span>
            <h3 className="dr-card-title dr-ct-post">{x.title}</h3>
            {showExcerpt && x.excerpt ? <p className="dr-card-text">{x.excerpt}</p> : null}
          </div>
        </SafeLink>
      ))}
    </div>
  );
}
