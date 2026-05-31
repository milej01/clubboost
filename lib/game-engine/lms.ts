import { z } from 'zod'
import {
  ok, err,
  type GameConfig, type GameState, type ValidatedEntry,
  type GameResult, type Leaderboard, type LeaderboardEntry,
  type ParticipantStatus, type AvailableAction, type RuleExplanation,
  type SettlementResult, type GameEngine, type GameDefinition,
  type LMSConfig, type LMSGameState, type LMSEntry, type ValidatedLMSEntry,
  type LMSRoundResult, type LMSSettlementInput, type LMSPickInput,
  type LMSRoundPick,
} from './types'

// ── Zod schemas ───────────────────────────────────────────────

const configSchema = z.object({
  type:                  z.literal('LAST_MAN_STANDING'),
  maxRounds:             z.number().int().min(1).max(52),
  allowTeamReuse:        z.boolean(),
  drawCountsAsSurvival:  z.boolean(),
  buybackEnabled:        z.boolean(),
  buybackUntilRound:     z.number().int().min(0),
  availableTeams:        z.array(z.string().min(1)).min(2, 'At least 2 teams required'),
  tiebreaker:            z.enum(['earliest_entry', 'random', 'manual']),
}).superRefine((data, ctx) => {
  if (data.buybackEnabled && data.buybackUntilRound > data.maxRounds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'buybackUntilRound cannot exceed maxRounds',
      path: ['buybackUntilRound'],
    })
  }
  if (new Set(data.availableTeams.map(t => t.toLowerCase())).size !== data.availableTeams.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Available teams must be unique (case-insensitive)',
      path: ['availableTeams'],
    })
  }
})

const roundPickSchema = z.object({
  roundNumber: z.number().int().positive(),
  teamName:    z.string().min(1),
  result:      z.enum(['correct', 'incorrect', 'pending']),
})

const entryInputSchema = z.object({
  entryId:     z.string().min(1),
  userId:      z.string().min(1),
  entryNumber: z.number().int().positive(),
  enteredAt:   z.string().datetime(),
  status:      z.enum(['pending_payment', 'active', 'eliminated', 'winner', 'refunded']),
  roundPicks:  z.array(roundPickSchema),
  usedBuyback: z.boolean(),
  buybackRound:       z.number().int().positive().optional(),
  eliminatedInRound:  z.number().int().positive().optional(),
})

const pickInputSchema = z.object({
  entryId:     z.string().min(1),
  roundNumber: z.number().int().positive(),
  teamName:    z.string().min(1),
})

const roundResultSchema = z.object({
  roundNumber:     z.number().int().positive(),
  survivingTeams:  z.array(z.string()),
  eliminatedTeams: z.array(z.string()),
  drawnTeams:      z.array(z.string()),
})

const settlementSchema = z.object({
  rounds:                 z.array(roundResultSchema).min(1, 'At least one round result required'),
  tiebreakWinnerEntryId:  z.string().optional(),
})

// ── Pure helpers ──────────────────────────────────────────────

function normalise(team: string): string {
  return team.trim().toLowerCase()
}

function makeSets(r: LMSRoundResult) {
  return {
    surviving:  new Set(r.survivingTeams.map(normalise)),
    eliminated: new Set(r.eliminatedTeams.map(normalise)),
    drawn:      new Set(r.drawnTeams.map(normalise)),
  }
}

/** Process a single round against the current entries. Returns updated entries. */
function processRound(
  entries: LMSEntry[],
  round: LMSRoundResult,
  config: LMSConfig,
): LMSEntry[] {
  const { surviving, eliminated, drawn } = makeSets(round)

  return entries.map((entry): LMSEntry => {
    if (entry.status !== 'active') return entry

    const pick = entry.roundPicks.find(p => p.roundNumber === round.roundNumber)

    // No pick submitted = missed the deadline = eliminated
    if (!pick) {
      return { ...entry, status: 'eliminated', eliminatedInRound: round.roundNumber }
    }

    const team = normalise(pick.teamName)
    const isElim = eliminated.has(team) || (drawn.has(team) && !config.drawCountsAsSurvival)

    const updatedPick: LMSRoundPick = {
      ...pick,
      result: isElim ? 'incorrect' : 'correct',
    }

    const newPicks = entry.roundPicks.map(p =>
      p.roundNumber === round.roundNumber ? updatedPick : p
    )

    if (!isElim) {
      return { ...entry, roundPicks: newPicks }
    }

    // Eliminated — but did they use buyback this round?
    const usedBuybackThisRound =
      entry.usedBuyback &&
      entry.buybackRound === round.roundNumber &&
      config.buybackEnabled &&
      round.roundNumber <= config.buybackUntilRound

    if (usedBuybackThisRound) {
      // Buyback keeps them active (they survive despite losing)
      return { ...entry, roundPicks: newPicks }
    }

    return { ...entry, status: 'eliminated', eliminatedInRound: round.roundNumber, roundPicks: newPicks }
  })
}

