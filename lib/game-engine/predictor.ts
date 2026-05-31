import { z } from 'zod'
import {
  ok, err,
  type GameConfig, type GameState, type ValidatedEntry,
  type GameResult, type Leaderboard, type LeaderboardEntry,
  type ParticipantStatus, type AvailableAction, type RuleExplanation,
  type SettlementResult, type GameEngine, type GameDefinition,
  type PredictorConfig, type PredictorGameState, type ValidatedPredictorEntry,
  type PredictorEntryInput, type PredictorSettlementInput, type FixtureResult,
} from './types'

// ── Zod schemas ───────────────────────────────────────────────

const fixtureResultSchema = z.enum(['home', 'draw', 'away'])

const predictionSchema = z.object({
  fixtureId: z.string().min(1),
  result:    fixtureResultSchema,
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
})

const entryInputSchema = z.object({
  entryId:             z.string().min(1),
  userId:              z.string().min(1),
  entryNumber:         z.number().int().positive(),
  enteredAt:           z.string().datetime(),
  predictions:         z.array(predictionSchema).length(6, 'Exactly 6 predictions required'),
  predictedTotalGoals: z.number().int().min(0).optional(),
})

const fixtureSchema = z.object({
  id:        z.string().min(1),
  homeTeam:  z.string().min(1),
  awayTeam:  z.string().min(1),
  kickoffAt: z.string().datetime().optional(),
  result:    fixtureResultSchema.optional(),
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
})

const configSchema = z.object({
  type:                      z.literal('SIX_RESULT_PREDICTOR'),
  fixtures:                  z.array(fixtureSchema).length(6, 'Exactly 6 fixtures required'),
  pointsPerCorrectResult:    z.number().int().min(1).max(100),
  bonusPointsForExactScore:  z.number().int().min(0).max(100),
  allowExactScore:           z.boolean(),
  tiebreaker:                z.enum(['total_goals', 'earliest_entry', 'manual']),
}).superRefine((data, ctx) => {
  const ids = data.fixtures.map(f => f.id)
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fixture IDs must be unique', path: ['fixtures'] })
  }
  if (data.bonusPointsForExactScore > 0 && !data.allowExactScore) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'bonusPointsForExactScore > 0 requires allowExactScore: true',
      path: ['bonusPointsForExactScore'],
    })
  }
})

const settlementSchema = z.object({
  fixtureResults: z.array(z.object({
    fixtureId: z.string().min(1),
    homeScore: z.number().int().min(0),
    awayScore: z.number().int().min(0),
  })),
  tiebreakWinnerEntryId: z.string().optional(),
})

// ── Pure scoring helpers ──────────────────────────────────────

function deriveResult(home: number, away: number): FixtureResult {
  return home > away ? 'home' : away > home ? 'away' : 'draw'
}

interface ScoreBreakdown { score: number; correctResults: number; exactScores: number }

function scoreEntry(entry: PredictorEntryInput, config: PredictorConfig): ScoreBreakdown {
  let score = 0
  let correctResults = 0
  let exactScores = 0

  for (const fixture of config.fixtures) {
    if (fixture.result == null) continue
    const pred = entry.predictions.find(p => p.fixtureId === fixture.id)
    if (!pred) continue

    if (pred.result !== fixture.result) continue

    score += config.pointsPerCorrectResult
    correctResults++

    if (
      config.allowExactScore &&
      config.bonusPointsForExactScore > 0 &&
      pred.homeScore !== undefined && pred.awayScore !== undefined &&
      fixture.homeScore !== undefined && fixture.awayScore !== undefined &&
      pred.homeScore === fixture.homeScore && pred.awayScore === fixture.awayScore
    ) {
      score += config.bonusPointsForExactScore
      exactScores++
    }
  }

  return { score, correctResults, exactScores }
}

// ── Tiebreaker ────────────────────────────────────────────────

function breakTie(
  tied: ValidatedPredictorEntry[],
  tiebreaker: PredictorConfig['tiebreaker'],
  actualTotalGoals: number | undefined,
  manualWinnerId: string | undefined,
): ValidatedPredictorEntry[] {
  if (tied.length <= 1) return tied

  switch (tiebreaker) {
    case 'total_goals': {
      if (actualTotalGoals === undefined) return tied  // unresolvable
      const withDiff = tied.map(e => ({
        e,
        diff: Math.abs((e.predictedTotalGoals ?? 0) - actualTotalGoals),
      })).sort((a, b) => a.diff - b.diff || a.e.entryNumber - b.e.entryNumber)
      const min = withDiff[0].diff
      return withDiff.filter(x => x.diff === min).map(x => x.e)
    }
    case 'earliest_entry': {
      const sorted = [...tied].sort((a, b) => a.entryNumber - b.entryNumber)
      return sorted.filter(e => e.entryNumber === sorted[0].entryNumber)
    }
    case 'manual': {
      if (!manualWinnerId) return tied   // caller must check if still > 1
      const w = tied.find(e => e.entryId === manualWinnerId)
      return w ? [w] : tied
    }
  }
}

