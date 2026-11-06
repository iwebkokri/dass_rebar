// Lead Manager configuration. BOTH the webhook URL (it contains a secret token) and the optional API key are secrets: encrypted at rest
// with the same AES-256-GCM key as the SMTP password, never sent back to the browser, never logged, never exported.
// Stored in the settings table under keys that match SECRET_KEY (lib/settings.ts) so exports skip them.
import { getSetting, setSetting } from './db';
import { decryptSecret, encryptSecret } from './mail-settings';
import { maskUrl, urlHost, validateWebhookUrl } from './lm-url.mjs';

/** Local-testing switch only (the owner never sets it): allows http:// and loopback / private hosts. */
export const allowInsecure = () => process.env.LEADMANAGER_ALLOW_INSECURE === '1';

export type LmTypes = { contact: boolean; quote: boolean; calculator: boolean; newsletter: boolean };
/** Which BUILT-IN forms are forwarded. Everything is forwarded by default — including newsletter sign-ups (the footer form is the only form on many pages). */
export const DEFAULT_TYPES: LmTypes = { contact: true, quote: true, calculator: true, newsletter: true };
export const LM_TYPE_LABEL: Record<keyof LmTypes, string> = {
  contact: 'Contact form',
  quote: 'Quote request (quote wizard)',
  calculator: 'Weight calculator leads',
  newsletter: 'Newsletter sign-ups (footer and popups)',
};

const K = {
  url: 'integration_secret_lm_url',
  key: 'integration_secret_lm_key',
  enabled: 'integration_lm_enabled',
  skipStaff: 'integration_lm_skip_staff',
  types: 'integration_lm_types',
} as const;

export type LmConfig = {
  source: 'admin' | 'env' | 'none';
  /** Switch on (default) — a URL that is saved but switched off is not used. */
  enabled: boolean;
  /** SECRET — full webhook URL. Server side only; never pass this to a component or put it in a message. */
  url: string;
  /** SECRET — optional bearer key ('' = no Authorization header). */
  key: string;
  host: string;
  masked: string;
  hasKey: boolean;
  skipStaff: boolean;
  types: LmTypes;
  /** URL valid + switched on: leads are being forwarded. */
  configured: boolean;
  problems: string[];
  /** A saved URL / key exists but cannot be decrypted on this server (key file lost). */
  unreadable: boolean;
  /** Where the secret values come from, for the status text. */
  envUrl: boolean;
  envKey: boolean;
};

function readTypes(): LmTypes {
  try {
    const raw = JSON.parse(getSetting(K.types) || '{}');
    return {
      contact: raw.contact !== false,
      quote: raw.quote !== false,
      calculator: raw.calculator !== false,
      newsletter: raw.newsletter !== false, // a missing value means ON
    };
  } catch {
    return { ...DEFAULT_TYPES };
  }
}

export function getLmConfig(): LmConfig {
  const encUrl = getSetting(K.url);
  const encKey = getSetting(K.key);
  const envUrl = (process.env.LEADMANAGER_URL || '').trim();
  const envKey = (process.env.LEADMANAGER_KEY || '').trim();

  const adminUrl = encUrl ? decryptSecret(encUrl) : '';
  const adminKey = encKey ? decryptSecret(encKey) : '';
  const unreadable = (!!encUrl && !adminUrl) || (!!encKey && !adminKey);

  const url = adminUrl || (!encUrl ? envUrl : '');
  const key = adminKey || (!encKey ? envKey : '');
  const source: LmConfig['source'] = adminUrl ? 'admin' : url ? 'env' : 'none';
  const enabled = getSetting(K.enabled) !== '0';

  const problems: string[] = [];
  let valid = false;
  if (unreadable) problems.push('The saved Lead Manager address can no longer be read on this server — enter it again.');
  else if (!url) problems.push('No Lead Manager webhook address is set.');
  else {
    const v = validateWebhookUrl(url, { allowInsecure: allowInsecure() });
    if (!v.ok) problems.push(v.error || 'The webhook address is not valid.');
    else valid = true;
  }
  if (valid && !enabled) problems.push('Forwarding to Lead Manager is switched off.');

  return {
    source,
    enabled,
    url,
    key,
    host: url ? urlHost(url) : '',
    masked: url ? maskUrl(url) : '',
    hasKey: !!key,
    skipStaff: getSetting(K.skipStaff) === '1', // OFF unless the administrator ticks the box: staff submissions are forwarded too
    types: readTypes(),
    configured: valid && enabled,
    problems,
    unreadable,
    envUrl: source === 'env',
    envKey: !encKey && !!envKey,
  };
}

export type LmInput = {
  enabled: boolean;
  skipStaff: boolean;
  types: LmTypes;
  /** '' = keep the saved one */
  url: string;
  clearUrl: boolean;
  key: string;
  clearKey: boolean;
};

/** Validate + store. The returned text is safe to show: it never contains the URL or the key. */
export function saveLmSettings(i: LmInput): { ok: boolean; error?: string } {
  let newUrl: string | null = null;
  if (i.url.trim()) {
    const v = validateWebhookUrl(i.url, { allowInsecure: allowInsecure() });
    if (!v.ok) return { ok: false, error: v.error };
    newUrl = v.url as string;
  }
  const key = i.key.trim();
  if (key && !/^[\x21-\x7e]{1,300}$/.test(key)) return { ok: false, error: 'The API key may only contain visible characters (no spaces) and must be under 300 characters.' };

  setSetting(K.enabled, i.enabled ? '1' : '0');
  setSetting(K.skipStaff, i.skipStaff ? '1' : '0');
  setSetting(K.types, JSON.stringify({ contact: !!i.types.contact, quote: !!i.types.quote, calculator: !!i.types.calculator, newsletter: !!i.types.newsletter }));
  if (i.clearUrl) setSetting(K.url, '');
  else if (newUrl) setSetting(K.url, encryptSecret(newUrl));
  if (i.clearKey) setSetting(K.key, '');
  else if (key) setSetting(K.key, encryptSecret(key));
  return { ok: true };
}
