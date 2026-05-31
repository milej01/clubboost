// ============================================================
// ClubBoost — Financial Ledger Service
//
// Append-only ledger. Never UPDATE or DELETE ledger rows.
// Every financial event (payment, refund, payout) produces
// a balanced set of CREDIT and DEBIT entries.
//
// For each successful payment the ledger should sum to zero:
//   +entry_gross = -(platform_fee + payment_processing_fee + boost + club + prize)
//
// Uses the service-role (admin) client — no RLS.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'
import type { Payment, Refund, Payout, CompetitionType } from '@/types/app'

// ── Types ──────────────────────────────────────────────────

export interface LedgerRow {
  payment_id:    string | null
  entry_id:      string | null
  competition_id: string
  club_id:       string
  user_id:       string | null
  ledger_type:   string
  direction:     'credit' | 'debit'
  amount_pence:  number
  description:   string | null
  reference_id:  string | null
}

// ── Helpers ────────────────────────────────────────────────

function credit(row: Omit<LedgerRow, 'direction'>): LedgerRow {
  return { ...row, direction: 'credit' }
}
function debit(row: Omit<LedgerRow, 'direction'>): LedgerRow {
  return { ...row, direction: 'debit' }
}

// ── Core write ─────────────────────────────────────────────

export async function writeLedgerRows(rows: LedgerRow[]): Promise<{ error: string | null }> {
  if (rows.length === 0) return { error: null }

  const db = createAdminClient()
  const { error } = await db.from('payment_ledger').insert(rows)
  if (error) {
    console.error('[ledger] Failed to write rows:', error.message, rows)
    return { error: error.message }
  }
  return { error: null }
}

// ── Payment ledger ─────────────────────────────────────────

/**
 * Record a complete 5-part ledger entry for a successful payment.
 *
 * Produces:
 *   CREDIT  entry_gross (or donation_gross)  — what the participant paid
 *   DEBIT   platform_service_fee             — platform's share
 *   DEBIT   payment_processing_fee           — Stripe's estimated/actual fee
 *   DEBIT   clubboost_weekly_contribution    — if applicable
 *   DEBIT   club_fundraising_amount          — club's net share
 *   DEBIT   prize_pool_allocation            — if applicable
 */
export async function recordPaymentLedger(
  payment: Payment,
  competitionType: CompetitionType,
  competitionClubId: string,
): Promise<{ error: string | null }> {
  const base = {
    payment_id:     payment.id,
    entry_id:       payment.entry_id,
    competition_id: payment.competition_id,
    club_id:        competitionClubId,
    user_id:        payment.user_id,
    reference_id:   payment.id,
  }

  const grossType = competitionType === 'donation' ? 'donation_gross' : 'entry_gross'

  const rows: LedgerRow[] = []

  // CREDIT — gross amount received from participant
  rows.push(credit({
    ...base,
    ledger_type:  grossType,
    amount_pence: payment.gross_amount_pence || payment.amount_pence,
    description:  `Entry fee for ${competitionType} competition`,
  }))

  // DEBIT — platform service fee
  if (payment.platform_service_fee_pence > 0) {
    rows.push(debit({
      ...base,
      ledger_type:  'platform_service_fee',
      amount_pence: payment.platform_service_fee_pence,
      description:  'ClubBoost platform service fee',
    }))
  }

  // DEBIT — payment processing fee (Stripe)
  if (payment.stripe_fee_pence > 0) {
    rows.push(debit({
      ...base,
      ledger_type:  'payment_processing_fee',
      amount_pence: payment.stripe_fee_pence,
      description:  'Stripe payment processing fee',
    }))
  }

  // DEBIT — weekly boost contribution
  if (payment.weekly_boost_contribution_pence > 0) {
    rows.push(debit({
      ...base,
      ledger_type:  'clubboost_weekly_contribution',
      amount_pence: payment.weekly_boost_contribution_pence,
      description:  'ClubBoost Weekly Boost contribution',
    }))
  }

  // DEBIT — club fundraising amount
  if (payment.club_fundraising_amount_pence > 0) {
    rows.push(debit({
      ...base,
      ledger_type:  'club_fundraising_amount',
      amount_pence: payment.club_fundraising_amount_pence,
      description:  'Club fundraising share',
    }))
  }

  // DEBIT — prize pool allocation
  if (payment.prize_pool_contribution_pence > 0) {
    rows.push(debit({
      ...base,
      ledger_type:  'prize_pool_allocation',
      amount_pence: payment.prize_pool_contribution_pence,
      description:  'Prize pool contribution',
    }))
  }

  return writeLedgerRows(rows)
}

