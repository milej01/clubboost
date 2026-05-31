import { describe, it, expect } from 'vitest'
import { lmsEngine, validateLMSPick } from '../lms'
import {
  makeLMSConfig, makeLMSState, makeLMSEntry, makeLMSRoundResult,
} from './helpers'
import type { LMSGameState, LMSEntry, LMSRoundResult } from '../types'

// ── validateGameConfig ────────────────────────────────────────

describe('validateGameConfig', () => {
  it('accepts a valid config', () => {
    expect(lmsEngine.validateGameConfig(makeLMSConfig()).ok).toBe(true)
  })

  it('rejects fewer than 2 teams', () => {
    const result = lmsEngine.validateGameConfig(makeLMSConfig({ availableTeams: ['Only'] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/2 teams/i)
  })

  it('rejects maxRounds < 1', () => {
    const result = lmsEngine.validateGameConfig(makeLMSConfig({ maxRounds: 0 }))
    expect(result.ok).toBe(false)
  })

  it('rejects buybackUntilRound > maxRounds', () => {
    const result = lmsEngine.validateGameConfig(
      makeLMSConfig({ maxRounds: 5, buybackEnabled: true, buybackUntilRound: 10 })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/buybackUntilRound/i)
  })

  it('rejects duplicate team names (case-insensitive)', () => {
    const result = lmsEngine.validateGameConfig(
      makeLMSConfig({ availableTeams: ['Arsenal', 'arsenal', 'Chelsea'] })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unique/i)
  })
})

// ── validateEntry ─────────────────────────────────────────────

describe('validateEntry', () => {
  it('accepts a valid new entry', () => {
    const state = makeLMSState()
    const result = lmsEngine.validateEntry(makeLMSEntry('e1'), state)
    expect(result.ok).toBe(true)
  })

  it('rejects when competition is not open or in_progress', () => {
    const state = makeLMSState({ status: 'closed' })
    const result = lmsEngine.validateEntry(makeLMSEntry('e1'), state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('COMPETITION_NOT_OPEN')
  })

  it('rejects duplicate userId', () => {
    const entry = makeLMSEntry('e1')
    const state = makeLMSState({ entries: [entry] })
    const dupe = makeLMSEntry('e2', 2, { userId: 'user-e1' })
    const result = lmsEngine.validateEntry(dupe, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('DUPLICATE_ENTRY')
  })
})

// ── validateLMSPick ───────────────────────────────────────────

describe('validateLMSPick', () => {
  it('accepts a valid pick for the current round', () => {
    const entry = makeLMSEntry('e1')
    const state = makeLMSState({ entries: [entry], currentRound: 1, status: 'in_progress' })
    const result = validateLMSPick({ entryId: 'e1', roundNumber: 1, teamName: 'Arsenal' }, state)
    expect(result.ok).toBe(true)
  })

  it('rejects pick for wrong round', () => {
    const entry = makeLMSEntry('e1')
    const state = makeLMSState({ entries: [entry], currentRound: 2, status: 'in_progress' })
    const result = validateLMSPick({ entryId: 'e1', roundNumber: 1, teamName: 'Arsenal' }, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('WRONG_ROUND')
  })

  it('rejects team not in available teams', () => {
    const entry = makeLMSEntry('e1')
    const state = makeLMSState({ entries: [entry], currentRound: 1 })
    const result = validateLMSPick({ entryId: 'e1', roundNumber: 1, teamName: 'NotATeam' }, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('TEAM_NOT_AVAILABLE')
  })

  it('rejects reused team when allowTeamReuse is false', () => {
    const entry = makeLMSEntry('e1', 1, {
      roundPicks: [{ roundNumber: 1, teamName: 'Arsenal', result: 'correct' }],
    })
    const state = makeLMSState({
      config: makeLMSConfig({ allowTeamReuse: false }),
      entries: [entry],
      currentRound: 2,
      status: 'in_progress',
    })
    const result = validateLMSPick({ entryId: 'e1', roundNumber: 2, teamName: 'Arsenal' }, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('TEAM_ALREADY_USED')
  })

  it('allows reused team when allowTeamReuse is true', () => {
    const entry = makeLMSEntry('e1', 1, {
      roundPicks: [{ roundNumber: 1, teamName: 'Arsenal', result: 'correct' }],
    })
    const state = makeLMSState({
      config: makeLMSConfig({ allowTeamReuse: true }),
      entries: [entry],
      currentRound: 2,
      status: 'in_progress',
    })
    const result = validateLMSPick({ entryId: 'e1', roundNumber: 2, teamName: 'Arsenal' }, state)
    expect(result.ok).toBe(true)
  })

  it('is case-insensitive for team names', () => {
    const entry = makeLMSEntry('e1', 1, {
      roundPicks: [{ roundNumber: 1, teamName: 'Arsenal', result: 'correct' }],
    })
    const state = makeLMSState({
      config: makeLMSConfig({ allowTeamReuse: false }),
      entries: [entry],
      currentRound: 2,
      status: 'in_progress',
    })
    const result = validateLMSPick({ entryId: 'e1', roundNumber: 2, teamName: 'ARSENAL' }, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('TEAM_ALREADY_USED')
  })

  it('rejects pick if already submitted for this round', () => {
    const entry = makeLMSEntry('e1', 1, {
      roundPicks: [{ roundNumber: 1, teamName: 'Arsenal', result: 'pending' }],
    })
    const state = makeLMSState({ entries: [entry], currentRound: 1, status: 'in_progress' })
    const result = validateLMSPick({ entryId: 'e1', roundNumber: 1, teamName: 'Chelsea' }, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('PICK_ALREADY_SUBMITTED')
  })

  it('rejects pick for eliminated entry', () => {
    const entry = makeLMSEntry('e1', 1, { status: 'eliminated' })
    const state = makeLMSState({ entries: [entry], currentRound: 1 })
    const result = validateLMSPick({ entryId: 'e1', roundNumber: 1, teamName: 'Arsenal' }, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ENTRY_NOT_ACTIVE')
  })
})

// ── settleCompetition ─────────────────────────────────────────

describe('settleCompetition', () => {
  function entryWithPick(id: string, entryNumber: number, round: number, team: string): LMSEntry {
    return makeLMSEntry(id, entryNumber, {
      roundPicks: [{ roundNumber: round, teamName: team, result: 'pending' }],
    })
  }

  it('identifies the last man standing as winner', () => {
    // e1 picks Arsenal (survives), e2 picks Chelsea (eliminated)
    const state = makeLMSState({
      entries: [
        entryWithPick('e1', 1, 1, 'Arsenal'),
        entryWithPick('e2', 2, 1, 'Chelsea'),
      ],
      currentRound: 1,
      status: 'closed',
    })
    const result = lmsEngine.settleCompetition(state, {
      rounds: [{ roundNumber: 1, survivingTeams: ['Arsenal'], eliminatedTeams: ['Chelsea'], drawnTeams: [] }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e1'])
    expect(result.data.loserEntryIds).toContain('e2')
  })

  it('eliminates participant with no pick (missed deadline)', () => {
    const state = makeLMSState({
      entries: [
        entryWithPick('e1', 1, 1, 'Arsenal'),
        makeLMSEntry('e2', 2),  // no pick at all
      ],
      currentRound: 1,
      status: 'closed',
    })
    const result = lmsEngine.settleCompetition(state, {
      rounds: [{ roundNumber: 1, survivingTeams: ['Arsenal'], eliminatedTeams: [], drawnTeams: [] }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e1'])
  })

  it('draws eliminate by default when drawCountsAsSurvival is false', () => {
    const state = makeLMSState({
      config: makeLMSConfig({ drawCountsAsSurvival: false }),
      entries: [
        entryWithPick('e1', 1, 1, 'Arsenal'),  // Arsenal drew
        entryWithPick('e2', 2, 1, 'Liverpool'), // Liverpool won
      ],
      currentRound: 1,
      status: 'closed',
    })
    const result = lmsEngine.settleCompetition(state, {
      rounds: [{ roundNumber: 1, survivingTeams: ['Liverpool'], eliminatedTeams: [], drawnTeams: ['Arsenal'] }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e2'])
  })

  it('draws count as survival when drawCountsAsSurvival is true', () => {
    const state = makeLMSState({
      config: makeLMSConfig({ drawCountsAsSurvival: true }),
      entries: [
        entryWithPick('e1', 1, 1, 'Arsenal'),  // Arsenal drew
        entryWithPick('e2', 2, 1, 'Chelsea'),  // Chelsea eliminated
      ],
      currentRound: 1,
      status: 'closed',
    })
    const result = lmsEngine.settleCompetition(state, {
      rounds: [{ roundNumber: 1, survivingTeams: [], eliminatedTeams: ['Chelsea'], drawnTeams: ['Arsenal'] }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e1'])
  })

  it('handles multi-round settlement correctly', () => {
    // Round 1: e1=Arsenal (survives), e2=Chelsea (eliminated)
    // Round 2: e1=Liverpool (survives)
    // e1 is the winner
    const state = makeLMSState({
      entries: [
        makeLMSEntry('e1', 1, {
          roundPicks: [
            { roundNumber: 1, teamName: 'Arsenal', result: 'pending' },
            { roundNumber: 2, teamName: 'Liverpool', result: 'pending' },
          ],
        }),
        makeLMSEntry('e2', 2, {
          roundPicks: [{ roundNumber: 1, teamName: 'Chelsea', result: 'pending' }],
        }),
      ],
      currentRound: 2,
      status: 'closed',
    })
    const result = lmsEngine.settleCompetition(state, {
      rounds: [
        { roundNumber: 1, survivingTeams: ['Arsenal'], eliminatedTeams: ['Chelsea'], drawnTeams: [] },
        { roundNumber: 2, survivingTeams: ['Liverpool'], eliminatedTeams: [], drawnTeams: [] },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e1'])
  })

  it('when all eliminated same round, applies tiebreaker (earliest_entry)', () => {
    const state = makeLMSState({
      config: makeLMSConfig({ tiebreaker: 'earliest_entry' }),
      entries: [
        entryWithPick('e1', 1, 1, 'Chelsea'),  // both eliminated
        entryWithPick('e2', 2, 1, 'Man City'),
      ],
      currentRound: 1,
      status: 'closed',
    })
    const result = lmsEngine.settleCompetition(state, {
      rounds: [{ roundNumber: 1, survivingTeams: [], eliminatedTeams: ['Chelsea', 'Man City'], drawnTeams: [] }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e1'])  // earliest entry wins
  })

  it('when all eliminated, manual tiebreaker requires tiebreakWinnerEntryId', () => {
    const state = makeLMSState({
      config: makeLMSConfig({ tiebreaker: 'manual' }),
      entries: [
        entryWithPick('e1', 1, 1, 'Chelsea'),
        entryWithPick('e2', 2, 1, 'Man City'),
      ],
      currentRound: 1,
      status: 'closed',
    })
    const result = lmsEngine.settleCompetition(state, {
      rounds: [{ roundNumber: 1, survivingTeams: [], eliminatedTeams: ['Chelsea', 'Man City'], drawnTeams: [] }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('MANUAL_TIEBREAKER_REQUIRED')
  })

  it('multiple survivors triggers tiebreaker (earliest_entry)', () => {
    // Both survive — tiebreaker picks e1
    const state = makeLMSState({
      config: makeLMSConfig({ tiebreaker: 'earliest_entry' }),
      entries: [
        entryWithPick('e1', 1, 1, 'Arsenal'),
        entryWithPick('e2', 2, 1, 'Liverpool'),
      ],
      currentRound: 1,
      status: 'closed',
    })
    const result = lmsEngine.settleCompetition(state, {
      rounds: [{ roundNumber: 1, survivingTeams: ['Arsenal', 'Liverpool'], eliminatedTeams: [], drawnTeams: [] }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e1'])
  })

  it('buyback keeps eliminated participant active for next round', () => {
    // Round 1: e1=Chelsea (eliminated, uses buyback round 1), e2=Arsenal (survives)
    // Round 2: e1=Liverpool (survives), e2=Chelsea (eliminated)
    // e1 survives via buyback; wins round 2
    const state = makeLMSState({
      config: makeLMSConfig({ buybackEnabled: true, buybackUntilRound: 3 }),
      entries: [
        makeLMSEntry('e1', 1, {
          usedBuyback: true,
          buybackRound: 1,
          roundPicks: [
            { roundNumber: 1, teamName: 'Chelsea', result: 'pending' },
            { roundNumber: 2, teamName: 'Liverpool', result: 'pending' },
          ],
        }),
        makeLMSEntry('e2', 2, {
          roundPicks: [
            { roundNumber: 1, teamName: 'Arsenal', result: 'pending' },
            { roundNumber: 2, teamName: 'Chelsea', result: 'pending' },
          ],
        }),
      ],
      currentRound: 2,
      status: 'closed',
    })
    const result = lmsEngine.settleCompetition(state, {
      rounds: [
        { roundNumber: 1, survivingTeams: ['Arsenal'], eliminatedTeams: ['Chelsea'], drawnTeams: [] },
        { roundNumber: 2, survivingTeams: ['Liverpool'], eliminatedTeams: ['Chelsea'], drawnTeams: [] },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e1'])
  })

  it('rejects settlement with no entries', () => {
    const state = makeLMSState({ status: 'closed' })
    const result = lmsEngine.settleCompetition(state, {
      rounds: [{ roundNumber: 1, survivingTeams: ['Arsenal'], eliminatedTeams: [], drawnTeams: [] }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NO_ENTRIES')
  })
})

// ── calculateLeaderboard ──────────────────────────────────────

describe('calculateLeaderboard', () => {
  it('ranks active entries above eliminated entries', () => {
    const state = makeLMSState({
      entries: [
        makeLMSEntry('e1', 1, { status: 'eliminated', eliminatedInRound: 1 }),
        makeLMSEntry('e2', 2, { status: 'active' }),
      ],
      currentRound: 2,
    })
    const lb = lmsEngine.calculateLeaderboard(state)
    expect(lb.entries[0].entryId).toBe('e2')
    expect(lb.entries[1].entryId).toBe('e1')
  })

  it('ranks later-eliminated entries above earlier-eliminated', () => {
    const state = makeLMSState({
      entries: [
        makeLMSEntry('e1', 1, { status: 'eliminated', eliminatedInRound: 1 }),
        makeLMSEntry('e2', 2, { status: 'eliminated', eliminatedInRound: 3 }),
      ],
      currentRound: 4,
    })
    const lb = lmsEngine.calculateLeaderboard(state)
    expect(lb.entries[0].entryId).toBe('e2')  // survived longer
    expect(lb.entries[1].entryId).toBe('e1')
  })

  it('marks isSettled correctly', () => {
    const settled = lmsEngine.calculateLeaderboard(makeLMSState({ status: 'settled' }))
    expect(settled.isSettled).toBe(true)
    const open = lmsEngine.calculateLeaderboard(makeLMSState({ status: 'open' }))
    expect(open.isSettled).toBe(false)
  })
})

// ── getAvailableActions ───────────────────────────────────────

describe('getAvailableActions', () => {
  it('offers SUBMIT_PICK to active entry that has not picked this round', () => {
    const e1 = makeLMSEntry('e1', 1)
    const state = makeLMSState({ entries: [e1], currentRound: 1, status: 'in_progress' })
    const actions = lmsEngine.getAvailableActions('e1', state)
    expect(actions.some(a => a.type === 'SUBMIT_PICK')).toBe(true)
  })

  it('does not offer SUBMIT_PICK if already picked this round', () => {
    const e1 = makeLMSEntry('e1', 1, {
      roundPicks: [{ roundNumber: 1, teamName: 'Arsenal', result: 'pending' }],
    })
    const state = makeLMSState({ entries: [e1], currentRound: 1, status: 'in_progress' })
    const actions = lmsEngine.getAvailableActions('e1', state)
    expect(actions.some(a => a.type === 'SUBMIT_PICK')).toBe(false)
  })

  it('offers USE_BUYBACK to eliminated entry within buyback window', () => {
    const e1 = makeLMSEntry('e1', 1, { status: 'eliminated', eliminatedInRound: 1, usedBuyback: false })
    const state = makeLMSState({
      config: makeLMSConfig({ buybackEnabled: true, buybackUntilRound: 3 }),
      entries: [e1],
      currentRound: 2,
      status: 'in_progress',
    })
    const actions = lmsEngine.getAvailableActions('e1', state)
    expect(actions.some(a => a.type === 'USE_BUYBACK')).toBe(true)
  })

  it('does not offer USE_BUYBACK if already used', () => {
    const e1 = makeLMSEntry('e1', 1, {
      status: 'eliminated',
      eliminatedInRound: 2,
      usedBuyback: true,
      buybackRound: 1,
    })
    const state = makeLMSState({
      config: makeLMSConfig({ buybackEnabled: true, buybackUntilRound: 5 }),
      entries: [e1],
      currentRound: 3,
    })
    const actions = lmsEngine.getAvailableActions('e1', state)
    expect(actions.some(a => a.type === 'USE_BUYBACK')).toBe(false)
  })
})

// ── explainRulesForParticipant ────────────────────────────────

describe('explainRulesForParticipant', () => {
  it('returns a non-empty explanation', () => {
    const config = makeLMSConfig()
    const explanation = lmsEngine.explainRulesForParticipant(config)
    expect(explanation.summary).toBeTruthy()
    expect(explanation.sections.length).toBeGreaterThan(0)
  })

  it('mentions draw rule in content', () => {
    const configDraw = makeLMSConfig({ drawCountsAsSurvival: true })
    const exDraw = lmsEngine.explainRulesForParticipant(configDraw)
    expect(exDraw.howToWin).toMatch(/draw/i)

    const configElim = makeLMSConfig({ drawCountsAsSurvival: false })
    const exElim = lmsEngine.explainRulesForParticipant(configElim)
    expect(exElim.howToWin).toMatch(/draw/i)
  })

  it('mentions buyback when enabled', () => {
    const config = makeLMSConfig({ buybackEnabled: true, buybackUntilRound: 3 })
    const explanation = lmsEngine.explainRulesForParticipant(config)
    const buybackSection = explanation.sections.find(s => s.heading === 'Buyback')
    expect(buybackSection?.content).toMatch(/round 3/i)
  })
})
