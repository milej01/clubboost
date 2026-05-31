// ============================================================
// Email Provider Abstraction
//
// All email sending goes through EmailProvider. The concrete
// implementation is chosen at runtime based on environment.
//
// To add a new provider (e.g. SendGrid, Postmark):
//   1. Create lib/email/providers/<name>.ts implementing EmailProvider
//   2. Add a case to getEmailProvider() below
// ============================================================

export interface SendEmailParams {
  to: { email: string; name?: string }
  subject: string
  html: string
  text: string
  replyTo?: string
  tags?: Record<string, string>
}

export interface SendEmailResult {
  messageId: string | null
  error: string | null
}

export interface EmailProvider {
  readonly name: string
  send(params: SendEmailParams): Promise<SendEmailResult>
}

// ── Factory ───────────────────────────────────────────────────

export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? 'console'

  switch (provider) {
    case 'resend': {
      // Lazy import so the console provider works without env vars
      const { ResendProvider } = require('./providers/resend') as {
        ResendProvider: new () => EmailProvider
      }
      return new ResendProvider()
    }

    case 'console':
    default: {
      const { ConsoleProvider } = require('./providers/console') as {
        ConsoleProvider: new () => EmailProvider
      }
      return new ConsoleProvider()
    }
  }
}
