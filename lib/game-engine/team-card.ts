import { z } from 'zod'
import {
  ok, err,
  type GameConfig, type GameState, type ValidatedEntry,
  type GameResult, type Leaderboard, type LeaderboardEntry,
  type ParticipantStatus, type AvailableAction, type RuleExplanation,
  type SettlementResult, type GameEngine, type GameDefinition,
  type TeamCardConfig, type TeamCardGameState, type ValidatedTeamCardEntry,
  type TeamCardEntryInput, type TeamCardSettlementInput, type TeamCardSlot,
} from './types'

// ── Zod schemas ───────────────────────────────────────────────

const slotStatusSchema = z.enum(['available', 'reserved', 'sold', 'void'])

const slotSchema = z.object({
  id:         z.string().min(1),
  slotNumber: z.number().int().positive(),
  teamName:   z.string().min(1),
  status:     slotStatusSchema,
  entryId:    z.string().optional(),
  userId:     z.string().optional(),
})

const configSchema = z.object({
  type:             z.literal('FOOTBALL_TEAM_CARD'),
  slots:            z.array(slotSchema).min(2, 'At least 2 team slots required'),
  assignmentMethod: z.enum(['participant_choice', 'random_assignment']),
  revealMethod:     z.enum(['manual_admin', 'manual_platform_admin']),
}).superRefine((data, ctx) => {
  const numbers = data.slots.map(s => s.slotNumber)
  if (new Set(numbers).size !== numbers.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Slot numbers must be unique', path: ['slots'] })
  }
  const ids = data.slots.map(s => s.id)
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Slot IDs must be unique', path: ['slots'] })
  }
})

const entryInputSchema = z.object({
  entryId:     z.string().min(1),
  userId:      z.string().min(1),
  entryNumber: z.number().int().positive(),
  enteredAt:   z.string().datetime(),
  slotId:      z.string().min(1),
})

const settlementSchema = z.object({
  winningSlotId: z.string().min(1),
})

// ── Leaderboard builder ───────────────────────────────────────

function buildLeaderboard(
  entries: ValidatedTeamCardEntry[],
  isSettled: boolean,
  winnerEntryIds: string[],
): Leaderboard {
  const winnerSet = new Set(winnerEntryIds)
  const sorted = [...entries].sort((a, b) => {
    const aWin = winnerSet.has(a.entryId) ? 0 : 1
    const bWin = winnerSet.has(b.entryId) ? 0 : 1
    if (aWin !== bWin) return aWin - bWin
    return a.entryNumber - b.entryNumber
  })

  const leaderboardEntries: LeaderboardEntry[] = sorted.map((entry, i) => ({
    rank: winnerSet.has(entry.entryId) ? 1 : i + 1,
    entryId: entry.entryId,
    userId: entry.userId,
    score: 0,                               // no numeric scoring in team card
    isWinner: winnerSet.has(entry.entryId),
    isEliminated: false,                    // no elimination; you just don't win
    details: { slot: entry.slot },
  }))

  return { entries: leaderboardEntries, isSettled, winnerEntryIds }
}

// ── Engine ────────────────────────────────────────────────────

export const definition: GameDefinition = {
  type: 'FOOTBALL_TEAM_CARD',
  label: 'Football Team Card',
  description: 'Choose a team slot. If your team is revealed as the winner, you win.',
  features: { hasRounds: false, hasScoring: false, hasWinner: true, supportsExactScore: false },
}

