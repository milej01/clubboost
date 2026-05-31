-- ============================================================
-- ClubBoost — Complete Schema (Migration 002)
-- Supersedes 001_initial_schema.sql for a greenfield deploy.
-- Run this against a fresh Supabase project.
--
-- Conventions:
--   • All monetary amounts stored as INTEGER in pence (GBP × 100).
--     Max INT value ≈ £21 M — sufficient for grassroots sport.
--   • All percentage splits stored as INTEGER basis points (bps).
--     100 bps = 1%.  10 000 bps = 100%.
--   • UUID primary keys everywhere (gen_random_uuid()).
--   • created_at / updated_at on every main table.
--   • Soft delete via deleted_at where rollback matters.
--   • Immutable tables (ledger, audit, snapshot) have no updated_at.
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram text search on club/team names


-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role            AS ENUM ('platform_admin', 'club_admin', 'participant');
CREATE TYPE club_member_role     AS ENUM ('owner', 'admin', 'member');
CREATE TYPE club_status          AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE verification_status  AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE verification_type    AS ENUM ('manual', 'document', 'stripe');
CREATE TYPE competition_type     AS ENUM ('predictor', 'last_man_standing', 'team_card', 'donation');
CREATE TYPE competition_status   AS ENUM ('draft', 'open', 'closed', 'settled', 'cancelled');
CREATE TYPE prize_type           AS ENUM ('none', 'percentage', 'fixed', 'description');
CREATE TYPE fixture_result       AS ENUM ('home', 'draw', 'away');
CREATE TYPE prediction_value     AS ENUM ('home', 'draw', 'away');
CREATE TYPE entry_status         AS ENUM ('pending_payment', 'active', 'eliminated', 'winner', 'refunded');
CREATE TYPE round_result_val     AS ENUM ('correct', 'incorrect', 'pending');
CREATE TYPE payment_status       AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded');
CREATE TYPE ledger_type          AS ENUM (
  'entry_payment',
  'prize_payout',
  'club_fundraising',
  'platform_fee',
  'weekly_boost_contribution',
  'refund',
  'adjustment'
);
CREATE TYPE ledger_direction     AS ENUM ('credit', 'debit');
CREATE TYPE refund_status        AS ENUM ('pending', 'succeeded', 'failed');
CREATE TYPE payout_status        AS ENUM ('pending_review', 'processing', 'paid', 'failed', 'cancelled');
CREATE TYPE payout_type          AS ENUM ('club_fundraising', 'prize_winner', 'platform_fee', 'weekly_boost');
CREATE TYPE platform_fee_status  AS ENUM ('pending', 'captured', 'refunded');
CREATE TYPE boost_period_status  AS ENUM ('active', 'closed', 'awarded');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'sms');
CREATE TYPE terms_context        AS ENUM ('registration', 'competition_creation', 'entry');


-- ============================================================
-- SHARED TRIGGER: updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ============================================================
-- TABLE: profiles
-- ============================================================
-- Extends auth.users 1:1. Auto-created by on_auth_user_created.
-- role controls coarse-grained access (RLS + server-side checks).
-- email is denormalized from auth.users for query convenience.
-- deleted_at soft-deletes the profile while preserving FK integrity.
-- ============================================================

CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  email         TEXT,
  role          user_role NOT NULL DEFAULT 'participant',
  avatar_url    TEXT,
  phone         TEXT,
  bio           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'participant')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- TABLE: terms_versions
-- ============================================================
-- Versioned platform terms of service.
-- Only one version should have is_current = TRUE at any time
-- (enforced by application logic, not a DB constraint, to allow
-- graceful rotation without a two-step transaction).
-- Acceptance records reference a specific version for legal audit.
-- ============================================================

CREATE TABLE public.terms_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version         TEXT NOT NULL UNIQUE,   -- e.g. '1.0', '1.1', '2.0'
  content         TEXT NOT NULL,
  effective_from  TIMESTAMPTZ NOT NULL,
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Intentionally no updated_at: treat as immutable after publish.
  -- Issue a new version rather than editing content.
);


-- ============================================================
-- TABLE: feature_flags
-- ============================================================
-- Runtime feature switches toggled by platform admins.
-- The application layer caches these per request (React cache()).
-- metadata JSONB carries flag-specific config:
--   weekly_boost → { "contribution_bps": 200 }
-- ============================================================

CREATE TABLE public.feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: clubs
-- ============================================================
-- A sports club using ClubBoost for fundraising.
-- Must be approved (status = 'approved') before competitions
-- can be published or entries accepted.
-- stripe_onboarded must be TRUE before paid competitions open.
-- weekly_boost_eligible is toggled separately by platform admin.
-- ============================================================

CREATE TABLE public.clubs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  sport                 TEXT NOT NULL DEFAULT 'football',
  team_age_group        TEXT,
  location              TEXT,
  description           TEXT,
  logo_url              TEXT,
  website_url           TEXT,
  contact_name          TEXT NOT NULL,
  contact_email         TEXT NOT NULL,
  contact_phone         TEXT,
  status                club_status NOT NULL DEFAULT 'pending',

  -- Stripe Connect
  stripe_account_id     TEXT UNIQUE,
  stripe_onboarded      BOOLEAN NOT NULL DEFAULT FALSE,

  -- Weekly Boost opt-in
  weekly_boost_eligible BOOLEAN NOT NULL DEFAULT FALSE,

  -- Approval provenance
  created_by            UUID NOT NULL REFERENCES public.profiles(id),
  approved_by           UUID REFERENCES public.profiles(id),
  approved_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  suspension_reason     TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,

  CONSTRAINT clubs_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  CONSTRAINT clubs_approval_requires_approver CHECK (
    status NOT IN ('approved', 'rejected') OR approved_by IS NOT NULL
  )
);

CREATE TRIGGER trg_clubs_updated_at
  BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: club_members
-- ============================================================
-- Maps profiles to clubs with a role.
-- A user may be a member of multiple clubs.
-- 'owner' is set on club creation; only one owner per club
-- (not enforced at DB level — enforced in application).
-- ============================================================

CREATE TABLE public.club_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        club_member_role NOT NULL DEFAULT 'member',
  invited_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (club_id, user_id)
);

CREATE TRIGGER trg_club_members_updated_at
  BEFORE UPDATE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: club_verification
-- ============================================================
-- Optional multi-step identity/document verification for clubs.
-- Separate from approval status — a club can be manually approved
-- while document verification is still pending.
-- documents JSONB: array of { type, url, filename, uploaded_at }.
-- ============================================================

