// ============================================================
// ClubBoost Game Engine — Shared Types
//
// Self-contained: no imports from @/types/app or any framework.
// All monetary values are integers in pence.
// ============================================================

// ── Discriminants ────────────────────────────────────────────

export type GameType =
  | 'SIX_RESULT_PREDICTOR'
  | 'LAST_MAN_STANDING'
  | 'FOOTBALL_TEAM_CARD'
  | 'DONATION_ONLY'

export type EntryStatus =
  | 'pending_payment'
  | 'active'
  | 'eliminated'
  | 'winner'
  | 'refunded'

export type CompetitionStatus =
  | 'open'
  | 'in_progress'   // LMS: between rounds
  | 'closed'
  | 'settled'
  | 'cancelled'

// ── Result type (no exceptions from pure functions) ──────────

export type GameResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string; code: string }

export function ok<T>(data: T): GameResult<T> {
  return { ok: true, data }
}

export function err(code: string, error: string): GameResult<never> {
  return { ok: false, code, error }
}

// ── Leaderboard ───────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number
  entryId: string
  userId: string
  score: number
  isWinner: boolean
  isEliminated: boolean
  tiebreakerValue?: number
  details?: Record<string, unknown>
}

export interface Leaderboard {
  entries: LeaderboardEntry[]
  isSettled: boolean
  winnerEntryIds: string[]
}

// ── Participant status ────────────────────────────────────────

export interface ParticipantStatus {
  entryId: string
  userId: string
  status: EntryStatus
  rank?: number
  score?: number
  isWinner: boolean
  isEliminated: boolean
  canTakeAction: boolean
  details: Record<string, unknown>
}

// ── Available actions ─────────────────────────────────────────

export type ActionType =
  | 'SUBMIT_PICK'
  | 'USE_BUYBACK'
  | 'CLAIM_SLOT'
  | 'VIEW_RESULTS'
  | 'ADMIN_REVEAL_WINNER'

export interface AvailableAction {
  type: ActionType
  label: string
  description?: string
  requiresInput: boolean
}

// ── Rules explanation ─────────────────────────────────────────

export interface RuleSection {
  heading: string
  content: string
}

export interface RuleExplanation {
  summary: string
  howToWin: string
  scoring?: string
  tiebreaker?: string
  sections: RuleSection[]
}

// ── Settlement result ─────────────────────────────────────────

export interface SettlementResult {
  winnerEntryIds: string[]
  loserEntryIds: string[]
  voidEntryIds: string[]
  finalLeaderboard: Leaderboard
  details: Record<string, unknown>
}

// ── Game definition (static metadata) ────────────────────────

export interface GameDefinition {
  type: GameType
  label: string
  description: string
  features: {
    hasRounds: boolean
    hasScoring: boolean
    hasWinner: boolean
    supportsExactScore: boolean
  }
}

// ────────────────────────────────────────────────────────────────
// PREDICTOR TYPES
// ────────────────────────────────────────────────────────────────

export type FixtureResult = 'home' | 'draw' | 'away'

export type PredictorTiebreaker =
  | 'total_goals'    // closest predicted total goals wins; ties go to earliest entry
  | 'earliest_entry' // first to enter wins
  | 'manual'         // admin specifies winner via tiebreakWinnerEntryId

export interface PredictorFixture {
  id: string
  homeTeam: string
  awayTeam: string
  kickoffAt?: string        // ISO datetime, optional
  result?: FixtureResult    // set at settlement
  homeScore?: number        // set at settlement
  awayScore?: number        // set at settlement
}

export interface PredictorConfig {
  type: 'SIX_RESULT_PREDICTOR'
  fixtures: PredictorFixture[]        // exactly 6
  pointsPerCorrectResult: number       // ≥ 1
  bonusPointsForExactScore: number     // 0 if allowExactScore is false
  allowExactScore: boolean
  tiebreaker: PredictorTiebreaker
}

export interface PredictorPrediction {
  fixtureId: string
  result: FixtureResult
  homeScore?: number          // only if allowExactScore
  awayScore?: number          // only if allowExactScore
}

export interface PredictorEntryInput {
  entryId: string
  userId: string
  entryNumber: number
  enteredAt: string           // ISO datetime
  predictions: PredictorPrediction[]  // exactly 6
  predictedTotalGoals?: number        // for total_goals tiebreaker
}

export interface ValidatedPredictorEntry extends PredictorEntryInput {
  score: number               // 0 until fixtures have results
  correctResults: number
  exactScores: number
}

export interface PredictorGameState {
  type: 'SIX_RESULT_PREDICTOR'
  config: PredictorConfig
  entries: ValidatedPredictorEntry[]
  status: CompetitionStatus
}

export interface PredictorSettlementInput {
  fixtureResults: Array<{
    fixtureId: string
    homeScore: number
    awayScore: number
  }>
  tiebreakWinnerEntryId?: string   // required when tiebreaker='manual' and there's a tie
}

// ────────────────────────────────────────────────────────────────
// LAST MAN STANDING TYPES
// ────────────────────────────────────────────────────────────────

export type LMSTiebreaker = 'earliest_entry' | 'random' | 'manual'
export type LMSPickResult  = 'correct' | 'incorrect' | 'pending'

