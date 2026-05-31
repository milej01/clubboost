// ============================================================
// Notification Hooks
//
// Each function is a "fire and forget" notification trigger
// called from service functions after business logic completes.
// They are designed to NEVER throw — a notification failure must
// never break the primary business flow.
//
// Usage in a service:
//   await notifyClubApproved(clubId).catch(() => {}) // already safe, but belt+suspenders
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification } from './notifications'
import { EMAIL_TYPES } from '@/lib/email/templates/types'
import { formatPence } from '@/lib/utils'
import type { Club, Competition } from '@/types/app'

const ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL ?? 'admin@clubboost.co.uk'
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'hello@clubboost.co.uk'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clubboost.co.uk'

// ── User email lookup ─────────────────────────────────────────

async function getUserEmail(userId: string): Promise<{ email: string | null; name: string | null }> {
  const db = createAdminClient()
  const [{ data: profile }, { data: authData }] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ])
  return {
    email: authData?.user?.email ?? null,
    name:  profile?.display_name ?? null,
  }
}

async function getClubOwner(clubId: string): Promise<{ userId: string; email: string; name: string } | null> {
  const db = createAdminClient()
  const { data: member } = await db
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('role', 'owner')
    .maybeSingle()

  if (!member) return null

  const { email, name } = await getUserEmail(member.user_id)
  if (!email) return null

  return { userId: member.user_id, email, name: name ?? 'there' }
}

// ── 1. Club application received ─────────────────────────────

export async function notifyClubApplicationReceived(club: Club): Promise<void> {
  try {
    await sendNotification({
      type: EMAIL_TYPES.CLUB_APPLICATION_RECEIVED,
      to:   { email: ADMIN_EMAIL, name: 'ClubBoost Admin' },
      data: {
        clubName:       club.name,
        sport:          club.sport,
        contactName:    club.contact_name,
        contactEmail:   club.contact_email,
        location:       club.location,
        adminReviewUrl: `${BASE_URL}/admin/clubs/${club.id}`,
      },
    })
  } catch (err) {
    console.error('[notify] club_application_received failed:', err)
  }
}

// ── 2. Club approved ─────────────────────────────────────────

export async function notifyClubApproved(club: Club): Promise<void> {
  try {
    await sendNotification({
      type: EMAIL_TYPES.CLUB_APPROVED,
      to:   { email: club.contact_email, name: club.contact_name },
      data: {
        contactName:    club.contact_name,
        clubName:       club.name,
        dashboardUrl:   `${BASE_URL}/dashboard`,
        stripeSetupUrl: `${BASE_URL}/dashboard/stripe`,
      },
    })
  } catch (err) {
    console.error('[notify] club_approved failed:', err)
  }
}

// ── 3. Club rejected ─────────────────────────────────────────

export async function notifyClubRejected(club: Club, reason?: string | null): Promise<void> {
  try {
    await sendNotification({
      type: EMAIL_TYPES.CLUB_REJECTED,
      to:   { email: club.contact_email, name: club.contact_name },
      data: {
        contactName:  club.contact_name,
        clubName:     club.name,
        reason:       reason ?? null,
        supportEmail: SUPPORT_EMAIL,
      },
    })
  } catch (err) {
    console.error('[notify] club_rejected failed:', err)
  }
}

// ── 5. Fundraiser published ───────────────────────────────────