CREATE TABLE public.club_verification (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  verification_type   verification_type NOT NULL DEFAULT 'manual',
  status              verification_status NOT NULL DEFAULT 'pending',
  verified_by         UUID REFERENCES public.profiles(id),
  notes               TEXT,
  documents           JSONB NOT NULL DEFAULT '[]'::JSONB,
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_club_verification_updated_at
  BEFORE UPDATE ON public.club_verification
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: competitions
-- ============================================================
-- Core fundraising competition. Split percentages are snapshotted
-- at creation and locked before the first entry (enforced in app).
--
-- Split constraint: prize% + club% + platform_fee% + boost% ≤ 100%
-- In bps: their sum must not exceed 10 000.
--
-- Accumulated totals (gross_entry_total_pence, etc.) are updated
-- atomically when each payment succeeds, giving live running totals
-- without aggregating over payments at read time.
-- ============================================================

CREATE TABLE public.competitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES public.clubs(id),
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  type          competition_type NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  rules_text    TEXT,
  status        competition_status NOT NULL DEFAULT 'draft',

  -- Entry pricing
  entry_fee_pence   INT NOT NULL DEFAULT 0 CHECK (entry_fee_pence >= 0),
  max_entries       INT CHECK (max_entries IS NULL OR max_entries > 0),

  -- Prize configuration
  prize_type          prize_type NOT NULL DEFAULT 'none',
  prize_pct_bps       INT CHECK (prize_pct_bps IS NULL OR prize_pct_bps BETWEEN 1 AND 9000),
  prize_fixed_pence   INT CHECK (prize_fixed_pence IS NULL OR prize_fixed_pence > 0),
  prize_description   TEXT,

  -- Financial split (basis points, 100 bps = 1%)
  club_pct_bps                   INT NOT NULL DEFAULT 4000 CHECK (club_pct_bps  BETWEEN 1000 AND 9500),
  platform_fee_bps               INT NOT NULL DEFAULT 800  CHECK (platform_fee_bps BETWEEN 0 AND 2000),
  weekly_boost_contribution_bps  INT NOT NULL DEFAULT 0    CHECK (weekly_boost_contribution_bps BETWEEN 0 AND 1000),

  -- Lifecycle timestamps
  opens_at      TIMESTAMPTZ,
  closes_at     TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  settled_at    TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,

  -- Terms
  terms_accepted      BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version_id    UUID REFERENCES public.terms_versions(id),

  -- Lightweight config (full game config in competition_game_configs)
  config  JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Accumulated financial totals (updated on each payment success / refund)
  total_entries_count                   INT NOT NULL DEFAULT 0 CHECK (total_entries_count >= 0),
  gross_entry_total_pence               INT NOT NULL DEFAULT 0 CHECK (gross_entry_total_pence >= 0),
  total_payment_processing_fee_pence    INT NOT NULL DEFAULT 0 CHECK (total_payment_processing_fee_pence >= 0),
  total_platform_service_fee_pence      INT NOT NULL DEFAULT 0 CHECK (total_platform_service_fee_pence >= 0),
  total_weekly_boost_contribution_pence INT NOT NULL DEFAULT 0 CHECK (total_weekly_boost_contribution_pence >= 0),
  total_club_fundraising_pence          INT NOT NULL DEFAULT 0 CHECK (total_club_fundraising_pence >= 0),
  total_prize_pool_pence                INT NOT NULL DEFAULT 0 CHECK (total_prize_pool_pence >= 0),
  total_refunded_pence                  INT NOT NULL DEFAULT 0 CHECK (total_refunded_pence >= 0),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  -- Prize fields must be populated for their type
  CONSTRAINT comp_prize_pct_populated   CHECK (prize_type <> 'percentage'  OR prize_pct_bps IS NOT NULL),
  CONSTRAINT comp_prize_fixed_populated CHECK (prize_type <> 'fixed'       OR prize_fixed_pence IS NOT NULL),
  CONSTRAINT comp_prize_desc_populated  CHECK (prize_type <> 'description' OR prize_description IS NOT NULL),
  -- Split integrity: no promises can exceed 100%
  CONSTRAINT comp_split_sum_valid CHECK (
    COALESCE(prize_pct_bps, 0)
    + club_pct_bps
    + platform_fee_bps
    + weekly_boost_contribution_bps
    <= 10000
  ),
  -- Dates must be ordered when both are set
  CONSTRAINT comp_dates_ordered CHECK (
    opens_at IS NULL OR closes_at IS NULL OR closes_at > opens_at
  )
);

CREATE TRIGGER trg_competitions_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-maintain total_entries_count from entries table
CREATE OR REPLACE FUNCTION public.sync_competition_entry_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      UPDATE public.competitions SET total_entries_count = total_entries_count + 1
      WHERE id = NEW.competition_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'active' AND NEW.status = 'active' THEN
      UPDATE public.competitions SET total_entries_count = total_entries_count + 1
      WHERE id = NEW.competition_id;
    ELSIF OLD.status = 'active' AND NEW.status = 'refunded' THEN
      UPDATE public.competitions SET total_entries_count = GREATEST(total_entries_count - 1, 0)
      WHERE id = NEW.competition_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================
-- TABLE: competition_game_configs
-- ============================================================
-- Detailed, type-specific game configuration. 1:1 with competitions.
-- Separating this out keeps competitions clean and allows versioned
-- config changes (version column) with full history if needed.
--
-- config JSONB shape per type:
--   predictor:
--     { "points_per_correct": 1, "tiebreak": "entry_order" }
--   last_man_standing:
--     { "max_rounds": 10, "allow_team_reuse": false,
--       "available_teams": ["Arsenal", "Chelsea", ...] }
--   team_card:
--     { "reveal_method": "manual", "max_slots": 50 }
--   donation:
--     { "target_amount_pence": 50000, "show_progress": true }
-- ============================================================

CREATE TABLE public.competition_game_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID NOT NULL UNIQUE REFERENCES public.competitions(id) ON DELETE CASCADE,
  config_type     competition_type NOT NULL,
  config          JSONB NOT NULL DEFAULT '{}'::JSONB,
  version         INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_competition_game_configs_updated_at
  BEFORE UPDATE ON public.competition_game_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: competition_rules_snapshots
-- ============================================================
-- Immutable snapshot of a competition's rules, prize, and split
-- taken at the moment a participant enters.
-- This is the legal record of what each entrant agreed to.
--
-- content_hash (SHA-256 of canonical JSON) enables deduplication:
-- if terms haven't changed, the same snapshot row is reused
-- across multiple entries rather than creating a new copy.
--
-- competition_snapshot holds the full competition JSONB at the
-- moment of entry so the record is self-contained even if the
-- competition is later edited or deleted.
-- ============================================================

CREATE TABLE public.competition_rules_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id        UUID NOT NULL REFERENCES public.competitions(id),
  content_hash          TEXT NOT NULL,
  rules_text            TEXT,
  entry_fee_pence       INT NOT NULL,
  prize_summary         JSONB NOT NULL,
  split_summary         JSONB NOT NULL,
  competition_snapshot  JSONB NOT NULL,
  snapshotted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- No updated_at: immutable after creation.

  UNIQUE (competition_id, content_hash)
);


