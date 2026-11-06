import type { Metadata } from 'next';
import Link from 'next/link';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import MediaField from '@/components/admin/MediaField';
import { SettingsPalette } from '@/components/admin/SettingsPalette';
import { requireCap } from '@/lib/auth';
import { PALETTE } from '@/lib/builder/schema.mjs';
import { getSetting } from '@/lib/db';
import { SITE_DEFAULTS, getPalette, getSiteSettings } from '@/lib/settings';
import { saveSettings } from '../../settings/actions';
import '../../css/settings.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings' };

export default async function Settings({ searchParams }: { searchParams: Promise<FlashParams> }) {
  await requireCap('manage_settings');
  const smtp = !!process.env.SMTP_HOST;
  const s = getSiteSettings();
  const palette = getPalette(); // saved list, or the built-in palette when none is saved

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Settings</h1>
          <p>Site identity, contact details, search / social defaults, brand colours, form notifications and diagrams.</p>
        </div>
      </div>

      <Flash params={await searchParams} />

      <form action={saveSettings} className="sc-stack">
        <section className="sc-card sc-form" aria-labelledby="set-identity">
          <h2 id="set-identity" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Site identity</h2>
          <div className="sc-field">
            <label htmlFor="site_title">Site title</label>
            <input className="sc-input" id="site_title" name="site_title" defaultValue={s.site_title} placeholder={SITE_DEFAULTS.title} maxLength={80} />
            <span className="sc-help">Used in the browser tab: “Page name | Site title”.</span>
          </div>
          <div className="sc-field">
            <label htmlFor="site_tagline">Tagline</label>
            <input className="sc-input" id="site_tagline" name="site_tagline" defaultValue={s.site_tagline} placeholder={SITE_DEFAULTS.tagline} maxLength={160} />
            <span className="sc-help">Shown after the title on the home page.</span>
          </div>
          <div className="sc-field"><MediaField name="site_logo__pick" defaultValue={s.site_logo} kind="image" label="Logo" help="Available to headers and other widgets." /></div>
          <div className="sc-field"><MediaField name="site_favicon__pick" defaultValue={s.site_favicon} kind="image" label="Favicon (browser tab icon)" help={`Square image, ideally 64×64 or larger. Default: ${SITE_DEFAULTS.favicon}`} /></div>
        </section>

        <section className="sc-card sc-form" aria-labelledby="set-contact">
          <h2 id="set-contact" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Contact details</h2>
          <div className="sc-field"><label htmlFor="contact_phone">Phone</label><input className="sc-input" id="contact_phone" name="contact_phone" defaultValue={s.contact_phone} maxLength={40} placeholder="(905) 555-0100" /></div>
          <div className="sc-field"><label htmlFor="contact_email">Email</label><input className="sc-input" id="contact_email" name="contact_email" type="email" defaultValue={s.contact_email} maxLength={200} placeholder="sales@dassrebar.com" /></div>
          <div className="sc-field is-wide"><label htmlFor="contact_address">Address</label><textarea className="sc-textarea" id="contact_address" name="contact_address" defaultValue={s.contact_address} rows={3} maxLength={400} /></div>
        </section>

        <section className="sc-card" aria-labelledby="set-seo">
          <h2 id="set-seo">Search &amp; social</h2>
          <p className="sc-muted" style={{ margin: 0 }}>
            The default description, social sharing image, title format, business profile, crawler rules and llms.txt now live under{' '}
            <Link href="/admin/seo" className="sc-rowlink">SEO &amp; AI</Link>. Tracking IDs and custom code are under <Link href="/admin/tracking" className="sc-rowlink">Tracking &amp; code</Link>.
          </p>
        </section>

        <section className="sc-card" aria-labelledby="set-design">
          <h2 id="set-design">Design — brand colours</h2>
          <p className="sc-muted" style={{ margin: '0 0 14px' }}>These swatches appear in every colour control of the page builder.</p>
          <SettingsPalette initial={palette} defaults={PALETTE as [string, string][]} />
        </section>

        <section className="sc-card sc-form" aria-labelledby="set-mail">
          <h2 id="set-mail" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Form notifications</h2>
          <div className={`sc-flash ${smtp ? 'sc-flash-ok' : 'sc-flash-warn'}`} style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
            {smtp
              ? 'Email is set up on this server (SMTP). New submissions are emailed to the addresses below.'
              : 'Email isn’t set up on this server yet (SMTP_HOST is empty), so notifications are not sent. Submissions are still saved under “Submissions”. See the README for the four lines to add.'}
          </div>
          <div className="sc-field is-wide">
            <label htmlFor="notify_emails">Send new submissions to</label>
            <input className="sc-input" id="notify_emails" name="notify_emails" defaultValue={getSetting('notify_emails')} maxLength={300} placeholder="sales@dassrebar.com, estimating@dassrebar.com" />
            <span className="sc-help">Comma-separated. Requires SMTP to be configured on the server (see README); submissions are always saved here either way.</span>
          </div>
        </section>

        <section className="sc-card sc-form" aria-labelledby="set-diagrams">
          <h2 id="set-diagrams" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Bar data diagrams</h2>
          <div className="sc-field"><MediaField name="bar_diagram_nominal__pick" defaultValue={getSetting('bar_diagram_nominal')} kind="image" label="Diagram 1 — nominal diameter" /></div>
          <div className="sc-field"><MediaField name="bar_diagram_side__pick" defaultValue={getSetting('bar_diagram_side')} kind="image" label="Diagram 2 — deformed bar side view" /></div>
          <div className="sc-field"><MediaField name="bar_diagram_actual__pick" defaultValue={getSetting('bar_diagram_actual')} kind="image" label="Diagram 3 — actual (overall) diameter" /></div>
        </section>

        <div className="sc-settings-save">
          <button className="sc-btn sc-btn-primary" type="submit">Save settings</button>
        </div>
      </form>
    </>
  );
}
