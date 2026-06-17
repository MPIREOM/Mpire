/**
 * WhatsApp Cloud API client.
 *
 * Uses the Meta WhatsApp Business Cloud API.
 * Swap this file out if you prefer Twilio, Vonage, etc.
 *
 * Required env vars:
 *   WHATSAPP_API_TOKEN        — Permanent or temporary access token
 *   WHATSAPP_PHONE_NUMBER_ID  — The phone-number ID from your Meta app
 *
 * NOTE ON TEMPLATES:
 *   Business-initiated messages (e.g. "a task was created") sent OUTSIDE the
 *   24-hour customer-service window MUST use a Meta-approved message template.
 *   Free-form text (sendWhatsAppMessage) only works inside that window — it is
 *   kept here for test messages and replies. For notifications, use
 *   sendWhatsAppTemplate with a template you've had approved in WhatsApp Manager.
 */

const API_VERSION = 'v21.0';

function getConfig() {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return null; // WhatsApp not configured — skip silently
  }

  return { token, phoneNumberId };
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a plain-text WhatsApp message to a phone number.
 *
 * @param to   - Recipient phone in E.164 format (e.g. "+1234567890")
 * @param body - Message text (max 4096 chars)
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<WhatsAppSendResult> {
  const config = getConfig();

  if (!config) {
    console.warn('[WhatsApp] Not configured — skipping message send');
    return { success: false, error: 'WhatsApp not configured' };
  }

  // Strip anything that isn't digits or +
  const cleanPhone = to.replace(/[^+\d]/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: `Invalid phone number: ${to}` };
  }

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${config.phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || JSON.stringify(data);
      console.error('[WhatsApp] API error:', errMsg);
      return { success: false, error: errMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WhatsApp] Send failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * A single positional body parameter for a template ({{1}}, {{2}}, ...).
 * Order MUST match the order of placeholders in the approved template body.
 */
export interface TemplateParams {
  /** Approved template name as it appears in WhatsApp Manager. */
  name: string;
  /** BCP-47 language code of the approved template, e.g. "en_US". */
  languageCode: string;
  /** Positional body variables, in {{1}}, {{2}}, ... order. */
  bodyParams: string[];
  /**
   * Optional document for templates whose HEADER is of type DOCUMENT (e.g. a
   * PDF attachment). Provide a media ID from uploadWhatsAppMedia().
   */
  headerDocument?: { mediaId: string; filename: string };
}

/**
 * Meta rejects body parameters containing newlines, tabs, or runs of 4+
 * spaces. Collapse whitespace so the value is always a valid parameter.
 */
function sanitizeParam(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Send an approved WhatsApp message template to a phone number.
 *
 * Use this for business-initiated notifications (task created, assigned,
 * comment added) — i.e. any message sent outside the 24-hour window.
 *
 * @param to       - Recipient phone in E.164 format (e.g. "+1234567890")
 * @param template - Approved template name, language, and ordered body params
 */
export async function sendWhatsAppTemplate(
  to: string,
  template: TemplateParams
): Promise<WhatsAppSendResult> {
  const config = getConfig();

  if (!config) {
    console.warn('[WhatsApp] Not configured — skipping template send');
    return { success: false, error: 'WhatsApp not configured' };
  }

  const cleanPhone = to.replace(/[^+\d]/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: `Invalid phone number: ${to}` };
  }

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${config.phoneNumberId}/messages`;

    const components: Record<string, unknown>[] = [];

    if (template.headerDocument) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              id: template.headerDocument.mediaId,
              filename: template.headerDocument.filename,
            },
          },
        ],
      });
    }

    if (template.bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: template.bodyParams.map((text) => ({
          type: 'text',
          text: sanitizeParam(text),
        })),
      });
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.languageCode },
          components,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || JSON.stringify(data);
      console.error('[WhatsApp] Template API error:', errMsg);
      return { success: false, error: errMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WhatsApp] Template send failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

export interface MediaUploadResult {
  success: boolean;
  mediaId?: string;
  error?: string;
}

/**
 * Upload a document (e.g. a generated PDF) to WhatsApp and get a media ID.
 *
 * The returned ID can be reused across multiple sends (to different recipients
 * on the same phone number) and is valid for ~30 days. Use it as the
 * headerDocument.mediaId of a template that has a DOCUMENT header.
 *
 * @param bytes    - File contents
 * @param filename - Display filename, e.g. "Finance-Report-2026-05.pdf"
 * @param mimeType - MIME type, e.g. "application/pdf"
 */
export async function uploadWhatsAppMedia(
  bytes: Uint8Array,
  filename: string,
  mimeType = 'application/pdf'
): Promise<MediaUploadResult> {
  const config = getConfig();

  if (!config) {
    console.warn('[WhatsApp] Not configured — skipping media upload');
    return { success: false, error: 'WhatsApp not configured' };
  }

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${config.phoneNumberId}/media`;

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    // Copy into a fresh ArrayBuffer-backed view so Blob gets a clean buffer.
    const buffer = new Uint8Array(bytes);
    form.append('file', new Blob([buffer], { type: mimeType }), filename);

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}` },
      body: form,
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || JSON.stringify(data);
      console.error('[WhatsApp] Media upload error:', errMsg);
      return { success: false, error: errMsg };
    }

    return { success: true, mediaId: data?.id };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WhatsApp] Media upload failed:', errMsg);
    return { success: false, error: errMsg };
  }
}
