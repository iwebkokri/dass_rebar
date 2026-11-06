# Popups, forms, lead emails and Lead Manager

Everything in this guide lives in the Studio CMS (`/admin`). Nothing here needs a developer once the site is deployed.

| Where | What it does |
|---|---|
| **Forms** | Build enquiry forms from templates (Contact, Quote, Callback, Newsletter, Feedback, Blank) and place them on pages or in popups |
| **Popups** | Modals, slide-ins and bars with triggers, display rules and "how often" controls |
| **Email** | Where every new lead is emailed, how those emails look, and a log of everything sent |
| **Lead Manager** | Every enquiry is also recorded in your lead-management software (a webhook), with a delivery log |

All four share one rule: **a customer's enquiry is saved first** (Submissions). Email and Lead Manager happen afterwards, independently of each other, and neither can fail or slow down the visitor's form.

---

## 1. Lead emails

**Admin → Email** (administrators only).

### What the owner receives
* **To** – the address(es) under *Send every new lead to* (up to 10). A form can override this (Forms → *Email*).
* **From** – `"Customer name via Dass Rebar" <leads@yourdomain.com>`: your own authenticated address, so the mail is delivered and SPF / DKIM / DMARC pass. The customer's address is deliberately *not* in From (providers reject or spam-folder that).
* **Reply-To** – the customer's own address. **Pressing Reply — for the owner or anyone on the team — writes straight to the customer.** If the customer gave no email, there is no Reply-To and the email says so.
* A designed, responsive email (works in Gmail, Outlook, Apple Mail; dark-mode aware): customer card with **Reply** and **Call** buttons, everything they submitted as a table, the page (or popup) they were on, the campaign they came from, the time in your time zone, and a **View in the CMS** button.
* Customer **file uploads are never attached** (they are private); the email lists their names and links to the lead in the CMS.
* Everything a customer typed is escaped; line breaks in names / subjects are stripped, so nobody can inject mail headers.

### Setting it up
1. **Email → Settings**, pick your provider (it fills host / port / security) and enter the login.

   | Provider | Host · port · security | Notes |
   |---|---|---|
   | **Hostinger** | `smtp.hostinger.com` · 465 · SSL | Create a mailbox in hPanel → *Emails* (e.g. `leads@yourdomain.com`). Username = the full address; use the same address as From. |
   | Gmail / Workspace | `smtp.gmail.com` · 465 · SSL | Needs an **App Password** (Google Account → Security → 2-Step Verification → App passwords). |
   | Microsoft 365 | `smtp.office365.com` · 587 · STARTTLS | SMTP AUTH must be enabled for the mailbox. |
   | SendGrid | `smtp.sendgrid.net` · 587 · STARTTLS | Username `apikey`, password = the API key; the From address must be a verified sender. |
   | Mailgun | `smtp.mailgun.org` · 587 · STARTTLS | Use the domain's SMTP credentials. |
2. Set **From address** and **Send every new lead to**. Save.
3. Press **Send test email**. If anything is wrong you see the mail server's exact answer. (Wrong password → `535 … authentication failed`.)

The SMTP password is stored **encrypted** (AES-256-GCM, key from `APP_SECRET` / `SECRET_KEY` if set, else a key file in `DATA_DIR/private/mail.key`), is never sent back to the browser, and is never exported. If you move the database to another server, move `DATA_DIR/private/` with it — otherwise the saved password can't be read and you simply enter it again.

**Environment fallback** (used only while the Email page has no server saved): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `NOTIFY_EMAIL`. Set `SITE_URL=https://yourdomain` too — it is used for the links inside emails.

### Per-form options (Forms → a form → *Email*)
Administrators can set a different recipient list, a subject (merge tags `{form} {name} {email} {phone} {company} {site} {id}`), switch the owner email off, or enable a **customer auto-reply** (default off; sent only if the visitor typed a valid address; `{{name}} {{first_name}} {{form}} {{site}}` merge tags; replies to it come to the owner). Editors can build forms but cannot change recipients or the auto-reply.

### Delivery, retries and the log
Every email is a row in **Email → Email log**. A failure is retried automatically after **1 minute** and **10 minutes**; after that it stays *failed* with the error and a **Resend** button. The dashboard shows a banner when email is not set up ("Leads are saved, but no email is sent") or when recent emails failed. Retries live in memory; after a restart the app re-arms them from the log at boot.

### Deliverability checklist
* Send from an address **on your own domain** and make sure the domain has **SPF**, **DKIM** and **DMARC** records (Hostinger: hPanel → *Emails* → *DNS / Email authentication*).
* Use the mailbox you log in with as the From address. Gmail and Microsoft rewrite From to the signed-in account.
* Auto-replies go to addresses typed by visitors — keep the text neutral and never include private data.