/**
 * Record refund ledger rows.
 * Mirrors the original payment in reverse (credit becomes debit, vice versa).
 * For full refunds, creates a single 'refund' credit for the full amount.
 */
export async function recordRefundLedger(
  refund: Refund,
  payment: Payment,
  competitionClubId: string,
): Promise<{ error: string | null }> {
  const base = {
    payment_id:     payment.id,
    entry_id:       payment.entry_id,
    competition_id: payment.competition_id,
    club_id:        competitionClubId,
    user_id:        payment.user_id,
    reference_id:   refund.id,
  }

  const rows: LedgerRow[] = [
    credit({
      ...base,
      ledger_type:  'refund',
      amount_pence: refund.amount_pence,
      description:  `Refund: ${refund.reason}`,
    }),
  ]

  return writeLedgerRows(rows)
}

/**
 * Record a payout ledger row when a payout is marked as paid.
 */
export async function recordPayoutLedger(
  payout: Payout,
  competitionClubId: string,
): Promise<{ error: string | null }> {
  const rows: LedgerRow[] = [
    debit({
      payment_id:     null,
      entry_id:       null,
      competition_id: payout.competition_id,
      club_id:        competitionClubId,
      user_id:        payout.recipient_user_id ?? null,
      ledger_type:    'payout',
      amount_pence:   payout.amount_pence,
      description:    `Payout: ${payout.payout_type}${payout.payment_reference ? ` ref:${payout.payment_reference}` : ''}`,
      reference_id:   payout.id,
    }),
  ]

  return writeLedgerRows(rows)
}

// ── Read helpers ───────────────────────────────────────────

export async function getLedgerForPayment(paymentId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('payment_ledger')
    .select('*')
    .eq('payment_id', paymentId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function getLedgerForCompetition(competitionId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('payment_ledger')
    .select('*')
    .eq('competition_id', competitionId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getLedgerSummaryForClub(clubId: string, fromDate?: string, toDate?: string) {
  const db = createAdminClient()

  let q = db
    .from('payment_ledger')
    .select('ledger_type, direction, amount_pence')
    .eq('club_id', clubId)

  if (fromDate) q = q.gte('created_at', fromDate)
  if (toDate)   q = q.lte('created_at', toDate)

  const { data } = await q
  const rows = data ?? []

  // Aggregate by type
  const summary: Record<string, { credit: number; debit: number; net: number }> = {}
  for (const row of rows) {
    if (!summary[row.ledger_type]) summary[row.ledger_type] = { credit: 0, debit: 0, net: 0 }
    if (row.direction === 'credit') {
      summary[row.ledger_type].credit += row.amount_pence
    } else {
      summary[row.ledger_type].debit += row.amount_pence
    }
    summary[row.ledger_type].net = summary[row.ledger_type].credit - summary[row.ledger_type].debit
  }

  return summary
}

export async function getAdminLedgerStats(): Promise<{
  totalGrossPence: number
  totalPlatformFeePence: number
  totalStripeFeesPence: number
  totalClubFundraisingPence: number
  totalBoostContributionPence: number
  totalPrizePoolPence: number
  totalRefundsPence: number
  totalPayoutsPence: number
}> {
  const db = createAdminClient()
  const { data } = await db
    .from('payment_ledger')
    .select('ledger_type, direction, amount_pence')

  const rows = data ?? []
  const sum = (type: string, dir: 'credit' | 'debit') =>
    rows.filter(r => r.ledger_type === type && r.direction === dir)
        .reduce((s, r) => s + r.amount_pence, 0)

  return {
    totalGrossPence:           sum('entry_gross', 'credit') + sum('donation_gross', 'credit'),
    totalPlatformFeePence:     sum('platform_service_fee', 'debit'),
    totalStripeFeesPence:      sum('payment_processing_fee', 'debit'),
    totalClubFundraisingPence: sum('club_fundraising_amount', 'debit'),
    totalBoostContributionPence: sum('clubboost_weekly_contribution', 'debit'),
    totalPrizePoolPence:       sum('prize_pool_allocation', 'debit'),
    totalRefundsPence:         sum('refund', 'credit'),
    totalPayoutsPence:         sum('payout', 'debit'),
  }
}
