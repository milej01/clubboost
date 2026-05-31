import { describe, it, expect } from 'vitest'
import {
  calculateContributionPence,
  verifyContribution,
  summariseFund,
  computeClubEligibility,
  formatBoostAmount,
  formatContributionRate,
  describeFund,
  canAwardAmount,
  participantBoostNotice,
  SOURCE_LABELS,
} from '@/lib/services/boost-calculator'
import type { BoostFundItem } from '@/types/app'

// ─────────────────────────────────────────────────────────────────────────────
// calculateContributionPence
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateContributionPence', () => {
  it('calculates 1% (100 bps) of 1000p as 10p', () => {
    expect(calculateContributionPence(1000, 100)).toBe(10)
  })

  it('calculates 2% (200 bps) of 500p as 10p', () => {
    expect(calculateContributionPence(500, 200)).toBe(10)
  })

  it('calculates 2.5% (250 bps) of 1000p as 25p', () => {
    expect(calculateContributionPence(1000, 250)).toBe(25)
  })

  it('floors sub-penny amounts — no rounding up', () => {
    // 1% of 99p = 0.99p → should be 0 (floored)
    expect(calculateContributionPence(99, 100)).toBe(0)
  })

  it('floors correctly for non-trivial remainders', () => {
    // 3% of 333p = 9.99p → should be 9
    expect(calculateContributionPence(333, 300)).toBe(9)
  })

  it('returns 0 when entryFee is zero', () => {
    expect(calculateContributionPence(0, 200)).toBe(0)
  })

  it('returns 0 when entryFee is negative', () => {
    expect(calculateContributionPence(-500, 200)).toBe(0)
  })

  it('returns 0 when contributionBps is zero', () => {
    expect(calculateContributionPence(1000, 0)).toBe(0)
  })

  it('returns 0 when contributionBps is negative', () => {
    expect(calculateContributionPence(1000, -100)).toBe(0)
  })

  it('handles 100% (10000 bps) correctly', () => {
    expect(calculateContributionPence(1000, 10_000)).toBe(1000)
  })

  it('handles large amounts without floating point errors', () => {
    // £200.00 entry, 5% → £10.00
    expect(calculateContributionPence(20_000, 500)).toBe(1000)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// verifyContribution
// ─────────────────────────────────────────────────────────────────────────────
describe('verifyContribution', () => {
  it('returns true when stored amount matches calculated amount', () => {
    expect(verifyContribution(1000, 200, 20)).toBe(true)
  })

  it('returns false when stored amount does not match', () => {
    expect(verifyContribution(1000, 200, 21)).toBe(false)
  })

  it('accepts 0 as a valid stored amount when calculation yields 0', () => {
    expect(verifyContribution(99, 100, 0)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// summariseFund
// ─────────────────────────────────────────────────────────────────────────────
function makeFundItem(overrides: Partial<BoostFundItem> = {}): BoostFundItem {
  return {
    id: 'item-1',
    period_id: 'period-1',
    source_type: 'admin_topup',
    amount_pence: 1000,
    description: null,
    club_id: null,
    competition_id: null,
    payment_id: null,
    entry_id: null,
    sponsor_id: null,
    created_by: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('summariseFund', () => {
  it('returns zero summary for empty array', () => {
    const result = summariseFund([])
    expect(result.totalPence).toBe(0)
    expect(result.itemCount).toBe(0)
    expect(result.bySource).toEqual({})
    expect(result.byClub).toEqual({})
  })

  it('sums a single item', () => {
    const result = summariseFund([makeFundItem({ amount_pence: 5000, source_type: 'sponsor' })])
    expect(result.totalPence).toBe(5000)
    expect(result.bySource.sponsor).toBe(5000)
    expect(result.itemCount).toBe(1)
  })

  it('groups multiple items by source', () => {
    const items = [
      makeFundItem({ id: '1', source_type: 'sponsor',            amount_pence: 5000 }),
      makeFundItem({ id: '2', source_type: 'sponsor',            amount_pence: 3000 }),
      makeFundItem({ id: '3', source_type: 'platform_marketing', amount_pence: 2000 }),
    ]
    const result = summariseFund(items)
    expect(result.totalPence).toBe(10_000)
    expect(result.bySource.sponsor).toBe(8000)
    expect(result.bySource.platform_marketing).toBe(2000)
    expect(result.bySource.competition_payment).toBeUndefined()
  })

  it('accumulates by clubId only when club_id is set', () => {
    const items = [
      makeFundItem({ id: '1', club_id: 'club-a', amount_pence: 400, source_type: 'competition_payment' }),
      makeFundItem({ id: '2', club_id: 'club-a', amount_pence: 600, source_type: 'competition_payment' }),
      makeFundItem({ id: '3', club_id: 'club-b', amount_pence: 200, source_type: 'competition_payment' }),
      makeFundItem({ id: '4', club_id: null,     amount_pence: 100, source_type: 'admin_topup' }),
    ]
    const result = summariseFund(items)
    expect(result.byClub['club-a']).toBe(1000)
    expect(result.byClub['club-b']).toBe(200)
    expect(Object.keys(result.byClub)).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeClubEligibility
// ─────────────────────────────────────────────────────────────────────────────
const baseEligible = {
  clubId: 'club-1',
  isApproved: true,
  isStripeOnboarded: true,
  isEnrolled: true,
  hasCompetitionsInPeriod: true,
  contributionPence: 500,
}

describe('computeClubEligibility', () => {
  it('returns eligible when all conditions met', () => {
    const result = computeClubEligibility(baseEligible)
    expect(result.isEligible).toBe(true)
    expect(result.ineligibilityReason).toBeNull()
    expect(result.reason).toContain('£5.00')
  })

  it('is ineligible when not approved', () => {
    const result = computeClubEligibility({ ...baseEligible, isApproved: false })
    expect(result.isEligible).toBe(false)
    expect(result.ineligibilityReason).toMatch(/not approved/i)
  })

  it('is ineligible when not enrolled', () => {
    const result = computeClubEligibility({ ...baseEligible, isEnrolled: false })
    expect(result.isEligible).toBe(false)
    expect(result.ineligibilityReason).toMatch(/enrolled/i)
  })

  it('is ineligible when stripe not onboarded', () => {
    const result = computeClubEligibility({ ...baseEligible, isStripeOnboarded: false })
    expect(result.isEligible).toBe(false)
    expect(result.ineligibilityReason).toMatch(/stripe/i)
  })

  it('is ineligible when no competitions in period', () => {
    const result = computeClubEligibility({ ...baseEligible, hasCompetitionsInPeriod: false })
    expect(result.isEligible).toBe(false)
    expect(result.ineligibilityReason).toMatch(/no competitions/i)
  })

  it('not-approved takes priority over not-enrolled', () => {
    const result = computeClubEligibility({ ...baseEligible, isApproved: false, isEnrolled: false })
    expect(result.ineligibilityReason).toMatch(/not approved/i)
  })

  it('includes zero-contribution clubs when otherwise eligible', () => {
    const result = computeClubEligibility({ ...baseEligible, contributionPence: 0 })
    expect(result.isEligible).toBe(true)
    // Reason shouldn't mention contribution amount when zero
    expect(result.reason).not.toContain('contributed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// formatBoostAmount
// ─────────────────────────────────────────────────────────────────────────────
describe('formatBoostAmount', () => {
  it('formats pence as £ string with 2 decimal places', () => {
    expect(formatBoostAmount(1000)).toBe('£10.00')
    expect(formatBoostAmount(125)).toBe('£1.25')
    expect(formatBoostAmount(0)).toBe('£0.00')
  })

  it('handles large amounts', () => {
    expect(formatBoostAmount(100_000)).toBe('£1000.00')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// formatContributionRate
// ─────────────────────────────────────────────────────────────────────────────
describe('formatContributionRate', () => {
  it('formats whole percentages without decimal', () => {
    expect(formatContributionRate(100)).toBe('1%')
    expect(formatContributionRate(200)).toBe('2%')
    expect(formatContributionRate(500)).toBe('5%')
  })

  it('formats fractional percentages with one decimal place', () => {
    expect(formatContributionRate(150)).toBe('1.5%')
    expect(formatContributionRate(250)).toBe('2.5%')
  })

  it('handles zero', () => {
    expect(formatContributionRate(0)).toBe('0%')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// describeFund
// ─────────────────────────────────────────────────────────────────────────────
describe('describeFund', () => {
  it('returns "No contributions yet" for empty fund', () => {
    expect(describeFund({ totalPence: 0, bySource: {}, byClub: {}, itemCount: 0 }))
      .toBe('No contributions yet')
  })

  it('includes total and source breakdown', () => {
    const summary = {
      totalPence: 15_000,
      bySource: { sponsor: 10_000, admin_topup: 5_000 } as Record<string, number>,
      byClub: {},
      itemCount: 2,
    }
    const text = describeFund(summary as Parameters<typeof describeFund>[0])
    expect(text).toContain('£150.00 total')
    expect(text).toContain('Sponsor: £100.00')
    expect(text).toContain('Admin top-up: £50.00')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// canAwardAmount
// ─────────────────────────────────────────────────────────────────────────────
describe('canAwardAmount', () => {
  it('allows award within the remaining fund', () => {
    const result = canAwardAmount({
      totalFundPence: 10_000,
      existingAwardsPence: 3_000,
      proposedAmountPence: 5_000,
    })
    expect(result.allowed).toBe(true)
    expect(result.remainingPence).toBe(2_000)
    expect(result.message).toBe('OK')
  })

  it('allows award that exactly exhausts the fund', () => {
    const result = canAwardAmount({
      totalFundPence: 10_000,
      existingAwardsPence: 5_000,
      proposedAmountPence: 5_000,
    })
    expect(result.allowed).toBe(true)
    expect(result.remainingPence).toBe(0)
  })

  it('rejects award that exceeds the remaining fund', () => {
    const result = canAwardAmount({
      totalFundPence: 10_000,
      existingAwardsPence: 8_000,
      proposedAmountPence: 3_000,
    })
    expect(result.allowed).toBe(false)
    expect(result.message).toContain('£30.00')   // proposed
    expect(result.message).toContain('£20.00')   // remaining
  })

  it('rejects zero-amount award', () => {
    const result = canAwardAmount({
      totalFundPence: 10_000,
      existingAwardsPence: 0,
      proposedAmountPence: 0,
    })
    expect(result.allowed).toBe(false)
    expect(result.message).toMatch(/greater than zero/i)
  })

  it('rejects negative-amount award', () => {
    const result = canAwardAmount({
      totalFundPence: 10_000,
      existingAwardsPence: 0,
      proposedAmountPence: -100,
    })
    expect(result.allowed).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// participantBoostNotice
// ─────────────────────────────────────────────────────────────────────────────
describe('participantBoostNotice', () => {
  it('includes the contribution rate', () => {
    const notice = participantBoostNotice(200)
    expect(notice).toContain('2%')
  })

  it('includes "ClubBoost Weekly Boost" branding', () => {
    const notice = participantBoostNotice(100)
    expect(notice).toContain('ClubBoost Weekly Boost')
  })

  it('does not mention jackpot', () => {
    const notice = participantBoostNotice(100)
    expect(notice.toLowerCase()).not.toContain('jackpot')
  })

  it('does not mention prize draw', () => {
    const notice = participantBoostNotice(100)
    expect(notice.toLowerCase()).not.toContain('prize draw')
  })

  it('does not mention odds', () => {
    const notice = participantBoostNotice(100)
    expect(notice.toLowerCase()).not.toContain('odds')
  })

  it('uses fractional rate correctly', () => {
    const notice = participantBoostNotice(250)
    expect(notice).toContain('2.5%')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE_LABELS
// ─────────────────────────────────────────────────────────────────────────────
describe('SOURCE_LABELS', () => {
  it('has a label for every contribution source', () => {
    const sources = ['competition_payment', 'sponsor', 'platform_marketing', 'admin_topup'] as const
    for (const source of sources) {
      expect(SOURCE_LABELS[source]).toBeTruthy()
    }
  })
})