// ── Tiebreaker ────────────────────────────────────────────────

function breakTie(
  entries: LMSEntry[],
  tiebreaker: LMSConfig['tiebreaker'],
  manualWinnerId: string | undefined,
): LMSEntry[] {
  if (entries.length <= 1) return entries

  switch (tiebreaker) {
    case 'earliest_entry': {
      const sorted = [...entries].sort((a, b) => a.entryNumber - b.entryNumber)
      return sorted.filter(e => e.entryNumber === sorted[0].entryNumber)
    }
    case 'random': {
      // Deterministic "random" via UUID string sort — reproducible given the same entries.
      const sorted = [...entries].sort((a, b) => a.entryId.localeCompare(b.entryId))
      return [sorted[0]]
    }
    case 'manual': {
      if (!manualWinnerId) return entries
      const w = entries.find(e => e.entryId === manualWinnerId)
      return w ? [w] : entries
    }
  }
}

// ── Leaderboard builder ───────────────────────────────────────

function lmsScore(entry: LMSEntry, currentRound: number): number {
  // Score = last round survived (higher is better)
  if (entry.status === 'active' || entry.status === 'winner') return currentRound
  return (entry.eliminatedInRound ?? 1) - 1
}

function buildLeaderboard(
  entries: LMSEntry[],
  currentRound: number,
  isSettled: boolean,
  winnerEntryIds: string[],
): Leaderboard {
  const winnerSet = new Set(winnerEntryIds)

  const sorted = [...entries].sort((a, b) => {
    const aScore = lmsScore(a, currentRound)
    const bScore = lmsScore(b, currentRound)
    if (bScore !== aScore) return bScore - aScore
    // Active before eliminated at same score
    const aActive = a.status === 'active' || a.status === 'winner' ? 0 : 1
    const bActive = b.status === 'active' || b.status === 'winner' ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return a.entryNumber - b.entryNumber
  })

  let currentRankVal = 1
  const leaderboardEntries: LeaderboardEntry[] = sorted.map((entry, i) => {
    const score = lmsScore(entry, currentRound)
    if (i > 0 && score < lmsScore(sorted[i - 1], currentRound)) currentRankVal = i + 1
    return {
      rank: currentRankVal,
      entryId: entry.entryId,
      userId: entry.userId,
      score,
      isWinner: winnerSet.has(entry.entryId),
      isEliminated: entry.status === 'eliminated',
      tiebreakerValue: entry.entryNumber,
      details: { roundPicks: entry.roundPicks, eliminatedInRound: entry.eliminatedInRound },
    }
  })

  return { entries: leaderboardEntries, isSettled, winnerEntryIds }
}

// ── Engine ────────────────────────────────────────────────────

export const definition: GameDefinition = {
  type: 'LAST_MAN_STANDING',
  label: 'Last Man Standing',
  description: 'Pick one team per round. Last participant still active wins.',
  features: { hasRounds: true, hasScoring: false, hasWinner: true, supportsExactScore: false },
}

