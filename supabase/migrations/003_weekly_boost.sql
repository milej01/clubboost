-- ============================================================
-- ClubBoost — Migration 003: Weekly Boost (complete)
--
-- Extends the stub boost tables from 002_complete_schema.sql.
-- Safe to apply on top of 002 on an existing database.
--
-- Changes:
--   1. clubs            — add weekly_boost_enrolled column
--   2. boost_period_status enum — add 'draft' value
--   3. clubboost_weekly_boost_periods — add published_rules, notes, created_by
--   4. boost_contribution_source enum — new
--   5. boost_sponsors   — new table
--   6. clubboost_weekly_boost_contributions — extend for multi-source funding
--   7. boost_eligible_clubs — new table (stores manual overrides)
--   8. clubboost_weekly_boost_awards — drop single-club-per-period constraint,
--                                       add status, is_public, publish fields
--   9. boost_audit_events — new table
--  10. RLS policies for new tables
--  11. Indexes
--  12. Feature flag metadata update
-- ============================================================


-- ============================================================
-- 1. clubs — opt-in enrollment column
-- ============================================================
-- Clubs must opt in to be included in weekly boost eligibility
-- calculations. Platform admin can still manually add any club.

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS weekly_boost_enrolled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.clubs.weekly_boost_enrolled IS
  'Club has opted in to participate in the Weekly Boost programme';


-- ============================================================
-- 2. boost_period_status enum — add draft
-- ============================================================
-- Periods start as draft (unpublished), move to active when open,
-- then closed when accepting no more contributions, then awarded.

DO $$ BEGIN
  ALTER TYPE public.boost_period_status ADD VALUE IF NOT EXISTS 'draft';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 3. clubboost_weekly_boost_periods — extend columns
-- ============================================================

ALTER TABLE public.clubboost_weekly_boost_periods
  ADD COLUMN IF NOT EXISTS published_rules TEXT,
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS created_by      UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.clubboost_weekly_boost_periods.published_rules IS
  'Public-facing rules text shown to clubs and participants for this period';
COMMENT ON COLUMN public.clubboost_weekly_boost_periods.notes IS
  'Internal admin notes — not shown publicly';


-- ============================================================
-- 4. boost_contribution_source enum
-- ============================================================

CREATE TYPE public.boost_contribution_source AS ENUM (
  'competition_payment',  -- from a participant payment (linked to payments table)
  'sponsor',              -- sponsor contribution (linked to boost_sponsors)
  'platform_marketing',   -- platform-level marketing budget
  'admin_topup'           -- manual top-up by platform admin
);


-- ============================================================
-- 5. boost_sponsors — new table
-- ============================================================
-- Companies or individuals sponsoring the weekly boost fund.
-- Sponsors can contribute to multiple periods.

CREATE TABLE public.boost_sponsors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  contact_name   TEXT,
  contact_email  TEXT,
  logo_url       TEXT,
  website_url    TEXT,
  notes          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_boost_sponsors_updated_at
  BEFORE UPDATE ON public.boost_sponsors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.boost_sponsors ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.boost_sponsors IS
  'Sponsors who contribute to the Weekly Boost fund';


-- ============================================================
-- 6. clubboost_weekly_boost_contributions — extend for all sources
-- ============================================================
-- The 002 version only tracked competition payments.
-- We extend it to support all funding sources.

-- Make payment_id, entry_id, competition_id nullable.
ALTER TABLE public.clubboost_weekly_boost_contributions
  ALTER COLUMN payment_id     DROP NOT NULL,
  ALTER COLUMN entry_id       DROP NOT NULL,
  ALTER COLUMN competition_id DROP NOT NULL;

-- Drop the unique constraint on payment_id
-- (replaced with a partial unique index below).
ALTER TABLE public.clubboost_weekly_boost_contributions
  DROP CONSTRAINT IF EXISTS clubboost_weekly_boost_contributions_payment_id_key;

-- Add new columns. source_type defaults to competition_payment
-- so existing rows remain semantically correct.
ALTER TABLE public.clubboost_weekly_boost_contributions
  ADD COLUMN IF NOT EXISTS source_type  public.boost_contribution_source NOT NULL DEFAULT 'competition_payment',
  ADD COLUMN IF NOT EXISTS sponsor_id   UUID REFERENCES public.boost_sponsors(id),
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES public.profiles(id);

-- club_id was NOT NULL in 002. Make it nullable for non-competition sources.
ALTER TABLE public.clubboost_weekly_boost_contributions
  ALTER COLUMN club_id DROP NOT NULL;

-- Partial unique: a single payment can only create one contribution.
CREATE UNIQUE INDEX IF NOT EXISTS idx_boost_contributions_payment_unique
  ON public.clubboost_weekly_boost_contributions (payment_id)
  WHERE payment_id IS NOT NULL;

COMMENT ON TABLE public.clubboost_weekly_boost_contributions IS
  'Immutable ledger of all contributions to a boost period fund, from all sources';


-- ============================================================
-- 7. boost_eligible_clubs — new table
-- ============================================================
-- Stores computed eligibility results and manual overrides
-- per period. Computed by the service; overrides applied on top.

CREATE TABLE public.boost_eligible_clubs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id               UUID NOT NULL REFERENCES public.clubboost_weekly_boost_periods(id) ON DELETE CASCADE,
  club_id                 UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  is_eligible             BOOLEAN NOT NULL DEFAULT TRUE,
  eligibility_reason      TEXT,           -- why computed as eligible (for display)
  ineligibility_reason    TEXT,           -- why computed as ineligible
  is_manually_overridden  BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason         TEXT,
  override_by             UUID REFERENCES public.profiles(id),
  override_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (period_id, club_id)
);

