// ============================================================
// ClubBoost — Weekly Boost Calculator
//
// Pure functions — no I/O, no Supabase, fully testable.
// All monetary values in pence (integer arithmetic).
// All percentage values in basis points (100 bps = 1%).
// ============================================================

import type { BoostContributionSource, BoostFundItem } from '@/types/app'

// ── Contribution calculation ──────────────────────────────────

/**
 * Calculate the boost contribution from a single entry payment.
 * Uses integer arithmetic with floor rounding (no floating point).
 *
 * @param entryFeePence  The entry fee charged for the entry (pence)
 * @param contributionBps  The competition's boost contribution rate (basis points)
 * @returns  Contribution amount in pence, floored to nearest whole penny
 */
export function calculateContributionPence(
  entryFeePence: number,
  contributionBps: number,
): number {
  if (entryFeePence <= 0 || contributionBps <= 0) return 0
  // Math.floor ensures we never over-allocate relative to the entry fee
  return Math.floor((entryFeePence * contributionBps) / 10_000)
}

/**
 * Verify that a contribution amount is consistent with entry fee and rate.
 * Used to validate stored contribution records.
 */
export function verifyContribution(
  entryFeePence: number,
  contributionBps: number,
  storedAmountPence: number,
): boolean {
  const expected = calculateContributionPence(entryFeePence, contributionBps)
  return storedAmountPence === expected
}

// ── Fund aggregation ──────────────────────────────────────────

/**
 * Total all contributions to produce a fund summary.
 * Returns total pence and a per-source breakdown.
 */
export interface FundSummary {
  totalPence: number
  bySource: Partial<Record<BoostContributionSource, number>>
  byClub: Record<string, number>   // clubId → pence, for clubs with competition contributions
  itemCount: number
}

export function summariseFund(items: BoostFundItem[]): FundSummary {
  const bySource: Partial<Record<BoostContributionSource, number>> = {}
  const byClub: Record<string, number> = {}
  let totalPence = 0

  for (const item of items) {
    totalPence += item.amount_pence

    bySource[item.source_type] = (bySource[item.source_type] ?? 0) + item.amount_pence

    if (item.club_id) {
      byClub[item.club_id] = (byClub[item.club_id] ?? 0) + item.amount_pence
    }
  }

  return { totalPence, bySource, byClub, itemCount: items.length }
}

// ── Eligibility ───────────────────────────────────────────────

export interface EligibilityInput {
  clubId: string
  isApproved: boolean
  isStripeOnboarded: boolean
  isEnrolled: boolean
  hasCompetitionsInPeriod: boolean
  contributionPence: number       // total from this club's competitions in the period
}

export interface EligibilityResult {
  isEligible: boolean
  reason: string
  ineligibilityReason: string | null
}

/**
 * Compute whether a club is eligible for a boost period.
 * Pure function — all state is passed in.
 */
export function computeClubEligibility(input: EligibilityInput): EligibilityResult {
  if (!input.isApproved) {
    return {
      isEligible: false,
      reason: '',
      ineligibilityReason: 'Club is not approved',
    }
  }
  if (!input.isEnrolled) {
    return {
      isEligible: false,
      reason: '',
      ineligibilityReason: 'Club has not enrolled in the Weekly Boost programme',
    }
  }
  if (!input.isStripeOnboarded) {
    return {
      isEligible: false,
      reason: '',
      ineligibilityReason: 'Club has not completed Stripe Connect onboarding',
    }
  }
  if (!input.hasCompetitionsInPeriod) {
    return {
      isEligible: false,
      reason: '',
      ineligibilityReason: 'Club has no competitions with entries in this period',
    }
  }

  const contributionText = input.contributionPence > 0
    ? ` (contributed ${formatBoostAmount(input.contributionPence)} this period)`
    : ''

  return {
    isEligible: true,
    reason: `Approved, enrolled, onboarded, and has active competitions${contributionText}`,
    ineligibilityReason: null,
  }
}

// ── Display helpers ───────────────────────────────────────────

/**
 * Format a pence amount as a GBP string e.g. "£12.50".
 */
export function formatBoostAmount(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

/**
 * Format a contribution rate in basis points as a percentage string.
 * e.g. 200 bps → "2%"
 */
export function formatContributionRate(bps: number): string {
  const pct = bps / 100
  // Show one decimal place only if non-integer
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`
}

/**
 * Human-readable source type label.
 */
export const SOURCE_LABELS: Record<BoostContributionSource, string> = {
  competition_payment: 'Competition contributions',
  sponsor:             'Sponsor',
  platform_marketing:  'Platform marketing',
  admin_topup:         'Admin top-up',
}

/**
 * Return a human-readable summary of how the fund is composed.
 * e.g. "£120.00 total — competition contributions: £80.00, sponsor: £40.00"
 */
export function describeFund(summary: FundSummary): string {
  if (summary.totalPence === 0) return 'No contributions yet'

  const parts = (Object.entries(summary.bySource) as [BoostContributionSource, number][])
    .sort(([, a], [, b]) => b - a)
    .map(([source, pence]) => `${SOURCE_LABELS[source]}: ${formatBoostAmount(pence)}`)

  return `${formatBoostAmount(summary.totalPence)} total — ${parts.join(', ')}`
}

/**
 * Validate that an award amount does not exceed the available fund
 * after accounting for existing awards.
 */
export function canAwardAmount(params: {
  totalFundPence: number
  existingAwardsPence: number
  proposedAmountPence: number
}): { allowed: boolean; remainingPence: number; message: string } {
  const remaining = params.totalFundPence - params.existingAwardsPence
  if (params.proposedAmountPence <= 0) {
    return { allowed: false, remainingPence: remaining, message: 'Award amount must be greater than zero' }
  }
  if (params.proposedAmountPence > remaining) {
    return {
      allowed: false,
      remainingPence: remaining,
      message: `Award of ${formatBoostAmount(params.proposedAmountPence)} exceeds available fund of ${formatBoostAmount(remaining)}`,
    }
  }
  return { allowed: true, remainingPence: remaining - params.proposedAmountPence, message: 'OK' }
}

// ── Participant-facing copy ───────────────────────────────────

/**
 * Returns the standard participant-facing boost notice text.
 * Does NOT use the word "jackpot" or describe participant-level odds.
 */
export function participantBoostNotice(contributionBps: number): string {
  const rate = formatContributionRate(contributionBps)
  return `A small part of this entry fee (${rate}) may contribute to the ClubBoost Weekly Boost — a shared fund that gives grassroots clubs the chance to receive extra fundraising support each week.`
}
