// ============================================================
// Email template data types
//
// Every email template has a corresponding Data type that
// defines exactly what variables it needs. The notification
// service uses the EmailDataMap to enforce type safety when
// sending any notification.
// ============================================================

// ── 1. Club application received (→ admin) ───────────────────

export interface ClubApplicationReceivedData {
  clubName:       string
  sport:          string
  contactName:    string
  contactEmail:   string
  location:       string
  adminReviewUrl: string
}

// ── 2. Club approved (→ club owner) ─────────────────────────

export interface ClubApprovedData {
  contactName:  string
  clubName:     string
  dashboardUrl: string
  stripeSetupUrl: string
}

// ── 3. Club rejected (→ club owner) ─────────────────────────

export interface ClubRejectedData {
  contactName:  string
  clubName:     string
  reason:       string | null
  supportEmail: string
}

// ── 4. Stripe onboarding reminder (→ club owner) ─────────────

export interface StripeReminderData {
  contactName:    string
  clubName:       string
  stripeSetupUrl: string
  /** Number of days since they signed up */
  daysSinceSignup: number
}

// ── 5. Fundraiser published (→ club admin) ───────────────────

export interface FundraiserPublishedData {
  contactName:      string
  clubName:         string
  fundraiserTitle:  string
  entryFee:         string   // formatted, e.g. "£5.00"
  publicUrl:        string
  closingDate:      string | null
  shareText:        string   // pre-filled share copy
}

// ── 6. Entry confirmation (→ participant) ────────────────────

export interface EntryConfirmationData {
  participantName:  string
  fundraiserTitle:  string
  clubName:         string
  entryNumber:      number
  entryFee:         string
  competitionType:  string   // 'Predictor' | 'Last Man Standing' | etc.
  selectionSummary: string   // human-readable summary of their picks
  competitionUrl:   string
  dashboardUrl:     string
}

// ── 7. Payment receipt (→ participant) ───────────────────────

export interface PaymentReceiptData {
  participantName:  string
  fundraiserTitle:  string
  clubName:         string
  amount:           string
  paymentDate:      string
  paymentMethod:    string   // e.g. "Visa ending 4242"
  transactionRef:   string   // Stripe payment intent ID (short)
  dashboardUrl:     string
}

// ── 8. Fundraiser closing soon (→ club admin, marketing) ─────

export interface FundraiserClosingSoonData {
  contactName:     string
  clubName:        string
  fundraiserTitle: string
  entryCount:      number
  raisedSoFar:     string
  closingDate:     string
  daysLeft:        number
  fundraiserUrl:   string
  dashboardUrl:    string
}

// ── 9. Fundraiser closed (→ club admin) ──────────────────────

export interface FundraiserClosedData {
  contactName:      string
  clubName:         string
  fundraiserTitle:  string
  finalEntryCount:  number
  grossRaised:      string
  yourShare:        string
  prizePool:        string
  closedAt:         string
  settleUrl:        string
}

// ── 10a. Winner notification (→ winner) ──────────────────────

export interface WinnerNotificationData {
  winnerName:       string
  fundraiserTitle:  string
  clubName:         string
  prizeDescription: string
  prizePence:       number | null   // null if prize is non-cash
  competitionUrl:   string
  contactEmail:     string   // club contact for prize claim
}

// ── 10b. Settlement result (→ all other entrants) ────────────

export interface SettlementResultData {
  participantName:  string
  fundraiserTitle:  string
  clubName:         string
  result:           'eliminated' | 'no_winner' | 'refunded'
  winnerName:       string | null
  competitionUrl:   string
  dashboardUrl:     string
}

// ── 11. Refund confirmation (→ participant) ───────────────────

export interface RefundConfirmationData {
  participantName:  string
  fundraiserTitle:  string
  refundAmount:     string
  reason:           string
  estimatedDays:    number   // working days to appear on statement
  originalPaymentDate: string
  dashboardUrl:     string
}

// ── 12. Payout pending (→ club owner) ────────────────────────

export interface PayoutPendingData {
  contactName:   string
  clubName:      string
  payoutAmount:  string
  payoutType:    string   // 'Fundraising share' | 'Prize fund' | 'Weekly Boost award'
  estimatedDays: number
  dashboardUrl:  string
}