export const lmsEngine: GameEngine = {
  type: 'LAST_MAN_STANDING',
  definition,

  validateGameConfig(raw: unknown): GameResult<GameConfig> {
    const result = configSchema.safeParse(raw)
    if (!result.success) return err('INVALID_CONFIG', result.error.issues[0].message)
    return ok(result.data as LMSConfig)
  },

  validateEntry(raw: unknown, state: GameState): GameResult<ValidatedEntry> {
    if (state.type !== 'LAST_MAN_STANDING') {
      return err('WRONG_GAME_TYPE', `Expected LAST_MAN_STANDING state, got ${state.type}`)
    }
    if (state.status !== 'open' && state.status !== 'in_progress') {
      return err('COMPETITION_NOT_OPEN', `Competition is ${state.status}, not accepting entries`)
    }

    const parsed = entryInputSchema.safeParse(raw)
    if (!parsed.success) return err('INVALID_ENTRY', parsed.error.issues[0].message)
    const input = parsed.data as ValidatedLMSEntry

    if (state.entries.some(e => e.userId === input.userId)) {
      return err('DUPLICATE_ENTRY', 'User has already entered this competition')
    }

    return ok(input)
  },

  calculateLeaderboard(state: GameState): Leaderboard {
    if (state.type !== 'LAST_MAN_STANDING') {
      return { entries: [], isSettled: false, winnerEntryIds: [] }
    }
    const isSettled = state.status === 'settled'
    const winnerEntryIds = isSettled
      ? state.entries.filter(e => e.status === 'winner').map(e => e.entryId)
      : []
    return buildLeaderboard(state.entries, state.currentRound, isSettled, winnerEntryIds)
  },

  getParticipantStatus(entryId: string, state: GameState): ParticipantStatus | null {
    if (state.type !== 'LAST_MAN_STANDING') return null
    const entry = state.entries.find(e => e.entryId === entryId)
    if (!entry) return null

    const hasPicked = entry.roundPicks.some(p => p.roundNumber === state.currentRound)
    const canPick =
      entry.status === 'active' &&
      (state.status === 'open' || state.status === 'in_progress') &&
      !hasPicked

    const canBuyback =
      entry.status === 'eliminated' &&
      state.config.buybackEnabled &&
      (entry.eliminatedInRound ?? 0) <= state.config.buybackUntilRound &&
      !entry.usedBuyback

    const lb = this.calculateLeaderboard(state)
    const lbEntry = lb.entries.find(e => e.entryId === entryId)

    return {
      entryId,
      userId: entry.userId,
      status: entry.status,
      rank: lbEntry?.rank,
      score: lmsScore(entry, state.currentRound),
      isWinner: entry.status === 'winner',
      isEliminated: entry.status === 'eliminated',
      canTakeAction: canPick || canBuyback,
      details: {
        roundPicks: entry.roundPicks,
        currentRound: state.currentRound,
        eliminatedInRound: entry.eliminatedInRound,
        usedBuyback: entry.usedBuyback,
        canPick,
        canBuyback,
      },
    }
  },

  getAvailableActions(entryId: string, state: GameState): AvailableAction[] {
    if (state.type !== 'LAST_MAN_STANDING') return []
    const entry = state.entries.find(e => e.entryId === entryId)
    if (!entry) return []

    const actions: AvailableAction[] = []

    const hasPicked = entry.roundPicks.some(p => p.roundNumber === state.currentRound)
    if (
      entry.status === 'active' &&
      (state.status === 'open' || state.status === 'in_progress') &&
      !hasPicked
    ) {
      actions.push({
        type: 'SUBMIT_PICK',
        label: `Pick your team for round ${state.currentRound}`,
        description: `Choose one team from ${state.config.availableTeams.length} available teams`,
        requiresInput: true,
      })
    }

    if (
      entry.status === 'eliminated' &&
      state.config.buybackEnabled &&
      (entry.eliminatedInRound ?? 0) <= state.config.buybackUntilRound &&
      !entry.usedBuyback
    ) {
      actions.push({
        type: 'USE_BUYBACK',
        label: 'Use your buyback',
        description: 'Pay an additional entry fee to re-enter the competition',
        requiresInput: false,
      })
    }

    if (state.status === 'settled') {
      actions.push({ type: 'VIEW_RESULTS', label: 'View final results', requiresInput: false })
    }

    return actions
  },

  settleCompetition(state: GameState, input: unknown): GameResult<SettlementResult> {
    if (state.type !== 'LAST_MAN_STANDING') {
      return err('WRONG_GAME_TYPE', 'Expected LAST_MAN_STANDING state')
    }
    if (state.entries.length === 0) {
      return err('NO_ENTRIES', 'Cannot settle a competition with no entries')
    }

    const parsed = settlementSchema.safeParse(input)
    if (!parsed.success) return err('INVALID_SETTLEMENT_INPUT', parsed.error.issues[0].message)
    const settlementInput = parsed.data as LMSSettlementInput

    // Process rounds in order
    let currentEntries = [...state.entries]
    for (const round of settlementInput.rounds) {
      currentEntries = processRound(currentEntries, round, state.config)
    }

    const activeEntries = currentEntries.filter(e => e.status === 'active')
    const eliminatedEntries = currentEntries.filter(e => e.status === 'eliminated')
    const lastRound = settlementInput.rounds.at(-1)?.roundNumber ?? state.currentRound

    let winnerEntryIds: string[]

    if (activeEntries.length === 1) {
      // Clear winner
      winnerEntryIds = [activeEntries[0].entryId]
    } else if (activeEntries.length > 1) {
      // All survived — apply tiebreaker (maxRounds reached or admin settling early)
      const winners = breakTie(activeEntries, state.config.tiebreaker, settlementInput.tiebreakWinnerEntryId)
      if (state.config.tiebreaker === 'manual' && winners.length > 1) {
        return err(
          'MANUAL_TIEBREAKER_REQUIRED',
          `${activeEntries.length} participants still active — provide tiebreakWinnerEntryId`,
        )
      }
      winnerEntryIds = winners.map(e => e.entryId)
    } else {
      // All eliminated — find entries eliminated in the final round as candidates
      const finalRoundEliminated = eliminatedEntries.filter(e => e.eliminatedInRound === lastRound)
      const candidates = finalRoundEliminated.length > 0 ? finalRoundEliminated : eliminatedEntries

      const winners = breakTie(candidates, state.config.tiebreaker, settlementInput.tiebreakWinnerEntryId)
      if (state.config.tiebreaker === 'manual' && winners.length > 1) {
        return err(
          'MANUAL_TIEBREAKER_REQUIRED',
          'All participants eliminated — provide tiebreakWinnerEntryId to select winner',
        )
      }
      winnerEntryIds = winners.map(e => e.entryId)
    }

    const winnerSet = new Set(winnerEntryIds)
    const finalEntries = currentEntries.map(e =>
      winnerSet.has(e.entryId) ? { ...e, status: 'winner' as const } : e
    )

    const loserEntryIds = finalEntries
      .filter(e => !winnerSet.has(e.entryId))
      .map(e => e.entryId)

    return ok({
      winnerEntryIds,
      loserEntryIds,
      voidEntryIds: [],
      finalLeaderboard: buildLeaderboard(finalEntries, lastRound, true, winnerEntryIds),
      details: {
        roundsProcessed: settlementInput.rounds.length,
        survivorsAfterAllRounds: activeEntries.length,
        allEliminatedSameRound: activeEntries.length === 0,
      },
    })
  },

  explainRulesForParticipant(config: GameConfig): RuleExplanation {
    if (config.type !== 'LAST_MAN_STANDING') {
      return { summary: '', howToWin: '', sections: [] }
    }

    const drawRule = config.drawCountsAsSurvival
      ? 'Drawn matches count as survival.'
      : 'Drawn matches result in elimination.'

    const reuseRule = config.allowTeamReuse
      ? 'You may pick the same team in multiple rounds.'
      : 'You cannot pick the same team more than once across all rounds.'

    const buybackText = config.buybackEnabled
      ? `Buyback is available up to and including round ${config.buybackUntilRound}. Each participant may use one buyback.`
      : 'No buyback is available in this competition.'

    const tiebreakerText: Record<LMSConfig['tiebreaker'], string> = {
      earliest_entry: 'If multiple participants survive all rounds, the earliest entry wins.',
      random:         'If multiple participants survive all rounds, the winner is selected at random.',
      manual:         'If multiple participants survive all rounds, the club admin selects the winner.',
    }

    return {
      summary: `Last person standing wins. Pick one team per round — they must win to keep you in.`,
      howToWin: `Survive every round. ${drawRule} ${reuseRule} The last active participant wins.`,
      tiebreaker: tiebreakerText[config.tiebreaker],
      sections: [
        {
          heading: 'How it works',
          content: `Each round, pick one team from ${config.availableTeams.length} available teams. If your team wins, you survive. ${drawRule}`,
        },
        {
          heading: 'Team selection',
          content: reuseRule,
        },
        {
          heading: 'Buyback',
          content: buybackText,
        },
        {
          heading: 'Tiebreaker',
          content: tiebreakerText[config.tiebreaker],
        },
        {
          heading: 'Maximum rounds',
          content: `The competition runs for a maximum of ${config.maxRounds} rounds.`,
        },
      ],
    }
  },
}

