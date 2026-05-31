// Shared test factories — build minimal valid state objects for each game type.

import type {
  PredictorGameState, PredictorConfig, PredictorFixture, ValidatedPredictorEntry,
  LMSGameState, LMSConfig, LMSEntry, LMSRoundResult,
  TeamCardGameState, TeamCardConfig, TeamCardSlot, ValidatedTeamCardEntry,
  DonationGameState, DonationConfig, ValidatedDonationEntry,
} from '../types'

// ── Predictor ─────────────────────────────────────────────────

export function makeFixture(id: string, overrides: Partial<PredictorFixture> = {}): PredictorFixture {
  return { id, homeTeam: `Home${id}`, awayTeam: `Away${id}`, ...overrides }
}

export const SIX_FIXTURES: PredictorFixture[] = [
  makeFixture('f1', { homeTeam: 'Arsenal',   awayTeam: 'Chelsea' }),
  makeFixture('f2', { homeTeam: 'Liverpool', awayTeam: 'Man City' }),
  makeFixture('f3', { homeTeam: 'Man Utd',   awayTeam: 'Spurs' }),
  makeFixture('f4', { homeTeam: 'Everton',   awayTeam: 'Newcastle' }),
  makeFixture('f5', { homeTeam: 'Villa',     awayTeam: 'West Ham' }),
  makeFixture('f6', { homeTeam: 'Brighton',  awayTeam: 'Brentford' }),
]

export function makePredictorConfig(overrides: Partial<PredictorConfig> = {}): PredictorConfig {
  return {
    type: 'SIX_RESULT_PREDICTOR',
    fixtures: SIX_FIXTURES,
    pointsPerCorrectResult: 1,
    bonusPointsForExactScore: 0,
    allowExactScore: false,
    tiebreaker: 'earliest_entry',
    ...overrides,
  }
}

export function makePredictorState(
  overrides: Partial<PredictorGameState> = {},
): PredictorGameState {
  return {
    type: 'SIX_RESULT_PREDICTOR',
    config: makePredictorConfig(),
    entries: [],
    status: 'open',
    ...overrides,
  }
}

export function makePredictorEntry(
  id: string,
  entryNumber = 1,
  results: Array<'home' | 'draw' | 'away'> = ['home', 'draw', 'away', 'home', 'draw', 'away'],
  overrides: Partial<ValidatedPredictorEntry> = {},
): ValidatedPredictorEntry {
  return {
    entryId: id,
    userId: `user-${id}`,
    entryNumber,
    enteredAt: `2025-01-01T${String(entryNumber).padStart(2, '0')}:00:00.000Z`,
    predictions: SIX_FIXTURES.map((f, i) => ({ fixtureId: f.id, result: results[i] })),
    predictedTotalGoals: undefined,
    score: 0,
    correctResults: 0,
    exactScores: 0,
    ...overrides,
  }
}

// ── LMS ───────────────────────────────────────────────────────

export function makeLMSConfig(overrides: Partial<LMSConfig> = {}): LMSConfig {
  return {
    type: 'LAST_MAN_STANDING',
    maxRounds: 10,
    allowTeamReuse: false,
    drawCountsAsSurvival: false,
    buybackEnabled: false,
    buybackUntilRound: 0,
    availableTeams: ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Spurs', 'Man Utd'],
    tiebreaker: 'earliest_entry',
    ...overrides,
  }
}

export function makeLMSState(overrides: Partial<LMSGameState> = {}): LMSGameState {
  return {
    type: 'LAST_MAN_STANDING',
    config: makeLMSConfig(),
    entries: [],
    currentRound: 1,
    status: 'open',
    roundResults: [],
    ...overrides,
  }
}

export function makeLMSEntry(
  id: string,
  entryNumber = 1,
  overrides: Partial<LMSEntry> = {},
): LMSEntry {
  return {
    entryId: id,
    userId: `user-${id}`,
    entryNumber,
    enteredAt: `2025-01-01T${String(entryNumber).padStart(2, '0')}:00:00.000Z`,
    status: 'active',
    roundPicks: [],
    usedBuyback: false,
    ...overrides,
  }
}

export function makeLMSRoundResult(
  round: number,
  overrides: Partial<LMSRoundResult> = {},
): LMSRoundResult {
  return {
    roundNumber: round,
    survivingTeams: ['Arsenal', 'Liverpool'],
    eliminatedTeams: ['Chelsea', 'Man City'],
    drawnTeams: [],
    ...overrides,
  }
}

// ── Team card ─────────────────────────────────────────────────

export function makeSlot(n: number, overrides: Partial<TeamCardSlot> = {}): TeamCardSlot {
  return {
    id: `slot-${n}`,
    slotNumber: n,
    teamName: `Team ${n}`,
    status: 'available',
    ...overrides,
  }
}

export function makeTeamCardConfig(
  slotCount = 4,
  overrides: Partial<TeamCardConfig> = {},
): TeamCardConfig {
  return {
    type: 'FOOTBALL_TEAM_CARD',
    slots: Array.from({ length: slotCount }, (_, i) => makeSlot(i + 1)),
    assignmentMethod: 'participant_choice',
    revealMethod: 'manual_admin',
    ...overrides,
  }
}

export function makeTeamCardState(
  overrides: Partial<TeamCardGameState> = {},
): TeamCardGameState {
  return {
    type: 'FOOTBALL_TEAM_CARD',
    config: makeTeamCardConfig(),
    entries: [],
    status: 'open',
    ...overrides,
  }
}

export function makeTeamCardEntry(
  id: string,
  slotId: string,
  slot: TeamCardSlot,
  entryNumber = 1,
): ValidatedTeamCardEntry {
  return {
    entryId: id,
    userId: `user-${id}`,
    entryNumber,
    enteredAt: '2025-01-01T12:00:00.000Z',
    slotId,
    slot,
  }
}

// ── Donation ──────────────────────────────────────────────────

export function makeDonationConfig(overrides: Partial<DonationConfig> = {}): DonationConfig {
  return {
    type: 'DONATION_ONLY',
    showProgress: true,
    allowAnonymous: true,
    ...overrides,
  }
}

export function makeDonationState(
  overrides: Partial<DonationGameState> = {},
): DonationGameState {
  return {
    type: 'DONATION_ONLY',
    config: makeDonationConfig(),
    entries: [],
    status: 'open',
    totalRaisedPence: 0,
    ...overrides,
  }
}

export function makeDonationEntry(
  id: string,
  amountPence = 500,
  entryNumber = 1,
  overrides: Partial<ValidatedDonationEntry> = {},
): ValidatedDonationEntry {
  return {
    entryId: id,
    userId: `user-${id}`,
    entryNumber,
    enteredAt: '2025-01-01T12:00:00.000Z',
    amountPence,
    isAnonymous: false,
    ...overrides,
  }
}
