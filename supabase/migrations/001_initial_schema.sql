-- ClubBoost Initial Schema
-- All money stored as integers (pence). Never floats.
-- Basis points (bps) used for percentages: 100 bps = 1%

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile row when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'participant')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Convenience: check if calling user is platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin'
  );
$$;

-- Convenience: check if calling user is admin/owner of a club
CREATE OR REPLACE FUNCTION is_club_admin(p_club_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

-- ============================================================
-- FEATURE FLAGS
-- ============================================================

CREATE TABLE public.feature_flags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT NOT NULL UNIQUE,
  enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  description  TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER feature_flags_updated_at BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PROFILES
-- ============================================================

CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'participant'
                  CHECK (role IN ('platform_admin', 'club_admin', 'participant')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CLUBS
-- ============================================================

CREATE TABLE public.clubs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  slug                     TEXT NOT NULL UNIQUE,
  sport                    TEXT NOT NULL DEFAULT 'football',
  team_age_group           TEXT,
  location                 TEXT NOT NULL,
  contact_name             TEXT NOT NULL,
  contact_email            TEXT NOT NULL,
  contact_phone            TEXT,
  logo_url                 TEXT,
  banner_url               TEXT,
  description              TEXT,
  stripe_account_id        TEXT,
  stripe_onboarded         BOOLEAN NOT NULL DEFAULT FALSE,
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  rejection_reason         TEXT,
  suspension_reason        TEXT,
  weekly_boost_eligible    BOOLEAN NOT NULL DEFAULT FALSE,
  weekly_boost_enrolled    BOOLEAN NOT NULL DEFAULT FALSE,
  -- Platform fee in basis points, snapshotted to competitions at creation time
  platform_fee_bps         INTEGER NOT NULL DEFAULT 800 CHECK (platform_fee_bps >= 0 AND platform_fee_bps <= 3000),
  created_by               UUID NOT NULL REFERENCES public.profiles(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ
);

CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX clubs_slug_idx         ON public.clubs(slug);
CREATE INDEX clubs_status_idx       ON public.clubs(status);
CREATE INDEX clubs_created_by_idx   ON public.clubs(created_by);

-- ============================================================
-- CLUB MEMBERS
-- ============================================================

CREATE TABLE public.club_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_at  TIMESTAMPTZ,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

CREATE INDEX club_members_club_id_idx  ON public.club_members(club_id);
CREATE INDEX club_members_user_id_idx  ON public.club_members(user_id);

-- ============================================================
-- COMPETITIONS
-- ============================================================

CREATE TABLE public.competitions (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                      UUID NOT NULL REFERENCES public.clubs(id),
  created_by                   UUID NOT NULL REFERENCES public.profiles(id),
  type                         TEXT NOT NULL
                                 CHECK (type IN ('predictor', 'last_man_standing', 'team_card', 'donation')),
  title                        TEXT NOT NULL,
  description                  TEXT,
  banner_url                   TEXT,
  rules_text                   TEXT,
  status                       TEXT NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft', 'open', 'closed', 'settled', 'cancelled')),
  entry_fee_pence              INTEGER NOT NULL DEFAULT 0 CHECK (entry_fee_pence >= 0),
  max_entries                  INTEGER CHECK (max_entries IS NULL OR max_entries > 0),
  -- Prize configuration
  prize_type                   TEXT NOT NULL DEFAULT 'none'
                                 CHECK (prize_type IN ('percentage', 'fixed', 'description', 'none')),
  prize_pence                  INTEGER NOT NULL DEFAULT 0 CHECK (prize_pence >= 0),
  prize_pct_bps                INTEGER NOT NULL DEFAULT 0 CHECK (prize_pct_bps >= 0 AND prize_pct_bps <= 10000),
  prize_description            TEXT,
  -- Split configuration (basis points; must sum to <= 10000)
  club_pct_bps                 INTEGER NOT NULL DEFAULT 4000,
  platform_fee_bps             INTEGER NOT NULL DEFAULT 800,
  weekly_boost_contribution_bps INTEGER NOT NULL DEFAULT 0,
  -- Dates
  opens_at                     TIMESTAMPTZ,
  closes_at                    TIMESTAMPTZ,
  settled_at                   TIMESTAMPTZ,
  settled_by                   UUID REFERENCES public.profiles(id),
  -- Type-specific config (fixtures list, teams, round count, etc.)
  config                       JSONB NOT NULL DEFAULT '{}',
  terms_accepted               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                   TIMESTAMPTZ
);

CREATE TRIGGER competitions_updated_at BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX competitions_club_id_idx  ON public.competitions(club_id);
CREATE INDEX competitions_status_idx   ON public.competitions(status);
CREATE INDEX competitions_type_idx     ON public.competitions(type);

-- ============================================================
-- COMPETITION ROUNDS (for LMS and multi-round Predictor)
-- ============================================================

CREATE TABLE public.competition_rounds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  round_number    INTEGER NOT NULL,
  title           TEXT,
  starts_at       TIMESTAMPTZ,
  deadline_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'settled')),
  result_data     JSONB,
  settled_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, round_number)
);