### Privacy
Lead emails contain what the visitor typed, so they pass through your mail provider. Visitor IP addresses are never stored or emailed. Submissions themselves stay in your database until you delete them.

---

## 2. Forms

**Admin → Forms → New form.** Start from a template, then change anything.

* **Field types:** short text, email, phone, long text, dropdown, radio buttons, checkbox, checkboxes (several), consent checkbox, number, date, file upload (existing limits: 10 MB each, 5 per submission), hidden value (the value always comes from the form, never from the browser). Each field has a label, placeholder, help text, required, and half/full width.
* **Use this answer as the customer's…** (name / email / phone / company / message) tells the CMS list, the lead email and Lead Manager which answer is which, instead of guessing from the label. An Email field mapped to *Email* is the address replies go to.
* **After sending:** submit-button label, success message, or a redirect address.
* **Place it:** page builder → *Dynamic* → **Custom form** → pick the form. The same widget works **inside a popup**. The form's screen lists everywhere it is used (pages, header/footer, popups).
* **Submissions** shows which form and which page (or popup) every lead came from, the campaign, the email delivery and the Lead Manager delivery.

---

## 3. Popups

**Admin → Popups.** *New popup* offers: Newsletter signup, Get a quote (with a form — created for you), Announcement bar, Exit-intent offer, Blank. A popup is built in the **page builder** (same sections, rows, columns and widgets; the canvas draws it as the popup). Popups are created **switched off**; they appear only after you press **Activate**. Three example popups are seeded switched off (`npm run seed -- --only=popups`).

### Settings (builder → *Popup* tab)
* **Type:** centered modal, slide-in (bottom right / left), bar (top / bottom), full screen. Width (px or %), maximum height, background, overlay colour and opacity, corner radius, shadow, close-button style and position, entrance animation (fade / slide / zoom / none — switched off for visitors who prefer reduced motion), layer (z-index).
* **When it appears (any combination — the first that happens wins):**

  | Trigger | Meaning |
  |---|---|
  | After the page has loaded | N seconds |
  | When the visitor scrolls | N % of the page |
  | Exit intent | the mouse leaves through the top of the window (desktop only) |
  | After inactivity | N seconds without mouse, keyboard, scroll or touch |
  | From page view number | e.g. the 2nd page of a visit |
  | Click | any link or button whose address is **`#popup:<link-name>`** (or `#dr-popup-<id>`); in a link's settings choose **Popup action → Open popup / Close the popup**. Opening the page with `#popup:<link-name>` in the address works too. |
* **Where and for whom:** every page / home only / only these pages / every page except these (one address per line, `*` is a wildcard: `/products*`), devices (desktop / tablet / mobile), everyone or signed-out visitors only, start and end date (UTC).
* **How often:** every time · once per visit · once per visitor ever · again after N days once closed — plus *never again once the visitor sent a form in it*, *close by itself after N seconds*, *close N seconds after a form is sent*.

### How it behaves
The server sends a page only the popups that are **active, inside their schedule, allowed on that page and for that visitor** — drafts and excluded popups are not in the HTML at all. The browser then applies triggers, device and frequency (remembered in the visitor's browser). Closing: ✕ button, **Esc**, click outside (modal types). Modal popups lock page scrolling, move focus inside, keep Tab inside, and give focus back to the link that opened them (`role="dialog"`, `aria-modal`, labelled by the popup's heading). Bars and slide-ins are non-modal. A form inside a popup shows its "thank you" message in the popup, can close it after a few seconds, and is recorded with the popup's name.

Popups never appear in `/admin`, in the builder canvas of a normal page, in `llms.txt` or in the sitemap.

