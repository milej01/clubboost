// Core domain types for ClubBoost
// All monetary values are integers (pence). All percentages are basis points (bps): 100 bps = 1%.

export type UserRole = 'platform_admin' | 'club_admin' | 'participant'
export type ClubStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type CompetitionType = 'predictor' | 'last_man_standing' | 'team_card' | 'donation'
export type CompetitionStatus = 'draft' | 'open' | 'closed' | 'settled' | 'cancelled'
export type EntryStatus = 'pending_payment' | 'active' | 'eliminated' | 'winner' | 'refunded'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded'
export type RefundStatus  = 'pending' | 'succeeded' | 'failed'
export type PayoutStatus  = 'pending_review' | 'processing' | 'paid' | 'failed' | 'cancelled'
/** DB enum payout_type values */
export type PayoutType    = 'club_fundraising' | 'prize_winner' | 'platform_fee' | 'weekly_boost' | 'refund'
export type LedgerType =
  | 'entry_gross'
  | 'donation_gross'
  | 'platform_service_fee'
  | 'payment_processing_fee'
  | 'club_fundraising_amount'
  | 'prize_pool_allocation'
  | 'clubboost_weekly_contribution'
  | 'refund'
  | 'payout'
  | 'adjustment'
  // Legacy values (migration 002)
  | 'entry_payment'
  | 'prize_payout'
  | 'club_fundraising'
  | 'platform_fee'
  | 'weekly_boost_contribution'
export type LedgerDirection = 'credit' | 'debit'
export type PrizeType = 'percentage' | 'fixed' | 'description' | 'none'
export type MemberRole = 'owner' | 'admin' | 'member'
export type RoundStatus = 'open' | 'closed' | 'settled'
export type BoostContributionSource =
  | 'competition_payment'
  | 'sponsor'
  | 'platform_marketing'
  | 'admin_topup'

/** @deprecated use BoostContributionSource */
export type BoostSource = BoostContributionSource

export type BoostPeriodStatus = 'draft' | 'active' | 'closed' | 'awarded'
export type BoostAwardStatus  = 'pending' | 'confirmed' | 'paid' | 'cancelled'

// ─── Profile ─────────────────────────────────────────────────

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  phone: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

// ─── Club ────────────────────────────────────────────────────