-- ============================================================
-- TABLE: teams
-- ============================================================
-- Optional team registry. Used primarily for LMS competitions.
-- club_id IS NULL → platform-wide team (e.g. Premier League clubs).
-- club_id IS NOT NULL → club-specific team list.
-- Predictor fixtures use free-text home_team / away_team instead.
-- ============================================================

CREATE TABLE public.teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  short_name  TEXT,
  logo_url    TEXT,
  sport       TEXT NOT NULL DEFAULT 'football',
  league      TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE NULLS NOT DISTINCT (club_id, name)
);

CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: fixtures
-- ============================================================
-- One row per match in a predictor competition (exactly 6 for MVP).
-- home_team / away_team are canonical text; *_team_id are optional
-- links to the teams registry for richer display.
-- result is set by admin at settlement; home_score / away_score
-- are provided for reference but result is what drives scoring.
-- ============================================================

CREATE TABLE public.fixtures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  fixture_order   INT NOT NULL CHECK (fixture_order >= 0),
  home_team       TEXT NOT NULL,
  away_team       TEXT NOT NULL,
  home_team_id    UUID REFERENCES public.teams(id),
  away_team_id    UUID REFERENCES public.teams(id),
  kickoff_at      TIMESTAMPTZ,
  home_score      INT CHECK (home_score IS NULL OR home_score >= 0),
  away_score      INT CHECK (away_score IS NULL OR away_score >= 0),
  result          fixture_result,
  settled_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (competition_id, fixture_order)
);

CREATE TRIGGER trg_fixtures_updated_at
  BEFORE UPDATE ON public.fixtures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: team_card_slots
-- ============================================================
-- Each row is one available "square" in a team_card competition.
-- Participants claim exactly one slot. is_taken flips to TRUE when
-- taken_by_entry_id is set. is_winning_slot is set at settlement.
-- FK to entries is deferred until after entries is created.
-- ============================================================

CREATE TABLE public.team_card_slots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id      UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  slot_number         INT NOT NULL CHECK (slot_number >= 1),
  team_name           TEXT NOT NULL,
  is_taken            BOOLEAN NOT NULL DEFAULT FALSE,
  taken_by_entry_id   UUID,                 -- FK added below after entries
  is_winning_slot     BOOLEAN,              -- NULL until settled
  revealed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (competition_id, slot_number)
);

CREATE TRIGGER trg_team_card_slots_updated_at
  BEFORE UPDATE ON public.team_card_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: entries
-- ============================================================
-- One entry per participant per competition.
-- Created with status = 'pending_payment'; activated by the
-- Stripe checkout.session.completed webhook.
--
-- Per-entry financial fields mirror the payment breakdown,
-- enabling reconciliation without joining through payments.
-- They are set to 0 and populated only when payment succeeds.
--
-- rules_snapshot_id captures what the entrant agreed to.
-- entry_number is auto-assigned sequentially per competition.
-- ============================================================

CREATE TABLE public.entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id      UUID NOT NULL REFERENCES public.competitions(id),
  user_id             UUID NOT NULL REFERENCES public.profiles(id),
  entry_number        INT NOT NULL DEFAULT 0,
  status              entry_status NOT NULL DEFAULT 'pending_payment',
  rules_snapshot_id   UUID REFERENCES public.competition_rules_snapshots(id),
  payment_id          UUID,                   -- FK added below after payments

  -- Per-entry financial split (all pence, populated on payment success)
  entry_fee_pence                   INT NOT NULL DEFAULT 0 CHECK (entry_fee_pence >= 0),
  payment_processing_fee_pence      INT NOT NULL DEFAULT 0 CHECK (payment_processing_fee_pence >= 0),
  platform_service_fee_pence        INT NOT NULL DEFAULT 0 CHECK (platform_service_fee_pence >= 0),
  weekly_boost_contribution_pence   INT NOT NULL DEFAULT 0 CHECK (weekly_boost_contribution_pence >= 0),
  club_fundraising_pence            INT NOT NULL DEFAULT 0 CHECK (club_fundraising_pence >= 0),
  prize_pool_contribution_pence     INT NOT NULL DEFAULT 0 CHECK (prize_pool_contribution_pence >= 0),

  -- Settlement
  score         INT,             -- predictor: count of correct predictions
  rank          INT,             -- post-settlement rank (1 = top)
  is_winner     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Lifecycle timestamps
  entered_at    TIMESTAMPTZ,     -- when status first became 'active'
  eliminated_at TIMESTAMPTZ,     -- LMS: when eliminated

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (competition_id, entry_number),
  UNIQUE (competition_id, user_id)           -- one entry per participant per competition
);

CREATE TRIGGER trg_entries_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_entries_sync_count
  AFTER INSERT OR UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_competition_entry_count();

-- Auto-assign entry_number sequentially per competition
CREATE OR REPLACE FUNCTION public.generate_entry_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entry_number = 0 THEN
    SELECT COALESCE(MAX(entry_number), 0) + 1
    INTO NEW.entry_number
    FROM public.entries
    WHERE competition_id = NEW.competition_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_entries_entry_number
  BEFORE INSERT ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.generate_entry_number();

-- FK from team_card_slots → entries (now that entries exists)
ALTER TABLE public.team_card_slots
  ADD CONSTRAINT fk_team_card_slots_entry
  FOREIGN KEY (taken_by_entry_id) REFERENCES public.entries(id);


-- ============================================================
-- TABLE: entry_predictions
-- ============================================================
-- One row per fixture per predictor entry (6 rows per entry).
-- is_correct is NULL until the fixture is settled.
-- Changing a prediction after submission is disallowed in the app.
-- ============================================================

CREATE TABLE public.entry_predictions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  fixture_id  UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  prediction  prediction_value NOT NULL,
  is_correct  BOOLEAN,                 -- NULL until fixture settled
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- No updated_at: treat predictions as immutable after submission.

  UNIQUE (entry_id, fixture_id)
);


-- ============================================================
-- TABLE: entry_round_picks
-- ============================================================
-- One row per round per LMS entry (created round by round).
-- team_id optionally links to the teams registry; team_name is
-- canonical and denormalized for display and historical accuracy.
-- result starts as 'pending' and is set during round settlement.
-- ============================================================

CREATE TABLE public.entry_round_picks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  competition_id  UUID NOT NULL REFERENCES public.competitions(id),
  round_number    INT NOT NULL CHECK (round_number >= 1),
  team_id         UUID REFERENCES public.teams(id),
  team_name       TEXT NOT NULL,
  result          round_result_val NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (entry_id, round_number)
);

CREATE TRIGGER trg_entry_round_picks_updated_at
  BEFORE UPDATE ON public.entry_round_picks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: donations
-- ============================================================
-- Supplementary data for donation-type competition entries.
-- Stores the optional supporter message and anonymity flag.
-- Keyed to entry_id 1:1 so the entry is always the canonical record.
-- ============================================================