export async function notifyFundraiserPublished(competition: Competition, club: Club): Promise<void> {
  try {
    const owner = await getClubOwner(club.id)
    if (!owner) return

    const publicUrl = `${BASE_URL}/c/${club.slug}/${competition.id}`

    await sendNotification({
      type: EMAIL_TYPES.FUNDRAISER_PUBLISHED,
      to:   { email: owner.email, name: owner.name, userId: owner.userId },
      data: {
        contactName:      club.contact_name,
        clubName:         club.name,
        fundraiserTitle:  competition.title,
        entryFee:         formatPence(competition.entry_fee_pence),
        publicUrl,
        closingDate:      competition.closes_at
          ? new Date(competition.closes_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : null,
        shareText: `⚽ Enter ${competition.title} and support ${club.name}! ${formatPence(competition.entry_fee_pence)} entry — ${publicUrl}`,
      },
    })
  } catch (err) {
    console.error('[notify] fundraiser_published failed:', err)
  }
}

// ── 6 & 7. Entry confirmation + payment receipt ───────────────

export async function notifyEntryConfirmed(params: {
  participantId:    string
  competition:      Competition
  clubName:         string
  clubSlug:         string
  entryNumber:      number
  selectionSummary: string
}): Promise<void> {
  try {
    const { email, name } = await getUserEmail(params.participantId)
    if (!email) return

    const competitionUrl = `${BASE_URL}/c/${params.clubSlug}/${params.competition.id}`
    const displayName    = name ?? 'there'

    const TYPE_LABEL: Record<string, string> = {
      predictor: 'Score Predictor', last_man_standing: 'Last Man Standing',
      team_card: 'Team Card', donation: 'Donation',
    }

    await sendNotification({
      type: EMAIL_TYPES.ENTRY_CONFIRMATION,
      to:   { email, name: displayName, userId: params.participantId },
      data: {
        participantName:  displayName,
        fundraiserTitle:  params.competition.title,
        clubName:         params.clubName,
        entryNumber:      params.entryNumber,
        entryFee:         formatPence(params.competition.entry_fee_pence),
        competitionType:  TYPE_LABEL[params.competition.type] ?? params.competition.type,
        selectionSummary: params.selectionSummary,
        competitionUrl,
        dashboardUrl:     `${BASE_URL}/my/dashboard`,
      },
    })
  } catch (err) {
    console.error('[notify] entry_confirmation failed:', err)
  }
}

export async function notifyPaymentReceipt(params: {
  participantId:    string
  competitionTitle: string
  clubName:         string
  amountPence:      number
  paymentDate:      string
  cardBrand:        string | null
  cardLast4:        string | null
  paymentIntentId:  string | null
}): Promise<void> {
  try {
    const { email, name } = await getUserEmail(params.participantId)
    if (!email) return

    const method = params.cardBrand && params.cardLast4
      ? `${params.cardBrand} ending ${params.cardLast4}`
      : 'Card'

    await sendNotification({
      type: EMAIL_TYPES.PAYMENT_RECEIPT,
      to:   { email, name: name ?? undefined, userId: params.participantId },
      data: {
        participantName:  name ?? 'there',
        fundraiserTitle:  params.competitionTitle,
        clubName:         params.clubName,
        amount:           formatPence(params.amountPence),
        paymentDate:      params.paymentDate,
        paymentMethod:    method,
        transactionRef:   params.paymentIntentId
          ? `${params.paymentIntentId.slice(0, 12)}…`
          : 'N/A',
        dashboardUrl:     `${BASE_URL}/my/dashboard`,
      },
    })
  } catch (err) {
    console.error('[notify] payment_receipt failed:', err)
  }
}

// ── 9. Fundraiser closed ──────────────────────────────────────

export async function notifyFundraiserClosed(params: {
  competition:      Competition
  club:             Club
  finalEntryCount:  number
  grossRaisedPence: number
  yourSharePence:   number
  prizePoolPence:   number
}): Promise<void> {
  try {
    await sendNotification({
      type: EMAIL_TYPES.FUNDRAISER_CLOSED,
      to:   { email: params.club.contact_email, name: params.club.contact_name },
      data: {
        contactName:      params.club.contact_name,
        clubName:         params.club.name,
        fundraiserTitle:  params.competition.title,
        finalEntryCount:  params.finalEntryCount,
        grossRaised:      formatPence(params.grossRaisedPence),
        yourShare:        formatPence(params.yourSharePence),
        prizePool:        formatPence(params.prizePoolPence),
        closedAt:         new Date().toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        }),
        settleUrl: `${BASE_URL}/dashboard/competitions/${params.competition.id}`,
      },
    })
  } catch (err) {
    console.error('[notify] fundraiser_closed failed:', err)
  }
}

// ── 10a. Winner notification ─────────────────────────────────

export async function notifyWinner(params: {
  winnerId:         string
  competition:      Competition
  club:             Club
  prizePence:       number | null
}): Promise<void> {
  try {
    const { email, name } = await getUserEmail(params.winnerId)
    if (!email) return

    const prizeDescription = params.competition.prize_type === 'percentage'
      ? `${Math.round(params.competition.prize_pct_bps / 100)}% of the entry pot`
      : params.competition.prize_description ?? 'Prize'

    await sendNotification({
      type: EMAIL_TYPES.WINNER_NOTIFICATION,
      to:   { email, name: name ?? undefined, userId: params.winnerId },
      data: {
        winnerName:       name ?? 'there',
        fundraiserTitle:  params.competition.title,
        clubName:         params.club.name,
        prizeDescription,
        prizePence:       params.prizePence,
        competitionUrl:   `${BASE_URL}/c/${params.club.slug}/${params.competition.id}`,
        contactEmail:     params.club.contact_email,
      },
    })
  } catch (err) {
    console.error('[notify] winner_notification failed:', err)
  }
}

