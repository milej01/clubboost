import { describe, it, expect } from 'vitest'
import { predictorEngine } from '../predictor'
import {
  makePredictorConfig, makePredictorState, makePredictorEntry, SIX_FIXTURES,
} from './helpers'
import type { PredictorGameState, PredictorSettlementInput } from '../types'

// ── validateGameConfig ────────────────────────────────────────

describe('validateGameConfig', () => {
  it('accepts a valid 6-fixture config', () => {
    const result = predictorEngine.validateGameConfig(makePredictorConfig())
    expect(result.ok).toBe(true)
  })

  it('rejects fewer than 6 fixtures', () => {
    const config = makePredictorConfig({ fixtures: SIX_FIXTURES.slice(0, 5) })
    const result = predictorEngine.validateGameConfig(config)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_CONFIG')
  })

  it('rejects more than 6 fixtures', () => {
    const extra = { id: 'f7', homeTeam: 'X', awayTeam: 'Y' }
    const config = makePredictorConfig({ fixtures: [...SIX_FIXTURES, extra] })
    const result = predictorEngine.validateGameConfig(config)
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate fixture IDs', () => {
    const fixtures = [...SIX_FIXTURES]
    fixtures[5] = { ...fixtures[5], id: 'f1' }
    const result = predictorEngine.validateGameConfig(makePredictorConfig({ fixtures }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unique/i)
  })

  it('rejects negative pointsPerCorrectResult', () => {
    const result = predictorEngine.validateGameConfig(
      makePredictorConfig({ pointsPerCorrectResult: 0 })
    )
    expect(result.ok).toBe(false)
  })

  it('rejects bonusPointsForExactScore > 0 when allowExactScore is false', () => {
    const result = predictorEngine.validateGameConfig(
      makePredictorConfig({ bonusPointsForExactScore: 3, allowExactScore: false })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/allowExactScore/i)
  })

  it('accepts bonusPoints when allowExactScore is true', () => {
    const result = predictorEngine.validateGameConfig(
      makePredictorConfig({ bonusPointsForExactScore: 3, allowExactScore: true })
    )
    expect(result.ok).toBe(true)
  })

  it('rejects non-object input', () => {
    expect(predictorEngine.validateGameConfig(null).ok).toBe(false)
    expect(predictorEngine.validateGameConfig('string').ok).toBe(false)
    expect(predictorEngine.validateGameConfig(42).ok).toBe(false)
  })
})

// ── validateEntry ─────────────────────────────────────────────

describe('validateEntry', () => {
  it('accepts a valid entry with 6 predictions', () => {
    const state = makePredictorState()
    const raw = makePredictorEntry('e1')
    const result = predictorEngine.validateEntry(raw, state)
    expect(result.ok).toBe(true)
  })

  it('rejects entry when competition is not open', () => {
    const state = makePredictorState({ status: 'closed' })
    const result = predictorEngine.validateEntry(makePredictorEntry('e1'), state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('COMPETITION_NOT_OPEN')
  })

  it('rejects entry with fewer than 6 predictions', () => {
    const state = makePredictorState()
    const entry = makePredictorEntry('e1')
    entry.predictions = entry.predictions.slice(0, 4)
    const result = predictorEngine.validateEntry(entry, state)
    expect(result.ok).toBe(false)
  })

  it('rejects entry with unknown fixture ID', () => {
    const state = makePredictorState()
    const entry = makePredictorEntry('e1')
    entry.predictions[0] = { fixtureId: 'UNKNOWN', result: 'home' }
    const result = predictorEngine.validateEntry(entry, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('UNKNOWN_FIXTURE')
  })

  it('rejects duplicate fixture predictions', () => {
    const state = makePredictorState()
    const entry = makePredictorEntry('e1')
    entry.predictions[1] = { ...entry.predictions[0] }  // duplicate f1
    const result = predictorEngine.validateEntry(entry, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('DUPLICATE_FIXTURE')
  })

  it('rejects exact score when allowExactScore is false', () => {
    const state = makePredictorState({ config: makePredictorConfig({ allowExactScore: false }) })
    const entry = makePredictorEntry('e1')
    entry.predictions[0] = { fixtureId: 'f1', result: 'home', homeScore: 2, awayScore: 0 }
    const result = predictorEngine.validateEntry(entry, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('EXACT_SCORE_NOT_ALLOWED')
  })

  it('accepts exact score when allowExactScore is true', () => {
    const state = makePredictorState({ config: makePredictorConfig({ allowExactScore: true }) })
    const entry = makePredictorEntry('e1')
    entry.predictions[0] = { fixtureId: 'f1', result: 'home', homeScore: 2, awayScore: 0 }
    const result = predictorEngine.validateEntry(entry, state)
    expect(result.ok).toBe(true)
  })

  it('rejects duplicate userId', () => {
    const entry = makePredictorEntry('e1')
    const state = makePredictorState({ entries: [{ ...entry, score: 0, correctResults: 0, exactScores: 0 }] })
    const newEntry = { ...makePredictorEntry('e2'), userId: 'user-e1' }
    const result = predictorEngine.validateEntry(newEntry, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('DUPLICATE_ENTRY')
  })

  it('rejects wrong game type state', () => {
    const lmsState = {
      type: 'LAST_MAN_STANDING' as const,
      config: { type: 'LAST_MAN_STANDING' as const, maxRounds: 5, allowTeamReuse: false, drawCountsAsSurvival: false, buybackEnabled: false, buybackUntilRound: 0, availableTeams: ['A', 'B'], tiebreaker: 'earliest_entry' as const },
      entries: [],
      currentRound: 1,
      status: 'open' as const,
      roundResults: [],
    }
    const result = predictorEngine.validateEntry(makePredictorEntry('e1'), lmsState)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('WRONG_GAME_TYPE')
  })

  it('score is 0 when fixtures have no results yet', () => {
    const state = makePredictorState()
    const result = predictorEngine.validateEntry(makePredictorEntry('e1'), state)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const entry = result.data as ReturnType<typeof makePredictorEntry>
      expect(entry.score).toBe(0)
    }
  })
})

// ── calculateLeaderboard ──────────────────────────────────────

describe('calculateLeaderboard', () => {
  it('returns empty leaderboard with no entries', () => {
    const lb = predictorEngine.calculateLeaderboard(makePredictorState())
    expect(lb.entries).toHaveLength(0)
    expect(lb.isSettled).toBe(false)
  })

  it('ranks entries by score descending', () => {
    const config = makePredictorConfig({
      fixtures: SIX_FIXTURES.map((f, i) =>
        i === 0 ? { ...f, result: 'home' as const } : f
      ),
    })
    // e1 predicts f1=home (correct), e2 predicts f1=draw (incorrect)
    const e1 = makePredictorEntry('e1', 1, ['home', 'draw', 'away', 'home', 'draw', 'away'])
    const e2 = makePredictorEntry('e2', 2, ['draw', 'draw', 'away', 'home', 'draw', 'away'])
    const state = makePredictorState({ config, entries: [e1, e2], status: 'settled' })

    const lb = predictorEngine.calculateLeaderboard(state)
    expect(lb.entries[0].entryId).toBe('e1')
    expect(lb.entries[0].score).toBe(1)
    expect(lb.entries[1].entryId).toBe('e2')
    expect(lb.entries[1].score).toBe(0)
  })

  it('assigns same rank to tied entries', () => {
    const config = makePredictorConfig({ fixtures: SIX_FIXTURES.map(f => ({ ...f, result: 'home' as const })) })
    const e1 = makePredictorEntry('e1', 1, ['home', 'home', 'home', 'home', 'home', 'home'])
    const e2 = makePredictorEntry('e2', 2, ['home', 'home', 'home', 'home', 'home', 'home'])
    const e3 = makePredictorEntry('e3', 3, ['draw', 'draw', 'draw', 'draw', 'draw', 'draw'])
    const state = makePredictorState({ config, entries: [e1, e2, e3], status: 'settled' })

    const lb = predictorEngine.calculateLeaderboard(state)
    expect(lb.entries[0].rank).toBe(1)
    expect(lb.entries[1].rank).toBe(1)  // tied at rank 1
    expect(lb.entries[2].rank).toBe(3)  // rank 3 (not 2)
  })

  it('counts correct exact scores with bonus points', () => {
    const config = makePredictorConfig({
      allowExactScore: true,
      bonusPointsForExactScore: 2,
      fixtures: SIX_FIXTURES.map((f, i) =>
        i === 0 ? { ...f, result: 'home' as const, homeScore: 2, awayScore: 0 } : f
      ),
    })
    const e1 = makePredictorEntry('e1', 1)
    e1.predictions[0] = { fixtureId: 'f1', result: 'home', homeScore: 2, awayScore: 0 }
    const e2 = makePredictorEntry('e2', 2)
    e2.predictions[0] = { fixtureId: 'f1', result: 'home' }  // correct result, no exact score

    const state = makePredictorState({ config, entries: [e1, e2], status: 'settled' })
    const lb = predictorEngine.calculateLeaderboard(state)
    expect(lb.entries[0].entryId).toBe('e1')
    expect(lb.entries[0].score).toBe(3)  // 1 correct + 2 bonus
    expect(lb.entries[1].score).toBe(1)  // 1 correct only
  })
})

// ── settleCompetition ─────────────────────────────────────────

describe('settleCompetition', () => {
  function makeSettledState(): PredictorGameState {
    const e1 = makePredictorEntry('e1', 1, ['home', 'draw', 'away', 'home', 'draw', 'away'])
    const e2 = makePredictorEntry('e2', 2, ['draw', 'home', 'home', 'away', 'home', 'home'])
    return makePredictorState({ entries: [e1, e2], status: 'closed' })
  }

  const FIXTURE_RESULTS: PredictorSettlementInput['fixtureResults'] = [
    { fixtureId: 'f1', homeScore: 2, awayScore: 0 },  // home
    { fixtureId: 'f2', homeScore: 1, awayScore: 1 },  // draw
    { fixtureId: 'f3', homeScore: 0, awayScore: 2 },  // away
    { fixtureId: 'f4', homeScore: 3, awayScore: 0 },  // home
    { fixtureId: 'f5', homeScore: 2, awayScore: 2 },  // draw
    { fixtureId: 'f6', homeScore: 0, awayScore: 1 },  // away
  ]

  it('correctly scores and picks a winner', () => {
    // e1 predicts exactly [home,draw,away,home,draw,away] = all 6 correct
    // e2 predicts [draw,home,home,away,home,home] = 0 correct
    const state = makeSettledState()
    const result = predictorEngine.settleCompetition(state, { fixtureResults: FIXTURE_RESULTS })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e1'])
    expect(result.data.loserEntryIds).toEqual(['e2'])
    expect(result.data.details.maxScore).toBe(6)
  })

  it('rejects empty entries', () => {
    const state = makePredictorState({ status: 'closed' })
    const result = predictorEngine.settleCompetition(state, { fixtureResults: FIXTURE_RESULTS })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NO_ENTRIES')
  })

  it('rejects invalid settlement input', () => {
    const state = makeSettledState()
    const result = predictorEngine.settleCompetition(state, { bad: 'data' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_SETTLEMENT_INPUT')
  })

  it('breaks tie by earliest_entry tiebreaker', () => {
    // Both e1 and e2 get 6/6 correct
    const e1 = makePredictorEntry('e1', 1, ['home', 'draw', 'away', 'home', 'draw', 'away'])
    const e2 = makePredictorEntry('e2', 2, ['home', 'draw', 'away', 'home', 'draw', 'away'])
    const state = makePredictorState({
      config: makePredictorConfig({ tiebreaker: 'earliest_entry' }),
      entries: [e1, e2],
      status: 'closed',
    })
    const result = predictorEngine.settleCompetition(state, { fixtureResults: FIXTURE_RESULTS })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e1'])
  })

  it('breaks tie by total_goals — closest predicted total wins', () => {
    // Both predict all correct. Actual total = 2+0+1+1+0+2+3+0+2+2+0+1 = 14
    const e1 = makePredictorEntry('e1', 1, ['home', 'draw', 'away', 'home', 'draw', 'away'], { predictedTotalGoals: 14 })
    const e2 = makePredictorEntry('e2', 2, ['home', 'draw', 'away', 'home', 'draw', 'away'], { predictedTotalGoals: 10 })
    const state = makePredictorState({
      config: makePredictorConfig({ tiebreaker: 'total_goals' }),
      entries: [e1, e2],
      status: 'closed',
    })
    const result = predictorEngine.settleCompetition(state, { fixtureResults: FIXTURE_RESULTS })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // actual = 2+0+1+1+0+2+3+0+2+2+0+1 = 14; e1 diff=0, e2 diff=4
    expect(result.data.winnerEntryIds).toEqual(['e1'])
  })

  it('breaks tie by manual — uses tiebreakWinnerEntryId', () => {
    const e1 = makePredictorEntry('e1', 1, ['home', 'draw', 'away', 'home', 'draw', 'away'])
    const e2 = makePredictorEntry('e2', 2, ['home', 'draw', 'away', 'home', 'draw', 'away'])
    const state = makePredictorState({
      config: makePredictorConfig({ tiebreaker: 'manual' }),
      entries: [e1, e2],
      status: 'closed',
    })
    const result = predictorEngine.settleCompetition(state, {
      fixtureResults: FIXTURE_RESULTS,
      tiebreakWinnerEntryId: 'e2',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.winnerEntryIds).toEqual(['e2'])
  })

  it('returns MANUAL_TIEBREAKER_REQUIRED when tied and no manual winner specified', () => {
    const e1 = makePredictorEntry('e1', 1, ['home', 'draw', 'away', 'home', 'draw', 'away'])
    const e2 = makePredictorEntry('e2', 2, ['home', 'draw', 'away', 'home', 'draw', 'away'])
    const state = makePredictorState({
      config: makePredictorConfig({ tiebreaker: 'manual' }),
      entries: [e1, e2],
      status: 'closed',
    })
    const result = predictorEngine.settleCompetition(state, { fixtureResults: FIXTURE_RESULTS })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('MANUAL_TIEBREAKER_REQUIRED')
  })

  it('derives fixture result correctly (home/draw/away)', () => {
    const e1 = makePredictorEntry('e1', 1, ['home', 'draw', 'away', 'home', 'draw', 'away'])
    const state = makePredictorState({ entries: [e1], status: 'closed' })
    const result = predictorEngine.settleCompetition(state, {
      fixtureResults: [
        { fixtureId: 'f1', homeScore: 1, awayScore: 0 }, // home → correct
        { fixtureId: 'f2', homeScore: 0, awayScore: 0 }, // draw → correct
        { fixtureId: 'f3', homeScore: 0, awayScore: 1 }, // away → correct
        { fixtureId: 'f4', homeScore: 0, awayScore: 0 }, // draw → e1 predicted home → wrong
        { fixtureId: 'f5', homeScore: 1, awayScore: 0 }, // home → e1 predicted draw → wrong
        { fixtureId: 'f6', homeScore: 1, awayScore: 0 }, // home → e1 predicted away → wrong
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.details.maxScore).toBe(3)
  })
})

// ── getParticipantStatus ──────────────────────────────────────

describe('getParticipantStatus', () => {
  it('returns null for unknown entryId', () => {
    const status = predictorEngine.getParticipantStatus('nope', makePredictorState())
    expect(status).toBeNull()
  })

  it('returns isWinner: true after settlement for winner', () => {
    const config = makePredictorConfig({
      fixtures: SIX_FIXTURES.map(f => ({ ...f, result: 'home' as const })),
    })
    const e1 = makePredictorEntry('e1', 1, ['home', 'home', 'home', 'home', 'home', 'home'])
    const state = makePredictorState({ config, entries: [e1], status: 'settled' })
    const status = predictorEngine.getParticipantStatus('e1', state)
    expect(status?.isWinner).toBe(true)
    expect(status?.score).toBe(6)
  })
})

// ── getAvailableActions ───────────────────────────────────────

describe('getAvailableActions', () => {
  it('returns empty array for open competition (no mid-game actions)', () => {
    const e1 = makePredictorEntry('e1', 1)
    const state = makePredictorState({ entries: [e1], status: 'open' })
    const actions = predictorEngine.getAvailableActions('e1', state)
    expect(actions).toHaveLength(0)
  })

  it('returns VIEW_RESULTS when settled', () => {
    const e1 = makePredictorEntry('e1', 1)
    const state = makePredictorState({ entries: [e1], status: 'settled' })
    const actions = predictorEngine.getAvailableActions('e1', state)
    expect(actions.some(a => a.type === 'VIEW_RESULTS')).toBe(true)
  })

  it('returns empty array for unknown entryId', () => {
    const state = makePredictorState({ status: 'settled' })
    const actions = predictorEngine.getAvailableActions('nope', state)
    expect(actions).toHaveLength(0)
  })
})

// ── explainRulesForParticipant ────────────────────────────────

describe('explainRulesForParticipant', () => {
  it('returns a non-empty explanation', () => {
    const config = makePredictorConfig()
    const explanation = predictorEngine.explainRulesForParticipant(config)
    expect(explanation.summary).toBeTruthy()
    expect(explanation.howToWin).toBeTruthy()
    expect(explanation.sections.length).toBeGreaterThan(0)
  })

  it('mentions exact score when allowExactScore is true', () => {
    const config = makePredictorConfig({ allowExactScore: true, bonusPointsForExactScore: 2 })
    const explanation = predictorEngine.explainRulesForParticipant(config)
    expect(explanation.scoring).toMatch(/bonus/i)
  })

  it('mentions tiebreaker type', () => {
    const explanation = predictorEngine.explainRulesForParticipant(
      makePredictorConfig({ tiebreaker: 'total_goals' })
    )
    expect(explanation.tiebreaker).toMatch(/total goals/i)
  })
})
