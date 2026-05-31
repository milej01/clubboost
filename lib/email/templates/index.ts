// ============================================================
// Template registry — single import point for all email renders.
//
// Usage:
//   const { subject, html, text } = renderEmail(EMAIL_TYPES.CLUB_APPROVED, data)
// ============================================================

import { EMAIL_TYPES, type EmailType, type EmailDataMap } from './types'

import { renderClubApplicationReceived } from './01-club-application-received'
import { renderClubApproved }            from './02-club-approved'
import { renderClubRejected }            from './03-club-rejected'
import { renderStripeReminder }          from './04-stripe-reminder'
import { renderFundraiserPublished }     from './05-fundraiser-published'
import { renderEntryConfirmation }       from './06-entry-confirmation'
import { renderPaymentReceipt }          from './07-payment-receipt'
import { renderFundraiserClosingSoon }   from './08-fundraiser-closing-soon'
import { renderFundraiserClosed }        from './09-fundraiser-closed'
import { renderWinnerNotification }      from './10a-winner-notification'
import { renderSettlementResult }        from './10b-settlement-result'
import { renderRefundConfirmation }      from './11-refund-confirmation'
import { renderPayoutPending }           from './12-payout-pending'
import { renderPayoutCompleted }         from './13-payout-completed'
import { renderBoostContributionSummary } from './14-boost-contribution-summary'
import { renderBoostAwardNotification }  from './15-boost-award-notification'

// Re-export everything callers need
export * from './types'

export type RenderedEmail = { subject: string; html: string; text: string }

type TemplateRenderer<T extends EmailType> = (data: EmailDataMap[T]) => RenderedEmail

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RENDERERS: Record<EmailType, TemplateRenderer<any>> = {
  [EMAIL_TYPES.CLUB_APPLICATION_RECEIVED]:  renderClubApplicationReceived,
  [EMAIL_TYPES.CLUB_APPROVED]:              renderClubApproved,
  [EMAIL_TYPES.CLUB_REJECTED]:              renderClubRejected,
  [EMAIL_TYPES.STRIPE_REMINDER]:            renderStripeReminder,
  [EMAIL_TYPES.FUNDRAISER_PUBLISHED]:       renderFundraiserPublished,
  [EMAIL_TYPES.ENTRY_CONFIRMATION]:         renderEntryConfirmation,
  [EMAIL_TYPES.PAYMENT_RECEIPT]:            renderPaymentReceipt,
  [EMAIL_TYPES.FUNDRAISER_CLOSING_SOON]:    renderFundraiserClosingSoon,
  [EMAIL_TYPES.FUNDRAISER_CLOSED]:          renderFundraiserClosed,
  [EMAIL_TYPES.WINNER_NOTIFICATION]:        renderWinnerNotification,
  [EMAIL_TYPES.SETTLEMENT_RESULT]:          renderSettlementResult,
  [EMAIL_TYPES.REFUND_CONFIRMATION]:        renderRefundConfirmation,
  [EMAIL_TYPES.PAYOUT_PENDING]:             renderPayoutPending,
  [EMAIL_TYPES.PAYOUT_COMPLETED]:           renderPayoutCompleted,
  [EMAIL_TYPES.BOOST_CONTRIBUTION_SUMMARY]: renderBoostContributionSummary,
  [EMAIL_TYPES.BOOST_AWARD_NOTIFICATION]:   renderBoostAwardNotification,
}

export function renderEmail<T extends EmailType>(
  type: T,
  data: EmailDataMap[T],
): RenderedEmail {
  const renderer = RENDERERS[type]
  if (!renderer) throw new Error(`No email renderer found for type: ${type}`)
  return renderer(data)
}

// ── Preview fixtures (for dev route) ─────────────────────────

export { clubApplicationReceivedFixture }  from './01-club-application-received'
export { clubApprovedFixture }             from './02-club-approved'
export { clubRejectedFixture }             from './03-club-rejected'
export { stripeReminderFixture }           from './04-stripe-reminder'
export { fundraiserPublishedFixture }      from './05-fundraiser-published'
export { entryConfirmationFixture }        from './06-entry-confirmation'
export { paymentReceiptFixture }           from './07-payment-receipt'
export { fundraiserClosingSoonFixture }    from './08-fundraiser-closing-soon'
export { fundraiserClosedFixture }         from './09-fundraiser-closed'
export { winnerNotificationFixture }       from './10a-winner-notification'
export { settlementResultFixture }         from './10b-settlement-result'
export { refundConfirmationFixture }       from './11-refund-confirmation'
export { payoutPendingFixture }            from './12-payout-pending'
export { payoutCompletedFixture }          from './13-payout-completed'
export { boostContributionSummaryFixture } from './14-boost-contribution-summary'
export { boostAwardNotificationFixture }   from './15-boost-award-notification'
