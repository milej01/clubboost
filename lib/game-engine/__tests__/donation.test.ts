import { describe, it, expect } from 'vitest'
import { donationEngine } from '../donation'
import {
  makeDonationConfig, makeDonationState, makeDonationEntry,
} from './helpers'

// ── validateGameConfig ────────────────────────────────────────

describe('validateGameConfig', () => {
  it('accepts a valid config', () => {
    expect(donationEngine.validateGameConfig(makeDonationConfig()).ok).toBe(true)
  })

  it('accepts config with optional targetAmountPence', () => {
    const result = donationEngine.validateGameConfig(makeDonationConfig({ targetAmountPence: 50000 }))
    expect(result.ok).toBe(true)
  })

  it('rejects negative targetAmountPence', () => {
    const result = donationEngine.validateGameConfig(makeDonationConfig({ targetAmountPence: -1 }))
    expect(result.ok).toBe(false)
  })

  it('rejects non-object input', () => {
    expect(donationEngine.validateGameConfig(null).ok).toBe(false)
    expect(donationEngine.validateGameConfig('string').ok).toBe(false)
  })
})

// ── validateEntry ─────────────────────────────────────────────

describe('validateEntry', () => {
  it('accepts a valid donation entry', () => {
    const state = makeDonationState()
    const result = donationEngine.validateEntry(makeDonationEntry('e1', 500), state)
    expect(result.ok).toBe(true)
  })

  it('rejects when fundraiser is not open', () => {
    const state = makeDonationState({ status: 'closed' })
    const result = donationEngine.validateEntry(makeDonationEntry('e1', 500), state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('COMPETITION_NOT_OPEN')
  })

  it('rejects amountPence of 0', () => {
    const state = makeDonationState()
    const result = donationEngine.validateEntry(makeDonationEntry('e1', 0), state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/1p/i)
  })

  it('rejects negative amountPence', () => {
    const state = makeDonationState()
    const result = donationEngine.validateEntry(makeDonationEntry('e1', -100), state)
    expect(result.ok).toBe(false)
  })

  it('rejects anonymous donation when allowAnonymous is false', () => {
    const state = makeDonationState({ config: makeDonationConfig({ allowAnonymous: false }) })
    const entry = makeDonationEntry('e1', 500, 1, { isAnonymous: true })
    const result = donationEngine.validateEntry(entry, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ANONYMOUS_NOT_ALLOWED')
  })

  it('accepts anonymous donation when allowAnonymous is true', () => {
    const state = makeDonationState({ config: makeDonationConfig({ allowAnonymous: true }) })
    const entry = makeDonationEntry('e1', 500, 1, { isAnonymous: true })
    const result = donationEngine.validateEntry(entry, state)
    expect(result.ok).toBe(true)
  })

  it('allows multiple donations from the same user (no duplicate check)', () => {
    const existing = makeDonationEntry('e1', 500)
    const state = makeDonationState({ entries: [existing] })
    // Same userId — should still be accepted (donation game allows multiple donations)
    const second = makeDonationEntry('e2', 1000, 2, { userId: existing.userId })
    const result = donationEngine.validateEntry(second, state)
    expect(result.ok).toBe(true)
  })
})

// ── calculateLeaderboard ──────────────────────────────────────

describe('calculateLeaderboard', () => {
  it('returns empty leaderboard with no entries', () => {
    const lb = donationEngine.calculateLeaderboard(makeDonationState())
    expect(lb.entries).toHaveLength(0)
  })

  it('ranks by amount descending', () => {
    const state = makeDonationState({
      entries: [
        makeDonationEntry('e1', 200, 1),
        makeDonationEntry('e2', 1000, 2),
        makeDonationEntry('e3', 500, 3),
      ],
    })
    const lb = donationEngine.calculateLeaderboard(state)
    expect(lb.entries[0].entryId).toBe('e2')   // £10
    expect(lb.entries[1].entryId).toBe('e3')   // £5
    expect(lb.entries[2].entryId).toBe('e1')   // £2
  })

  it('breaks amount ties by entry number (earlier first)', () => {
    const state = makeDonationState({
      entries: [
        makeDonationEntry('e1', 500, 2),   // same amount, later
        makeDonationEntry('e2', 500, 1),   // same amount, earlier
      ],
    })
    const lb = donationEngine.calculateLeaderboard(state)
    expect(lb.entries[0].entryId).toBe('e2')  // entryNumber 1 is first
  })

  it('masks userId as __anonymous__ for anonymous entries', () => {
    const state = makeDonationState({
      entries: [makeDonationEntry('e1', 500, 1, { isAnonymous: true })],
    })
    const lb = donationEngine.calculateLeaderboard(state)
    expect(lb.entries[0].userId).toBe('__anonymous__')
  })

  it('hides message for anonymous entries', () => {
    const state = makeDonationState({
      entries: [makeDonationEntry('e1', 500, 1, { isAnonymous: true, message: 'secret' })],
    })
    const lb = donationEngine.calculateLeaderboard(state)
    expect((lb.entries[0].details as { message?: string })?.message).toBeUndefined()
  })

  it('no entries are ever marked isWinner', () => {
    const state = makeDonationState({
      entries: [makeDonationEntry('e1', 500)],
      status: 'settled',
    })
    const lb = donationEngine.calculateLeaderboard(state)
    expect(lb.winnerEntryIds).toHaveLength(0)
    expect(lb.entries.every(e => !e.isWinner)).toBe(true)
  })

  it('marks isSettled correctly', () => {
    const open = donationEngine.calculateLeaderboard(makeDonationState({ status: 'open' }))
    expect(open.isSettled).toBe(false)
    const settled = donationEngine.calculateLeaderboard(makeDonationState({ status: 'settled' }))
    expect(settled.isSettled).toBe(true)
  })
})

// ── settleCompetition ─────────────────────────────────────────

describe('settleCompetition', () => {
  it('sums totalRaisedPence from all entries', () => {
    const state = makeDonationState({
      entries: [
        makeDonationEntry('e1', 500),
        makeDonationEntry('e2', 1000, 2),
        makeDonationEntry('e3', 750, 3),
      ],
    })
    const result = donationEngine.settleCompetition(state, {})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.details.totalRaisedPence).toBe(2250)
    expect(result.data.details.totalDonors).toBe(3)
  })

  it('reports targetMet:true when total meets target', () => {
    const state = makeDonationState({
      config: makeDonationConfig({ targetAmountPence: 1000 }),
      entries: [makeDonationEntry('e1', 1000), makeDonationEntry('e2', 500, 2)],
    })
    const result = donationEngine.settleCompetition(state, {})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.details.targetMet).toBe(true)
  })

  it('reports targetMet:false when total is below target', () => {
    const state = makeDonationState({
      config: makeDonationConfig({ targetAmountPence: 10000 }),
      entries: [makeDonationEntry('e1', 500)],
    })
    const result = donationEngine.settleCompetition(state, {})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.details.targetMet).toBe(false)
  })

  it('reports targetMet:null when no target is set', () => {
    const state = makeDonationState({
      entries: [makeDonationEntry('e1', 500)],
    })
    const result = donationEngine.settleCompetition(state, {})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.details.targetMet).toBeNull()
  })

  it('always returns empty winnerEntryIds', () => {
    const state = makeDonationState({
      entries: [makeDonationEntry('e1', 99999)],
    })
    const result = donationEngine.settleCompetition(state, {})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toHaveLength(0)
  })

  it('handles no entries gracefully', () => {
    const result = donationEngine.settleCompetition(makeDonationState(), {})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.details.totalRaisedPence).toBe(0)
    expect(result.data.details.totalDonors).toBe(0)
  })
})

