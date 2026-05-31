import { describe, it, expect } from 'vitest'
import { teamCardEngine } from '../team-card'
import {
  makeTeamCardConfig, makeTeamCardState, makeTeamCardEntry, makeSlot,
} from './helpers'
import type { TeamCardGameState } from '../types'

// ── validateGameConfig ────────────────────────────────────────

describe('validateGameConfig', () => {
  it('accepts a valid config with 4 slots', () => {
    expect(teamCardEngine.validateGameConfig(makeTeamCardConfig(4)).ok).toBe(true)
  })

  it('rejects fewer than 2 slots', () => {
    const result = teamCardEngine.validateGameConfig(makeTeamCardConfig(1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/2/i)
  })

  it('rejects duplicate slot numbers', () => {
    const slots = [
      makeSlot(1),
      makeSlot(1),   // duplicate
      makeSlot(3),
    ]
    const result = teamCardEngine.validateGameConfig(makeTeamCardConfig(2, { slots }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unique/i)
  })

  it('rejects duplicate slot IDs', () => {
    const slots = [
      { ...makeSlot(1), id: 'same-id' },
      { ...makeSlot(2), id: 'same-id' },
    ]
    const result = teamCardEngine.validateGameConfig(makeTeamCardConfig(2, { slots }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unique/i)
  })

  it('accepts both assignment methods', () => {
    expect(teamCardEngine.validateGameConfig(makeTeamCardConfig(4, { assignmentMethod: 'participant_choice' })).ok).toBe(true)
    expect(teamCardEngine.validateGameConfig(makeTeamCardConfig(4, { assignmentMethod: 'random_assignment' })).ok).toBe(true)
  })

  it('rejects non-object input', () => {
    expect(teamCardEngine.validateGameConfig(null).ok).toBe(false)
    expect(teamCardEngine.validateGameConfig(42).ok).toBe(false)
  })
})

// ── validateEntry ─────────────────────────────────────────────

describe('validateEntry', () => {
  it('accepts a valid entry for an available slot', () => {
    const state = makeTeamCardState()
    const slot = state.config.slots[0]
    const entry = makeTeamCardEntry('e1', slot.id, slot)
    const result = teamCardEngine.validateEntry(entry, state)
    expect(result.ok).toBe(true)
  })

  it('rejects when competition is not open', () => {
    const state = makeTeamCardState({ status: 'closed' })
    const slot = state.config.slots[0]
    const result = teamCardEngine.validateEntry(makeTeamCardEntry('e1', slot.id, slot), state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('COMPETITION_NOT_OPEN')
  })

  it('rejects entry for unknown slot ID', () => {
    const state = makeTeamCardState()
    const slot = makeSlot(99)
    const result = teamCardEngine.validateEntry(makeTeamCardEntry('e1', 'slot-99', slot), state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('SLOT_NOT_FOUND')
  })

  it('rejects entry for a void slot', () => {
    const slots = [makeSlot(1, { status: 'void' }), makeSlot(2)]
    const state = makeTeamCardState({ config: makeTeamCardConfig(2, { slots }) })
    const result = teamCardEngine.validateEntry(makeTeamCardEntry('e1', 'slot-1', slots[0]), state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('SLOT_VOID')
  })

  it('rejects entry for a sold slot', () => {
    const slots = [makeSlot(1, { status: 'sold' }), makeSlot(2)]
    const state = makeTeamCardState({ config: makeTeamCardConfig(2, { slots }) })
    const result = teamCardEngine.validateEntry(makeTeamCardEntry('e1', 'slot-1', slots[0]), state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('SLOT_TAKEN')
  })

  it('rejects entry for a reserved slot', () => {
    const slots = [makeSlot(1, { status: 'reserved' }), makeSlot(2)]
    const state = makeTeamCardState({ config: makeTeamCardConfig(2, { slots }) })
    const result = teamCardEngine.validateEntry(makeTeamCardEntry('e1', 'slot-1', slots[0]), state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('SLOT_TAKEN')
  })

  it('rejects duplicate userId', () => {
    const slot1 = makeSlot(1)
    const slot2 = makeSlot(2)
    const state = makeTeamCardState({
      config: makeTeamCardConfig(2, { slots: [slot1, slot2] }),
      entries: [makeTeamCardEntry('e1', slot1.id, slot1)],
    })
    // e2 has same userId as e1 (user-e1)
    const dupe = { ...makeTeamCardEntry('e2', slot2.id, slot2), userId: 'user-e1' }
    const result = teamCardEngine.validateEntry(dupe, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('DUPLICATE_ENTRY')
  })

  it('attaches the resolved slot to the validated entry', () => {
    const state = makeTeamCardState()
    const slot = state.config.slots[0]
    const result = teamCardEngine.validateEntry(makeTeamCardEntry('e1', slot.id, slot), state)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const entry = result.data as { slot: typeof slot }
      expect(entry.slot.id).toBe(slot.id)
    }
  })
})

// ── settleCompetition ─────────────────────────────────────────

describe('settleCompetition', () => {
  function makeState(): TeamCardGameState {
    const slots = [makeSlot(1), makeSlot(2), makeSlot(3)]
    const state = makeTeamCardState({
      config: makeTeamCardConfig(3, { slots }),
      status: 'closed',
    })
    return {
      ...state,
      entries: [
        makeTeamCardEntry('e1', 'slot-1', slots[0]),
        makeTeamCardEntry('e2', 'slot-2', slots[1]),
        makeTeamCardEntry('e3', 'slot-3', slots[2], 3),
      ],
    }
  }

  it('identifies the holder of the winning slot as winner', () => {
    const state = makeState()
    const result = teamCardEngine.settleCompetition(state, { winningSlotId: 'slot-2' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e2'])
    expect(result.data.loserEntryIds).toContain('e1')
    expect(result.data.loserEntryIds).toContain('e3')
  })

  it('returns empty winnerEntryIds if winning slot has no entry', () => {
    const slots = [makeSlot(1), makeSlot(2, { status: 'available' })]
    const state = makeTeamCardState({
      config: makeTeamCardConfig(2, { slots }),
      entries: [makeTeamCardEntry('e1', 'slot-1', slots[0])],
      status: 'closed',
    })
    const result = teamCardEngine.settleCompetition(state, { winningSlotId: 'slot-2' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toHaveLength(0)
    expect(result.data.details.hasWinner).toBe(false)
  })

  it('rejects unknown winning slot', () => {
    const state = makeState()
    const result = teamCardEngine.settleCompetition(state, { winningSlotId: 'slot-99' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('SLOT_NOT_FOUND')
  })

  it('rejects voided winning slot', () => {
    const slots = [makeSlot(1, { status: 'void' }), makeSlot(2)]
    const state = makeTeamCardState({
      config: makeTeamCardConfig(2, { slots }),
      entries: [makeTeamCardEntry('e2', 'slot-2', slots[1])],
      status: 'closed',
    })
    const result = teamCardEngine.settleCompetition(state, { winningSlotId: 'slot-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('WINNING_SLOT_VOID')
  })

  it('includes voided entries in voidEntryIds', () => {
    const slots = [makeSlot(1, { status: 'void' }), makeSlot(2), makeSlot(3)]
    const state = makeTeamCardState({
      config: makeTeamCardConfig(3, { slots }),
      entries: [
        makeTeamCardEntry('e1', 'slot-1', slots[0]),  // in voided slot
        makeTeamCardEntry('e2', 'slot-2', slots[1]),
        makeTeamCardEntry('e3', 'slot-3', slots[2], 3),
      ],
      status: 'closed',
    })
    const result = teamCardEngine.settleCompetition(state, { winningSlotId: 'slot-2' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.voidEntryIds).toContain('e1')
    expect(result.data.winnerEntryIds).toEqual(['e2'])
  })

  it('rejects invalid settlement input', () => {
    const state = makeState()
    const result = teamCardEngine.settleCompetition(state, { bad: 'data' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_SETTLEMENT_INPUT')
  })
})

// ── calculateLeaderboard ──────────────────────────────────────

describe('calculateLeaderboard', () => {
  it('marks winner at rank 1 after settlement', () => {
    const slots = [makeSlot(1), makeSlot(2)]
    const state = makeTeamCardState({
      config: makeTeamCardConfig(2, { slots }),
      entries: [
        makeTeamCardEntry('e1', 'slot-1', slots[0]),
        makeTeamCardEntry('e2', 'slot-2', slots[1]),
      ],
      status: 'settled',
      winningSlotId: 'slot-2',
    })
    const lb = teamCardEngine.calculateLeaderboard(state)
    const winner = lb.entries.find(e => e.entryId === 'e2')
    expect(winner?.isWinner).toBe(true)
    expect(winner?.rank).toBe(1)
  })

  it('no winners before settlement', () => {
    const slots = [makeSlot(1), makeSlot(2)]
    const state = makeTeamCardState({
      config: makeTeamCardConfig(2, { slots }),
      entries: [makeTeamCardEntry('e1', 'slot-1', slots[0])],
      status: 'open',
    })
    const lb = teamCardEngine.calculateLeaderboard(state)
    expect(lb.winnerEntryIds).toHaveLength(0)
    expect(lb.entries.every(e => !e.isWinner)).toBe(true)
  })

  it('marks isSettled correctly', () => {
    const open = teamCardEngine.calculateLeaderboard(makeTeamCardState({ status: 'open' }))
    expect(open.isSettled).toBe(false)
    const settled = teamCardEngine.calculateLeaderboard(makeTeamCardState({ status: 'settled' }))
    expect(settled.isSettled).toBe(true)
  })
})

// ── getParticipantStatus ──────────────────────────────────────

describe('getParticipantStatus', () => {
  it('returns null for unknown entryId', () => {
    const status = teamCardEngine.getParticipantStatus('nope', makeTeamCardState())
    expect(status).toBeNull()
  })

  it('returns isWinner:true when winning slot matches', () => {
    const slots = [makeSlot(1), makeSlot(2)]
    const entry = makeTeamCardEntry('e1', 'slot-1', slots[0])
    const state = makeTeamCardState({
      config: makeTeamCardConfig(2, { slots }),
      entries: [entry],
      status: 'settled',
      winningSlotId: 'slot-1',
    })
    const status = teamCardEngine.getParticipantStatus('e1', state)
    expect(status?.isWinner).toBe(true)
    expect(status?.status).toBe('winner')
  })

  it('returns isWinner:false when winning slot does not match', () => {
    const slots = [makeSlot(1), makeSlot(2)]
    const entry = makeTeamCardEntry('e1', 'slot-1', slots[0])
    const state = makeTeamCardState({
      config: makeTeamCardConfig(2, { slots }),
      entries: [entry],
      status: 'settled',
      winningSlotId: 'slot-2',
    })
    const status = teamCardEngine.getParticipantStatus('e1', state)
    expect(status?.isWinner).toBe(false)
  })
})

// ── getAvailableActions ───────────────────────────────────────

describe('getAvailableActions', () => {
  it('returns VIEW_RESULTS after settlement', () => {
    const slot = makeSlot(1)
    const state = makeTeamCardState({
      entries: [makeTeamCardEntry('e1', slot.id, slot)],
      status: 'settled',
    })
    const actions = teamCardEngine.getAvailableActions('e1', state)
    expect(actions.some(a => a.type === 'VIEW_RESULTS')).toBe(true)
  })

  it('returns empty actions for open competition', () => {
    const slot = makeSlot(1)
    const state = makeTeamCardState({
      entries: [makeTeamCardEntry('e1', slot.id, slot)],
      status: 'open',
    })
    const actions = teamCardEngine.getAvailableActions('e1', state)
    expect(actions).toHaveLength(0)
  })

  it('returns empty for unknown entryId', () => {
    const actions = teamCardEngine.getAvailableActions('nope', makeTeamCardState())
    expect(actions).toHaveLength(0)
  })
})

// ── explainRulesForParticipant ────────────────────────────────

describe('explainRulesForParticipant', () => {
  it('returns a non-empty explanation', () => {
    const explanation = teamCardEngine.explainRulesForParticipant(makeTeamCardConfig())
    expect(explanation.summary).toBeTruthy()
    expect(explanation.howToWin).toBeTruthy()
    expect(explanation.sections.length).toBeGreaterThan(0)
  })

  it('mentions participant choice method', () => {
    const config = makeTeamCardConfig(4, { assignmentMethod: 'participant_choice' })
    const explanation = teamCardEngine.explainRulesForParticipant(config)
    expect(explanation.howToWin).toMatch(/choose/i)
  })

  it('mentions random assignment method', () => {
    const config = makeTeamCardConfig(4, { assignmentMethod: 'random_assignment' })
    const explanation = teamCardEngine.explainRulesForParticipant(config)
    expect(explanation.howToWin).toMatch(/random/i)
  })
})
