import type { Metadata } from 'next';
import Link from 'next/link';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { requireCap } from '@/lib/auth';
import { getBarData } from '@/lib/content';
import { saveBarData } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bar data' };

export default async function BarData({ searchParams }: { searchParams: Promise<FlashParams> }) {
  await requireCap('manage_content');
  const rows = getBarData();
  const blank = [0, 1]; // two empty lines for adding sizes

  const num = (name: string, value?: number, step = 'any') => (
    <input className="sc-input" type="number" name={name} defaultValue={value} min="0" step={step} inputMode="decimal" style={{ minWidth: 90 }} />
  );

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Bar data</h1>
          <p>The Canadian metric bar table on the Products page. It also feeds the weight calculators (bars marked “on request” are left out of those).</p>
        </div>
        <Link className="sc-btn" href="/products" target="_blank" rel="noopener">View on site ↗</Link>
      </div>

      <Flash params={await searchParams} />

      <form action={saveBarData}>
        <div className="sc-tablewrap">
          <table className="sc-table">
            <thead>
              <tr><th>Bar size</th><th>Mass (kg/m)</th><th>Nominal Ø (mm)</th><th>Area (mm²)</th><th>Perimeter (mm)</th><th>On request</th><th>Order</th><th>Delete</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><input className="sc-input" name={`r${r.id}_bar_size`} defaultValue={r.bar_size} maxLength={12} required style={{ minWidth: 70, maxWidth: 100 }} /></td>
                  <td>{num(`r${r.id}_mass`, r.mass_kg_m)}</td>
                  <td>{num(`r${r.id}_dia`, r.nominal_diameter_mm)}</td>
                  <td>{num(`r${r.id}_area`, r.area_mm2)}</td>
                  <td>{num(`r${r.id}_perim`, r.perimeter_mm)}</td>
                  <td><input type="checkbox" name={`r${r.id}_on_request`} defaultChecked={!!r.on_request} aria-label={`${r.bar_size} on request`} /></td>
                  <td>{num(`r${r.id}_sort_order`, r.sort_order, '1')}</td>
                  <td><input type="checkbox" name={`r${r.id}_delete`} aria-label={`Delete ${r.bar_size}`} /></td>
                </tr>
              ))}
              {blank.map((i) => (
                <tr key={`n${i}`}>
                  <td><input className="sc-input" name={`n${i}_bar_size`} maxLength={12} placeholder="+ add" style={{ minWidth: 70, maxWidth: 100 }} /></td>
                  <td>{num(`n${i}_mass`)}</td>
                  <td>{num(`n${i}_dia`)}</td>
                  <td>{num(`n${i}_area`)}</td>
                  <td>{num(`n${i}_perim`)}</td>
                  <td><input type="checkbox" name={`n${i}_on_request`} aria-label="New size on request" /></td>
                  <td>{num(`n${i}_sort_order`, rows.length + i + 1, '1')}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sc-form-actions" style={{ marginTop: 18, borderTop: 0 }}>
          <button className="sc-btn sc-btn-primary" type="submit">Save bar data</button>
          <span className="sc-muted">Tick “Delete” to remove a row. Fill in a blank line at the bottom to add a size.</span>
        </div>
      </form>
    </>
  );
}