export interface Club {
  id: string
  name: string
  slug: string
  sport: string
  team_age_group: string | null
  location: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  logo_url: string | null
  banner_url: string | null
  description: string | null
  stripe_account_id: string | null
  stripe_onboarded: boolean
  status: ClubStatus
  rejection_reason: string | null
  suspension_reason: string | null
  weekly_boost_eligible: boolean
  weekly_boost_enrolled: boolean
  platform_fee_bps: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ClubMember {
  id: string
  club_id: string
  user_id: string
  role: MemberRole
  invited_at: string | null
  joined_at: string
  created_at: string
  profile?: Profile
}

export interface ClubWithStats extends Club {
  total_raised_pence: number
  competition_count: number
  active_competition_count: number
  entry_count: number
}

// ─── Competition ─────────────────────────────────────────────

export interface Competition {
  id: string
  club_id: string
  created_by: string
  type: CompetitionType
  title: string
  description: string | null
  banner_url: string | null
  rules_text: string | null
  status: CompetitionStatus
  entry_fee_pence: number
  max_entries: number | null
  prize_type: PrizeType
  prize_pence: number
  prize_pct_bps: number
  prize_description: string | null
  club_pct_bps: number
  platform_fee_bps: number
  weekly_boost_contribution_bps: number
  opens_at: string | null
  closes_at: string | null
  settled_at: string | null
  settled_by: string | null
  config: CompetitionConfig
  terms_accepted: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CompetitionWithClub extends Competition {
  club: Club
  entry_count?: number
  total_pot_pence?: number
}

// ─── Competition Config (per type) ───────────────────────────

export interface PredictorConfig {
  fixtures: PredictorFixture[]
  points_per_correct: number  // default 1
}

export interface PredictorFixture {
  id?: string
  fixture_order: number
  home_team: string
  away_team: string
  kickoff_at?: string
}

export interface LMSConfig {
  max_rounds: number
  allow_team_reuse: boolean
  available_teams: string[]
  round_deadline_hours: number
}

export interface TeamCardConfig {
  slots: TeamCardSlot[]
  reveal_method: 'manual' | 'random'  // MVP: manual only
}

export interface TeamCardSlot {
  slot_number: number
  team_name: string
}

export interface DonationConfig {
  target_amount_pence?: number
  show_progress: boolean
}

export type CompetitionConfig =
  | PredictorConfig
  | LMSConfig
  | TeamCardConfig
  | DonationConfig
  | Record<string, unknown>

// ─── Rounds ──────────────────────────────────────────────────

export interface CompetitionRound {
  id: string
  competition_id: string
  round_number: number
  title: string | null
  starts_at: string | null
  deadline_at: string | null
  status: RoundStatus
  result_data: Record<string, unknown> | null
  settled_at: string | null
  created_at: string
  updated_at: string
}

// ─── Fixtures ────────────────────────────────────────────────

export interface Fixture {
  id: string
  competition_id: string
  round_id: string | null
  fixture_order: number
  home_team: string
  away_team: string
  kickoff_at: string | null
  actual_result: 'H' | 'D' | 'A' | null
  created_at: string
  updated_at: string
}

// ─── Team Card Slots ─────────────────────────────────────────

export interface TeamCardSlotRecord {
  id: string
  competition_id: string
  slot_number: number
  team_name: string
  entry_id: string | null
  assigned_at: string | null
  is_winner: boolean
  created_at: string
}

/**
 * TeamCardSlotRecord enriched with the linked entry's status.
 * Used on the entry page to distinguish "Reserved" (pending_payment)
 * from "Taken" (active / eliminated / winner).
 */
export interface EnrichedTeamCardSlot extends TeamCardSlotRecord {
  entryStatus: string | null
}

// ─── Entry ───────────────────────────────────────────────────

export interface Entry {
  id: string
  competition_id: string
  participant_id: string
  entry_number: number
  status: EntryStatus
  payment_id: string | null
  entry_data: EntryData
  points_total: number
  entered_at: string
  eliminated_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface EntryWithParticipant extends Entry {
  participant: Profile
  payment?: Payment
}

// Entry-specific data shapes
export interface PredictorEntryData {
  predictions: Array<{
    fixture_id: string
    predicted_result: 'H' | 'D' | 'A'
  }>
}

export interface LMSEntryData {
  picks: Array<{
    round_id: string
    team_picked: string
  }>
}

export interface TeamCardEntryData {
  slot_number: number
}

export interface DonationEntryData {
  message?: string
}

export type EntryData =
  | PredictorEntryData
  | LMSEntryData
  | TeamCardEntryData
  | DonationEntryData
  | Record<string, unknown>

// ─── Payment ─────────────────────────────────────────────────

/** DB table: payments */
export interface Payment {
  id: string
  competition_id: string
  /** DB column: user_id */
  user_id: string
  entry_id: string | null
  // Amounts (pence)
  amount_pence: number
  gross_amount_pence: number
  stripe_fee_pence: number
  platform_service_fee_pence: number
  weekly_boost_contribution_pence: number
  club_fundraising_amount_pence: number
  prize_pool_contribution_pence: number
  currency: string
  status: PaymentStatus
  // Stripe references
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  stripe_charge_id: string | null
  stripe_application_fee_id: string | null
  idempotency_key: string | null
  // Card details
  payment_method_type: string | null
  payment_method_brand: string | null
  payment_method_last4: string | null
  paid_at: string | null
  failed_at: string | null
  failure_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PaymentWithRelations extends Payment {
  participant: Profile
  competition: Competition & { club: Club }
}

/** DB table: payment_ledger */
export interface LedgerEntry {
  id: string
  payment_id: string | null
  entry_id: string | null
  competition_id: string
  club_id: string
  user_id: string | null
  ledger_type: LedgerType
  direction: LedgerDirection
  amount_pence: number
  description: string | null
  reference_id: string | null
  created_at: string
}

/** DB table: refunds */
export interface Refund {
  id: string
  payment_id: string
  entry_id: string | null
  initiated_by: string
  reason: string
  status: RefundStatus
  amount_pence: number
  stripe_refund_id: string | null
  refunded_at: string | null
  failure_reason: string | null
  created_at: string
  updated_at: string
}

// ─── Payout ──────────────────────────────────────────────────

/** DB table: payouts */
export interface Payout {
  id: string
  competition_id: string
  club_id: string | null
  /** Winner's profile ID (for prize payouts) */
  recipient_user_id: string | null
  payout_type: PayoutType
  amount_pence: number
  status: PayoutStatus
  stripe_transfer_id: string | null
  payment_reference: string | null
  notes: string | null
  initiated_by: string | null
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  created_at: string
  updated_at: string
}

export interface PayoutWithRelations extends Payout {
  club: Pick<Club, 'id' | 'name'> | null
  recipient: Pick<Profile, 'id' | 'display_name'> | null
  competition: Pick<Competition, 'id' | 'title'>
}

// ─── Weekly Boost ─────────────────────────────────────────────

/** DB table: clubboost_weekly_boost_periods */
export interface BoostPeriod {
  id: string
  period_name: string
  period_start: string          // DATE string e.g. '2026-05-19'
  period_end: string            // DATE string
  total_pool_pence: number      // denormalised running total
  published_rules: string | null
  notes: string | null
  status: BoostPeriodStatus
  closed_at: string | null
  awarded_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** @deprecated use BoostPeriod */
export type WeeklyBoostPeriod = BoostPeriod

/** DB table: boost_sponsors */
export interface BoostSponsor {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  logo_url: string | null
  website_url: string | null
  notes: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/** DB table: clubboost_weekly_boost_contributions */
export interface BoostFundItem {
  id: string
  period_id: string
  source_type: BoostContributionSource
  amount_pence: number
  description: string | null
  club_id: string | null
  competition_id: string | null
  payment_id: string | null
  entry_id: string | null
  sponsor_id: string | null
  created_by: string | null
  created_at: string
  // joined relations (optional)
  club?: Pick<Club, 'id' | 'name' | 'slug'>
  competition?: Pick<Competition, 'id' | 'title'>
  sponsor?: Pick<BoostSponsor, 'id' | 'name'>
}

/** DB table: boost_eligible_clubs */
export interface BoostEligibleClub {
  id: string
  period_id: string
  club_id: string
  is_eligible: boolean
  eligibility_reason: string | null
  ineligibility_reason: string | null
  is_manually_overridden: boolean
  override_reason: string | null
  override_by: string | null
  override_at: string | null
  created_at: string
  updated_at: string
  // joined
  club?: Club
  contribution_total_pence?: number
}

/** DB table: clubboost_weekly_boost_awards */
export interface BoostAward {
  id: string
  period_id: string
  club_id: string
  awarded_by: string
  amount_pence: number
  status: BoostAwardStatus
  reason: string | null
  payout_id: string | null
  is_public: boolean
  published_at: string | null
  published_summary: string | null
  awarded_at: string
  created_at: string
  updated_at: string
  // joined
  club?: Pick<Club, 'id' | 'name' | 'slug' | 'logo_url'>
  period?: Pick<BoostPeriod, 'id' | 'period_name' | 'period_start' | 'period_end'>
}

/** @deprecated use BoostAward */
export interface WeeklyBoostAward extends BoostAward {}

/** DB table: boost_audit_events */
export interface BoostAuditEvent {
  id: string
  period_id: string | null
  event_type: string
  actor_id: string | null
  actor_role: string | null
  club_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

/** Rich period view used by the admin detail page */
export interface BoostPeriodDetail extends BoostPeriod {
  fund_items: BoostFundItem[]
  eligible_clubs: BoostEligibleClub[]
  awards: BoostAward[]
  total_fund_pence: number
  fund_by_source: Partial<Record<BoostContributionSource, number>>
}

/** Summary shown on the club dashboard */
export interface ClubBoostSummary {
  is_enrolled: boolean
  active_period: BoostPeriod | null
  is_eligible: boolean
  eligibility_reason: string | null
  total_contributed_pence: number
  award_history: BoostAward[]
}

// ─── Feature Flags ────────────────────────────────────────────

export interface FeatureFlag {
  id: string
  key: string
  enabled: boolean
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type FeatureFlagKey =
  | 'weekly_boost'
  | 'donation_only'
  | 'csv_export'
  | 'team_card'
  | 'last_man_standing'

// ─── Audit Log ────────────────────────────────────────────────

export type AuditAction =
  | 'club_created'
  | 'club_approved'
  | 'club_rejected'
  | 'club_suspended'
  | 'club_updated'
  | 'competition_created'
  | 'competition_edited'
  | 'competition_published'
  | 'competition_entered'
  | 'competition_closed'
  | 'competition_settled'
  | 'competition_cancelled'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'payment_refunded'
  | 'payout_initiated'
  | 'payout_completed'
  | 'weekly_boost_period_created'
  | 'weekly_boost_period_closed'
  | 'weekly_boost_contribution_recorded'
  | 'weekly_boost_awarded'
  | 'weekly_boost_award_published'
  | 'weekly_boost_eligibility_overridden'
  | 'weekly_boost_sponsor_added'
  | 'admin_override'
  | 'stripe_connect_started'
  | 'stripe_connect_completed'

export interface AuditLog {
  id: string
  actor_id: string | null
  club_id: string | null
  entity_type: string
  entity_id: string | null
  action: AuditAction | string
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  ip_address: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor?: Profile
}

// ─── Game Engine ──────────────────────────────────────────────

export interface LeaderboardEntry {
  entry_id: string
  participant_id: string
  participant_name: string
  entry_number: number
  rank: number
  points_total: number
  status: EntryStatus
  details?: Record<string, unknown>
}

export interface SettlementResult {
  winner_entry_id: string | null
  winner_participant_id: string | null
  leaderboard: LeaderboardEntry[]
  prize_pence: number
  notes: string
}

export interface RuleExplanation {
  how_to_enter: string
  how_winner_is_decided: string
  prize_description: string
  refund_note: string
}

// ─── Server Action Results ────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Pot Split ────────────────────────────────────────────────

export interface PotSplit {
  entry_fee_pence: number
  prize_pence: number
  club_pence: number
  platform_pence: number
  boost_pence: number
  prize_pct: number
  club_pct: number
  platform_pct: number
  boost_pct: number
}
