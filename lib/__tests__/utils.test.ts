/**
 * Pure-function tests for financial utilities.
 *
 * No database or network calls — these tests run entirely in memory.
 * The key invariants being verified:
 *   1. calculateSplit always partitions the gross fee without loss or gain
 *   2. Each allocation slice is non-negative
 *   3. The club slice is the true residual and never goes negative
 *   4. Rounding mode is always floor (never over-allocate)
 */

import { describe, it, expect } from 'vitest'
import {
  calculateSplit,
  estimateStripeFee,
  poundsToPence,
  percentToBps,
} from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// poundsToPence / percentToBps — unit conversion sanity checks
// ─────────────────────────────────────────────────────────────────────────────

describe('poundsToPence', () => {
  it('converts whole pounds', () => expect(poundsToPence(5)).toBe(500))
  it('converts decimal pounds, rounds correctly', () => expect(poundsToPence(1.99)).toBe(199))
  it('handles zero', () => expect(poundsToPence(0)).toBe(0))
})

describe('percentToBps', () => {
  it('converts 8% to 800 bps', () => expect(percentToBps(8)).toBe(800))
  it('converts 2.5% to 250 bps', () => expect(percentToBps(2.5)).toBe(250))
  it('converts 100% to 10000 bps', () => expect(percentToBps(100)).toBe(10000))
  it('handles zero', () => expect(percentToBps(0)).toBe(0))
})

// ─────────────────────────────────────────────────────────────────────────────
// estimateStripeFee
// ─────────────────────────────────────────────────────────────────────────────

