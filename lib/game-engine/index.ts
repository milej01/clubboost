export { predictorEngine } from './predictor'
export { lmsEngine, validateLMSPick } from './lms'
export { teamCardEngine } from './team-card'
export { donationEngine } from './donation'

export type {
  GameType,
  GameEngine,
  GameDefinition,
  GameConfig,
  GameState,
  ValidatedEntry,
  GameResult,
  Leaderboard,
  LeaderboardEntry,
  ParticipantStatus,
  AvailableAction,
  ActionType,
  RuleExplanation,
  RuleSection,
  SettlementResult,
  EntryStatus,
  CompetitionStatus,

  // Predictor
  PredictorConfig,
  PredictorFixture,
  PredictorEntryInput,
  PredictorPrediction,
  ValidatedPredictorEntry,
  PredictorGameState,
  PredictorSettlementInput,
  PredictorTiebreaker,
  FixtureResult,

  // LMS
  LMSConfig,
  LMSEntry,
  LMSRoundPick,
  LMSRoundResult,
  LMSPickInput,
  ValidatedLMSEntry,
  LMSGameState,
  LMSSettlementInput,
  LMSTiebreaker,
  LMSPickResult,

  // Team card
  TeamCardConfig,
  TeamCardSlot,
  TeamCardEntryInput,
  ValidatedTeamCardEntry,
  TeamCardGameState,
  TeamCardSettlementInput,
  SlotStatus,

  // Donation
  DonationConfig,
  DonationEntryInput,
  ValidatedDonationEntry,
  DonationGameState,
} from './types'

export { ok, err } from './types'

import { predictorEngine } from './predictor'
import { lmsEngine }       from './lms'
import { teamCardEngine }  from './team-card'
import { donationEngine }  from './donation'
import type { GameType, GameEngine } from './types'
import type { CompetitionType }      from '@/types/app'

const engines: Record<GameType, GameEngine> = {
  SIX_RESULT_PREDICTOR: predictorEngine,
  LAST_MAN_STANDING:    lmsEngine,
  FOOTBALL_TEAM_CARD:   teamCardEngine,
  DONATION_ONLY:        donationEngine,
}

const DB_TYPE_MAP: Record<CompetitionType, GameType> = {
  predictor:         'SIX_RESULT_PREDICTOR',
  last_man_standing: 'LAST_MAN_STANDING',
  team_card:         'FOOTBALL_TEAM_CARD',
  donation:          'DONATION_ONLY',
}

export function competitionTypeToGameType(type: CompetitionType): GameType {
  const gameType = DB_TYPE_MAP[type]
  if (!gameType) throw new Error(`No game type mapping for competition type: ${type}`)
  return gameType
}

export function getEngine(type: GameType | CompetitionType): GameEngine {
  const gameType = (type in DB_TYPE_MAP)
    ? DB_TYPE_MAP[type as CompetitionType]
    : type as GameType
  const engine = engines[gameType]
  if (!engine) throw new Error(`No game engine registered for type: ${type}`)
  return engine
}