CREATE TABLE public.donations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        UUID NOT NULL UNIQUE REFERENCES public.entries(id) ON DELETE CASCADE,
  competition_id  UUID NOT NULL REFERENCES public.competitions(id),
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  message         TEXT,
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: payments
-- ============================================================
-- One Stripe payment record per entry attempt.
-- All financial breakdown fields are populated atomically when
-- the Stripe webhook confirms success.
--
-- stripe_fee_pence = Stripe's payment processing fee (1.4% + 20p
-- for European cards in the UK, approximately). Tracked for P&L
-- but not charged separately to participants.
--
-- The entry_id FK is nullable to allow payments to be created
-- before the entry row exists (though current flow creates entry first).
-- ============================================================

CREATE TABLE public.payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    UUID NOT NULL REFERENCES public.competitions(id),
  user_id           UUID NOT NULL REFERENCES public.profiles(id),
  entry_id          UUID REFERENCES public.entries(id),

  -- Amounts (all pence)
  amount_pence                    INT NOT NULL CHECK (amount_pence >= 0),
  gross_amount_pence              INT NOT NULL DEFAULT 0,
  stripe_fee_pence                INT NOT NULL DEFAULT 0,
  platform_service_fee_pence      INT NOT NULL DEFAULT 0,
  weekly_boost_contribution_pence INT NOT NULL DEFAULT 0,
  club_fundraising_amount_pence   INT NOT NULL DEFAULT 0,
  prize_pool_contribution_pence   INT NOT NULL DEFAULT 0,

  currency    TEXT NOT NULL DEFAULT 'gbp',
  status      payment_status NOT NULL DEFAULT 'pending',

  -- Stripe references
  stripe_payment_intent_id    TEXT UNIQUE,
  stripe_checkout_session_id  TEXT UNIQUE,
  stripe_charge_id            TEXT,

  -- Card details (populated on success for display/receipts)
  payment_method_type   TEXT,
  payment_method_last4  TEXT,

  paid_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  failure_reason  TEXT,

  metadata    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK from entries → payments (now that payments exists)
ALTER TABLE public.entries
  ADD CONSTRAINT fk_entries_payment
  FOREIGN KEY (payment_id) REFERENCES public.payments(id);


-- ============================================================
-- TABLE: payment_ledger
-- ============================================================
-- Immutable, append-only financial ledger. Never updated or deleted.
-- Every payment creates a set of ledger rows covering the full split:
--
--   CREDIT | entry_payment             | £5.00  ← participant pays
--   DEBIT  | platform_fee              | £0.40  ← platform's cut
--   DEBIT  | weekly_boost_contribution | £0.10  ← boost pool
--   DEBIT  | club_fundraising          | £2.00  ← club's share
--   DEBIT  | prize_pool_contribution   | £2.50  ← prize pot
--   (Sum of DEBITs = CREDIT = gross payment amount)
--
-- At settlement:
--   CREDIT | prize_payout              | £2.50  ← winner receives
--   CREDIT | club_fundraising          | £2.00  ← club receives
--
-- reference_id is a UUID pointer to the source record
-- (payment_id, refund_id, payout_id, or boost award id).
-- ============================================================

CREATE TABLE public.payment_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID REFERENCES public.payments(id),
  entry_id        UUID REFERENCES public.entries(id),
  competition_id  UUID NOT NULL REFERENCES public.competitions(id),
  club_id         UUID NOT NULL REFERENCES public.clubs(id),
  user_id         UUID REFERENCES public.profiles(id),
  ledger_type     ledger_type NOT NULL,
  direction       ledger_direction NOT NULL,
  amount_pence    INT NOT NULL CHECK (amount_pence > 0),
  description     TEXT,
  reference_id    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: refunds
-- ============================================================
-- Tracks refund requests initiated by platform admins.
-- amount_pence supports partial refunds.
-- stripe_refund_id is populated when Stripe confirms the refund.
-- ============================================================

CREATE TABLE public.refunds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        UUID NOT NULL REFERENCES public.payments(id),
  entry_id          UUID REFERENCES public.entries(id),
  initiated_by      UUID NOT NULL REFERENCES public.profiles(id),
  reason            TEXT NOT NULL,
  status            refund_status NOT NULL DEFAULT 'pending',
  amount_pence      INT NOT NULL CHECK (amount_pence > 0),
  stripe_refund_id  TEXT UNIQUE,
  refunded_at       TIMESTAMPTZ,
  failure_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: payouts
-- ============================================================
-- Represents money owed after settlement: club fundraising share,
-- winner prize, or platform fee capture.
-- ALL payouts are created as 'pending_review' in the MVP.
-- Admin manually transitions: pending_review → processing → paid.
-- stripe_transfer_id is reserved for future automated transfers.
-- payment_reference stores a manual bank transfer reference when paid.
-- ============================================================

CREATE TABLE public.payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id      UUID NOT NULL REFERENCES public.competitions(id),
  club_id             UUID NOT NULL REFERENCES public.clubs(id),
  payout_type         payout_type NOT NULL,
  recipient_user_id   UUID REFERENCES public.profiles(id),   -- winner's profile for prize payouts
  amount_pence        INT NOT NULL CHECK (amount_pence > 0),
  status              payout_status NOT NULL DEFAULT 'pending_review',

  stripe_transfer_id  TEXT UNIQUE,   -- future automated transfers
  payment_reference   TEXT,          -- manual bank transfer ref
  notes               TEXT,

  approved_by   UUID REFERENCES public.profiles(id),
  approved_at   TIMESTAMPTZ,
  paid_at       TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: platform_fees
-- ============================================================
-- Per-payment platform fee record for revenue accounting.
-- stripe_application_fee_id links to the Stripe application fee
-- object when using Connect destination charges.
-- period_month (YYYY-MM) enables monthly revenue roll-ups.
-- ============================================================

CREATE TABLE public.platform_fees (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id            UUID NOT NULL REFERENCES public.competitions(id),
  payment_id                UUID NOT NULL REFERENCES public.payments(id),
  club_id                   UUID NOT NULL REFERENCES public.clubs(id),
  period_month              TEXT NOT NULL,
  fee_amount_pence          INT NOT NULL CHECK (fee_amount_pence >= 0),
  stripe_application_fee_id TEXT,
  status                    platform_fee_status NOT NULL DEFAULT 'pending',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (payment_id),
  CONSTRAINT pf_period_month_format CHECK (period_month ~ '^\d{4}-\d{2}$')
);

CREATE TRIGGER trg_platform_fees_updated_at
  BEFORE UPDATE ON public.platform_fees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: clubboost_weekly_boost_periods
-- ============================================================
-- One period = one weekly fundraising window.
-- Entries whose competition has weekly_boost_contribution_bps > 0
-- contribute to the active period's pool.
-- Platform admin closes the period and awards the pool to one club.
-- ============================================================

