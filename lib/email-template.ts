// The look of every email the site sends: ONE branded, responsive, table-based shell (inline CSS, 600px, Outlook-safe bulletproof
// buttons, dark-mode aware, hidden preheader) and three bodies on top of it — the owner's "New lead" notification, the optional
// customer auto-reply and the test message. Pure functions: no database, no network (the mailer + the Email page preview call them).
//
// SECURITY: every customer-provided string goes through esc()/escBr() and every href through mailUrl() (absolute http(s)/mailto/tel only).
import { DEFAULT_ACCENT, cleanHeader, esc, escBr, isHex, mailUrl, validEmail } from './mail-util';

export type LeadField = { label: string; value: string; long?: boolean };

export type SiteView = {
  name: string;
  /** Absolute site address without a trailing slash ('' when unknown) */
  base: string;
  logoUrl: string;
  accent: string;
  footer: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
};

export type LeadView = {
  /** Badge text: Contact / Quote / Newsletter / Calculator / the form's name */
  kindLabel: string;
  formName: string;
  submissionId: number | null;
  customer: { name: string; email: string; phone: string; company: string };
  fields: LeadField[];
  /** File names only — customer uploads are private and never attached */
  files: string[];
  /** Absolute page address the lead came from ('' when unknown) and its label */
  sourceUrl: string;
  sourceLabel: string;
  when: Date;
  /** Absolute link to the submission in the CMS ('' when the public address is unknown) */
  cmsUrl: string;
  /** Where the visitor came from, e.g. "google / cpc / spring-sale" ('' when untagged) */
  campaign?: string;
  /** A banner shown above everything (the test email) */
  notice?: string;
};

export type Rendered = { html: string; text: string; preheader: string };

// ------------------------------------------------------------------ palette
const NAVY = '#182845';
const INK = '#1F2937';
const MUTED = '#5B6676';
const LINE = '#E3E6EA';
const PANEL = '#F4F5F7';
const PANEL_LINE = '#DCDFE3';
const FONT = "'Segoe UI', Arial, Helvetica, sans-serif";

const accentOf = (s: SiteView) => (isHex(s.accent) ? s.accent : DEFAULT_ACCENT);

export function formatWhen(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' }).format(d);
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }
}

const firstNameOf = (name: string) => cleanHeader(name, 80).split(' ')[0] || '';

// ------------------------------------------------------------------ building blocks
function button(label: string, href: string, accent: string, outline = false, extraClass = ''): string {
  const url = mailUrl(href);
  if (!url) return '';
  const bg = outline ? 'bgcolor="#ffffff"' : `bgcolor="${accent}"`;
  const style = outline
    ? `background:#ffffff;border:2px solid ${accent};border-radius:6px;padding:10px 20px`
    : `background:${accent};border:2px solid ${accent};border-radius:6px;padding:10px 20px`;
  const color = outline ? accent : '#ffffff';
  return (
    `<table role="presentation" align="left" cellpadding="0" cellspacing="0" border="0" style="margin:0 10px 10px 0"><tr>` +
    `<td ${bg} align="center" class="btn${extraClass ? ` ${extraClass}` : ''}" style="${style};mso-padding-alt:10px 20px">` +
    `<a href="${esc(url)}" target="_blank" style="font-family:${FONT};font-size:15px;line-height:20px;font-weight:700;color:${color};text-decoration:none;display:inline-block">${esc(label)}</a>` +
    `</td></tr></table>`
  );
}

function logoBlock(site: SiteView): string {
  const logo = mailUrl(site.logoUrl);
  if (logo) {
    return `<img src="${esc(logo)}" alt="${esc(site.name)}" width="150" style="display:block;border:0;outline:none;text-decoration:none;width:150px;max-width:150px;height:auto;font-family:${FONT};font-size:20px;font-weight:800;color:#ffffff">`;
  }
  return `<span style="font-family:${FONT};font-size:22px;line-height:26px;font-weight:800;letter-spacing:2px;color:#ffffff;text-transform:uppercase">${esc(site.name)}</span>`;
}