// ── Leaderboard builder ───────────────────────────────────────

function buildLeaderboard(
  entries: ValidatedPredictorEntry[],
  isSettled: boolean,
  winnerEntryIds: string[],
): Leaderboard {
  const winnerSet = new Set(winnerEntryIds)
  const sorted = [...entries].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.entryNumber - b.entryNumber
  )

  let currentRank = 1
  const leaderboardEntries: LeaderboardEntry[] = sorted.map((entry, i) => {
    if (i > 0 && sorted[i].score < sorted[i - 1].score) currentRank = i + 1
    return {
      rank: currentRank,
      entryId: entry.entryId,
      userId: entry.userId,
      score: entry.score,
      isWinner: winnerSet.has(entry.entryId),
      isEliminated: false,
      tiebreakerValue: entry.predictedTotalGoals ?? entry.entryNumber,
      details: { correctResults: entry.correctResults, exactScores: entry.exactScores },
    }
  })

  return { entries: leaderboardEntries, isSettled, winnerEntryIds }
}

// ── Engine ────────────────────────────────────────────────────

export const definition: GameDefinition = {
  type: 'SIX_RESULT_PREDICTOR',
  label: 'Six-Result Predictor',
  description: 'Predict the results of six fixtures. Highest score wins.',
  features: { hasRounds: false, hasScoring: true, hasWinner: true, supportsExactScore: true },
}

