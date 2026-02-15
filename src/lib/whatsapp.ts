/**
 * WhatsApp Cloud API client.
 *
 * Uses the Meta WhatsApp Business Cloud API to send text messages.
 * Swap this file out if you prefer Twilio, Vonage, etc.
 *
 * Required env vars:
 *   WHATSAPP_API_TOKEN        — Permanent or temporary access token
 *   WHATSAPP_PHONE_NUMBER_ID  — The phone-number ID from your Meta app
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
