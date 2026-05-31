// ============================================================
// Console email provider — for development & testing.
// Logs the email to stdout instead of actually sending it.
// Set EMAIL_PROVIDER=console (or leave unset) to use.
// ============================================================

import type { EmailProvider, SendEmailParams, SendEmailResult } from '../provider'

export class ConsoleProvider implements EmailProvider {
  readonly name = 'console'

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const id = `console_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    console.log('\n' + '='.repeat(60))
    console.log('[EMAIL] To:     ', params.to.name ? `${params.to.name} <${params.to.email}>` : params.to.email)
    console.log('[EMAIL] Subject:', params.subject)
    console.log('[EMAIL] Text:\n')
    console.log(params.text)
    console.log('='.repeat(60) + '\n')
    return { messageId: id, error: null }
  }
}