describe('estimateStripeFee', () => {
  it('estimates Stripe fee for £5.00 (1.5% + 25p, ceil)', () => {
    // 500 * 0.015 = 7.5 + 25 = 32.5 → ceil → 33p
    expect(estimateStripeFee(500)).toBe(33)
  })

  it('estimates Stripe fee for £10.00', () => {
    // 1000 * 0.015 = 15 + 25 = 40p → no ceiling needed
    expect(estimateStripeFee(1000)).toBe(40)
  })

  it('is always positive', () => {
    expect(estimateStripeFee(1)).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// calculateSplit — core financial partitioning
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateSplit', () => {
  // ── Predictor competition (£5.00 entry) ─────────────────────────────────
  // prize 50% (5000 bps), club 40% (4000 bps), platform 8% (800 bps),
  // boost 2% (200 bps).  Stripe fee 33p (estimated for 500p).
  //
  // prize    = floor(500 * 5000 / 10000)  = 250p
  // platform = floor(500 * 800  / 10000)  = 40p
  // boost    = floor(500 * 200  / 10000)  = 10p
  // stripeFee = estimateStripeFee(500)    = 33p
  // club     = max(0, 500 - 250 - 40 - 10 - 33) = 167p
  describe('Predictor (£5.00, 50/40/8/2)', () => {
    const split = calculateSplit(500, {
      prizePctBps:    5000,
      clubPctBps:     4000,
      platformFeeBps: 800,
      weeklyBoostBps: 200,
    })

    it('prize slice is 250p (50%)', () => expect(split.prize).toBe(250))
    it('platform slice is 40p (8%)', () => expect(split.platform).toBe(40))
    it('boost slice is 10p (2%)', () => expect(split.boost).toBe(10))
    it('Stripe fee is 33p (estimated)', () => expect(split.stripeFee).toBe(33))
    it('club slice is residual = 167p', () => expect(split.club).toBe(167))
    it('total equals gross entry fee', () => {
      expect(split.prize + split.platform + split.boost + split.stripeFee + split.club)
        .toBe(500)
    })
    it('all slices are non-negative', () => {
      expect(split.prize).toBeGreaterThanOrEqual(0)
      expect(split.platform).toBeGreaterThanOrEqual(0)
      expect(split.boost).toBeGreaterThanOrEqual(0)
      expect(split.stripeFee).toBeGreaterThanOrEqual(0)
      expect(split.club).toBeGreaterThanOrEqual(0)
    })
  })

  // ── LMS competition (£10.00 entry) ──────────────────────────────────────
  // prize 60% (6000 bps), club 30% (3000 bps), platform 8% (800 bps),
  // boost 2% (200 bps).  Stripe fee 40p (no ceiling at 1000p).
  //
  // prize    = floor(1000 * 6000 / 10000)  = 600p
  // platform = floor(1000 * 800  / 10000)  = 80p
  // boost    = floor(1000 * 200  / 10000)  = 20p
  // stripeFee = estimateStripeFee(1000)    = 40p
  // club     = max(0, 1000 - 600 - 80 - 20 - 40) = 260p
  describe('LMS (£10.00, 60/30/8/2)', () => {
    const split = calculateSplit(1000, {
      prizePctBps:    6000,
      clubPctBps:     3000,
      platformFeeBps: 800,
      weeklyBoostBps: 200,
    })

    it('prize slice is 600p (60%)', () => expect(split.prize).toBe(600))
    it('platform slice is 80p (8%)', () => expect(split.platform).toBe(80))
    it('boost slice is 20p (2%)', () => expect(split.boost).toBe(20))
    it('Stripe fee is 40p (estimated)', () => expect(split.stripeFee).toBe(40))
    it('club slice is residual = 260p', () => expect(split.club).toBe(260))
    it('total equals gross entry fee', () => {
      expect(split.prize + split.platform + split.boost + split.stripeFee + split.club)
        .toBe(1000)
    })
  })

  // ── Donation (£5.00, no prize, no boost) ────────────────────────────────
  // prize 0%, club 92% (9200 bps), platform 8% (800 bps), boost 0%.
  //
  // prize    = 0
  // platform = floor(500 * 800 / 10000)  = 40p
  // boost    = 0
  // stripeFee = 33p
  // club     = max(0, 500 - 0 - 40 - 0 - 33) = 427p
  describe('Donation (£5.00, no prize, no boost)', () => {
    const split = calculateSplit(500, {
      prizePctBps:    0,
      clubPctBps:     9200,
      platformFeeBps: 800,
      weeklyBoostBps: 0,
    })

    it('prize slice is 0', () => expect(split.prize).toBe(0))
    it('boost slice is 0', () => expect(split.boost).toBe(0))
    it('platform slice is 40p', () => expect(split.platform).toBe(40))
    it('club gets majority residual', () => expect(split.club).toBe(427))
    it('total equals gross entry fee', () => {
      expect(split.prize + split.platform + split.boost + split.stripeFee + split.club)
        .toBe(500)
    })
  })

  // ── Weekly Boost disabled ────────────────────────────────────────────────
  // When weeklyBoostBps is 0 (feature flag off), boost slice must be zero.
  describe('Weekly Boost disabled (boost bps = 0)', () => {
    it('boost slice is exactly 0', () => {
      const split = calculateSplit(500, {
        prizePctBps:    5000,
        clubPctBps:     4000,
        platformFeeBps: 800,
        weeklyBoostBps: 0,       // ← flag off
      })
      expect(split.boost).toBe(0)
    })

    it('club slice increases when boost is disabled', () => {
      const withBoost    = calculateSplit(500, { prizePctBps: 5000, clubPctBps: 4000, platformFeeBps: 800, weeklyBoostBps: 200 })
      const withoutBoost = calculateSplit(500, { prizePctBps: 5000, clubPctBps: 4000, platformFeeBps: 800, weeklyBoostBps: 0 })
      // Club gets boost share as extra residual when boost is off
      expect(withoutBoost.club).toBeGreaterThan(withBoost.club)
    })
  })

  // ── Guard: zero entry fee ────────────────────────────────────────────────
  describe('zero entry fee guard', () => {
    it('returns all-zero split for £0 entry', () => {
      const split = calculateSplit(0, { prizePctBps: 5000, clubPctBps: 4000, platformFeeBps: 800, weeklyBoostBps: 200 })
      expect(split.prize).toBe(0)
      expect(split.platform).toBe(0)
      expect(split.boost).toBe(0)
      expect(split.stripeFee).toBe(0)
      expect(split.club).toBe(0)
      expect(split.total).toBe(0)
    })
  })

  // ── Guard: club slice never negative ────────────────────────────────────
  describe('club slice never goes negative', () => {
    it('clamps club slice to 0 when fees exceed gross', () => {
      // Extreme test: 100% prize + 100% platform would exceed gross
      const split = calculateSplit(100, {
        prizePctBps:    5000,
        clubPctBps:     5000,
        platformFeeBps: 5000, // fees sum to more than 100%
        weeklyBoostBps: 5000,
        stripeFee:      0,    // remove Stripe fee from equation
      })
      expect(split.club).toBeGreaterThanOrEqual(0)
    })
  })

  // ── Actual Stripe fee override ───────────────────────────────────────────
  describe('actual Stripe fee override', () => {
    it('uses actual fee when provided, adjusting club residual', () => {
      const estimated = calculateSplit(500, { prizePctBps: 0, clubPctBps: 0, platformFeeBps: 0, weeklyBoostBps: 0 })
      const actual    = calculateSplit(500, { prizePctBps: 0, clubPctBps: 0, platformFeeBps: 0, weeklyBoostBps: 0, stripeFee: 45 })
      // Club receives less when actual Stripe fee is higher than estimate
      expect(actual.club).toBeLessThan(estimated.club)
    })
  })

  // ── Demo data financial cross-check ─────────────────────────────────────
  // Verify the amounts used in the demo seed match the calculateSplit function.
  describe('demo seed financial cross-check', () => {
    it('Predictor: 4 entries × £5.00 → £10 prize pool', () => {
      const split = calculateSplit(500, {
        prizePctBps:    5000,
        clubPctBps:     4000,
        platformFeeBps: 800,
        weeklyBoostBps: 200,
      })
      expect(split.prize * 4).toBe(1000) // £10 prize pool
    })

    it('LMS: 5 entries × £10.00 → £30 prize pool', () => {
      const split = calculateSplit(1000, {
        prizePctBps:    6000,
        clubPctBps:     3000,
        platformFeeBps: 800,
        weeklyBoostBps: 200,
      })
      expect(split.prize * 5).toBe(3000) // £30 prize pool
    })
  })
})
