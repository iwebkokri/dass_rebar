// Mail provider presets for the Email page (client-safe: no node imports).
export type MailSecurity = 'ssl' | 'starttls' | 'none';

export const SECURITY_LABEL: Record<MailSecurity, string> = {
  ssl: 'SSL / TLS (usually port 465)',
  starttls: 'STARTTLS (usually port 587)',
  none: 'None (port 25 / local relay only)',
};

export type MailPreset = { id: string; label: string; host: string; port: number; security: MailSecurity; user?: string; note: string };

export const MAIL_PRESETS: MailPreset[] = [
  {
    id: 'hostinger', label: 'Hostinger', host: 'smtp.hostinger.com', port: 465, security: 'ssl',
    note: 'Create a mailbox in hPanel → Emails (e.g. leads@yourdomain.com). The username is the full mailbox address; the password is the mailbox password. Use the same address as the From address.',
  },
  {
    id: 'gmail', label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 465, security: 'ssl',
    note: 'Needs an App Password (Google Account → Security → 2-Step Verification → App passwords). Your normal password will not work. Gmail rewrites the From address to the signed-in account.',
  },
  {
    id: 'microsoft365', label: 'Microsoft 365', host: 'smtp.office365.com', port: 587, security: 'starttls',
    note: 'SMTP AUTH must be enabled for the mailbox in the Microsoft 365 admin centre. The From address must be that mailbox (or one it may send as).',
  },
  {
    id: 'sendgrid', label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, security: 'starttls', user: 'apikey',
    note: 'The username is the word apikey; the password is your SendGrid API key. The From address must be a verified sender or domain.',
  },
  {
    id: 'mailgun', label: 'Mailgun', host: 'smtp.mailgun.org', port: 587, security: 'starttls',
    note: 'Use the SMTP credentials of your Mailgun sending domain (Sending → Domain settings → SMTP credentials).',
  },
  { id: 'custom', label: 'Custom SMTP server', host: '', port: 587, security: 'starttls', note: 'Enter the host, port and security your mail provider documents.' },
];

export const presetById = (id: string) => MAIL_PRESETS.find((p) => p.id === id);