CREATE TRIGGER competition_rounds_updated_at BEFORE UPDATE ON public.competition_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX competition_rounds_competition_id_idx ON public.competition_rounds(competition_id);

-- ============================================================
-- FIXTURES (six-result predictor)
-- ============================================================

CREATE TABLE public.fixtures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  round_id        UUID REFERENCES public.competition_rounds(id) ON DELETE SET NULL,
  fixture_order   INTEGER NOT NULL DEFAULT 0,
  home_team       TEXT NOT NULL,
  away_team       TEXT NOT NULL,
  kickoff_at      TIMESTAMPTZ,
  -- 'H' | 'D' | 'A' — set by admin at settlement
  actual_result   TEXT CHECK (actual_result IN ('H', 'D', 'A')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER fixtures_updated_at BEFORE UPDATE ON public.fixtures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX fixtures_competition_id_idx ON public.fixtures(competition_id);

-- ============================================================
-- TEAM CARD SLOTS (football team card)
-- ============================================================

CREATE TABLE public.team_card_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  slot_number     INTEGER NOT NULL,
  team_name       TEXT NOT NULL,
  entry_id        UUID,  -- populated when entry payment succeeds
  assigned_at     TIMESTAMPTZ,
  is_winner       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, slot_number)
);

CREATE INDEX team_card_slots_competition_id_idx ON public.team_card_slots(competition_id);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE public.payments (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id                   UUID NOT NULL REFERENCES public.competitions(id),
  participant_id                   UUID NOT NULL REFERENCES public.profiles(id),
  stripe_checkout_session_id       TEXT UNIQUE,
  stripe_payment_intent_id         TEXT UNIQUE,
  stripe_charge_id                 TEXT,
  amount_pence                     INTEGER NOT NULL CHECK (amount_pence >= 0),
  currency                         TEXT NOT NULL DEFAULT 'gbp',
  status                           TEXT NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  -- Split breakdown (calculated at payment time, stored for audit)
  platform_fee_pence               INTEGER NOT NULL DEFAULT 0,
  club_share_pence                 INTEGER NOT NULL DEFAULT 0,
  prize_contribution_pence         INTEGER NOT NULL DEFAULT 0,
  weekly_boost_contribution_pence  INTEGER NOT NULL DEFAULT 0,
  refunded_at                      TIMESTAMPTZ,
  refund_reason                    TEXT,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX payments_competition_id_idx              ON public.payments(competition_id);
CREATE INDEX payments_participant_id_idx              ON public.payments(participant_id);
CREATE INDEX payments_status_idx                      ON public.payments(status);
CREATE INDEX payments_stripe_checkout_session_id_idx  ON public.payments(stripe_checkout_session_id);

-- ============================================================
-- ENTRIES
-- ============================================================

CREATE TABLE public.entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID NOT NULL REFERENCES public.competitions(id),
  participant_id  UUID NOT NULL REFERENCES public.profiles(id),
  entry_number    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending_payment'
                    CHECK (status IN ('pending_payment', 'active', 'eliminated', 'winner', 'refunded')),
  payment_id      UUID REFERENCES public.payments(id),
  -- Stores competition-specific data: predictions, picks, chosen slot, etc.
  entry_data      JSONB NOT NULL DEFAULT '{}',
  points_total    INTEGER NOT NULL DEFAULT 0,
  entered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  eliminated_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(competition_id, entry_number)
);