// ── LMS-specific exported validators ─────────────────────────
// These are not part of the GameEngine interface but are available
// to the application layer for round-by-round pick submission.

/** Validate a round pick for an existing LMS entry. */
export function validateLMSPick(raw: unknown, state: LMSGameState): GameResult<LMSPickInput> {
  const parsed = pickInputSchema.safeParse(raw)
  if (!parsed.success) return err('INVALID_PICK', parsed.error.issues[0].message)
  const input = parsed.data as LMSPickInput

  const entry = state.entries.find(e => e.entryId === input.entryId)
  if (!entry) return err('ENTRY_NOT_FOUND', `Entry ${input.entryId} not found`)
  if (entry.status !== 'active') {
    return err('ENTRY_NOT_ACTIVE', `Entry is ${entry.status}, must be active to submit a pick`)
  }
  if (entry.roundPicks.some(p => p.roundNumber === input.roundNumber)) {
    return err('PICK_ALREADY_SUBMITTED', `Pick already submitted for round ${input.roundNumber}`)
  }
  if (input.roundNumber !== state.currentRound) {
    return err('WRONG_ROUND', `Competition is on round ${state.currentRound}, not ${input.roundNumber}`)
  }

  // Team must be in availableTeams (case-insensitive)
  const available = state.config.availableTeams.map(normalise)
  if (!available.includes(normalise(input.teamName))) {
    return err('TEAM_NOT_AVAILABLE', `"${input.teamName}" is not in the available teams list`)
  }

  // No team reuse
  if (!state.config.allowTeamReuse) {
    const usedTeams = entry.roundPicks.map(p => normalise(p.teamName))
    if (usedTeams.includes(normalise(input.teamName))) {
      return err('TEAM_ALREADY_USED', `"${input.teamName}" was already picked in a previous round`)
    }
  }

  return ok(input)
}