CREATE TABLE public.clubboost_weekly_boost_periods (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name       TEXT NOT NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  total_pool_pence  INT NOT NULL DEFAULT 0 CHECK (total_pool_pence >= 0),
  status            boost_period_status NOT NULL DEFAULT 'active',
  closed_at         TIMESTAMPTZ,
  awarded_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT boost_period_dates_valid CHECK (period_end > period_start)
);

CREATE TRIGGER trg_weekly_boost_periods_updated_at
  BEFORE UPDATE ON public.clubboost_weekly_boost_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- TABLE: clubboost_weekly_boost_contributions
-- ============================================================
-- Immutable. One row per payment that included a boost contribution.
-- club_id identifies which club's competition the contribution came from
-- (relevant for future weighted-probability award logic).
-- ============================================================

CREATE TABLE public.clubboost_weekly_boost_contributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id       UUID NOT NULL REFERENCES public.clubboost_weekly_boost_periods(id),
  payment_id      UUID NOT NULL UNIQUE REFERENCES public.payments(id),
  entry_id        UUID NOT NULL REFERENCES public.entries(id),
  club_id         UUID NOT NULL REFERENCES public.clubs(id),
  competition_id  UUID NOT NULL REFERENCES public.competitions(id),
  amount_pence    INT NOT NULL CHECK (amount_pence > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: clubboost_weekly_boost_awards
-- ============================================================
-- Records the manual award of a period's pool to a winning club.
-- One award per period (UNIQUE on period_id).
-- payout_id links to the payouts record for payment tracking.
-- ============================================================

CREATE TABLE public.clubboost_weekly_boost_awards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id     UUID NOT NULL UNIQUE REFERENCES public.clubboost_weekly_boost_periods(id),
  club_id       UUID NOT NULL REFERENCES public.clubs(id),
  awarded_by    UUID NOT NULL REFERENCES public.profiles(id),
  amount_pence  INT NOT NULL CHECK (amount_pence > 0),
  reason        TEXT,
  payout_id     UUID REFERENCES public.payouts(id),
  awarded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: terms_acceptances
-- ============================================================
-- Audit record of every terms acceptance event.
-- ip_address and user_agent provide the legal trail.
-- context distinguishes where in the flow the acceptance occurred.
-- ============================================================

CREATE TABLE public.terms_acceptances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id),
  terms_version_id  UUID NOT NULL REFERENCES public.terms_versions(id),
  context           terms_context NOT NULL,
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: audit_logs
-- ============================================================
-- Append-only event log for compliance and debugging.
-- before_state / after_state snapshot relevant fields as JSONB.
-- actor_id IS NULL for system-initiated events (webhooks, triggers).
-- entity_type is a free-text discriminator; not an ENUM so new
-- entity types don't require a migration.
--
-- Standard action names:
--   club: club_created, club_approved, club_rejected, club_suspended
--   competition: competition_created, competition_published,
--                competition_closed, competition_settled, competition_cancelled
--   entry: entry_created, entry_activated, entry_eliminated, entry_refunded
--   payment: payment_succeeded, payment_failed, payment_refunded
--   payout: payout_created, payout_approved, payout_paid
--   user: user_registered, user_role_changed
--   feature_flag: flag_toggled
--   weekly_boost: boost_awarded
-- ============================================================

CREATE TABLE public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES public.profiles(id),
  club_id       UUID REFERENCES public.clubs(id),
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  action        TEXT NOT NULL,
  before_state  JSONB,
  after_state   JSONB,
  metadata      JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: notifications
-- ============================================================
-- In-app (and future email/SMS) notification records.
-- read_at NULL means unread. sent_at is when it was dispatched.
-- data JSONB carries deep-link params (competition_id, entry_id, etc.).
-- ============================================================

CREATE TABLE public.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id         UUID REFERENCES public.clubs(id),
  competition_id  UUID REFERENCES public.competitions(id),
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  data            JSONB NOT NULL DEFAULT '{}'::JSONB,
  channel         notification_channel NOT NULL DEFAULT 'in_app',
  read_at         TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- HELPER FUNCTIONS (used in RLS policies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'platform_admin'
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin(p_club_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid()
  );
$$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs                                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_verification                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_versions                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_game_configs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_rules_snapshots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_card_slots                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries                              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_predictions                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_round_picks                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations                            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_ledger                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds                              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts                              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubboost_weekly_boost_periods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubboost_weekly_boost_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubboost_weekly_boost_awards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptances                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications                        ENABLE ROW LEVEL SECURITY;

-- ── profiles ─────────────────────────────────────────────────

CREATE POLICY "profiles: own row" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles: same club member" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm1
      JOIN public.club_members cm2 ON cm1.club_id = cm2.club_id
      WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.id
    )
  );

CREATE POLICY "profiles: platform admin reads all" ON public.profiles
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE POLICY "profiles: own update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "profiles: platform admin update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_platform_admin());

-- ── clubs ─────────────────────────────────────────────────────

CREATE POLICY "clubs: public reads approved" ON public.clubs
  FOR SELECT TO authenticated, anon
  USING (status = 'approved' AND deleted_at IS NULL);

CREATE POLICY "clubs: members read own" ON public.clubs
  FOR SELECT TO authenticated
  USING (is_club_member(id) AND deleted_at IS NULL);

CREATE POLICY "clubs: platform admin reads all" ON public.clubs
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE POLICY "clubs: authenticated can create" ON public.clubs
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "clubs: admins update own" ON public.clubs
  FOR UPDATE TO authenticated
  USING (is_club_admin(id))
  WITH CHECK (
    is_club_admin(id)
    -- Prevent self-approval: club admins cannot change status
    AND status = (SELECT status FROM public.clubs WHERE id = clubs.id)
  );

CREATE POLICY "clubs: platform admin update" ON public.clubs
  FOR UPDATE TO authenticated
  USING (is_platform_admin());

-- ── club_members ─────────────────────────────────────────────

CREATE POLICY "club_members: read own club" ON public.club_members
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

CREATE POLICY "club_members: platform admin reads all" ON public.club_members
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE POLICY "club_members: admins insert" ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (is_club_admin(club_id) OR is_platform_admin());

CREATE POLICY "club_members: admins delete" ON public.club_members
  FOR DELETE TO authenticated
  USING (
    is_club_admin(club_id)
    OR is_platform_admin()
    OR user_id = auth.uid()    -- users can remove themselves
  );

CREATE POLICY "club_members: admins update roles" ON public.club_members
  FOR UPDATE TO authenticated
  USING (is_club_admin(club_id) OR is_platform_admin());

-- ── club_verification ─────────────────────────────────────────

CREATE POLICY "club_verification: admins read own" ON public.club_verification
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id) OR is_platform_admin());

CREATE POLICY "club_verification: platform admin write" ON public.club_verification
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── terms_versions ────────────────────────────────────────────

CREATE POLICY "terms_versions: anyone reads" ON public.terms_versions
  FOR SELECT TO authenticated, anon
  USING (TRUE);