CREATE TRIGGER entries_updated_at BEFORE UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-assign sequential entry_number per competition
CREATE OR REPLACE FUNCTION generate_entry_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- NOTE: race condition possible at high concurrency; acceptable for MVP
  SELECT COALESCE(MAX(entry_number), 0) + 1
  INTO NEW.entry_number
  FROM public.entries
  WHERE competition_id = NEW.competition_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER entries_assign_number BEFORE INSERT ON public.entries
  FOR EACH ROW WHEN (NEW.entry_number = 0) EXECUTE FUNCTION generate_entry_number();

CREATE INDEX entries_competition_id_idx  ON public.entries(competition_id);
CREATE INDEX entries_participant_id_idx  ON public.entries(participant_id);
CREATE INDEX entries_status_idx          ON public.entries(status);
CREATE INDEX entries_payment_id_idx      ON public.entries(payment_id);

-- ============================================================
-- PREDICTIONS (predictor entries)
-- ============================================================

CREATE TABLE public.predictions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id          UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  fixture_id        UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  predicted_result  TEXT NOT NULL CHECK (predicted_result IN ('H', 'D', 'A')),
  points_awarded    INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, fixture_id)
);

CREATE INDEX predictions_entry_id_idx    ON public.predictions(entry_id);
CREATE INDEX predictions_fixture_id_idx  ON public.predictions(fixture_id);

-- ============================================================
-- LMS PICKS (last man standing)
-- ============================================================

CREATE TABLE public.lms_picks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id     UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  round_id     UUID NOT NULL REFERENCES public.competition_rounds(id) ON DELETE CASCADE,
  team_picked  TEXT NOT NULL,
  is_correct   BOOLEAN,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, round_id)
);

CREATE INDEX lms_picks_entry_id_idx  ON public.lms_picks(entry_id);
CREATE INDEX lms_picks_round_id_idx  ON public.lms_picks(round_id);

-- ============================================================
-- PAYOUTS
-- ============================================================

CREATE TABLE public.payouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    UUID NOT NULL REFERENCES public.competitions(id),
  recipient_id      UUID REFERENCES public.profiles(id),
  club_id           UUID REFERENCES public.clubs(id),
  type              TEXT NOT NULL
                      CHECK (type IN ('winner_prize', 'club_fundraise', 'weekly_boost', 'refund')),
  amount_pence      INTEGER NOT NULL CHECK (amount_pence >= 0),
  currency          TEXT NOT NULL DEFAULT 'gbp',
  stripe_transfer_id TEXT,
  status            TEXT NOT NULL DEFAULT 'pending_review'
                      CHECK (status IN ('pending_review', 'processing', 'paid', 'failed', 'cancelled')),
  notes             TEXT,
  initiated_by      UUID REFERENCES public.profiles(id),
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER payouts_updated_at BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX payouts_competition_id_idx  ON public.payouts(competition_id);
CREATE INDEX payouts_status_idx          ON public.payouts(status);
CREATE INDEX payouts_club_id_idx         ON public.payouts(club_id);

-- ============================================================
-- WEEKLY BOOST
-- ============================================================