export interface LMSConfig {
  type: 'LAST_MAN_STANDING'
  maxRounds: number           // competition ends after this many rounds
  allowTeamReuse: boolean     // can a participant pick the same team in a later round?
  drawCountsAsSurvival: boolean  // if false, draws eliminate the participant
  buybackEnabled: boolean
  buybackUntilRound: number   // 0 means no buyback; otherwise buyback allowed up to this round
  availableTeams: string[]    // at least 2 teams
  tiebreaker: LMSTiebreaker
}

export interface LMSRoundPick {
  roundNumber: number
  teamName: string
  result: LMSPickResult
}

export interface LMSEntry {
  entryId: string
  userId: string
  entryNumber: number
  enteredAt: string
  status: EntryStatus
  roundPicks: LMSRoundPick[]
  usedBuyback: boolean
  buybackRound?: number         // round in which buyback was used
  eliminatedInRound?: number
}

export type ValidatedLMSEntry = LMSEntry

export interface LMSRoundResult {
  roundNumber: number
  survivingTeams: string[]    // teams whose side won (case-insensitive match)
  eliminatedTeams: string[]   // teams whose side lost
  drawnTeams: string[]        // teams that drew
}

export interface LMSGameState {
  type: 'LAST_MAN_STANDING'
  config: LMSConfig
  entries: LMSEntry[]
  currentRound: number
  status: CompetitionStatus
  roundResults: LMSRoundResult[]
}

export interface LMSPickInput {
  entryId: string
  roundNumber: number
  teamName: string
}

export interface LMSSettlementInput {
  rounds: LMSRoundResult[]
  tiebreakWinnerEntryId?: string   // for 'manual' when all eliminated same round
}

// ────────────────────────────────────────────────────────────────
// FOOTBALL TEAM CARD TYPES
// ────────────────────────────────────────────────────────────────

export type SlotStatus = 'available' | 'reserved' | 'sold' | 'void'

export interface TeamCardSlot {
  id: string
  slotNumber: number
  teamName: string
  status: SlotStatus
  entryId?: string       // set when claimed
  userId?: string        // denormalized from entry
}

export interface TeamCardConfig {
  type: 'FOOTBALL_TEAM_CARD'
  slots: TeamCardSlot[]                                      // at least 2
  assignmentMethod: 'participant_choice' | 'random_assignment'
  revealMethod: 'manual_admin' | 'manual_platform_admin'
}

export interface TeamCardEntryInput {
  entryId: string
  userId: string
  entryNumber: number
  enteredAt: string
  slotId: string         // the slot being claimed
}

export interface ValidatedTeamCardEntry extends TeamCardEntryInput {
  slot: TeamCardSlot     // the resolved slot at entry time
}

export interface TeamCardGameState {
  type: 'FOOTBALL_TEAM_CARD'
  config: TeamCardConfig
  entries: ValidatedTeamCardEntry[]
  status: CompetitionStatus
  winningSlotId?: string
}

export interface TeamCardSettlementInput {
  winningSlotId: string
}

// ────────────────────────────────────────────────────────────────
// DONATION TYPES
// ────────────────────────────────────────────────────────────────

export interface DonationConfig {
  type: 'DONATION_ONLY'
  targetAmountPence?: number   // optional fundraising target
  showProgress: boolean
  allowAnonymous: boolean
}

export interface DonationEntryInput {
  entryId: string
  userId: string
  entryNumber: number
  enteredAt: string
  amountPence: number          // must be > 0
  message?: string
  isAnonymous: boolean
}

export type ValidatedDonationEntry = DonationEntryInput

export interface DonationGameState {
  type: 'DONATION_ONLY'
  config: DonationConfig
  entries: ValidatedDonationEntry[]
  status: CompetitionStatus
  totalRaisedPence: number
}

// ────────────────────────────────────────────────────────────────
// UNION TYPES
// ────────────────────────────────────────────────────────────────

export type GameConfig =
  | PredictorConfig
  | LMSConfig
  | TeamCardConfig
  | DonationConfig

export type GameState =
  | PredictorGameState
  | LMSGameState
  | TeamCardGameState
  | DonationGameState

export type ValidatedEntry =
  | ValidatedPredictorEntry
  | ValidatedLMSEntry
  | ValidatedTeamCardEntry
  | ValidatedDonationEntry

// ────────────────────────────────────────────────────────────────
// GAME ENGINE INTERFACE
// ────────────────────────────────────────────────────────────────

export interface GameEngine {
  readonly type: GameType
  readonly definition: GameDefinition

  /** Validate game-type-specific configuration (e.g. exactly 6 fixtures). */
  validateGameConfig(raw: unknown): GameResult<GameConfig>

  /** Validate a new entry submission against the current game state. */
  validateEntry(raw: unknown, state: GameState): GameResult<ValidatedEntry>

  /** Calculate current standings. Scores are recomputed from state. */
  calculateLeaderboard(state: GameState): Leaderboard

  /** Return a single participant's current status, or null if not found. */
  getParticipantStatus(entryId: string, state: GameState): ParticipantStatus | null

  /** Return actions available to the participant right now. */
  getAvailableActions(entryId: string, state: GameState): AvailableAction[]

  /** Produce the final settlement result. Pure — does not mutate state. */
  settleCompetition(state: GameState, input: unknown): GameResult<SettlementResult>

  /** Generate a human-readable rule explanation for the public entry page. */
  explainRulesForParticipant(config: GameConfig): RuleExplanation
}