CREATE POLICY "terms_versions: platform admin write" ON public.terms_versions
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── feature_flags ─────────────────────────────────────────────

CREATE POLICY "feature_flags: anyone reads" ON public.feature_flags
  FOR SELECT TO authenticated, anon
  USING (TRUE);

CREATE POLICY "feature_flags: platform admin write" ON public.feature_flags
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── competitions ──────────────────────────────────────────────

-- Public can see open/closed/settled competitions for approved clubs
CREATE POLICY "competitions: public reads live" ON public.competitions
  FOR SELECT TO authenticated, anon
  USING (
    status IN ('open', 'closed', 'settled')
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = competitions.club_id AND status = 'approved'
    )
  );

CREATE POLICY "competitions: club admins read all own" ON public.competitions
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id) AND deleted_at IS NULL);

CREATE POLICY "competitions: platform admin reads all" ON public.competitions
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE POLICY "competitions: club admins create" ON public.competitions
  FOR INSERT TO authenticated
  WITH CHECK (
    is_club_admin(club_id)
    AND EXISTS (
      SELECT 1 FROM public.clubs WHERE id = club_id AND status = 'approved'
    )
  );

CREATE POLICY "competitions: club admins update draft" ON public.competitions
  FOR UPDATE TO authenticated
  USING (is_club_admin(club_id) AND status = 'draft')
  WITH CHECK (is_club_admin(club_id));

CREATE POLICY "competitions: platform admin update" ON public.competitions
  FOR UPDATE TO authenticated
  USING (is_platform_admin());

-- ── competition_game_configs ──────────────────────────────────

CREATE POLICY "game_configs: mirrors competition access" ON public.competition_game_configs
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_game_configs.competition_id
        AND (
          c.status IN ('open', 'closed', 'settled')
          OR is_club_admin(c.club_id)
          OR is_platform_admin()
        )
    )
  );

CREATE POLICY "game_configs: club admins write" ON public.competition_game_configs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = competition_game_configs.competition_id
        AND (is_club_admin(club_id) OR is_platform_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = competition_game_configs.competition_id
        AND (is_club_admin(club_id) OR is_platform_admin())
    )
  );

-- ── competition_rules_snapshots ────────────────────────────────

CREATE POLICY "rules_snapshots: entrant reads own" ON public.competition_rules_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.entries
      WHERE rules_snapshot_id = competition_rules_snapshots.id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "rules_snapshots: club admins read own competition" ON public.competition_rules_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = competition_rules_snapshots.competition_id
        AND is_club_admin(club_id)
    )
  );

CREATE POLICY "rules_snapshots: platform admin reads all" ON public.competition_rules_snapshots
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- Inserts happen via service role (server action) — no policy needed for anon/authenticated INSERT.

-- ── teams ─────────────────────────────────────────────────────

CREATE POLICY "teams: platform-wide readable by all" ON public.teams
  FOR SELECT TO authenticated, anon
  USING (club_id IS NULL AND active = TRUE);

CREATE POLICY "teams: club-specific readable by members" ON public.teams
  FOR SELECT TO authenticated
  USING (club_id IS NOT NULL AND is_club_member(club_id) AND active = TRUE);

CREATE POLICY "teams: platform admin reads all" ON public.teams
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE POLICY "teams: club admins manage own" ON public.teams
  FOR ALL TO authenticated
  USING (club_id IS NOT NULL AND is_club_admin(club_id))
  WITH CHECK (club_id IS NOT NULL AND is_club_admin(club_id));

CREATE POLICY "teams: platform admin manage all" ON public.teams
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── fixtures ──────────────────────────────────────────────────

CREATE POLICY "fixtures: public reads for live competition" ON public.fixtures
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = fixtures.competition_id AND status IN ('open', 'closed', 'settled')
    )
  );

CREATE POLICY "fixtures: club admins read own" ON public.fixtures
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = fixtures.competition_id AND is_club_admin(club_id)
    )
  );

CREATE POLICY "fixtures: platform admin reads all" ON public.fixtures
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE POLICY "fixtures: club admins write" ON public.fixtures
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = fixtures.competition_id AND is_club_admin(club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = fixtures.competition_id AND is_club_admin(club_id)
    )
  );

-- ── team_card_slots ───────────────────────────────────────────

CREATE POLICY "slots: public reads for live competition" ON public.team_card_slots
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = team_card_slots.competition_id AND status IN ('open', 'closed', 'settled')
    )
  );

CREATE POLICY "slots: club admins write" ON public.team_card_slots
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = team_card_slots.competition_id AND is_club_admin(club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = team_card_slots.competition_id AND is_club_admin(club_id)
    )
  );

-- ── entries ───────────────────────────────────────────────────

CREATE POLICY "entries: own row" ON public.entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "entries: club admins read own competition" ON public.entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = entries.competition_id AND is_club_admin(club_id)
    )
  );

CREATE POLICY "entries: platform admin reads all" ON public.entries
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- Inserts handled by service role via server action

-- ── entry_predictions ─────────────────────────────────────────

CREATE POLICY "predictions: own entry" ON public.entry_predictions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.entries WHERE id = entry_predictions.entry_id AND user_id = auth.uid())
  );

CREATE POLICY "predictions: club admin reads own competition" ON public.entry_predictions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.entries e
      JOIN public.competitions c ON c.id = e.competition_id
      WHERE e.id = entry_predictions.entry_id AND is_club_admin(c.club_id)
    )
  );

CREATE POLICY "predictions: platform admin reads all" ON public.entry_predictions
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- ── entry_round_picks ─────────────────────────────────────────

CREATE POLICY "round_picks: own entry" ON public.entry_round_picks
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.entries WHERE id = entry_round_picks.entry_id AND user_id = auth.uid())
  );

CREATE POLICY "round_picks: club admin reads own competition" ON public.entry_round_picks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = entry_round_picks.competition_id AND is_club_admin(club_id)
    )
  );

CREATE POLICY "round_picks: platform admin reads all" ON public.entry_round_picks
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- ── donations ─────────────────────────────────────────────────

CREATE POLICY "donations: own row" ON public.donations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Non-anonymous donations on a live competition are public
CREATE POLICY "donations: public reads non-anonymous" ON public.donations
  FOR SELECT TO authenticated, anon
  USING (
    is_anonymous = FALSE
    AND EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = donations.competition_id AND status IN ('open', 'closed', 'settled')
    )
  );

CREATE POLICY "donations: club admins read own" ON public.donations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = donations.competition_id AND is_club_admin(club_id)
    )
  );

-- ── payments ──────────────────────────────────────────────────

CREATE POLICY "payments: own row" ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "payments: club admins read own competition" ON public.payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = payments.competition_id AND is_club_admin(club_id)
    )
  );

CREATE POLICY "payments: platform admin reads all" ON public.payments
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- ── payment_ledger ────────────────────────────────────────────

