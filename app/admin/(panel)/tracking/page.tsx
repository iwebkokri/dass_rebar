import type { Metadata } from 'next';
import TrackingForm from '@/components/admin/TrackingForm';
import { requireCap } from '@/lib/auth';
import { getTracking } from '@/lib/tracking';
import { activeTrackers } from '@/lib/tracking-core.mjs';
import '../../css/settings.css';
import '../../css/seo.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tracking & code' };

export default async function TrackingPage() {
  await requireCap('manage_code');
  const t = getTracking();
  const active = activeTrackers(t) as string[];

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Tracking &amp; code</h1>
          <p>Google Analytics, Tag Manager, ad pixels, and your own CSS and scripts for the header and footer of the public site.</p>
        </div>
      </div>

      <div className="se-trk-sum" aria-label="Active trackers">
        {active.length ? active.map((a) => (<span key={a} className="sc-badge sc-badge-ok">{a} on</span>)) : <span className="sc-badge">No trackers set</span>}
        {t.skipUsers ? <span className="sc-badge">signed-in users excluded</span> : <span className="sc-badge sc-badge-warn">signed-in users are tracked</span>}
      </div>

      <TrackingForm
        initial={{
          ga4: t.ga4, gtm: t.gtm, ads: t.ads, ads_label: t.ads_label, meta: t.meta, linkedin: t.linkedin, tiktok: t.tiktok, clarity: t.clarity,
          skipUsers: t.skipUsers, code_css: t.css, code_head: t.head, code_body: t.body, code_footer: t.footer,
        }}
      />
    </>
  );
}