**Preview a draft:** *Popups → Preview* (or the builder's Preview button) opens the site with `?popup-preview=<id>`. This works **only for signed-in staff**; for visitors the same address shows nothing.

---

## 4. Lead Manager

**Admin → Lead Manager** (administrators only). Every customer enquiry is also sent to your Lead Manager webhook — one `POST` per lead, from the server, over **HTTPS**.

### Set up
1. In Lead Manager, copy the **webhook address** for your brand (it ends with a secret token, e.g. `https://leadmanager.example.com/api/webhooks/custom/<token>`).
2. **Lead Manager → Settings:** paste it, add an **API key** only if Lead Manager gave you one (the `Authorization: Bearer …` header is sent only when a key is saved), keep *Send new enquiries to Lead Manager* ticked, **Save**.
3. Press **Send test lead**. It sends one real lead named *Test Person (website test)* with the form name *Admin test* and shows Lead Manager's HTTP status and answer. Delete it in Lead Manager afterwards.

Both the address and the key are **secrets**: stored encrypted, never shown again (only the host is), never logged, never exported, redacted from error messages.

### What is sent — and what is forwarded by default
Everything is forwarded by default, from every form on the site:

| Source | Forwarded by default? | Where to change it |
|---|---|---|
| Contact form | yes | Lead Manager → *What is sent* |
| Quote request (wizard) | yes | same |
| Weight calculator leads | yes | same |
| **Newsletter sign-ups** (footer and popups) | **yes** | same (*Send newsletter sign-ups too*) |
| Forms you built (also in popups) | yes | the form's own **Send to Lead Manager** switch |
| Submissions made by **signed-in staff** | **yes** | tick **Skip submissions made by signed-in staff** *only if your team tests forms on the live site* |

When something is skipped (switch off, staff skip, not set up) the reason is written in the **delivery log** and on that lead's page, and a **Send to Lead Manager now** button pushes it later.

### Field mapping
| Lead Manager field | Taken from |
|---|---|
| `name`, `email`, `phone`, `company`, `message` | the form's answers (built-in forms by name; custom forms by the field you mapped under *Use this answer as the customer's…*, else by field type and label) |
| `formName` | the form's name (*Contact form*, *Quote request*, *Weight calculator*, *Newsletter signup*, or your form's name) |
| `pageUrl` | the page the form was submitted from (absolute address) |
| `utm_source` `utm_medium` `utm_campaign` `utm_term` `utm_content` | the visitor's first page of the visit (see below) |
| `externalId` | `dassrebar-sub-<id>` — identical on every retry and resend, so a lead is never created twice |
| `fields { … }` | everything else with readable keys: quote → *Project location*, *Sector*, *Need*, *Existing customer*, *Rebar sizes*, *Total quantity*, *Materials*, *Other items*; calculator → *Rebar size*, *Length (m)*, *Quantity*, *Estimated weight (kg)*; custom forms → every answer by its label; plus *Shown in* (popup name), *Landing page*, *Referrer*, *Submitted at* |
| files | never sent. Only `fields.attachments = "2 files (view in CMS)"` and `fields.cmsLink` (the lead in this CMS) |

Control characters are stripped; the message is capped at 5,000 characters, other values at 500, and at most 40 fields are sent.

### UTM / source attribution
A tiny first-party script on public pages stores, on the visitor's **first page of a visit**, the `utm_*` parameters, the landing address and the referrer in the browser's session storage. Any form the visitor submits — contact, quote, calculator, newsletter, custom forms, popup forms — posts them along. The server accepts only those keys as plain, length-capped text, stores them with the submission (shown on the lead's page and in the owner email) and forwards them. Nothing personal is in it, and nothing is sent anywhere except together with a form post.

### Delivery, retries and the log
* The lead is saved first; the forward runs afterwards with a **5-second timeout** and never blocks the visitor.
* Network errors, timeouts, `5xx`, `408` and `429` are **retried** after 1 minute, 10 minutes and 1 hour. Any other `4xx` (and redirects) is **refused** and not retried — the answer is shown so you can fix the address or key, then press **Resend**.
* An accepted lead is never sent again automatically; *Resend* sends the same `externalId`, so Lead Manager does not create a duplicate.
* **Lead Manager → Delivery log** lists every lead: *accepted / failed / refused / skipped*, HTTP status, a short answer, attempts, and **Resend**. The dashboard warns when forwards are failing. A restart loses the in-memory retry timers; at boot the app re-arms every retryable row from the log.

### Environment variables (Hostinger hPanel → Node.js app → Environment variables)
| Variable | Meaning |
|---|---|
| `LEADMANAGER_URL` | webhook address (used only while none is saved on the Lead Manager page) |
| `LEADMANAGER_KEY` | optional API key (same rule) |
| `LEADMANAGER_ALLOW_INSECURE` | **never set this on a live site.** Local testing only: allows `http://` and local addresses |

The address must be `https://` and a public host: loopback, private ranges, link-local, internal names and credentials in the address are refused (and a host that resolves to a private address is refused at send time).

---

## 5. After an update: "The database is still updating"
New features add tables and columns when the app **starts**. A server that was started before an update keeps its old database connection until it is restarted; until then those sections show *"The database is still updating — restart the app to finish"*, and visitors' forms keep working (the lead is saved; email and Lead Manager resume after the restart). Restart the app (`npm run dev` again, or *Restart* in hPanel).

## 6. Quick reference
| Task | Where |
|---|---|
| Change who gets lead emails | Email → Settings |
| See why an email / a Lead Manager forward didn't go | Email → Email log · Lead Manager → Delivery log · the lead's page |
| Test the email design | Email → Design & preview · *Send test email* |
| Stop a popup | Popups → Deactivate |
| Put a button on the page that opens a popup | link settings → *Popup action* |
| Push a skipped lead to Lead Manager | the lead's page → *Send to Lead Manager now* |