export const teamCardEngine: GameEngine = {
  type: 'FOOTBALL_TEAM_CARD',
  definition,

  validateGameConfig(raw: unknown): GameResult<GameConfig> {
    const result = configSchema.safeParse(raw)
    if (!result.success) return err('INVALID_CONFIG', result.error.issues[0].message)
    return ok(result.data as TeamCardConfig)
  },

  validateEntry(raw: unknown, state: GameState): GameResult<ValidatedEntry> {
    if (state.type !== 'FOOTBALL_TEAM_CARD') {
      return err('WRONG_GAME_TYPE', `Expected FOOTBALL_TEAM_CARD state, got ${state.type}`)
    }
    if (state.status !== 'open') {
      return err('COMPETITION_NOT_OPEN', `Competition is ${state.status}, not accepting entries`)
    }

    const parsed = entryInputSchema.safeParse(raw)
    if (!parsed.success) return err('INVALID_ENTRY', parsed.error.issues[0].message)
    const input = parsed.data as TeamCardEntryInput

    if (state.entries.some(e => e.userId === input.userId)) {
      return err('DUPLICATE_ENTRY', 'User has already entered this competition')
    }

    const slot = state.config.slots.find(s => s.id === input.slotId)
    if (!slot) {
      return err('SLOT_NOT_FOUND', `Slot ${input.slotId} not found in this competition`)
    }
    if (slot.status === 'void') {
      return err('SLOT_VOID', `Slot #${slot.slotNumber} (${slot.teamName}) has been voided`)
    }
    if (slot.status === 'sold' || slot.status === 'reserved') {
      return err('SLOT_TAKEN', `Slot #${slot.slotNumber} (${slot.teamName}) is already taken`)
    }

    const validated: ValidatedTeamCardEntry = { ...input, slot }
    return ok(validated)
  },

  calculateLeaderboard(state: GameState): Leaderboard {
    if (state.type !== 'FOOTBALL_TEAM_CARD') {
      return { entries: [], isSettled: false, winnerEntryIds: [] }
    }
    const isSettled = state.status === 'settled'
    const winnerEntryIds = isSettled && state.winningSlotId
      ? state.entries
          .filter(e => e.slotId === state.winningSlotId)
          .map(e => e.entryId)
      : []
    return buildLeaderboard(state.entries, isSettled, winnerEntryIds)
  },

  getParticipantStatus(entryId: string, state: GameState): ParticipantStatus | null {
    if (state.type !== 'FOOTBALL_TEAM_CARD') return null
    const entry = state.entries.find(e => e.entryId === entryId)
    if (!entry) return null

    const isWinner = state.winningSlotId != null && entry.slotId === state.winningSlotId
    const winningRevealed = state.winningSlotId != null

    return {
      entryId,
      userId: entry.userId,
      status: isWinner ? 'winner' : 'active',
      rank: isWinner ? 1 : undefined,
      score: 0,
      isWinner,
      isEliminated: false,
      canTakeAction: false,
      details: {
        slot: entry.slot,
        winningRevealed,
        winnerIsYou: isWinner,
      },
    }
  },

  getAvailableActions(entryId: string, state: GameState): AvailableAction[] {
    if (state.type !== 'FOOTBALL_TEAM_CARD') return []
    if (!state.entries.some(e => e.entryId === entryId)) return []
    if (state.status === 'settled') {
      return [{ type: 'VIEW_RESULTS', label: 'View results', requiresInput: false }]
    }
    return []
  },

  settleCompetition(state: GameState, input: unknown): GameResult<SettlementResult> {
    if (state.type !== 'FOOTBALL_TEAM_CARD') {
      return err('WRONG_GAME_TYPE', 'Expected FOOTBALL_TEAM_CARD state')
    }

    const parsed = settlementSchema.safeParse(input)
    if (!parsed.success) return err('INVALID_SETTLEMENT_INPUT', parsed.error.issues[0].message)
    const settlementInput = parsed.data as TeamCardSettlementInput

    const winningSlot = state.config.slots.find(s => s.id === settlementInput.winningSlotId)
    if (!winningSlot) {
      return err('SLOT_NOT_FOUND', `Winning slot ${settlementInput.winningSlotId} not found`)
    }
    if (winningSlot.status === 'void') {
      return err('WINNING_SLOT_VOID', `The winning slot (#${winningSlot.slotNumber} ${winningSlot.teamName}) has been voided`)
    }

    // Find entry for winning slot (may be absent if slot was never sold)
    const winnerEntry = state.entries.find(e => e.slotId === settlementInput.winningSlotId)
    const winnerEntryIds = winnerEntry ? [winnerEntry.entryId] : []
    const loserEntryIds = state.entries
      .filter(e => e.slotId !== settlementInput.winningSlotId)
      .map(e => e.entryId)

    const voidSlotIds = state.config.slots
      .filter(s => s.status === 'void')
      .map(s => s.id)
    const voidEntryIds = state.entries
      .filter(e => voidSlotIds.includes(e.slotId))
      .map(e => e.entryId)

    return ok({
      winnerEntryIds,
      loserEntryIds,
      voidEntryIds,
      finalLeaderboard: buildLeaderboard(state.entries, true, winnerEntryIds),
      details: {
        winningSlot: {
          id: winningSlot.id,
          slotNumber: winningSlot.slotNumber,
          teamName: winningSlot.teamName,
        },
        hasWinner: winnerEntry != null,
        totalSlots: state.config.slots.length,
        soldSlots: state.config.slots.filter(s => s.status === 'sold').length,
        voidSlots: voidSlotIds.length,
      },
    })
  },

  explainRulesForParticipant(config: GameConfig): RuleExplanation {
    if (config.type !== 'FOOTBALL_TEAM_CARD') {
      return { summary: '', howToWin: '', sections: [] }
    }

    const availableSlots = config.slots.filter(s => s.status === 'available').length
    const assignText = config.assignmentMethod === 'participant_choice'
      ? 'Choose your team from the available slots on the card.'
      : 'A team slot will be randomly assigned to you when you enter.'

    const revealText = config.revealMethod === 'manual_admin'
      ? 'The club admin will reveal the winning team.'
      : 'A ClubBoost platform admin will reveal the winning team.'

    return {
      summary: `Buy a slot on the team card. If your team is revealed as the winner, you win the prize.`,
      howToWin: `${assignText} Once all slots are sold (or the competition closes), ${revealText.toLowerCase()} If your slot's team is selected, you win.`,
      sections: [
        {
          heading: 'How to enter',
          content: `${assignText} There are ${availableSlots} available slots on this card.`,
        },
        {
          heading: 'How the winner is decided',
          content: `After the competition closes, ${revealText} The participant holding the winning slot wins the prize.`,
        },
        {
          heading: 'Voided slots',
          content: 'Any slot marked as void will not be eligible to win. Entry fees for voided slots will be refunded.',
        },
        {
          heading: 'Unsold slots',
          content: "If the winning slot was never purchased, there is no winner and the prize is not awarded.",
        },
      ],
    }
  },
}