// ── 13. Payout completed (→ club owner) ──────────────────────

export interface PayoutCompletedData {
  contactName:  string
  clubName:     string
  payoutAmount: string
  payoutType:   string
  reference:    string   // Stripe transfer ID
  paidAt:       string
  dashboardUrl: string
}

// ── 14. Weekly Boost contribution summary (→ club owner, marketing) ──

export interface BoostContributionSummaryData {
  contactName:         string
  clubName:            string
  periodName:          string
  contributionAmount:  string   // total contributed this period
  poolTotal:           string   // total in the shared pool
  periodEnd:           string
  boostInfoUrl:        string
  dashboardUrl:        string
}

// ── 15. Weekly Boost award notification (→ club owner) ───────

export interface BoostAwardNotificationData {
  contactName:   string
  clubName:      string
  periodName:    string
  awardAmount:   string
  notes:         string | null
  dashboardUrl:  string
}

// ── Registry ─────────────────────────────────────────────────

export const EMAIL_TYPES = {
  CLUB_APPLICATION_RECEIVED:  'club_application_received',
  CLUB_APPROVED:              'club_approved',
  CLUB_REJECTED:              'club_rejected',
  STRIPE_REMINDER:            'stripe_onboarding_reminder',
  FUNDRAISER_PUBLISHED:       'fundraiser_published',
  ENTRY_CONFIRMATION:         'entry_confirmation',
  PAYMENT_RECEIPT:            'payment_receipt',
  FUNDRAISER_CLOSING_SOON:    'fundraiser_closing_soon',
  FUNDRAISER_CLOSED:          'fundraiser_closed',
  WINNER_NOTIFICATION:        'winner_notification',
  SETTLEMENT_RESULT:          'settlement_result',
  REFUND_CONFIRMATION:        'refund_confirmation',
  PAYOUT_PENDING:             'payout_pending',
  PAYOUT_COMPLETED:           'payout_completed',
  BOOST_CONTRIBUTION_SUMMARY: 'boost_contribution_summary',
  BOOST_AWARD_NOTIFICATION:   'boost_award_notification',
} as const

export type EmailType = typeof EMAIL_TYPES[keyof typeof EMAIL_TYPES]

/** Marketing emails are opt-out (participant can unsubscribe). */
export const MARKETING_EMAIL_TYPES: ReadonlySet<EmailType> = new Set([
  EMAIL_TYPES.FUNDRAISER_CLOSING_SOON,
  EMAIL_TYPES.BOOST_CONTRIBUTION_SUMMARY,
])

/** Map from EmailType → the data interface for that email. */
export interface EmailDataMap {
  [EMAIL_TYPES.CLUB_APPLICATION_RECEIVED]:  ClubApplicationReceivedData
  [EMAIL_TYPES.CLUB_APPROVED]:              ClubApprovedData
  [EMAIL_TYPES.CLUB_REJECTED]:              ClubRejectedData
  [EMAIL_TYPES.STRIPE_REMINDER]:            StripeReminderData
  [EMAIL_TYPES.FUNDRAISER_PUBLISHED]:       FundraiserPublishedData
  [EMAIL_TYPES.ENTRY_CONFIRMATION]:         EntryConfirmationData
  [EMAIL_TYPES.PAYMENT_RECEIPT]:            PaymentReceiptData
  [EMAIL_TYPES.FUNDRAISER_CLOSING_SOON]:    FundraiserClosingSoonData
  [EMAIL_TYPES.FUNDRAISER_CLOSED]:          FundraiserClosedData
  [EMAIL_TYPES.WINNER_NOTIFICATION]:        WinnerNotificationData
  [EMAIL_TYPES.SETTLEMENT_RESULT]:          SettlementResultData
  [EMAIL_TYPES.REFUND_CONFIRMATION]:        RefundConfirmationData
  [EMAIL_TYPES.PAYOUT_PENDING]:             PayoutPendingData
  [EMAIL_TYPES.PAYOUT_COMPLETED]:           PayoutCompletedData
  [EMAIL_TYPES.BOOST_CONTRIBUTION_SUMMARY]: BoostContributionSummaryData
  [EMAIL_TYPES.BOOST_AWARD_NOTIFICATION]:   BoostAwardNotificationData
}
