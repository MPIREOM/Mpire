# WhatsApp Notifications — Setup & Verification

Mpire sends WhatsApp notifications for three events: **task created**, **task
assigned**, and **comment added**. These are *business-initiated* messages, so
WhatsApp requires each one to use a **Meta-approved message template**. Free-form
text is only allowed inside the 24-hour window after a user messages you first,
which doesn't apply here.

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

### Template 1 — `task_created`
- **Name:** `task_created`
- **Category:** Utility
- **Body:**
  ```
  📋 New task created

  Task: {{1}}
  Project: {{2}}
  Created by: {{3}}
  ```
- **Sample values:** `{{1}}` = `Design homepage`, `{{2}}` = `Website`, `{{3}}` = `Sara`

### Template 2 — `task_assigned`
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

### Template 3 — `comment_added`
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
# Only if your template names differ from the defaults:
# WHATSAPP_TEMPLATE_TASK_CREATED=task_created
# WHATSAPP_TEMPLATE_TASK_ASSIGNED=task_assigned
# WHATSAPP_TEMPLATE_COMMENT_ADDED=comment_added
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

## 5. Verify end-to-end

1. Confirm all three templates show **Approved** in WhatsApp Manager.
2. Set a `phone_number` (one you can check) on a test user.
3. As a *different* user in the same company, **create a task** assigned to the
   test user.
4. The test user should receive both the **task created** and **task assigned**
   WhatsApp messages.
5. **Add a comment** on that task as the other user → the assignee gets the
   **comment** message.
6. Check the `notification_log` table: rows should have `status = 'sent'` and a
   `provider_message_id`. Failures store the Meta error in `error_message`.

### Common errors (seen in `notification_log.error_message`)

| Error | Cause / fix |
|-------|-------------|
| `Template name does not exist in the translation` | Template not approved yet, name mismatch, or wrong `WHATSAPP_TEMPLATE_LANG`. |
| `(#131030) Recipient phone number not in allowed list` | In test mode — add the recipient under API Setup. |
| `more than 24 hours have passed...` | You're sending free-form text instead of a template — make sure you've redeployed with this update. |
| `Invalid OAuth access token` | Token expired (test tokens last 24h) — use a permanent System User token. |
