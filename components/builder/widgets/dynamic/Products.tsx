// `products` widget (stocked product cards / strip, "also supplied" box) + the bar data widgets (`bar-table`, `bar-diagrams`).
import type { WidgetProps } from '@/lib/builder/types';
import { EmptyBox, str } from './shared';

type Product = { id: number; name: string; sizes?: string; description?: string; image?: string };
type Bar = { id: number; bar_size: string; mass_kg_m: number; nominal_diameter_mm: number; area_mm2: number; perimeter_mm: number; on_request?: number };

export function Products({ node, ctx }: WidgetProps) {
  const p = node.props || {};
  const edit = !!ctx.edit;
  const data = ctx.data.products;
  if (str(p.kind, 'stocked') === 'also') {
    const also: Product[] = data?.also || [];
    if (!also.length) return <EmptyBox edit={edit}>No “also supplied” products yet — add them under Products in the admin.</EmptyBox>;
    const label = str(p.alsoLabel);
    return (
      <div className="dr-card dr-card--also">
        {label ? <span className="dr-also-label">{label}</span> : null}
        <div className="dr-also-names">
          {also.map((x) => (
            <span key={x.id} className="dr-card-title dr-ct-also">{x.name}</span>
          ))}
        </div>
      </div>
    );
  }

  const stocked: Product[] = data?.stocked || [];
  if (!stocked.length) return <EmptyBox edit={edit}>No stocked products yet — add them under Products in the admin.</EmptyBox>;
  const strip = str(p.layout, 'cards') === 'strip';
  return (
    <div className="dr-prod-grid">
      {stocked.map((x) =>
        strip ? (
          <article key={x.id} className="dr-card dr-card--strip">
            {x.image ? <img className="dr-card-img dr-card-img--32" src={x.image} alt={x.name} loading="lazy" /> : null}
            <div className="dr-card-body">
              <h3 className="dr-card-title dr-ct-strip">{x.name}</h3>
              {x.sizes ? (
                <dl className="dr-dl">
                  <dt>Sizes</dt>
                  <dd>{x.sizes}</dd>
                </dl>
              ) : null}
              {x.description ? <p className="dr-card-text">{x.description}</p> : null}
            </div>
          </article>
        ) : (
          <article key={x.id} className="dr-card dr-card--prod">
            {x.image ? <img className="dr-card-img dr-card-img--prod dr-card-img--r16" src={x.image} alt={x.name} loading="lazy" /> : null}
            <div className="dr-card-body dr-card-body--lg">
              {x.sizes ? <span className="dr-eyebrow dr-eyebrow--dim">{x.sizes}</span> : null}
              <h3 className="dr-card-title dr-ct-prod">{x.name}</h3>
              {x.description ? <p className="dr-card-text">{x.description}</p> : null}
            </div>
          </article>
        )
      )}
    </div>
  );
}

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function BarTable({ node, ctx }: WidgetProps) {
  const variant = str(node.props?.variant, 'full');
  const edit = !!ctx.edit;
  const bars: Bar[] = ctx.data.bars || [];
  if (!bars.length) return <EmptyBox edit={edit}>No bar data yet — add it under Bar data in the admin.</EmptyBox>;

  if (variant === 'chips') {
    return (
      <div className="dr-size-chips">
        {bars.map((b) =>
          b.on_request ? (
            <span key={b.id} className="dr-size-chip dr-size-chip--req">{b.bar_size} <small>ON REQUEST</small></span>
          ) : (
            <span key={b.id} className="dr-size-chip">{b.bar_size}</span>
          )
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="dr-table-wrap">
        <table className="dr-bt">
          <thead>
            <tr className="dr-bt-head">
              <th scope="col">Size</th>
              <th scope="col">Ø (mm)</th>
              <th scope="col">kg/m</th>
            </tr>
          </thead>
          <tbody>
            {bars.filter((b) => !b.on_request).map((b) => (
              <tr key={b.id}>
                <th scope="row" className="dr-bt-rh">{b.bar_size}</th>
                <td>{n(b.nominal_diameter_mm).toFixed(1)}</td>
                <td>{n(b.mass_kg_m).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="dr-table-wrap dr-table-wrap--dark">
      <table className="dr-bt dr-bt--full">
        <thead>
          <tr className="dr-bt-head">
            <th scope="col">BAR SIZE</th>
            <th scope="col">MASS (KG/M)</th>
            <th scope="col">NOMINAL DIAMETER (MM)</th>
            <th scope="col">CROSS-SECTIONAL AREA (MM²)</th>
            <th scope="col">PERIMETER (MM)</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.id} className={b.on_request ? 'dr-bt-req' : undefined}>
              <th scope="row" className="dr-bt-rh">{b.bar_size}</th>
              <td>{n(b.mass_kg_m).toFixed(3)}</td>
              <td>{n(b.nominal_diameter_mm).toFixed(1)}</td>
              <td>{b.area_mm2}</td>
              <td>{n(b.perimeter_mm).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BarDiagrams({ ctx }: WidgetProps) {
  const dg = ctx.data.diagrams;
  const imgs = dg
    ? ([
        [dg.nominal, 'Cross-section of a rebar showing the nominal diameter'],
        [dg.side, 'Side view of a deformed rebar showing its ribs'],
        [dg.actual, 'Cross-section of a rebar showing the actual (overall) diameter'],
      ] as [string, string][]).filter(([src]) => !!src)
    : [];
  if (!imgs.length) return <EmptyBox edit={!!ctx.edit}>No bar diagrams yet — set them under Bar data in the admin.</EmptyBox>;
  return (
    <div className="dr-diag">
      <div className="dr-diag-grid">
        {imgs.map(([src, alt]) => (
          <img key={src} src={src} alt={alt} width={260} height={240} loading="lazy" />
        ))}
      </div>
    </div>
  );
}