CREATE POLICY "ledger: own entries" ON public.payment_ledger
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ledger: club admins read own" ON public.payment_ledger
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id));

CREATE POLICY "ledger: platform admin reads all" ON public.payment_ledger
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- ── refunds ───────────────────────────────────────────────────

CREATE POLICY "refunds: own payment" ON public.refunds
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.payments WHERE id = refunds.payment_id AND user_id = auth.uid())
  );

CREATE POLICY "refunds: platform admin all" ON public.refunds
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── payouts ───────────────────────────────────────────────────

CREATE POLICY "payouts: club admins read own" ON public.payouts
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id));

CREATE POLICY "payouts: recipient reads own" ON public.payouts
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "payouts: platform admin all" ON public.payouts
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── platform_fees ─────────────────────────────────────────────

CREATE POLICY "platform_fees: platform admin all" ON public.platform_fees
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── weekly boost tables ───────────────────────────────────────

CREATE POLICY "boost_periods: authenticated reads" ON public.clubboost_weekly_boost_periods
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "boost_periods: platform admin write" ON public.clubboost_weekly_boost_periods
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "boost_contributions: club admins read own" ON public.clubboost_weekly_boost_contributions
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id) OR is_platform_admin());

CREATE POLICY "boost_awards: club admins read own" ON public.clubboost_weekly_boost_awards
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id) OR is_platform_admin());

CREATE POLICY "boost_awards: platform admin write" ON public.clubboost_weekly_boost_awards
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── terms_acceptances ─────────────────────────────────────────

CREATE POLICY "terms_acceptances: own row" ON public.terms_acceptances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "terms_acceptances: platform admin reads all" ON public.terms_acceptances
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- ── audit_logs ────────────────────────────────────────────────

CREATE POLICY "audit_logs: club admins read own club" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    club_id IS NOT NULL AND is_club_admin(club_id)
  );

CREATE POLICY "audit_logs: platform admin reads all" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- ── notifications ─────────────────────────────────────────────

CREATE POLICY "notifications: own row" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications: own update (mark read)" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- INDEXES
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_role         ON public.profiles (role)       WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_email        ON public.profiles (email)      WHERE deleted_at IS NULL;

-- clubs
CREATE INDEX idx_clubs_status          ON public.clubs (status)        WHERE deleted_at IS NULL;
CREATE INDEX idx_clubs_created_by      ON public.clubs (created_by);
CREATE INDEX idx_clubs_stripe_account  ON public.clubs (stripe_account_id) WHERE stripe_account_id IS NOT NULL;
CREATE INDEX idx_clubs_name_trgm       ON public.clubs USING GIN (name gin_trgm_ops);

-- club_members
CREATE INDEX idx_club_members_user     ON public.club_members (user_id);
CREATE INDEX idx_club_members_club     ON public.club_members (club_id);