// ── 10b. Settlement result (all non-winning entrants) ─────────

export async function notifySettlementResult(params: {
  participantId:   string
  result:          'eliminated' | 'no_winner' | 'refunded'
  competition:     Competition
  club:            Club
  winnerName:      string | null
}): Promise<void> {
  try {
    const { email, name } = await getUserEmail(params.participantId)
    if (!email) return

    await sendNotification({
      type: EMAIL_TYPES.SETTLEMENT_RESULT,
      to:   { email, name: name ?? undefined, userId: params.participantId },
      data: {
        participantName: name ?? 'there',
        fundraiserTitle: params.competition.title,
        clubName:        params.club.name,
        result:          params.result,
        winnerName:      params.winnerName,
        competitionUrl:  `${BASE_URL}/c/${params.club.slug}/${params.competition.id}`,
        dashboardUrl:    `${BASE_URL}/my/dashboard`,
      },
    })
  } catch (err) {
    console.error('[notify] settlement_result failed:', err)
  }
}

// ── 11. Refund confirmation ───────────────────────────────────

export async function notifyRefundConfirmed(params: {
  participantId:       string
  competitionTitle:    string
  refundAmountPence:   number
  reason:              string
  originalPaymentDate: string
}): Promise<void> {
  try {
    const { email, name } = await getUserEmail(params.participantId)
    if (!email) return

    await sendNotification({
      type: EMAIL_TYPES.REFUND_CONFIRMATION,
      to:   { email, name: name ?? undefined, userId: params.participantId },
      data: {
        participantName:     name ?? 'there',
        fundraiserTitle:     params.competitionTitle,
        refundAmount:        formatPence(params.refundAmountPence),
        reason:              params.reason,
        estimatedDays:       5,
        originalPaymentDate: params.originalPaymentDate,
        dashboardUrl:        `${BASE_URL}/my/dashboard`,
      },
    })
  } catch (err) {
    console.error('[notify] refund_confirmation failed:', err)
  }
}

// ── 12. Payout pending ────────────────────────────────────────

export async function notifyPayoutPending(params: {
  club:          Club
  amountPence:   number
  payoutType:    string
}): Promise<void> {
  try {
    await sendNotification({
      type: EMAIL_TYPES.PAYOUT_PENDING,
      to:   { email: params.club.contact_email, name: params.club.contact_name },
      data: {
        contactName:   params.club.contact_name,
        clubName:      params.club.name,
        payoutAmount:  formatPence(params.amountPence),
        payoutType:    params.payoutType,
        estimatedDays: 3,
        dashboardUrl:  `${BASE_URL}/dashboard/payments`,
      },
    })
  } catch (err) {
    console.error('[notify] payout_pending failed:', err)
  }
}

// ── 13. Payout completed ──────────────────────────────────────

export async function notifyPayoutCompleted(params: {
  club:         Club
  amountPence:  number
  payoutType:   string
  reference:    string
}): Promise<void> {
  try {
    await sendNotification({
      type: EMAIL_TYPES.PAYOUT_COMPLETED,
      to:   { email: params.club.contact_email, name: params.club.contact_name },
      data: {
        contactName:  params.club.contact_name,
        clubName:     params.club.name,
        payoutAmount: formatPence(params.amountPence),
        payoutType:   params.payoutType,
        reference:    params.reference,
        paidAt:       new Date().toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        }),
        dashboardUrl: `${BASE_URL}/dashboard/payments`,
      },
    })
  } catch (err) {
    console.error('[notify] payout_completed failed:', err)
  }
}

// ── 15. Weekly Boost award ────────────────────────────────────

export async function notifyBoostAward(params: {
  club:         Club
  periodName:   string
  amountPence:  number
  notes:        string | null
}): Promise<void> {
  try {
    await sendNotification({
      type: EMAIL_TYPES.BOOST_AWARD_NOTIFICATION,
      to:   { email: params.club.contact_email, name: params.club.contact_name },
      data: {
        contactName:  params.club.contact_name,
        clubName:     params.club.name,
        periodName:   params.periodName,
        awardAmount:  formatPence(params.amountPence),
        notes:        params.notes,
        dashboardUrl: `${BASE_URL}/dashboard/weekly-boost`,
      },
    })
  } catch (err) {
    console.error('[notify] boost_award failed:', err)
  }
}