CREATE TRIGGER trg_boost_eligible_clubs_updated_at
  BEFORE UPDATE ON public.boost_eligible_clubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.boost_eligible_clubs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.boost_eligible_clubs IS
  'Eligibility records per boost period. Computed by the service; '
  'is_manually_overridden flags admin corrections.';


-- ============================================================
-- 8. clubboost_weekly_boost_awards — fix constraints, add columns
-- ============================================================
-- 002 had UNIQUE on period_id (only one club per period could win).
-- We remove this to allow multiple clubs per period, guarded instead
-- by a partial unique on (period_id, club_id) for non-cancelled awards.

-- Drop single-per-period constraint
ALTER TABLE public.clubboost_weekly_boost_awards
  DROP CONSTRAINT IF EXISTS clubboost_weekly_boost_awards_period_id_key;

-- Add status, visibility, and publish columns.
ALTER TABLE public.clubboost_weekly_boost_awards
  ADD COLUMN IF NOT EXISTS status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled')),
  ADD COLUMN IF NOT EXISTS is_public         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_summary TEXT,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER trg_boost_awards_updated_at
  BEFORE UPDATE ON public.clubboost_weekly_boost_awards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A club can only receive one active (non-cancelled) award per period.
CREATE UNIQUE INDEX IF NOT EXISTS idx_boost_award_unique_active
  ON public.clubboost_weekly_boost_awards (period_id, club_id)
  WHERE status <> 'cancelled';

COMMENT ON TABLE public.clubboost_weekly_boost_awards IS
  'Manual awards of the boost fund to clubs. Multiple clubs may receive '
  'awards within a single period. One active award per (period, club).';


-- ============================================================
-- 9. boost_audit_events — new table
-- ============================================================
-- Dedicated append-only event log for boost-specific actions.
-- Complements the main audit_logs table with richer boost context.

CREATE TABLE public.boost_audit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   UUID REFERENCES public.clubboost_weekly_boost_periods(id),
  event_type  TEXT NOT NULL,    -- e.g. 'period_created', 'award_granted', 'eligibility_overridden'
  actor_id    UUID REFERENCES public.profiles(id),
  actor_role  TEXT,             -- 'platform_admin' (denormalized for fast queries)
  club_id     UUID REFERENCES public.clubs(id),
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Intentionally no updated_at: append-only audit table.
);

ALTER TABLE public.boost_audit_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.boost_audit_events IS
  'Append-only audit trail for all Weekly Boost administrative actions';


-- ============================================================
-- 10. RLS policies
-- ============================================================

-- ── boost_sponsors ────────────────────────────────────────────
-- All authenticated users can read active sponsors (for display).
-- Only platform admins can write.

CREATE POLICY "boost_sponsors: authenticated reads active"
  ON public.boost_sponsors FOR SELECT TO authenticated
  USING (is_active = TRUE OR is_platform_admin());

CREATE POLICY "boost_sponsors: platform admin all"
  ON public.boost_sponsors FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── boost_eligible_clubs ──────────────────────────────────────
-- Club admins can read their own eligibility status.
-- Platform admins can read and write everything.

CREATE POLICY "boost_eligible_clubs: club admins read own"
  ON public.boost_eligible_clubs FOR SELECT TO authenticated
  USING (is_club_admin(club_id) OR is_platform_admin());

CREATE POLICY "boost_eligible_clubs: platform admin all"
  ON public.boost_eligible_clubs FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── boost_audit_events ────────────────────────────────────────
-- Only platform admins can read the boost audit trail.
-- Inserts happen via service role (server actions).

CREATE POLICY "boost_audit_events: platform admin reads all"
  ON public.boost_audit_events FOR SELECT TO authenticated
  USING (is_platform_admin());


-- ============================================================
-- 11. Indexes
-- ============================================================

-- boost_sponsors
CREATE INDEX idx_boost_sponsors_active ON public.boost_sponsors (is_active) WHERE is_active = TRUE;

-- boost_eligible_clubs
CREATE INDEX idx_boost_eligible_period_club ON public.boost_eligible_clubs (period_id, club_id);
CREATE INDEX idx_boost_eligible_club        ON public.boost_eligible_clubs (club_id);

-- boost_awards (period was already indexed in 002; add club index)
CREATE INDEX IF NOT EXISTS idx_boost_awards_period ON public.clubboost_weekly_boost_awards (period_id);
CREATE INDEX IF NOT EXISTS idx_boost_awards_club   ON public.clubboost_weekly_boost_awards (club_id);
CREATE INDEX IF NOT EXISTS idx_boost_awards_status ON public.clubboost_weekly_boost_awards (status);

-- boost_contributions (add source index for admin reporting)
CREATE INDEX IF NOT EXISTS idx_boost_contributions_source ON public.clubboost_weekly_boost_contributions (source_type, period_id);

-- boost_audit_events
CREATE INDEX idx_boost_audit_period  ON public.boost_audit_events (period_id) WHERE period_id IS NOT NULL;
CREATE INDEX idx_boost_audit_club    ON public.boost_audit_events (club_id) WHERE club_id IS NOT NULL;
CREATE INDEX idx_boost_audit_type    ON public.boost_audit_events (event_type);
CREATE INDEX idx_boost_audit_created ON public.boost_audit_events (created_at DESC);


-- ============================================================
-- 12. Feature flag metadata update
-- ============================================================
-- Update the weekly_boost flag metadata to document configuration.

UPDATE public.feature_flags
SET metadata = jsonb_build_object(
  'default_contribution_bps', 200,
  'min_entries_for_eligibility', 1,
  'require_stripe_onboarded', true,
  'require_enrolled', true,
  'allow_multi_club_awards', true
)
WHERE key = 'weekly_boost';