CREATE TABLE public.weekly_boost_pool (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  UUID REFERENCES public.payments(id),
  amount_pence INTEGER NOT NULL CHECK (amount_pence >= 0),
  source      TEXT NOT NULL DEFAULT 'competition_contribution'
                CHECK (source IN ('competition_contribution', 'sponsorship', 'marketing', 'other')),
  notes       TEXT,
  week_start  DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX weekly_boost_pool_week_start_idx ON public.weekly_boost_pool(week_start);

CREATE TABLE public.weekly_boost_periods (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start        DATE NOT NULL UNIQUE,
  week_end          DATE NOT NULL,
  total_pool_pence  INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'awarded')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER weekly_boost_periods_updated_at BEFORE UPDATE ON public.weekly_boost_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.weekly_boost_awards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id    UUID NOT NULL REFERENCES public.weekly_boost_periods(id),
  club_id      UUID NOT NULL REFERENCES public.clubs(id),
  amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
  source       TEXT NOT NULL DEFAULT 'competition_contribution'
                 CHECK (source IN ('competition_contribution', 'sponsorship', 'marketing')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payout_id    UUID REFERENCES public.payouts(id),
  notes        TEXT,
  awarded_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER weekly_boost_awards_updated_at BEFORE UPDATE ON public.weekly_boost_awards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX weekly_boost_awards_club_id_idx  ON public.weekly_boost_awards(club_id);
CREATE INDEX weekly_boost_awards_status_idx   ON public.weekly_boost_awards(status);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE public.audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES public.profiles(id),
  club_id      UUID REFERENCES public.clubs(id),
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  action       TEXT NOT NULL,
  before_state JSONB,
  after_state  JSONB,
  ip_address   INET,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_log_actor_id_idx           ON public.audit_log(actor_id);
CREATE INDEX audit_log_club_id_idx            ON public.audit_log(club_id);
CREATE INDEX audit_log_entity_type_action_idx ON public.audit_log(entity_type, action);
CREATE INDEX audit_log_created_at_idx         ON public.audit_log(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.feature_flags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_rounds     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_card_slots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_picks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_boost_pool      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_boost_periods   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_boost_awards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- FEATURE FLAGS
CREATE POLICY "flags_read_authed"   ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "flags_write_admin"   ON public.feature_flags FOR ALL    TO authenticated USING (is_platform_admin());

-- PROFILES
CREATE POLICY "profiles_read"       ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_platform_admin());
CREATE POLICY "profiles_insert"     ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- CLUBS: public can read approved; creator/members/admin can read all
CREATE POLICY "clubs_read" ON public.clubs FOR SELECT
  USING (
    status = 'approved'
    OR created_by = auth.uid()
    OR is_club_admin(id)
    OR is_platform_admin()
  );
CREATE POLICY "clubs_insert" ON public.clubs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "clubs_update" ON public.clubs FOR UPDATE TO authenticated
  USING (is_club_admin(id) OR is_platform_admin());

-- CLUB MEMBERS
CREATE POLICY "members_read" ON public.club_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_club_admin(club_id) OR is_platform_admin());
CREATE POLICY "members_insert" ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (is_club_admin(club_id) OR is_platform_admin());
CREATE POLICY "members_delete" ON public.club_members FOR DELETE TO authenticated
  USING (is_club_admin(club_id) OR is_platform_admin());

-- COMPETITIONS
CREATE POLICY "competitions_read" ON public.competitions FOR SELECT
  USING (
    (status != 'draft'
      AND EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND status = 'approved'))
    OR is_club_admin(club_id)
    OR is_platform_admin()
  );
CREATE POLICY "competitions_insert" ON public.competitions FOR INSERT TO authenticated
  WITH CHECK (is_club_admin(club_id));
CREATE POLICY "competitions_update" ON public.competitions FOR UPDATE TO authenticated
  USING (is_club_admin(club_id) OR is_platform_admin());

-- COMPETITION ROUNDS
CREATE POLICY "rounds_read" ON public.competition_rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND (
        c.status != 'draft'
        OR is_club_admin(c.club_id)
        OR is_platform_admin()
      )
    )
  );
CREATE POLICY "rounds_write" ON public.competition_rounds FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND (is_club_admin(c.club_id) OR is_platform_admin())
    )
  );

-- FIXTURES
CREATE POLICY "fixtures_read" ON public.fixtures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND (
        c.status != 'draft'
        OR is_club_admin(c.club_id)
        OR is_platform_admin()
      )
    )
  );
CREATE POLICY "fixtures_write" ON public.fixtures FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND (is_club_admin(c.club_id) OR is_platform_admin())
    )
  );

