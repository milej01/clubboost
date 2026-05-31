-- ClubBoost seed data
-- Run after migrations. Creates a platform admin and a demo club.
-- Replace UUIDs with real ones from your Supabase Auth users.

-- ============================================================
-- HOW TO USE
-- 1. Create users in Supabase Auth dashboard (or via signup flow)
-- 2. Grab their UUIDs from auth.users
-- 3. Replace the UUIDs below with real values
-- 4. Run: supabase db reset --linked  OR  paste into SQL editor
-- ============================================================

DO $$
DECLARE
  admin_id    UUID := '00000000-0000-0000-0000-000000000001'; -- replace
  club_admin_id UUID := '00000000-0000-0000-0000-000000000002'; -- replace
  demo_club_id  UUID := gen_random_uuid();
  demo_comp_id  UUID := gen_random_uuid();
BEGIN

-- ── Profiles ──────────────────────────────────────────────────
-- (profiles are normally auto-created by the auth trigger;
--  this seed handles the case where users were created before the trigger)

INSERT INTO public.profiles (id, display_name, role) VALUES
  (admin_id,      'Platform Admin',  'platform_admin'),
  (club_admin_id, 'Demo Club Admin', 'club_admin')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name;

-- ── Demo club ─────────────────────────────────────────────────

INSERT INTO public.clubs (
  id, name, slug, sport, team_age_group, location,
  contact_name, contact_email, contact_phone,
  description, status, stripe_onboarded, created_by
) VALUES (
  demo_club_id,
  'Riverside FC',
  'riverside-fc',
  'football',
  'Seniors',
  'Riverside, Surrey',
  'Jane Smith',
  'secretary@riversidefc.example.com',
  '+44 7700 900123',
  'Riverside FC is a friendly community football club established in 1987. We run weekly training sessions and compete in the Surrey County League.',
  'approved',
  false,
  club_admin_id
) ON CONFLICT (slug) DO NOTHING;

-- Club admin as owner
INSERT INTO public.club_members (club_id, user_id, role)
VALUES (demo_club_id, club_admin_id, 'owner')
ON CONFLICT (club_id, user_id) DO NOTHING;

-- ── Demo competitions ─────────────────────────────────────────

-- Predictor competition
INSERT INTO public.competitions (
  id, club_id, created_by, type, title, description, rules_text, status,
  entry_fee_pence, prize_type, prize_pct_bps, club_pct_bps, platform_fee_bps,
  weekly_boost_contribution_bps, closes_at, terms_accepted, config
) VALUES (
  demo_comp_id,
  demo_club_id,
  club_admin_id,
  'predictor',
  'Weekend Premier League Predictor',
  'Predict the results of 6 Premier League matches this weekend. Highest score wins!',
  'Each correct result earns 1 point. Ties broken by entry order. Results final once admin settles.',
  'open',
  500,  -- £5.00
  'percentage',
  5000, -- 50% prize
  4000, -- 40% club
  800,  -- 8% platform
  0,
  (NOW() + INTERVAL '7 days'),
  true,
  '{"fixtures": [], "points_per_correct": 1}'::jsonb
) ON CONFLICT DO NOTHING;

-- Insert 6 demo fixtures for the predictor
INSERT INTO public.fixtures (competition_id, fixture_order, home_team, away_team, kickoff_at)
VALUES
  (demo_comp_id, 0, 'Arsenal',            'Chelsea',          (NOW() + INTERVAL '3 days')),
  (demo_comp_id, 1, 'Liverpool',           'Manchester City',  (NOW() + INTERVAL '3 days')),
  (demo_comp_id, 2, 'Manchester United',   'Tottenham',        (NOW() + INTERVAL '3 days')),
  (demo_comp_id, 3, 'Everton',             'Newcastle',        (NOW() + INTERVAL '4 days')),
  (demo_comp_id, 4, 'Aston Villa',         'West Ham',         (NOW() + INTERVAL '4 days')),
  (demo_comp_id, 5, 'Brighton',            'Brentford',        (NOW() + INTERVAL '4 days'))
ON CONFLICT DO NOTHING;

-- Donation competition
INSERT INTO public.competitions (
  club_id, created_by, type, title, description, status,
  entry_fee_pence, prize_type, club_pct_bps, platform_fee_bps,
  weekly_boost_contribution_bps, closes_at, terms_accepted, config
) VALUES (
  demo_club_id,
  club_admin_id,
  'donation',
  'Kit Fund 2025',
  'Help us raise £500 for new training kits for the squad this season!',
  'open',
  500,   -- £5.00
  'none',
  9200,  -- 92% club (8% platform fee)
  800,
  0,
  (NOW() + INTERVAL '30 days'),
  true,
  '{"target_amount_pence": 50000, "show_progress": true}'::jsonb
) ON CONFLICT DO NOTHING;

-- ── Audit log entries ─────────────────────────────────────────

INSERT INTO public.audit_log (actor_id, club_id, entity_type, entity_id, action, after_state)
VALUES
  (club_admin_id, demo_club_id, 'club',        demo_club_id, 'club_created',          '{"name": "Riverside FC"}'::jsonb),
  (admin_id,      demo_club_id, 'club',        demo_club_id, 'club_approved',          '{"status": "approved"}'::jsonb),
  (club_admin_id, demo_club_id, 'competition', demo_comp_id, 'competition_created',    '{"title": "Weekend Premier League Predictor"}'::jsonb),
  (club_admin_id, demo_club_id, 'competition', demo_comp_id, 'competition_published',  '{"status": "open"}'::jsonb);

END $$;