export const predictorEngine: GameEngine = {
  type: 'SIX_RESULT_PREDICTOR',
  definition,

  validateGameConfig(raw: unknown): GameResult<GameConfig> {
    const result = configSchema.safeParse(raw)
    if (!result.success) return err('INVALID_CONFIG', result.error.issues[0].message)
    return ok(result.data as PredictorConfig)
  },

  validateEntry(raw: unknown, state: GameState): GameResult<ValidatedEntry> {
    if (state.type !== 'SIX_RESULT_PREDICTOR') {
      return err('WRONG_GAME_TYPE', `Expected SIX_RESULT_PREDICTOR state, got ${state.type}`)
    }
    if (state.status !== 'open') {
      return err('COMPETITION_NOT_OPEN', `Competition is ${state.status}, not accepting entries`)
    }

    const parsed = entryInputSchema.safeParse(raw)
    if (!parsed.success) return err('INVALID_ENTRY', parsed.error.issues[0].message)
    const input = parsed.data as PredictorEntryInput

    if (state.entries.some(e => e.userId === input.userId)) {
      return err('DUPLICATE_ENTRY', 'User has already entered this competition')
    }

    const fixtureIds = new Set(state.config.fixtures.map(f => f.id))
    const seenFixtures = new Set<string>()
    for (const pred of input.predictions) {
      if (!fixtureIds.has(pred.fixtureId)) {
        return err('UNKNOWN_FIXTURE', `Fixture ${pred.fixtureId} not found in competition config`)
      }
      if (seenFixtures.has(pred.fixtureId)) {
        return err('DUPLICATE_FIXTURE', `Fixture ${pred.fixtureId} predicted more than once`)
      }
      seenFixtures.add(pred.fixtureId)
      if ((pred.homeScore !== undefined || pred.awayScore !== undefined) && !state.config.allowExactScore) {
        return err('EXACT_SCORE_NOT_ALLOWED', 'This competition does not accept exact score predictions')
      }
    }

    const { score, correctResults, exactScores } = scoreEntry(input, state.config)
    const validated: ValidatedPredictorEntry = { ...input, score, correctResults, exactScores }
    return ok(validated)
  },

  calculateLeaderboard(state: GameState): Leaderboard {
    if (state.type !== 'SIX_RESULT_PREDICTOR') {
      return { entries: [], isSettled: false, winnerEntryIds: [] }
    }
    const isSettled = state.status === 'settled'
    const scoredEntries = state.entries.map(entry => ({
      ...entry,
      ...scoreEntry(entry, state.config),
    }))
    const winnerEntryIds = isSettled && scoredEntries.length > 0
      ? [scoredEntries.reduce((best, e) =>
          e.score > best.score || (e.score === best.score && e.entryNumber < best.entryNumber)
            ? e : best
        ).entryId]
      : []
    return buildLeaderboard(scoredEntries, isSettled, winnerEntryIds)
  },

  getParticipantStatus(entryId: string, state: GameState): ParticipantStatus | null {
    if (state.type !== 'SIX_RESULT_PREDICTOR') return null
    const entry = state.entries.find(e => e.entryId === entryId)
    if (!entry) return null

    const { score, correctResults } = scoreEntry(entry, state.config)
    const lb = this.calculateLeaderboard(state)
    const lbEntry = lb.entries.find(e => e.entryId === entryId)
    const isWinner = lb.winnerEntryIds.includes(entryId)

    return {
      entryId,
      userId: entry.userId,
      status: isWinner ? 'winner' : 'active',
      rank: lbEntry?.rank,
      score,
      isWinner,
      isEliminated: false,
      canTakeAction: false,
      details: { correctResults, predictedTotalGoals: entry.predictedTotalGoals, predictions: entry.predictions },
    }
  },

  getAvailableActions(entryId: string, state: GameState): AvailableAction[] {
    if (state.type !== 'SIX_RESULT_PREDICTOR') return []
    if (!state.entries.some(e => e.entryId === entryId)) return []
    if (state.status === 'settled') {
      return [{ type: 'VIEW_RESULTS', label: 'View results', requiresInput: false }]
    }
    return []
  },

  settleCompetition(state: GameState, input: unknown): GameResult<SettlementResult> {
    if (state.type !== 'SIX_RESULT_PREDICTOR') {
      return err('WRONG_GAME_TYPE', 'Expected SIX_RESULT_PREDICTOR state')
    }
    if (state.entries.length === 0) {
      return err('NO_ENTRIES', 'Cannot settle a competition with no entries')
    }

    const parsed = settlementSchema.safeParse(input)
    if (!parsed.success) return err('INVALID_SETTLEMENT_INPUT', parsed.error.issues[0].message)
    const settlementInput = parsed.data as PredictorSettlementInput

    // Apply fixture results to config
    const resultMap = new Map(settlementInput.fixtureResults.map(r => [r.fixtureId, r]))
    const updatedConfig: PredictorConfig = {
      ...state.config,
      fixtures: state.config.fixtures.map(f => {
        const r = resultMap.get(f.id)
        if (!r) return f
        return { ...f, homeScore: r.homeScore, awayScore: r.awayScore, result: deriveResult(r.homeScore, r.awayScore) }
      }),
    }

    // Score all entries
    const scoredEntries = state.entries.map(entry => ({
      ...entry,
      ...scoreEntry(entry, updatedConfig),
    }))

    // Find top scorers
    const maxScore = Math.max(...scoredEntries.map(e => e.score))
    const topEntries = scoredEntries.filter(e => e.score === maxScore)

    const actualTotalGoals = settlementInput.fixtureResults.reduce(
      (sum, r) => sum + r.homeScore + r.awayScore,
      0,
    )

    const winners = breakTie(
      topEntries,
      updatedConfig.tiebreaker,
      actualTotalGoals,
      settlementInput.tiebreakWinnerEntryId,
    )

    if (updatedConfig.tiebreaker === 'manual' && topEntries.length > 1 && winners.length > 1) {
      return err(
        'MANUAL_TIEBREAKER_REQUIRED',
        `${topEntries.length} entries tied at ${maxScore} points — provide tiebreakWinnerEntryId`,
      )
    }

    const winnerEntryIds = winners.map(e => e.entryId)
    const loserEntryIds = scoredEntries
      .filter(e => !winnerEntryIds.includes(e.entryId))
      .map(e => e.entryId)

    return ok({
      winnerEntryIds,
      loserEntryIds,
      voidEntryIds: [],
      finalLeaderboard: buildLeaderboard(scoredEntries, true, winnerEntryIds),
      details: {
        maxScore,
        actualTotalGoals,
        fixtureResults: updatedConfig.fixtures.map(f => ({
          id: f.id, homeTeam: f.homeTeam, awayTeam: f.awayTeam,
          result: f.result, homeScore: f.homeScore, awayScore: f.awayScore,
        })),
      },
    })
  },

  explainRulesForParticipant(config: GameConfig): RuleExplanation {
    if (config.type !== 'SIX_RESULT_PREDICTOR') {
      return { summary: '', howToWin: '', sections: [] }
    }

    const scoring = config.allowExactScore && config.bonusPointsForExactScore > 0
      ? `${config.pointsPerCorrectResult} pt per correct result + ${config.bonusPointsForExactScore} bonus pt for exact score.`
      : `${config.pointsPerCorrectResult} pt per correct result.`

    const tiebreakerText: Record<PredictorConfig['tiebreaker'], string> = {
      total_goals:    'Ties broken by closest predicted total goals. Further ties go to earliest entry.',
      earliest_entry: 'Ties broken by entry order — first to enter wins.',
      manual:         'Ties resolved by club admin manually selecting the winner.',
    }

    return {
      summary: 'Predict the result of 6 fixtures. Most points wins.',
      howToWin: `Choose Home Win, Draw, or Away Win for each fixture.${config.allowExactScore ? ' Optionally predict the exact score for bonus points.' : ''} Highest total score at the end wins.`,
      scoring,
      tiebreaker: tiebreakerText[config.tiebreaker],
      sections: [
        {
          heading: 'How to enter',
          content: `Select a result (H/D/A) for all 6 fixtures.${config.allowExactScore ? ' You may also enter an exact score for each fixture to earn bonus points.' : ''}`,
        },
        {
          heading: 'Scoring',
          content: scoring,
        },
        {
          heading: 'Tiebreaker',
          content: tiebreakerText[config.tiebreaker],
        },
        {
          heading: 'Settlement',
          content: 'Results are entered by the club admin after all fixtures have been played. Winners are announced immediately after settlement.',
        },
      ],
    }
  },
}
