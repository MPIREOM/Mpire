# WhatsApp Notifications — Setup & Verification

Mpire sends WhatsApp notifications for two task events — **task assigned** and
**comment added** — plus a **monthly finance report** (summary + PDF). These are
*business-initiated* messages, so WhatsApp requires each one to use a
**Meta-approved message template**. Free-form text is only allowed inside the
24-hour window after a user messages you first, which doesn't apply here.

> Note: task **creation** does not send a notification — only assignment does.

This guide covers: (1) getting credentials, (2) creating the required templates,
(3) configuring env vars, and (4) verifying the setup end-to-end.

---

## 1. Get your credentials

From **[Meta for Developers](https://developers.facebook.com/) → your App →
WhatsApp → API Setup**:

| Value | Env var | Notes |
|-------|---------|-------|
| Access token | `WHATSAPP_API_TOKEN` | Use a **permanent** System User token for production; the 24-hour test token is fine for trying it out. |
| Phone number ID | `WHATSAPP_PHONE_NUMBER_ID` | The ID shown under "From" — **not** the phone number itself. |

You'll also need a verified WhatsApp **Business phone number** attached to the app.

---

## 2. Create the message templates

Go to **WhatsApp Manager → Account tools → Message templates → Create template**.
Create the three templates below. Use **Category: Utility** and **Language:
English (US)** so they match the defaults (`WHATSAPP_TEMPLATE_LANG=en_US`).

> ⚠️ The variable order matters — it must match the code in
> `src/lib/notifications.ts` (`buildTemplateParams`). Copy the bodies exactly.

### Template 1 — `task_assigned`
- **Name:** `task_assigned`
- **Category:** Utility
- **Body:**
  ```
  👤 You've been assigned a task

  Task: {{1}}
  Project: {{2}}
  Assigned by: {{3}}
  ```
- **Sample values:** `{{1}}` = `Design homepage`, `{{2}}` = `Website`, `{{3}}` = `Sara`

### Template 2 — `comment_added`
- **Name:** `comment_added`
- **Category:** Utility
- **Body:**
  ```
  💬 New comment

  Task: {{1}}
  Project: {{2}}
  From: {{3}}
  Comment: {{4}}
  ```
- **Sample values:** `{{1}}` = `Design homepage`, `{{2}}` = `Website`, `{{3}}` = `Sara`, `{{4}}` = `Looks great, ship it`

### Template 3 — `monthly_finance_report` (with PDF attachment)
- **Name:** `monthly_finance_report`
- **Category:** Utility
- **Header:** **Document** (this is what carries the PDF attachment — select
  "Document" as the header type when creating the template, and upload any sample
  PDF as the example)
- **Body:**
  ```
  📊 Monthly Finance Report — {{1}}

  Revenue collected: {{2}}
  Total expenses: {{3}}
  Net profit: {{4}}

  Full breakdown attached.
  ```
- **Sample values:** `{{1}}` = `May 2026`, `{{2}}` = `OMR 12,500.000`, `{{3}}` = `OMR 8,200.000`, `{{4}}` = `OMR 4,300.000`

Submit each for review. Approval is usually minutes to a few hours. The code
won't send successfully until the template's status is **Approved**.

> If you can't use these exact names, set `WHATSAPP_TEMPLATE_TASK_CREATED`,
> `WHATSAPP_TEMPLATE_TASK_ASSIGNED`, and `WHATSAPP_TEMPLATE_COMMENT_ADDED` to
> your chosen names. If you submit in a different language, set
> `WHATSAPP_TEMPLATE_LANG` to its code (e.g. `en`, `ar`).

---

## 3. Configure environment variables

Add these to your host (e.g. Vercel → Project → Settings → Environment Variables)
and to `.env.local` for local dev:

```
WHATSAPP_API_TOKEN=EAAG...your-token
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_TEMPLATE_LANG=en_US
# Secret protecting the monthly finance-report cron (generate with: openssl rand -hex 32)
CRON_SECRET=your-random-cron-secret
# Only if your template names differ from the defaults:
# WHATSAPP_TEMPLATE_TASK_ASSIGNED=task_assigned
# WHATSAPP_TEMPLATE_COMMENT_ADDED=comment_added
# WHATSAPP_TEMPLATE_FINANCE_REPORT=monthly_finance_report
```

Redeploy after changing env vars so the server picks them up.

---

## 4. Add recipient phone numbers

A user only receives notifications if their `phone_number` is set (E.164 format,
e.g. `+15551234567`). Set it from **People** (admins/owners) or **Settings** (self).

> **Test mode caveat:** before your number/templates are fully live, Meta only
> delivers to phone numbers you've added as **recipients** in API Setup. Add your
> own number there to test.

---

## 5. Monthly finance report

The app sends each opted-in person the **previous month's** finance report on the
**1st of every month** (06:00 UTC) — a short WhatsApp summary (revenue collected,
total expenses, net profit) with the **full breakdown as a PDF attachment**.

### One-time setup
1. **Run the DB migration** `supabase/migration-finance-reports.sql` (adds the
   `users.receives_finance_report` opt-in column).
2. **Approve the `monthly_finance_report` template** (Template 3 above) — it must
   have a **Document header**.
3. Set **`CRON_SECRET`** in your env vars (Vercel auto-sends it to the cron).
4. The schedule lives in `vercel.json` (`0 6 1 * *`) and deploys automatically.

### Choosing recipients
On the **People** page, open a user (owner only) and tick **"Monthly finance
report"**. They must also have a phone number set. Only ticked users receive it —
this is independent of role.

### Verify it now (without waiting for the 1st)
Trigger the cron manually for a chosen month and check the result:
```
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-app>/api/cron/monthly-finance-report?month=2026-05"
```
The JSON response reports `sent` / `failed` counts per company. Opted-in users
should receive the WhatsApp message + PDF. Rows are written to `notification_log`
with `event_type = 'monthly_finance_report'`.

---

## 6. Verify end-to-end (task notifications)

1. Confirm the templates show **Approved** in WhatsApp Manager.
2. Set a `phone_number` (one you can check) on a test user.
3. As a *different* user in the same company, **create a task** assigned to the
   test user → the assignee gets the **task assigned** message (nothing is sent
   for task creation itself).
4. **Add a comment** on that task as the other user → the assignee gets the
   **comment** message.
5. Check the `notification_log` table: rows should have `status = 'sent'` and a
   `provider_message_id`. Failures store the Meta error in `error_message`.

### Common errors (seen in `notification_log.error_message`)

| Error | Cause / fix |
|-------|-------------|
| `Template name does not exist in the translation` | Template not approved yet, name mismatch, or wrong `WHATSAPP_TEMPLATE_LANG`. |
| `(#131030) Recipient phone number not in allowed list` | In test mode — add the recipient under API Setup. |
| `more than 24 hours have passed...` | You're sending free-form text instead of a template — make sure you've redeployed with this update. |
| `Invalid OAuth access token` | Token expired (test tokens last 24h) — use a permanent System User token. |
