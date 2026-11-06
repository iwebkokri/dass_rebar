// Kept for the callers that only need a plain notice to the site owner (e.g. a blog comment waiting for moderation).
// LEADS (contact, quote, newsletter, custom forms …) are emailed by lib/mailer.ts → notifyLead().
// SMTP settings come from the Studio CMS Email page (or the SMTP_* / NOTIFY_EMAIL environment variables as a fallback).
import { sendSystemNotice } from './mailer';

export const sendNotification = (subject: string, text: string, replyTo?: string): Promise<void> => sendSystemNotice(subject, text, replyTo);