function fieldRows(fields: LeadField[]): string {
  const short = fields.filter((f) => !f.long);
  const long = fields.filter((f) => f.long);
  let out = '';
  if (short.length) {
    out += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`;
    for (const f of short) {
      out +=
        `<tr><td class="stack lbl row" width="36%" valign="top" style="padding:10px 14px 10px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:13px;line-height:20px;font-weight:700;color:${MUTED}">${esc(f.label)}</td>` +
        `<td class="stack txt row" valign="top" style="padding:10px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:15px;line-height:22px;color:${INK};word-break:break-word">${escBr(f.value) || '<span style="color:#9AA3AF">—</span>'}</td></tr>`;
    }
    out += `</table>`;
  }
  for (const f of long) {
    out +=
      `<p class="lbl" style="margin:18px 0 6px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${MUTED}">${esc(f.label)}</p>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="box txt" bgcolor="#FAFAFB" style="background:#FAFAFB;border:1px solid ${LINE};border-radius:6px;padding:14px 16px;font-family:${FONT};font-size:15px;line-height:23px;color:${INK};word-break:break-word">${escBr(f.value)}</td></tr></table>`;
  }
  return out;
}

const HEAD_STYLE = `
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic}
  a{color:${NAVY}}
  @media (max-width:620px){
    .wrap{width:100% !important}
    .pad{padding:22px 18px !important}
    .stack{display:block !important;width:100% !important}
    .lbl.stack{padding:12px 0 0 !important;border-bottom:0 !important}
    .txt.stack{padding:2px 0 12px !important}
    .h1{font-size:24px !important;line-height:30px !important}
  }
  @media (prefers-color-scheme:dark){
    .bg{background:#0F1623 !important}
    .card{background:#19223A !important}
    .txt,.txt a{color:#E8ECF3 !important}
    .muted,.lbl{color:#A9B3C4 !important}
    .panel{background:#222D45 !important;border-color:#34425F !important}
    .row{border-color:#34425F !important}
    .box{background:#222D45 !important;border-color:#34425F !important}
    .lnk{color:#E0CBAE !important}
    .btn-navy{background:#3B5183 !important;border-color:#3B5183 !important}
    .foot,.foot a{color:#A9B3C4 !important}
  }`;

function shell(site: SiteView, o: { title: string; preheader: string; body: string; footerHtml: string }): string {
  const accent = accentOf(site);
  const filler = '&zwnj;&nbsp;'.repeat(40);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(o.title)}</title>
<style>${HEAD_STYLE}</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#EEF0F3" bgcolor="#EEF0F3">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#EEF0F3;opacity:0">${esc(o.preheader)}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" bgcolor="#EEF0F3" style="background:#EEF0F3"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="wrap" style="width:100%;max-width:600px">
<tr><td bgcolor="${NAVY}" class="pad" style="background:${NAVY};padding:22px 28px;border-radius:10px 10px 0 0">${logoBlock(site)}</td></tr>
<tr><td height="4" bgcolor="${accent}" style="height:4px;line-height:4px;font-size:0;background:${accent}">&nbsp;</td></tr>
<tr><td bgcolor="#FFFFFF" class="card pad" style="background:#FFFFFF;padding:28px;border-radius:0 0 10px 10px;font-family:${FONT};color:${INK}">
${o.body}
</td></tr>
<tr><td class="foot pad" style="padding:18px 28px 6px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED}" align="left">${o.footerHtml}</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

function footer(site: SiteView, reason: string): string {
  const bits = [esc(site.name)];
  if (site.address) bits.push(esc(cleanHeader(site.address, 200)));
  if (site.phone) bits.push(esc(cleanHeader(site.phone, 40)));
  const custom = site.footer ? `<br>${escBr(site.footer)}` : '';
  return `<strong>${bits.join(' · ')}</strong>${custom}<br>${reason}`;
}

const adminLink = (site: SiteView) => (site.base ? `${site.base}/admin` : '');

// ------------------------------------------------------------------ owner notification
export function renderOwnerEmail(site: SiteView, lead: LeadView): Rendered {
  const accent = accentOf(site);
  const c = lead.customer;
  const who = cleanHeader(c.name, 160) || cleanHeader(c.email, 200) || 'A new visitor';
  const hasEmail = validEmail(c.email);
  const replySubject = `Re: ${lead.formName ? `your ${cleanHeader(lead.formName, 80)} enquiry` : 'your enquiry'}`.slice(0, 120);
  const replyHref = hasEmail ? `mailto:${c.email}?subject=${encodeURIComponent(replySubject)}` : '';
  const phoneDigits = (c.phone || '').replace(/[^\d+]/g, '');
  const telHref = phoneDigits.length >= 5 ? `tel:${phoneDigits}` : '';
  const when = formatWhen(lead.when, site.timezone);

  const preheader = [who, hasEmail ? c.email : '', c.phone].filter(Boolean).join(' · ') + (lead.kindLabel ? ` — new ${lead.kindLabel.toLowerCase()} lead` : '');

  const lines: string[] = [];
  if (c.company) lines.push(`<div class="muted" style="font-size:15px;line-height:22px;color:${MUTED}">${esc(cleanHeader(c.company, 160))}</div>`);
  if (hasEmail) lines.push(`<div style="font-size:15px;line-height:24px"><a class="lnk" href="${esc(`mailto:${c.email}`)}" style="color:${NAVY};text-decoration:underline">${esc(c.email)}</a></div>`);
  if (c.phone) lines.push(`<div style="font-size:15px;line-height:24px">${telHref ? `<a class="lnk" href="${esc(telHref)}" style="color:${NAVY};text-decoration:underline">${esc(cleanHeader(c.phone, 40))}</a>` : esc(cleanHeader(c.phone, 40))}</div>`);

  const buttons =
    (hasEmail ? button(`Reply to ${firstNameOf(c.name) || 'customer'}`, replyHref, accent) : '') +
    (telHref ? button(`Call ${cleanHeader(c.phone, 40)}`, telHref, accent, true) : '');
  const noEmail = hasEmail
    ? ''
    : `<p class="muted" style="margin:12px 0 0;font-size:13px;line-height:19px;color:${MUTED}"><strong>No email address was provided</strong> — replying to this message won’t reach the customer${telHref ? ', but you can call them' : ''}.</p>`;

  const customerCard =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px"><tr>` +
    `<td class="panel" bgcolor="${PANEL}" style="background:${PANEL};border:1px solid ${PANEL_LINE};border-left:4px solid ${accent};border-radius:8px;padding:18px 20px">` +
    `<div class="muted" style="font-size:11px;line-height:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED}">Customer</div>` +
    `<div class="txt" style="margin:4px 0 6px;font-size:22px;line-height:28px;font-weight:800;color:${NAVY}">${esc(who)}</div>` +
    lines.join('') +
    (buttons ? `<div style="margin-top:14px">${buttons}<div style="clear:both;height:0;line-height:0;font-size:0">&nbsp;</div></div>` : '') +
    noEmail +
    `</td></tr></table>`;

  const files = lead.files.length
    ? `<p class="muted" style="margin:16px 0 0;font-size:13px;line-height:19px;color:${MUTED}"><strong>${lead.files.length} file${lead.files.length === 1 ? '' : 's'} attached by the customer</strong> (kept private, not included in this email): ${esc(lead.files.slice(0, 8).join(', '))}${lead.files.length > 8 ? '…' : ''}${lead.cmsUrl ? ' — open the lead in the CMS to download.' : ''}</p>`
    : '';

  const details: string[] = [];
  details.push(
    `<tr><td class="stack lbl row" width="36%" valign="top" style="padding:8px 14px 8px 0;border-bottom:1px solid ${LINE};font-size:13px;line-height:20px;font-weight:700;color:${MUTED}">Received</td><td class="stack txt row" valign="top" style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;line-height:20px;color:${INK}">${esc(when)}</td></tr>`
  );
  const src = mailUrl(lead.sourceUrl);
  if (src || lead.sourceLabel) {
    details.push(
      `<tr><td class="stack lbl row" width="36%" valign="top" style="padding:8px 14px 8px 0;border-bottom:1px solid ${LINE};font-size:13px;line-height:20px;font-weight:700;color:${MUTED}">Source page</td><td class="stack txt row" valign="top" style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;line-height:20px;color:${INK};word-break:break-all">` +
        (src ? `<a class="lnk" href="${esc(src)}" style="color:${NAVY}">${esc(cleanHeader(lead.sourceLabel || src, 160))}</a>` : esc(cleanHeader(lead.sourceLabel, 160))) +
        `</td></tr>`
    );
  }
  if (lead.campaign) {
    details.push(
      `<tr><td class="stack lbl row" width="36%" valign="top" style="padding:8px 14px 8px 0;border-bottom:1px solid ${LINE};font-size:13px;line-height:20px;font-weight:700;color:${MUTED}">Campaign</td><td class="stack txt row" valign="top" style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;line-height:20px;color:${INK};word-break:break-word">${esc(cleanHeader(lead.campaign, 200))}</td></tr>`
    );
  }
  if (lead.submissionId) {
    details.push(
      `<tr><td class="stack lbl row" width="36%" valign="top" style="padding:8px 14px 8px 0;font-size:13px;line-height:20px;font-weight:700;color:${MUTED}">Submission</td><td class="stack txt row" valign="top" style="padding:8px 0;font-size:14px;line-height:20px;color:${INK}">#${lead.submissionId}</td></tr>`
    );
  }

  const notice = lead.notice
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px"><tr><td bgcolor="#FFF7E6" style="background:#FFF7E6;border:1px solid #F0D9A8;border-radius:6px;padding:12px 14px;font-size:14px;line-height:20px;color:#6B4A00">${esc(lead.notice)}</td></tr></table>`
    : '';

  const cms = lead.cmsUrl ? `<div style="margin-top:24px">${button('View in the CMS', lead.cmsUrl, NAVY, false, 'btn-navy')}<div style="clear:both;height:0;line-height:0;font-size:0">&nbsp;</div></div>` : '';

  const body =
    notice +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${accent}" style="background:${accent};border-radius:999px;padding:4px 12px;font-size:12px;line-height:16px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#FFFFFF">${esc(cleanHeader(lead.kindLabel, 60) || 'Lead')}</td></tr></table>` +
    `<h1 class="h1 txt" style="margin:12px 0 0;font-size:28px;line-height:34px;font-weight:800;color:${NAVY};font-family:${FONT}">New lead</h1>` +
    `<p class="muted" style="margin:4px 0 0;font-size:15px;line-height:22px;color:${MUTED}">Someone just submitted <strong>${esc(cleanHeader(lead.formName, 120) || 'a form')}</strong> on your website.</p>` +
    customerCard +
    `<h2 class="txt" style="margin:26px 0 4px;font-size:16px;line-height:22px;font-weight:800;color:${NAVY};font-family:${FONT}">What they sent</h2>` +
    (lead.fields.length ? fieldRows(lead.fields) : `<p class="muted" style="margin:6px 0 0;font-size:14px;color:${MUTED}">No details were entered.</p>`) +
    files +
    `<h2 class="txt" style="margin:26px 0 4px;font-size:16px;line-height:22px;font-weight:800;color:${NAVY};font-family:${FONT}">Details</h2>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${details.join('')}</table>` +
    cms;

  const admin = adminLink(site);
  const reason = `You are receiving this because lead notifications are enabled at ${admin ? `<a href="${esc(admin)}" style="color:${MUTED}">${esc(admin.replace(/^https?:\/\//, ''))}</a>` : 'your website’s admin'}. Replying to this email writes to the customer.`;

  const html = shell(site, { title: `New lead — ${who}`, preheader, body, footerHtml: footer(site, reason) });

  // ---- plain text alternative (same information)
  const t: string[] = [];
  if (lead.notice) t.push(`*** ${lead.notice} ***`, '');
  t.push(`NEW LEAD — ${lead.kindLabel || 'Lead'}`, `${site.name}`, '', 'CUSTOMER', `  ${who}`);
  if (c.company) t.push(`  ${cleanHeader(c.company, 160)}`);
  if (hasEmail) t.push(`  Email: ${c.email}  (reply to this email to write to them)`);
  else t.push('  No email address was provided — replying will not reach the customer.');
  if (c.phone) t.push(`  Phone: ${cleanHeader(c.phone, 40)}`);
  t.push('', 'WHAT THEY SENT');
  for (const f of lead.fields) t.push(f.long || /\n/.test(f.value) ? `${f.label}:\n${f.value.split('\n').map((l) => `  ${l}`).join('\n')}` : `${f.label}: ${f.value || '—'}`);
  if (lead.files.length) t.push('', `Files from the customer (private, not attached): ${lead.files.join(', ')}`);
  t.push('', 'DETAILS', `Received: ${when}`);
  if (src || lead.sourceLabel) t.push(`Source page: ${src || lead.sourceLabel}`);
  if (lead.campaign) t.push(`Campaign: ${cleanHeader(lead.campaign, 200)}`);
  if (lead.submissionId) t.push(`Submission: #${lead.submissionId}`);
  if (lead.cmsUrl) t.push('', `View in the CMS: ${lead.cmsUrl}`);
  t.push('', `— ${site.name}${site.address ? ` · ${cleanHeader(site.address, 200)}` : ''}${site.phone ? ` · ${cleanHeader(site.phone, 40)}` : ''}`);
  t.push(`You are receiving this because lead notifications are enabled${admin ? ` at ${admin}` : ''}.`);

  return { html, text: t.join('\n'), preheader };
}

// ------------------------------------------------------------------ customer auto-reply
export type AutoReplyView = {
  customerName: string;
  formName: string;
  /** Plain text, already merged ({{name}} etc.) */
  message: string;
  /** Short recap of what the customer sent (label + value) */
  recap: LeadField[];
  when: Date;
  notice?: string;
};

export function renderAutoReply(site: SiteView, v: AutoReplyView): Rendered {
  const accent = accentOf(site);
  const first = firstNameOf(v.customerName);
  const preheader = `We’ve received your ${cleanHeader(v.formName, 80) || 'message'} — ${site.name}`;
  const recap = v.recap.slice(0, 10).map((f) => ({ ...f, value: f.value.length > 300 ? `${f.value.slice(0, 300)}…` : f.value }));
  const notice = v.notice
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px"><tr><td bgcolor="#FFF7E6" style="background:#FFF7E6;border:1px solid #F0D9A8;border-radius:6px;padding:12px 14px;font-size:14px;line-height:20px;color:#6B4A00">${esc(v.notice)}</td></tr></table>`
    : '';
  const home = site.base ? button(`Visit ${site.name}`, site.base, accent) : '';

  const body =
    notice +
    `<h1 class="h1 txt" style="margin:0;font-size:26px;line-height:32px;font-weight:800;color:${NAVY};font-family:${FONT}">${first ? `Thanks, ${esc(first)}!` : 'Thanks for getting in touch!'}</h1>` +
    `<p class="txt" style="margin:14px 0 0;font-size:16px;line-height:25px;color:${INK}">${escBr(v.message)}</p>` +
    (recap.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0"><tr><td class="panel" bgcolor="${PANEL}" style="background:${PANEL};border:1px solid ${PANEL_LINE};border-left:4px solid ${accent};border-radius:8px;padding:6px 20px 16px">` +
        `<p class="muted" style="margin:14px 0 0;font-size:11px;line-height:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED}">A copy of what you sent</p>${fieldRows(recap)}</td></tr></table>`
      : '') +
    (home ? `<div style="margin-top:24px">${home}<div style="clear:both;height:0;line-height:0;font-size:0">&nbsp;</div></div>` : '') +
    `<p class="muted" style="margin:18px 0 0;font-size:13px;line-height:19px;color:${MUTED}">This is an automatic confirmation. You can reply to this email if you’d like to add anything.</p>`;

  const reason = `You are receiving this because you submitted a form at ${site.base ? esc(site.base.replace(/^https?:\/\//, '')) : esc(site.name)}.`;
  const html = shell(site, { title: `We received your message — ${site.name}`, preheader, body, footerHtml: footer(site, reason) });

  const t: string[] = [];
  if (v.notice) t.push(`*** ${v.notice} ***`, '');
  t.push(first ? `Thanks, ${first}!` : 'Thanks for getting in touch!', '', v.message);
  if (recap.length) {
    t.push('', 'A COPY OF WHAT YOU SENT');
    for (const f of recap) t.push(f.long || /\n/.test(f.value) ? `${f.label}:\n${f.value.split('\n').map((l) => `  ${l}`).join('\n')}` : `${f.label}: ${f.value || '—'}`);
  }
  t.push('', 'This is an automatic confirmation. You can reply to this email if you’d like to add anything.', '', `— ${site.name}${site.address ? ` · ${cleanHeader(site.address, 200)}` : ''}${site.phone ? ` · ${cleanHeader(site.phone, 40)}` : ''}`);
  return { html, text: t.join('\n'), preheader };
}

// ------------------------------------------------------------------ sample data (test email + the Email page preview)
export function sampleLead(site: SiteView): LeadView {
  return {
    kindLabel: 'Quote',
    formName: 'Quote request',
    submissionId: 1234,
    customer: { name: 'Jordan Rivera', email: 'jordan.rivera@example.com', phone: '(416) 555-0148', company: 'Northline Construction' },
    fields: [
      { label: 'Project location', value: 'Mississauga, ON' },
      { label: 'Sector', value: 'Commercial' },
      { label: 'Need', value: 'Supply and fabrication' },
      { label: 'Materials', value: '• 15M × 120\n• 20M × 60', long: true },
      { label: 'Notes', value: 'Hi — we need delivery by the end of the month. Drawings attached.\nCould you also quote cut & bend?', long: true },
    ],
    files: ['L2-bar-list.pdf'],
    sourceUrl: site.base ? `${site.base}/quote` : '',
    sourceLabel: '/quote',
    when: new Date(),
    cmsUrl: site.base ? `${site.base}/admin/submissions/1234` : '',
  };
}

export function sampleAutoReply(site: SiteView, message: string): AutoReplyView {
  const l = sampleLead(site);
  return { customerName: l.customer.name, formName: l.formName, message, recap: l.fields, when: l.when };
}
