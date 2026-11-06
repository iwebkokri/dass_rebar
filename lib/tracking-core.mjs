// Tracking IDs: strict validators and the vendors' standard snippets. Pure (no database, no Next) so it can be unit-tested.
//
// Every ID is checked against a tight pattern BEFORE it is stored and again before it is used, so a stored value can
// never carry script into the page; snippets embed IDs with JSON.stringify as well.

export const TRACKER_FIELDS = [
  { key: 'ga4', label: 'Google Analytics 4 — Measurement ID', placeholder: 'G-XXXXXXXXXX', re: /^G-[A-Z0-9]{6,14}$/, fold: 'upper', help: 'Admin → Data streams → your web stream. Starts with G-.' },
  { key: 'gtm', label: 'Google Tag Manager — Container ID', placeholder: 'GTM-XXXXXXX', re: /^GTM-[A-Z0-9]{4,10}$/, fold: 'upper', help: 'Starts with GTM-. Also adds the noscript fallback right after <body>.' },
  { key: 'ads', label: 'Google Ads / Google tag — ID', placeholder: 'AW-123456789', re: /^AW-\d{6,13}$/, fold: 'upper', help: 'Starts with AW-. Loads the Google tag (gtag.js).' },
  { key: 'ads_label', label: 'Google Ads — conversion label (optional)', placeholder: 'AbC-D_efG123', re: /^[A-Za-z0-9_-]{6,40}$/, fold: 'none', help: 'Optional. Sent as a conversion each time a form on the site is submitted successfully.' },
  { key: 'meta', label: 'Meta (Facebook) Pixel — Pixel ID', placeholder: '123456789012345', re: /^\d{6,20}$/, fold: 'none', help: 'Digits only. Tracks PageView, and Lead when a form is submitted.' },
  { key: 'linkedin', label: 'LinkedIn Insight Tag — Partner ID', placeholder: '1234567', re: /^\d{4,12}$/, fold: 'none', help: 'Digits only.' },
  { key: 'tiktok', label: 'TikTok Pixel — Pixel ID', placeholder: 'C1ABCDEFGHIJKLMNOP', re: /^[A-Z0-9]{8,30}$/, fold: 'upper', help: 'Letters and digits.' },
  { key: 'clarity', label: 'Microsoft Clarity — Project ID', placeholder: 'abcdefghij', re: /^[a-z0-9]{6,20}$/, fold: 'lower', help: 'Letters and digits.' },
];

export const TRACKING_KEYS = TRACKER_FIELDS.map((f) => f.key);

/** The settings-table key for a tracker field. */
export const trackKey = (k) => `track_${k}`;

/** Validate form input. Returns the cleaned values (empty string = not set) and one message per rejected field. */
export function validateTracking(input) {
  const values = {};
  const errors = {};
  for (const f of TRACKER_FIELDS) {
    let v = String(input?.[f.key] ?? '').trim();
    if (f.fold === 'upper') v = v.toUpperCase();
    else if (f.fold === 'lower') v = v.toLowerCase();
    if (!v) { values[f.key] = ''; continue; }
    if (!f.re.test(v)) { errors[f.key] = `“${v.slice(0, 40)}” is not a valid ${f.label.split(' — ')[0]} ID. Expected something like ${f.placeholder}.`; values[f.key] = ''; continue; }
    values[f.key] = v;
  }
  return { values, errors };
}

/** Re-check a stored value (defence in depth: settings can also arrive through an import). Returns '' when it doesn't pass. */
export function trustedId(key, value) {
  const f = TRACKER_FIELDS.find((x) => x.key === key);
  const v = String(value ?? '').trim();
  return f && f.re.test(v) ? v : '';
}

const q = (s) => JSON.stringify(String(s)); // safe JS string literal (IDs are already pattern-checked)

/** Listens for the site's form-success event and forwards it to whichever trackers are loaded. */
function conversionScript(t) {
  const sendTo = t.ads && t.ads_label ? q(`${t.ads}/${t.ads_label}`) : 'null';
  return (
    `window.addEventListener('dr:form-success',function(e){var d=(e&&e.detail)||{};var f=d.form||'form';` +
    `try{if(window.gtag){gtag('event','generate_lead',{form_name:f});var s=${sendTo};if(s)gtag('event','conversion',{send_to:s});}}catch(_){}` +
    `try{if(window.fbq)fbq('track','Lead');}catch(_){}` +
    `try{if(window.ttq)ttq.track('SubmitForm');}catch(_){}` +
    `try{if(window.dataLayer)dataLayer.push({event:'dr_form_success',form_name:f});}catch(_){}` +
    `});`
  );
}

/** Built-in trackers as head elements ({tag, attrs, text}) — same shape the snippet tokenizer returns. */
export function trackerHeadNodes(t) {
  const nodes = [];
  const any = t.ga4 || t.ads;
  if (any) {
    nodes.push({ tag: 'script', attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(t.ga4 || t.ads)}` } });
    let cfg = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());`;
    if (t.ga4) cfg += `gtag('config',${q(t.ga4)});`;
    if (t.ads) cfg += `gtag('config',${q(t.ads)});`;
    nodes.push({ tag: 'script', attrs: {}, text: cfg });
  }
  if (t.gtm) {
    nodes.push({
      tag: 'script', attrs: {},
      text: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${q(t.gtm)});`,
    });
  }
  if (t.meta) {
    nodes.push({
      tag: 'script', attrs: {},
      text: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${q(t.meta)});fbq('track','PageView');`,
    });
  }
  if (t.linkedin) {
    nodes.push({
      tag: 'script', attrs: {},
      text: `_linkedin_partner_id=${q(t.linkedin)};window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName('script')[0];var b=document.createElement('script');b.type='text/javascript';b.async=true;b.src='https://snap.licdn.com/li.lms-analytics/insight.min.js';s.parentNode.insertBefore(b,s);})(window.lintrk);`,
    });
  }
  if (t.tiktok) {
    nodes.push({
      tag: 'script', attrs: {},
      text: `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(${q(t.tiktok)});ttq.page();}(window,document,'ttq');`,
    });
  }
  if (t.clarity) {
    nodes.push({
      tag: 'script', attrs: {},
      text: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${q(t.clarity)});`,
    });
  }
  if (nodes.length) nodes.push({ tag: 'script', attrs: {}, text: conversionScript(t) });
  return nodes;
}

/** Raw HTML that must sit right after <body> (noscript fallbacks of GTM, Meta Pixel and LinkedIn). IDs are pattern-checked. */
export function trackerBodyHtml(t) {
  const parts = [];
  if (t.gtm) parts.push(`<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(t.gtm)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`);
  if (t.meta) parts.push(`<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${encodeURIComponent(t.meta)}&amp;ev=PageView&amp;noscript=1"></noscript>`);
  if (t.linkedin) parts.push(`<noscript><img height="1" width="1" style="display:none" alt="" src="https://px.ads.linkedin.com/collect/?pid=${encodeURIComponent(t.linkedin)}&amp;fmt=gif"></noscript>`);
  return parts.join('');
}

/** Which trackers are active (for the admin screen's summary). */
export function activeTrackers(t) {
  return TRACKER_FIELDS.filter((f) => f.key !== 'ads_label' && t[f.key]).map((f) => f.label.split(' — ')[0]);
}
