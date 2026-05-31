// ============================================================
// Resend email provider — uses the Resend REST API directly
// (no npm package required; just set RESEND_API_KEY).
//
// Docs: https://resend.com/docs/api-reference/emails/send-email
// ============================================================

import type { EmailProvider, SendEmailParams, SendEmailResult } from '../provider'

const RESEND_API_URL = 'https://api.resend.com/emails'

export class ResendProvider implements EmailProvider {
  readonly name = 'resend'
  private readonly apiKey: string
  private readonly fromAddress: string

  constructor() {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('[ResendProvider] RESEND_API_KEY is not set')
    this.apiKey       = key
    this.fromAddress  = process.env.EMAIL_FROM ?? 'ClubBoost <hello@clubboost.co.uk>'
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const body = {
      from:     this.fromAddress,
      to:       [params.to.name ? `${params.to.name} <${params.to.email}>` : params.to.email],
      subject:  params.subject,
      html:     params.html,
      text:     params.text,
      ...(params.replyTo && { reply_to: params.replyTo }),
      ...(params.tags    && { tags: Object.entries(params.tags).map(([name, value]) => ({ name, value })) }),
    }

    try {
      const res = await fetch(RESEND_API_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      })

      const json = await res.json() as { id?: string; message?: string; name?: string }

      if (!res.ok) {
        const msg = json.message ?? json.name ?? `HTTP ${res.status}`
        console.error('[ResendProvider] send failed:', msg)
        return { messageId: null, error: msg }
      }

      return { messageId: json.id ?? null, error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown network error'
      console.error('[ResendProvider] fetch failed:', msg)
      return { messageId: null, error: msg }
    }
  }
}
