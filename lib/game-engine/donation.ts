import { z } from 'zod'
import {
  ok, err,
  type GameConfig, type GameState, type ValidatedEntry,
  type GameResult, type Leaderboard, type LeaderboardEntry,
  type ParticipantStatus, type AvailableAction, type RuleExplanation,
  type SettlementResult, type GameEngine, type GameDefinition,
  type DonationConfig, type DonationGameState, type ValidatedDonationEntry,
  type DonationEntryInput,
} from './types'

// ── Zod schemas ───────────────────────────────────────────────

const configSchema = z.object({
  type:               z.literal('DONATION_ONLY'),
  targetAmountPence:  z.number().int().positive().optional(),
  showProgress:       z.boolean(),
  allowAnonymous:     z.boolean(),
})

const entryInputSchema = z.object({
  entryId:     z.string().min(1),
  userId:      z.string().min(1),
  entryNumber: z.number().int().positive(),
  enteredAt:   z.string().datetime(),
  amountPence: z.number().int().positive('Donation amount must be at least 1p'),
  message:     z.string().max(500).optional(),
  isAnonymous: z.boolean(),
})

// ── Engine ────────────────────────────────────────────────────

export const definition: GameDefinition = {
  type: 'DONATION_ONLY',
  label: 'Donation Fundraiser',
  description: 'No game winner — track supporter contributions toward a fundraising goal.',
  features: { hasRounds: false, hasScoring: false, hasWinner: false, supportsExactScore: false },
}

export const donationEngine: GameEngine = {
  type: 'DONATION_ONLY',
  definition,

  validateGameConfig(raw: unknown): GameResult<GameConfig> {
    const result = configSchema.safeParse(raw)
    if (!result.success) return err('INVALID_CONFIG', result.error.issues[0].message)
    return ok(result.data as DonationConfig)
  },

  validateEntry(raw: unknown, state: GameState): GameResult<ValidatedEntry> {
    if (state.type !== 'DONATION_ONLY') {
      return err('WRONG_GAME_TYPE', `Expected DONATION_ONLY state, got ${state.type}`)
    }
    if (state.status !== 'open') {
      return err('COMPETITION_NOT_OPEN', `Fundraiser is ${state.status}, not accepting donations`)
    }

    const parsed = entryInputSchema.safeParse(raw)
    if (!parsed.success) return err('INVALID_ENTRY', parsed.error.issues[0].message)
    const input = parsed.data as DonationEntryInput

    if (!state.config.allowAnonymous && input.isAnonymous) {
      return err('ANONYMOUS_NOT_ALLOWED', 'This fundraiser does not allow anonymous donations')
    }

    // Donation fundraisers allow multiple donations per user (unlike other types)
    return ok(input)
  },

  calculateLeaderboard(state: GameState): Leaderboard {
    if (state.type !== 'DONATION_ONLY') {
      return { entries: [], isSettled: false, winnerEntryIds: [] }
    }
    // Donations are ranked by amount descending, then by entry number
    const sorted = [...state.entries].sort(
      (a, b) => b.amountPence - a.amountPence || a.entryNumber - b.entryNumber
    )
    const leaderboardEntries: LeaderboardEntry[] = sorted.map((entry, i) => ({
      rank: i + 1,
      entryId: entry.entryId,
      userId: entry.isAnonymous ? '__anonymous__' : entry.userId,
      score: entry.amountPence,
      isWinner: false,
      isEliminated: false,
      details: {
        amountPence: entry.amountPence,
        message: entry.isAnonymous ? undefined : entry.message,
        isAnonymous: entry.isAnonymous,
      },
    }))

    return {
      entries: leaderboardEntries,
      isSettled: state.status === 'settled',
      winnerEntryIds: [],
    }
  },

  getParticipantStatus(entryId: string, state: GameState): ParticipantStatus | null {
    if (state.type !== 'DONATION_ONLY') return null
    const entry = state.entries.find(e => e.entryId === entryId)
    if (!entry) return null

    return {
      entryId,
      userId: entry.userId,
      status: 'active',
      score: entry.amountPence,
      isWinner: false,
      isEliminated: false,
      canTakeAction: false,
      details: {
        amountPence: entry.amountPence,
        message: entry.message,
        isAnonymous: entry.isAnonymous,
        totalRaisedPence: state.totalRaisedPence,
        targetAmountPence: state.config.targetAmountPence,
      },
    }
  },

  getAvailableActions(entryId: string, state: GameState): AvailableAction[] {
    if (state.type !== 'DONATION_ONLY') return []
    if (!state.entries.some(e => e.entryId === entryId)) return []
    if (state.status === 'settled') {
      return [{ type: 'VIEW_RESULTS', label: 'View fundraising total', requiresInput: false }]
    }
    return []
  },

  settleCompetition(state: GameState, _input: unknown): GameResult<SettlementResult> {
    if (state.type !== 'DONATION_ONLY') {
      return err('WRONG_GAME_TYPE', 'Expected DONATION_ONLY state')
    }

    const totalRaisedPence = state.entries.reduce((sum, e) => sum + e.amountPence, 0)
    const targetMet = state.config.targetAmountPence != null
      ? totalRaisedPence >= state.config.targetAmountPence
      : null

    return ok({
      winnerEntryIds: [],
      loserEntryIds: [],
      voidEntryIds: [],
      finalLeaderboard: this.calculateLeaderboard(state),
      details: {
        totalDonors: state.entries.length,
        totalRaisedPence,
        targetAmountPence: state.config.targetAmountPence,
        targetMet,
      },
    })
  },

  explainRulesForParticipant(config: GameConfig): RuleExplanation {
    if (config.type !== 'DONATION_ONLY') {
      return { summary: '', howToWin: '', sections: [] }
    }

    const targetText = config.targetAmountPence != null
      ? ` The fundraising target is £${(config.targetAmountPence / 100).toFixed(2)}.`
      : ''

    const anonText = config.allowAnonymous
      ? 'You may donate anonymously.'
      : 'Donations are attributed to your name.'

    return {
      summary: `Support the club with a donation.${targetText} There is no game winner.`,
      howToWin: 'There is no winner — this is a fundraiser. Your contribution goes directly to the club.',
      sections: [
        {
          heading: 'About this fundraiser',
          content: `This is a straightforward donation fundraiser.${targetText} Every contribution goes to the club.`,
        },
        {
          heading: 'Your message',
          content: 'You may include a message of support with your donation. This will be displayed publicly unless you choose to donate anonymously.',
        },
        {
          heading: 'Anonymity',
          content: anonText,
        },
        {
          heading: 'Refunds',
          content: 'Donations are non-refundable unless the fundraiser is cancelled by the club before it closes.',
        },
      ],
    }
  },
}
