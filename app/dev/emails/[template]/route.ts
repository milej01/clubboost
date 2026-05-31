// GET /dev/emails/<template>
// GET /dev/emails/        (index — lists all templates)
//
// DEVELOPMENT ONLY — serves rendered HTML emails in the browser
// so you can preview them without actually sending.
//
// Examples:
//   http://localhost:3000/dev/emails/
//   http://localhost:3000/dev/emails/club_approved
//   http://localhost:3000/dev/emails/entry_confirmation?mode=text

import { NextRequest, NextResponse } from 'next/server'
import {
  EMAIL_TYPES,
  renderEmail,
  type EmailType,
  type EmailDataMap,
  // Fixtures
  clubApplicationReceivedFixture,
  clubApprovedFixture,
  clubRejectedFixture,
  stripeReminderFixture,
  fundraiserPublishedFixture,
  entryConfirmationFixture,
  paymentReceiptFixture,
  fundraiserClosingSoonFixture,
  fundraiserClosedFixture,
  winnerNotificationFixture,
  settlementResultFixture,
  refundConfirmationFixture,
  payoutPendingFixture,
  payoutCompletedFixture,
  boostContributionSummaryFixture,
  boostAwardNotificationFixture,
} from '@/lib/email/templates/index'

// Block in production
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ template: string }> },
) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const { template } = await params
  const mode = req.nextUrl.searchParams.get('mode') // 'html' | 'text'

  // ── Index page ──────────────────────────────────────────────
  if (template === '_index' || !template) {
    const links = Object.values(EMAIL_TYPES)
      .map(t => `<li><a href="/dev/emails/${t}">${t}</a></li>`)
      .join('')

    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Email Previews</title>
       <style>body{font-family:sans-serif;padding:32px;}ul{line-height:2;}</style></head>
       <body><h1>⚡ ClubBoost Email Previews</h1><ul>${links}</ul></body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    )
  }

  // ── Template rendering ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FIXTURES: Record<EmailType, EmailDataMap[EmailType]> = {
    [EMAIL_TYPES.CLUB_APPLICATION_RECEIVED]:  clubApplicationReceivedFixture,
    [EMAIL_TYPES.CLUB_APPROVED]:              clubApprovedFixture,
    [EMAIL_TYPES.CLUB_REJECTED]:              clubRejectedFixture,
    [EMAIL_TYPES.STRIPE_REMINDER]:            stripeReminderFixture,
    [EMAIL_TYPES.FUNDRAISER_PUBLISHED]:       fundraiserPublishedFixture,
    [EMAIL_TYPES.ENTRY_CONFIRMATION]:         entryConfirmationFixture,
    [EMAIL_TYPES.PAYMENT_RECEIPT]:            paymentReceiptFixture,
    [EMAIL_TYPES.FUNDRAISER_CLOSING_SOON]:    fundraiserClosingSoonFixture,
    [EMAIL_TYPES.FUNDRAISER_CLOSED]:          fundraiserClosedFixture,
    [EMAIL_TYPES.WINNER_NOTIFICATION]:        winnerNotificationFixture,
    [EMAIL_TYPES.SETTLEMENT_RESULT]:          settlementResultFixture,
    [EMAIL_TYPES.REFUND_CONFIRMATION]:        refundConfirmationFixture,
    [EMAIL_TYPES.PAYOUT_PENDING]:             payoutPendingFixture,
    [EMAIL_TYPES.PAYOUT_COMPLETED]:           payoutCompletedFixture,
    [EMAIL_TYPES.BOOST_CONTRIBUTION_SUMMARY]: boostContributionSummaryFixture,
    [EMAIL_TYPES.BOOST_AWARD_NOTIFICATION]:   boostAwardNotificationFixture,
  }

  const fixture = FIXTURES[template as EmailType]
  if (!fixture) {
    const available = Object.values(EMAIL_TYPES).join(', ')
    return NextResponse.json(
      { error: `Unknown template "${template}". Available: ${available}` },
      { status: 404 },
    )
  }

  try {
    const rendered = renderEmail(template as EmailType, fixture as any)

    if (mode === 'text') {
      return new NextResponse(rendered.text, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // Wrap in a nav frame for switching between templates
    const nav = Object.values(EMAIL_TYPES)
      .map(t => `<a href="/dev/emails/${t}" style="${t === template ? 'font-weight:700;color:#7c3aed;' : ''}">${t}</a>`)
      .join('<br>')

    const frame = `<!DOCTYPE html>
<html><head><title>Preview: ${template}</title>
<style>
  body { margin: 0; display: flex; font-family: sans-serif; }
  .nav { width: 220px; min-height: 100vh; background: #f8fafc; border-right: 1px solid #e2e8f0;
         padding: 16px; font-size: 12px; overflow-y: auto; flex-shrink: 0; }
  .nav a { display: block; margin-bottom: 6px; color: #475569; text-decoration: none; }
  .nav a:hover { color: #7c3aed; }
  .preview { flex: 1; overflow: auto; }
  .preview iframe { border: none; width: 100%; height: 100vh; }
  .toolbar { background: #0f172a; padding: 8px 16px; font-size: 12px; color: #94a3b8; display: flex; gap: 16px; }
  .toolbar a { color: #7c3aed; }
</style>
</head><body>
<div class="nav">
  <p style="font-weight:700;margin:0 0 12px;color:#0f172a;">⚡ Email Previews</p>
  ${nav}
</div>
<div class="preview" style="display:flex;flex-direction:column;">
  <div class="toolbar">
    Subject: <strong style="color:#fff;">${rendered.subject}</strong>
    <a href="?mode=text">Plain text →</a>
  </div>
  <iframe srcdoc="${rendered.html.replace(/"/g, '&quot;')}" />
</div>
</body></html>`

    return new NextResponse(frame, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Render failed' },
      { status: 500 },
    )
  }
}