-- TEAM CARD SLOTS
CREATE POLICY "slots_read" ON public.team_card_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND c.status != 'draft'
    )
    OR is_platform_admin()
  );
CREATE POLICY "slots_write" ON public.team_card_slots FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND (is_club_admin(c.club_id) OR is_platform_admin())
    )
  );

-- ENTRIES
CREATE POLICY "entries_read" ON public.entries FOR SELECT TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND (is_club_admin(c.club_id) OR is_platform_admin())
    )
  );
CREATE POLICY "entries_insert" ON public.entries FOR INSERT TO authenticated
  WITH CHECK (participant_id = auth.uid());
CREATE POLICY "entries_update" ON public.entries FOR UPDATE TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND (is_club_admin(c.club_id) OR is_platform_admin())
    )
  );

-- PREDICTIONS
CREATE POLICY "predictions_read" ON public.predictions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id AND (
        e.participant_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.competitions c
          WHERE c.id = e.competition_id AND (is_club_admin(c.club_id) OR is_platform_admin())
        )
      )
    )
  );
CREATE POLICY "predictions_insert" ON public.predictions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id AND e.participant_id = auth.uid() AND e.status = 'pending_payment'
    )
  );

-- LMS PICKS
CREATE POLICY "lms_picks_read" ON public.lms_picks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id AND (
        e.participant_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.competitions c
          WHERE c.id = e.competition_id AND (is_club_admin(c.club_id) OR is_platform_admin())
        )
      )
    )
  );
CREATE POLICY "lms_picks_insert" ON public.lms_picks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id AND e.participant_id = auth.uid() AND e.status = 'active'
    )
  );

-- PAYMENTS
CREATE POLICY "payments_read" ON public.payments FOR SELECT TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND (is_club_admin(c.club_id) OR is_platform_admin())
    )
  );
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (participant_id = auth.uid());
-- Updates come via service role from webhook handler only
CREATE POLICY "payments_update_admin" ON public.payments FOR UPDATE TO authenticated
  USING (is_platform_admin());

-- PAYOUTS
CREATE POLICY "payouts_read" ON public.payouts FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR (club_id IS NOT NULL AND is_club_admin(club_id))
    OR EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND is_club_admin(c.club_id)
    )
    OR is_platform_admin()
  );
CREATE POLICY "payouts_write" ON public.payouts FOR ALL TO authenticated
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_id AND is_club_admin(c.club_id)
    )
  );

-- WEEKLY BOOST
CREATE POLICY "boost_pool_admin"    ON public.weekly_boost_pool    FOR ALL TO authenticated USING (is_platform_admin());
CREATE POLICY "boost_periods_read"  ON public.weekly_boost_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "boost_periods_admin" ON public.weekly_boost_periods FOR ALL TO authenticated USING (is_platform_admin());
CREATE POLICY "boost_awards_read"   ON public.weekly_boost_awards  FOR SELECT TO authenticated
  USING (is_club_admin(club_id) OR is_platform_admin());
CREATE POLICY "boost_awards_admin"  ON public.weekly_boost_awards  FOR ALL TO authenticated USING (is_platform_admin());

-- AUDIT LOG: written by service role; readable by platform admin or own actions
CREATE POLICY "audit_read" ON public.audit_log FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR (club_id IS NOT NULL AND is_club_admin(club_id)) OR is_platform_admin());

-- ============================================================
-- SEED: DEFAULT FEATURE FLAGS
-- ============================================================

INSERT INTO public.feature_flags (key, enabled, description, metadata) VALUES
  ('weekly_boost',        FALSE, 'ClubBoost Weekly Boost fundraising feature',
   '{"contribution_bps": 200, "min_entries_per_week": 10, "max_award_pence": 5000}'),
  ('donation_only',       TRUE,  'Donation-only fundraiser competition type',  '{}'),
  ('csv_export',          TRUE,  'CSV export for entries and payments',         '{}'),
  ('team_card',           TRUE,  'Football team card competition type',         '{}'),
  ('last_man_standing',   TRUE,  'Last Man Standing competition type',          '{}');
