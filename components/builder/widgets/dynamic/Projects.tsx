// `projects` widget — featured/other/roster projects from the CMS as cards, detail rows with a photo gallery, a compact list or chips.
import type { WidgetProps } from '@/lib/builder/types';
import { EmptyBox, SafeLink, num, projectSubtitle, str } from './shared';

type Proj = { id: number; title: string; category?: string; location?: string; address?: string; images?: string[] };

/** Main photo + a row of thumbnails (first image is the main one). */
function Gallery({ p }: { p: Proj }) {
  const [hero, ...thumbs] = p.images || [];
  if (!hero) return <div className="dr-pg-ph" />;
  const shown = thumbs.slice(0, 6);
  return (
    <div className="dr-pg">
      <img className="dr-pg-hero" src={hero} alt={`${p.title} — photo 1`} loading="lazy" />
      {shown.length > 0 && (
        <div className="dr-pg-thumbs" style={{ ['--n' as any]: shown.length }}>
          {shown.map((src, i) => (
            <img key={src + i} src={src} alt={`${p.title} — photo ${i + 2}`} loading="lazy" />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Projects({ node, ctx }: WidgetProps) {
  const p = node.props || {};
  const d = ctx.data.projects;
  const source = str(p.source, 'featured');
  const layout = str(p.layout, 'cards');
  const edit = !!ctx.edit;

  let items: Proj[] = [];
  if (d) {
    if (source === 'others') items = d.others;
    else if (source === 'roster') items = d.roster;
    else if (source === 'all') items = [...d.featured, ...d.others];
    else items = d.featured;
  }
  const limit = num(p.limit, 0);
  if (limit > 0) items = items.slice(0, limit);
  if (!items.length) return <EmptyBox edit={edit}>No projects to show yet — add some under Projects in the admin.</EmptyBox>;

  if (layout === 'chips') {
    const label = str(p.chipsLabel);
    return (
      <div className="dr-chips">
        {label ? <span className="dr-chips-label">{label}</span> : null}
        {items.map((x) => (
          <span key={x.id} className="dr-chip">{[x.title, x.location].filter(Boolean).join(', ')}</span>
        ))}
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className="dr-proj-grid dr-proj-list">
        {items.map((x, i) => {
          const sub = [x.location, x.address].filter(Boolean).join(' · ');
          return (
            <div key={x.id} className="dr-proj-li">
              <span className="dr-proj-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="dr-proj-li-body">
                <span className="dr-card-title dr-ct-li">{x.title}</span>
                {sub ? <span className="dr-proj-sub">{sub}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (layout === 'detail') {
    const [lead, ...rest] = items;
    return (
      <div className="dr-proj-detail">
        <article className="dr-proj-lead">
          <div className="dr-proj-lead-media"><Gallery p={lead} /></div>
          <div className="dr-proj-lead-body">
            {lead.location ? <span className="dr-eyebrow">{lead.location}</span> : null}
            <h3 className="dr-card-title dr-ct-lead">{lead.title}</h3>
            {lead.address ? <p className="dr-proj-lead-addr">{lead.address}</p> : null}
          </div>
        </article>
        {rest.length > 0 && (
          <div className="dr-proj-grid dr-proj-grid--detail">
            {rest.map((x) => (
              <article key={x.id} className="dr-card dr-card--detail">
                <Gallery p={x} />
                <div className="dr-card-body dr-card-body--lg">
                  {x.location ? <span className="dr-eyebrow dr-eyebrow--dim">{x.location}</span> : null}
                  <h3 className="dr-card-title dr-ct-detail">{x.title}</h3>
                  {x.address ? <p className="dr-card-meta dr-card-meta--md">{x.address}</p> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  // cards (home page projects strip)
  const link = str(p.linkUrl);
  return (
    <div className="dr-proj-grid">
      {items.map((x) => {
        const img = x.images?.[0];
        const sub = projectSubtitle(x);
        return (
          <SafeLink key={x.id} href={link} edit={edit} className="dr-card dr-card--proj">
            {img ? <img className="dr-card-img dr-card-img--43" src={img} alt={x.title} loading="lazy" /> : <div className="dr-card-img dr-card-img--ph dr-card-img--43" />}
            <div className="dr-card-body">
              {x.category ? <span className="dr-pill">{x.category}</span> : null}
              <h3 className="dr-card-title dr-ct-proj">{x.title}</h3>
              {sub ? <span className="dr-card-meta">{sub}</span> : null}
            </div>
          </SafeLink>
        );
      })}
    </div>
  );
}