-- competitions
CREATE INDEX idx_competitions_club_status    ON public.competitions (club_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_competitions_status_closes  ON public.competitions (status, closes_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_competitions_type           ON public.competitions (type) WHERE deleted_at IS NULL;

-- fixtures
CREATE INDEX idx_fixtures_competition_order  ON public.fixtures (competition_id, fixture_order);
CREATE INDEX idx_fixtures_kickoff            ON public.fixtures (kickoff_at) WHERE kickoff_at IS NOT NULL;

-- team_card_slots
CREATE INDEX idx_slots_competition_taken     ON public.team_card_slots (competition_id, is_taken);

-- entries
CREATE INDEX idx_entries_user                ON public.entries (user_id);
CREATE INDEX idx_entries_competition_status  ON public.entries (competition_id, status);
CREATE INDEX idx_entries_payment             ON public.entries (payment_id) WHERE payment_id IS NOT NULL;

-- entry_predictions
CREATE INDEX idx_predictions_entry           ON public.entry_predictions (entry_id);
CREATE INDEX idx_predictions_fixture         ON public.entry_predictions (fixture_id);

-- entry_round_picks
CREATE INDEX idx_round_picks_entry           ON public.entry_round_picks (entry_id);
CREATE INDEX idx_round_picks_competition_round ON public.entry_round_picks (competition_id, round_number);

-- payments
CREATE INDEX idx_payments_user               ON public.payments (user_id);
CREATE INDEX idx_payments_competition_status ON public.payments (competition_id, status);
CREATE INDEX idx_payments_entry              ON public.payments (entry_id) WHERE entry_id IS NOT NULL;
-- stripe_payment_intent_id and stripe_checkout_session_id already have UNIQUE indexes

-- payment_ledger
CREATE INDEX idx_ledger_competition          ON public.payment_ledger (competition_id);
CREATE INDEX idx_ledger_club                 ON public.payment_ledger (club_id);
CREATE INDEX idx_ledger_payment              ON public.payment_ledger (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_ledger_type_direction       ON public.payment_ledger (ledger_type, direction);
CREATE INDEX idx_ledger_created_at           ON public.payment_ledger (created_at DESC);

-- refunds
CREATE INDEX idx_refunds_payment             ON public.refunds (payment_id);
CREATE INDEX idx_refunds_status              ON public.refunds (status);

-- payouts
CREATE INDEX idx_payouts_club_status         ON public.payouts (club_id, status);
CREATE INDEX idx_payouts_competition         ON public.payouts (competition_id);
CREATE INDEX idx_payouts_recipient           ON public.payouts (recipient_user_id) WHERE recipient_user_id IS NOT NULL;

-- platform_fees
CREATE INDEX idx_platform_fees_period_club   ON public.platform_fees (period_month, club_id);
CREATE INDEX idx_platform_fees_status        ON public.platform_fees (status);

-- weekly boost
CREATE INDEX idx_boost_contributions_period  ON public.clubboost_weekly_boost_contributions (period_id);
CREATE INDEX idx_boost_contributions_club    ON public.clubboost_weekly_boost_contributions (club_id, period_id);

-- terms_acceptances
CREATE INDEX idx_terms_acceptances_user      ON public.terms_acceptances (user_id);

-- audit_logs
CREATE INDEX idx_audit_entity                ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_club_created          ON public.audit_logs (club_id, created_at DESC) WHERE club_id IS NOT NULL;
CREATE INDEX idx_audit_actor                 ON public.audit_logs (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_action                ON public.audit_logs (action);

-- notifications
CREATE INDEX idx_notifications_user_unread   ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_competition   ON public.notifications (competition_id) WHERE competition_id IS NOT NULL;

-- JSONB GIN indexes for config searching
CREATE INDEX idx_competition_game_configs_gin ON public.competition_game_configs USING GIN (config);
CREATE INDEX idx_teams_name_trgm              ON public.teams USING GIN (name gin_trgm_ops);


-- ============================================================
-- SEED DATA
-- ============================================================

-- Feature flags
INSERT INTO public.feature_flags (key, enabled, description, metadata) VALUES
  (
    'weekly_boost',
    FALSE,
    'ClubBoost Weekly Boost — platform contributes a prize pot each week, awarded to one eligible club',
    '{"contribution_bps": 200, "min_entries_for_eligibility": 5}'::JSONB
  ),
  (
    'donation_only',
    TRUE,
    'Donation Fundraiser competition type',
    '{}'::JSONB
  ),
  (
    'csv_export',
    TRUE,
    'CSV export of entries and payments for club admins',
    '{}'::JSONB
  ),
  (
    'team_card',
    TRUE,
    'Football Team Card competition type',
    '{}'::JSONB
  ),
  (
    'last_man_standing',
    TRUE,
    'Last Man Standing competition type',
    '{}'::JSONB
  ),
  (
    'automated_payouts',
    FALSE,
    'Automatically transfer club fundraising share via Stripe Connect on settlement (future)',
    '{}'::JSONB
  )
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description, metadata = EXCLUDED.metadata;

-- Terms version 1.0
INSERT INTO public.terms_versions (version, content, effective_from, is_current)
VALUES (
  '1.0',
  $TERMS$
ClubBoost Platform Terms of Service — Version 1.0

By creating a competition on ClubBoost, you confirm that:

1. Your club is a legitimate grassroots sports organisation.
2. The competition is a genuine fundraising activity and not a form of illegal gambling.
3. All entry fees collected will be used for club fundraising purposes.
4. You will honour the prize structure stated at competition creation.
5. You accept ClubBoost's platform service fee as stated at competition creation.
6. You will settle competitions promptly and honestly.
7. You will not misrepresent your club, competition, or prize structure to participants.

ClubBoost reserves the right to suspend clubs or competitions that violate these terms.
  $TERMS$,
  '2025-01-01 00:00:00+00',
  TRUE
)
ON CONFLICT (version) DO NOTHING;

-- ── Demo data (optional — requires real user UUIDs from auth.users) ──────
-- To activate: create users via /register, get their UUIDs from
-- Supabase Auth dashboard, and replace the placeholder values below.
--
-- DO $$
-- DECLARE
--   admin_id      UUID := '<platform-admin-user-uuid>';
--   club_admin_id UUID := '<club-admin-user-uuid>';
--   demo_club_id  UUID := gen_random_uuid();
--   demo_comp_id  UUID := gen_random_uuid();
--   demo_config_id UUID := gen_random_uuid();
--   snap_id       UUID := gen_random_uuid();
--   tv_id         UUID;
-- BEGIN
--
--   SELECT id INTO tv_id FROM public.terms_versions WHERE version = '1.0';
--
--   -- Profiles (normally auto-created by trigger; this handles pre-trigger users)
--   INSERT INTO public.profiles (id, display_name, email, role) VALUES
--     (admin_id,      'Platform Admin',  'admin@clubboost.example.com',    'platform_admin'),
--     (club_admin_id, 'Demo Club Admin', 'secretary@riverside.example.com', 'club_admin')
--   ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
--
--   -- Demo club
--   INSERT INTO public.clubs (
--     id, slug, name, sport, team_age_group, location,
--     contact_name, contact_email, contact_phone,
--     description, status, stripe_onboarded,
--     weekly_boost_eligible, created_by, approved_by, approved_at
--   ) VALUES (
--     demo_club_id, 'riverside-fc', 'Riverside FC', 'football', 'Seniors', 'Riverside, Surrey',
--     'Jane Smith', 'secretary@riverside.example.com', '+44 7700 900123',
--     'Riverside FC is a friendly community club established in 1987, competing in the Surrey County League.',
--     'approved', FALSE, TRUE, club_admin_id, admin_id, NOW()
--   ) ON CONFLICT (slug) DO NOTHING;
--
--   INSERT INTO public.club_members (club_id, user_id, role)
--   VALUES (demo_club_id, club_admin_id, 'owner')
--   ON CONFLICT (club_id, user_id) DO NOTHING;
--
--   -- Demo predictor competition
--   INSERT INTO public.competitions (
--     id, club_id, created_by, type, title, description, rules_text, status,
--     entry_fee_pence, prize_type, prize_pct_bps, club_pct_bps, platform_fee_bps,
--     weekly_boost_contribution_bps, closes_at, terms_accepted, terms_version_id, config
--   ) VALUES (
--     demo_comp_id, demo_club_id, club_admin_id,
--     'predictor', 'Weekend Premier League Predictor',
--     'Predict results of 6 Premier League matches. Highest score wins!',
--     'Each correct result (H/D/A) earns 1 point. Ties broken by entry order.',
--     'open',
--     500,                          -- £5.00 entry
--     'percentage', 5000,           -- 50% prize
--     4000,                         -- 40% club
--     800,                          -- 8% platform
--     200,                          -- 2% weekly boost
--     NOW() + INTERVAL '7 days',
--     TRUE, tv_id,
--     '{"points_per_correct": 1}'::JSONB
--   ) ON CONFLICT DO NOTHING;
--
--   INSERT INTO public.competition_game_configs (competition_id, config_type, config)
--   VALUES (
--     demo_comp_id, 'predictor',
--     '{"points_per_correct": 1, "tiebreak": "entry_order"}'::JSONB
--   ) ON CONFLICT (competition_id) DO NOTHING;
--
--   INSERT INTO public.fixtures (competition_id, fixture_order, home_team, away_team, kickoff_at) VALUES
--     (demo_comp_id, 0, 'Arsenal',           'Chelsea',         NOW() + INTERVAL '3 days'),
--     (demo_comp_id, 1, 'Liverpool',          'Manchester City', NOW() + INTERVAL '3 days'),
--     (demo_comp_id, 2, 'Manchester United',  'Tottenham',       NOW() + INTERVAL '3 days'),
--     (demo_comp_id, 3, 'Everton',            'Newcastle',       NOW() + INTERVAL '4 days'),
--     (demo_comp_id, 4, 'Aston Villa',        'West Ham',        NOW() + INTERVAL '4 days'),
--     (demo_comp_id, 5, 'Brighton',           'Brentford',       NOW() + INTERVAL '4 days')
--   ON CONFLICT DO NOTHING;
--
--   -- Audit log
--   INSERT INTO public.audit_logs (actor_id, club_id, entity_type, entity_id, action, after_state)
--   VALUES
--     (club_admin_id, demo_club_id, 'club',        demo_club_id, 'club_created',         '{"name": "Riverside FC"}'::JSONB),
--     (admin_id,      demo_club_id, 'club',        demo_club_id, 'club_approved',         '{"status": "approved"}'::JSONB),
--     (club_admin_id, demo_club_id, 'competition', demo_comp_id, 'competition_created',   '{"title": "Weekend Premier League Predictor"}'::JSONB),
--     (club_admin_id, demo_club_id, 'competition', demo_comp_id, 'competition_published', '{"status": "open"}'::JSONB);
--
-- END $$;