// ── getParticipantStatus ──────────────────────────────────────

describe('getParticipantStatus', () => {
  it('returns null for unknown entryId', () => {
    const status = donationEngine.getParticipantStatus('nope', makeDonationState())
    expect(status).toBeNull()
  })

  it('exposes amountPence as score', () => {
    const state = makeDonationState({ entries: [makeDonationEntry('e1', 750)] })
    const status = donationEngine.getParticipantStatus('e1', state)
    expect(status?.score).toBe(750)
  })

  it('exposes totalRaisedPence in details', () => {
    const state = makeDonationState({
      entries: [makeDonationEntry('e1', 500)],
      totalRaisedPence: 500,
    })
    const status = donationEngine.getParticipantStatus('e1', state)
    expect((status?.details as { totalRaisedPence: number })?.totalRaisedPence).toBe(500)
  })

  it('isWinner and isEliminated are always false', () => {
    const state = makeDonationState({ entries: [makeDonationEntry('e1', 500)], status: 'settled' })
    const status = donationEngine.getParticipantStatus('e1', state)
    expect(status?.isWinner).toBe(false)
    expect(status?.isEliminated).toBe(false)
  })
})

// ── getAvailableActions ───────────────────────────────────────

describe('getAvailableActions', () => {
  it('returns VIEW_RESULTS after settlement', () => {
    const state = makeDonationState({
      entries: [makeDonationEntry('e1', 500)],
      status: 'settled',
    })
    const actions = donationEngine.getAvailableActions('e1', state)
    expect(actions.some(a => a.type === 'VIEW_RESULTS')).toBe(true)
  })

  it('returns no actions while open', () => {
    const state = makeDonationState({ entries: [makeDonationEntry('e1', 500)], status: 'open' })
    const actions = donationEngine.getAvailableActions('e1', state)
    expect(actions).toHaveLength(0)
  })

  it('returns empty for unknown entryId', () => {
    const actions = donationEngine.getAvailableActions('nope', makeDonationState())
    expect(actions).toHaveLength(0)
  })
})

// ── explainRulesForParticipant ────────────────────────────────

describe('explainRulesForParticipant', () => {
  it('returns a non-empty explanation', () => {
    const explanation = donationEngine.explainRulesForParticipant(makeDonationConfig())
    expect(explanation.summary).toBeTruthy()
    expect(explanation.howToWin).toBeTruthy()
    expect(explanation.sections.length).toBeGreaterThan(0)
  })

  it('mentions target amount when set', () => {
    const config = makeDonationConfig({ targetAmountPence: 10000 })
    const explanation = donationEngine.explainRulesForParticipant(config)
    expect(explanation.summary).toMatch(/£100/)
  })

  it('mentions anonymity policy correctly', () => {
    const anonConfig = makeDonationConfig({ allowAnonymous: true })
    const exAnon = donationEngine.explainRulesForParticipant(anonConfig)
    const anonSection = exAnon.sections.find(s => s.heading === 'Anonymity')
    expect(anonSection?.content).toMatch(/anonymously/i)

    const noAnonConfig = makeDonationConfig({ allowAnonymous: false })
    const exNoAnon = donationEngine.explainRulesForParticipant(noAnonConfig)
    const noAnonSection = exNoAnon.sections.find(s => s.heading === 'Anonymity')
    expect(noAnonSection?.content).toMatch(/attributed/i)
  })
})
