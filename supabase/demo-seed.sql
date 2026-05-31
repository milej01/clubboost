-- ============================================================
-- ClubBoost Demo Seed
-- ============================================================
-- Populates the database with realistic grassroots football demo
-- data so every dashboard, public page, and admin view is fully
-- populated out of the box.
--
-- Run via:
--   supabase db reset          (drops everything, re-applies all
--                               migrations, then runs this file)
--   psql $DATABASE_URL -f supabase/demo-seed.sql  (append-only)
--
-- Demo credentials (all passwords: Demo1234!)
-- ┌─────────────────────────────────────────┬───────────────────┐
-- │ Email                                   │ Role              │
-- ├─────────────────────────────────────────┼───────────────────┤
-- │ admin@clubboost.demo                    │ Platform Admin    │
-- │ secretary@hillside-fc.demo              │ Club Admin        │
-- │ admin@northgate-united.demo             │ Club Admin        │
-- │ manager@riverside-sports.demo           │ Club Admin        │
-- │ alice@demo.clubboost                    │ Participant       │
-- │ bob@demo.clubboost                      │ Participant       │
-- │ charlie@demo.clubboost                  │ Participant       │
-- │ diana@demo.clubboost                    │ Participant       │
-- │ eddie@demo.clubboost                    │ Participant       │
-- └─────────────────────────────────────────┴───────────────────┘
--
-- Clubs:
--   Hillside FC           — approved, Stripe onboarded, boost enrolled
--   Northgate United      — pending (awaiting admin approval)
--   Riverside Sports      — suspended (non-payment of prizes)
--
-- Competitions (all under Hillside FC):
--   1. Premier League Predictor GW37  — settled  (Alice won)
--   2. Last Man Standing 2025-26      — open     (3 rounds settled)
--   3. End of Season Team Card        — open     (8/20 slots taken)
--   4. New Changing Rooms Fund        — open     (donation, 4 backers)
--
-- Weekly Boost:
--   Period 1 (2026-05-05–11) — awarded £25 to Hillside FC
--   Period 2 (2026-05-19–25) — active, £20.30 in pool
-- ============================================================

DO $$
DECLARE
  -- ── Users ──────────────────────────────────────────────────
  ADMIN_ID    CONSTANT UUID := '00000000-0001-4000-8000-000000000000';
  CADMIN1_ID  CONSTANT UUID := '00000000-0002-4000-8000-000000000000'; -- Hillside FC
  CADMIN2_ID  CONSTANT UUID := '00000000-0003-4000-8000-000000000000'; -- Northgate United
  CADMIN3_ID  CONSTANT UUID := '00000000-0004-4000-8000-000000000000'; -- Riverside Sports
  ALICE_ID    CONSTANT UUID := '00000000-0005-4000-8000-000000000000';
  BOB_ID      CONSTANT UUID := '00000000-0006-4000-8000-000000000000';
  CHARLIE_ID  CONSTANT UUID := '00000000-0007-4000-8000-000000000000';
  DIANA_ID    CONSTANT UUID := '00000000-0008-4000-8000-000000000000';
  EDDIE_ID    CONSTANT UUID := '00000000-0009-4000-8000-000000000000';

  -- ── Clubs ──────────────────────────────────────────────────
  HILLSIDE_ID   CONSTANT UUID := '00000001-0001-4000-8000-000000000000';
  NORTHGATE_ID  CONSTANT UUID := '00000001-0002-4000-8000-000000000000';
  RIVERSIDE_ID  CONSTANT UUID := '00000001-0003-4000-8000-000000000000';

  -- ── Competitions ───────────────────────────────────────────
  PRED_ID  CONSTANT UUID := '00000002-0001-4000-8000-000000000000'; -- predictor, settled
  LMS_ID   CONSTANT UUID := '00000002-0002-4000-8000-000000000000'; -- LMS, open
  CARD_ID  CONSTANT UUID := '00000002-0003-4000-8000-000000000000'; -- team card, open
  DONA_ID  CONSTANT UUID := '00000002-0004-4000-8000-000000000000'; -- donation, open

  -- ── Fixtures (Predictor GW37) ───────────────────────────────
  F1_ID  CONSTANT UUID := '00000003-0001-4000-8000-000000000000'; -- Arsenal v Man Utd
  F2_ID  CONSTANT UUID := '00000003-0002-4000-8000-000000000000'; -- Liverpool v Wolves
  F3_ID  CONSTANT UUID := '00000003-0003-4000-8000-000000000000'; -- Chelsea v Spurs
  F4_ID  CONSTANT UUID := '00000003-0004-4000-8000-000000000000'; -- Newcastle v Bournemouth
  F5_ID  CONSTANT UUID := '00000003-0005-4000-8000-000000000000'; -- Aston Villa v Brighton
  F6_ID  CONSTANT UUID := '00000003-0006-4000-8000-000000000000'; -- Everton v Fulham
  -- Actual results: H H D A H H

  -- ── LMS Rounds ─────────────────────────────────────────────
  R1_ID  CONSTANT UUID := '00000004-0001-4000-8000-000000000000'; -- settled
  R2_ID  CONSTANT UUID := '00000004-0002-4000-8000-000000000000'; -- settled
  R3_ID  CONSTANT UUID := '00000004-0003-4000-8000-000000000000'; -- settled
  R4_ID  CONSTANT UUID := '00000004-0004-4000-8000-000000000000'; -- open (current)

  -- ── Entries ────────────────────────────────────────────────
  -- Predictor
  EP_ALICE_ID    CONSTANT UUID := '00000005-0001-4000-8000-000000000000';
  EP_BOB_ID      CONSTANT UUID := '00000005-0002-4000-8000-000000000000';
  EP_CHARLIE_ID  CONSTANT UUID := '00000005-0003-4000-8000-000000000000';
  EP_DIANA_ID    CONSTANT UUID := '00000005-0004-4000-8000-000000000000';
  -- LMS
  EL_ALICE_ID    CONSTANT UUID := '00000005-0011-4000-8000-000000000000';
  EL_BOB_ID      CONSTANT UUID := '00000005-0012-4000-8000-000000000000';
  EL_CHARLIE_ID  CONSTANT UUID := '00000005-0013-4000-8000-000000000000';
  EL_DIANA_ID    CONSTANT UUID := '00000005-0014-4000-8000-000000000000';
  EL_EDDIE_ID    CONSTANT UUID := '00000005-0015-4000-8000-000000000000';
  -- Team Card
  EC_ALICE_ID    CONSTANT UUID := '00000005-0021-4000-8000-000000000000';
  EC_CHARLIE_ID  CONSTANT UUID := '00000005-0022-4000-8000-000000000000';
  EC_EDDIE_ID    CONSTANT UUID := '00000005-0023-4000-8000-000000000000';
  EC_BOB_ID      CONSTANT UUID := '00000005-0024-4000-8000-000000000000'; -- pending_payment
  -- Donation
  ED_ALICE_ID    CONSTANT UUID := '00000005-0031-4000-8000-000000000000';
  ED_BOB_ID      CONSTANT UUID := '00000005-0032-4000-8000-000000000000';
  ED_CHARLIE_ID  CONSTANT UUID := '00000005-0033-4000-8000-000000000000';
  ED_DIANA_ID    CONSTANT UUID := '00000005-0034-4000-8000-000000000000';

  -- ── Payments ───────────────────────────────────────────────
  -- Predictor (£5.00 each; splits 50% prize / 40% club / 8% platform / 2% boost)
  PP_ALICE_ID    CONSTANT UUID := '00000006-0001-4000-8000-000000000000';
  PP_BOB_ID      CONSTANT UUID := '00000006-0002-4000-8000-000000000000';
  PP_CHARLIE_ID  CONSTANT UUID := '00000006-0003-4000-8000-000000000000';
  PP_DIANA_ID    CONSTANT UUID := '00000006-0004-4000-8000-000000000000';
  -- LMS (£10.00 each; splits 60% prize / 30% club / 8% platform / 2% boost)
  PL_ALICE_ID    CONSTANT UUID := '00000006-0011-4000-8000-000000000000';
  PL_BOB_ID      CONSTANT UUID := '00000006-0012-4000-8000-000000000000';
  PL_CHARLIE_ID  CONSTANT UUID := '00000006-0013-4000-8000-000000000000';
  PL_DIANA_ID    CONSTANT UUID := '00000006-0014-4000-8000-000000000000';
  PL_EDDIE_ID    CONSTANT UUID := '00000006-0015-4000-8000-000000000000';
  -- Team Card (£5.00 each; 90% club / 8% platform / 2% boost)
  PC_ALICE_ID    CONSTANT UUID := '00000006-0021-4000-8000-000000000000';
  PC_CHARLIE_ID  CONSTANT UUID := '00000006-0022-4000-8000-000000000000';
  PC_EDDIE_ID    CONSTANT UUID := '00000006-0023-4000-8000-000000000000';
  -- Bob team card payment is still pending — no payment UUID
  -- Donation (£5.00 each; 92% club / 8% platform)
  PD_ALICE_ID    CONSTANT UUID := '00000006-0031-4000-8000-000000000000';
  PD_BOB_ID      CONSTANT UUID := '00000006-0032-4000-8000-000000000000';
  PD_CHARLIE_ID  CONSTANT UUID := '00000006-0033-4000-8000-000000000000';
  PD_DIANA_ID    CONSTANT UUID := '00000006-0034-4000-8000-000000000000';

  -- ── Payouts ────────────────────────────────────────────────
  POUT_PRIZE_ID  CONSTANT UUID := '00000008-0001-4000-8000-000000000000'; -- Alice prize
  POUT_CLUB_ID   CONSTANT UUID := '00000008-0002-4000-8000-000000000000'; -- Hillside club share

  -- ── Weekly Boost ───────────────────────────────────────────
  BOOST_P1_ID    CONSTANT UUID := '00000009-0001-4000-8000-000000000000'; -- awarded
  BOOST_P2_ID    CONSTANT UUID := '00000009-0002-4000-8000-000000000000'; -- active
  BOOST_A1_ID    CONSTANT UUID := '0000000a-0001-4000-8000-000000000000'; -- award → Hillside

BEGIN

-- ============================================================
-- 1. AUTH USERS
-- ============================================================
-- Inserts directly into auth.users so this seed is self-contained.
-- Only safe to run via service role (supabase db seed / SQL editor).
-- pgcrypto must be enabled (migration 002 enables it).

INSERT INTO auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  (ADMIN_ID,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@clubboost.demo',
   crypt('Demo1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Platform Admin"}'::jsonb, NOW(), NOW()),

  (CADMIN1_ID, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'secretary@hillside-fc.demo',
   crypt('Demo1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Tom Bradshaw"}'::jsonb, NOW(), NOW()),

  (CADMIN2_ID, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@northgate-united.demo',
   crypt('Demo1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Sarah Chen"}'::jsonb, NOW(), NOW()),

  (CADMIN3_ID, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'manager@riverside-sports.demo',
   crypt('Demo1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Mike Johnson"}'::jsonb, NOW(), NOW()),

  (ALICE_ID,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alice@demo.clubboost',
   crypt('Demo1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Alice Thompson"}'::jsonb, NOW(), NOW()),

  (BOB_ID,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bob@demo.clubboost',
   crypt('Demo1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Bob Hargreaves"}'::jsonb, NOW(), NOW()),

  (CHARLIE_ID, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'charlie@demo.clubboost',
   crypt('Demo1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Charlie Osei"}'::jsonb, NOW(), NOW()),

  (DIANA_ID,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'diana@demo.clubboost',
   crypt('Demo1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Diana Patel"}'::jsonb, NOW(), NOW()),

  (EDDIE_ID,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'eddie@demo.clubboost',
   crypt('Demo1234!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Eddie Mwangi"}'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Auth identities (required for email login)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), ADMIN_ID,   'admin@clubboost.demo',
   jsonb_build_object('sub', ADMIN_ID::text,   'email', 'admin@clubboost.demo'),
   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), CADMIN1_ID, 'secretary@hillside-fc.demo',
   jsonb_build_object('sub', CADMIN1_ID::text, 'email', 'secretary@hillside-fc.demo'),
   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), CADMIN2_ID, 'admin@northgate-united.demo',
   jsonb_build_object('sub', CADMIN2_ID::text, 'email', 'admin@northgate-united.demo'),
   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), CADMIN3_ID, 'manager@riverside-sports.demo',
   jsonb_build_object('sub', CADMIN3_ID::text, 'email', 'manager@riverside-sports.demo'),
   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), ALICE_ID,   'alice@demo.clubboost',
   jsonb_build_object('sub', ALICE_ID::text,   'email', 'alice@demo.clubboost'),
   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), BOB_ID,     'bob@demo.clubboost',
   jsonb_build_object('sub', BOB_ID::text,     'email', 'bob@demo.clubboost'),
   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), CHARLIE_ID, 'charlie@demo.clubboost',
   jsonb_build_object('sub', CHARLIE_ID::text, 'email', 'charlie@demo.clubboost'),
   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), DIANA_ID,   'diana@demo.clubboost',
   jsonb_build_object('sub', DIANA_ID::text,   'email', 'diana@demo.clubboost'),
   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), EDDIE_ID,   'eddie@demo.clubboost',
   jsonb_build_object('sub', EDDIE_ID::text,   'email', 'eddie@demo.clubboost'),
   'email', NOW(), NOW(), NOW())
ON CONFLICT (provider_id, provider) DO NOTHING;


-- ============================================================
-- 2. PROFILES
-- ============================================================
-- The on_auth_user_created trigger usually creates these, but it
-- may not have fired for these synthetic rows.

INSERT INTO public.profiles (id, display_name, role) VALUES
  (ADMIN_ID,   'Platform Admin',  'platform_admin'),
  (CADMIN1_ID, 'Tom Bradshaw',    'club_admin'),
  (CADMIN2_ID, 'Sarah Chen',      'club_admin'),
  (CADMIN3_ID, 'Mike Johnson',    'club_admin'),
  (ALICE_ID,   'Alice Thompson',  'participant'),
  (BOB_ID,     'Bob Hargreaves',  'participant'),
  (CHARLIE_ID, 'Charlie Osei',    'participant'),
  (DIANA_ID,   'Diana Patel',     'participant'),
  (EDDIE_ID,   'Eddie Mwangi',    'participant')
ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      role         = EXCLUDED.role;


-- ============================================================
-- 3. CLUBS
-- ============================================================

INSERT INTO public.clubs (
  id, name, slug, sport, team_age_group, location,
  contact_name, contact_email, contact_phone, description,
  status, stripe_account_id, stripe_onboarded,
  weekly_boost_eligible, weekly_boost_enrolled,
  platform_fee_bps, created_by
) VALUES

  -- Approved club — full Stripe onboarding, boost enrolled
  (HILLSIDE_ID,
   'Hillside FC', 'hillside-fc', 'football', 'Senior Men',
   'Hillside, Greater Manchester',
   'Tom Bradshaw', 'secretary@hillside-fc.demo', '+44 7700 900123',
   'Hillside FC was founded in 1989 and competes in the Greater Manchester Sunday League Division 2. '
   'We train every Tuesday evening at Hillside Rec and welcome players of all abilities. '
   'Our motto: play hard, stay together.',
   'approved', 'acct_demo_hillside_stripe', TRUE,
   TRUE, TRUE, 800, CADMIN1_ID),

  -- Pending club — applied 3 days ago, no competitions yet
  (NORTHGATE_ID,
   'Northgate United', 'northgate-united', 'football', 'Senior Men & Women',
   'Northgate, Bristol',
   'Sarah Chen', 'admin@northgate-united.demo', '+44 7800 100456',
   'Northgate United is a newly formed community club looking to get fundraising off the ground. '
   'We field both a men''s and ladies'' team in the Bristol & District League.',
   'pending', NULL, FALSE,
   FALSE, FALSE, 800, CADMIN2_ID),

  -- Suspended club — stripe onboarded but suspended for non-payment
  (RIVERSIDE_ID,
   'Riverside Sports FC', 'riverside-sports-fc', 'football', 'Senior Men',
   'Riverside, Leeds',
   'Mike Johnson', 'manager@riverside-sports.demo', '+44 7900 200789',
   'Riverside Sports FC competes in the West Yorkshire League.',
   'suspended', 'acct_demo_riverside_stripe', TRUE,
   FALSE, FALSE, 800, CADMIN3_ID)

ON CONFLICT (id) DO NOTHING;

-- Club members (owners)
INSERT INTO public.club_members (club_id, user_id, role) VALUES
  (HILLSIDE_ID,  CADMIN1_ID, 'owner'),
  (NORTHGATE_ID, CADMIN2_ID, 'owner'),
  (RIVERSIDE_ID, CADMIN3_ID, 'owner')
ON CONFLICT (club_id, user_id) DO NOTHING;


-- ============================================================
-- 4. COMPETITIONS
-- ============================================================

-- 4a. Predictor GW37 — settled, Alice won with 6/6
INSERT INTO public.competitions (
  id, club_id, created_by, type, title, description, rules_text, status,
  entry_fee_pence, prize_type, prize_pct_bps, prize_pence, prize_description,
  club_pct_bps, platform_fee_bps, weekly_boost_contribution_bps,
  opens_at, closes_at, settled_at, settled_by, terms_accepted, config
) VALUES (
  PRED_ID, HILLSIDE_ID, CADMIN1_ID,
  'predictor',
  'Premier League Predictor — Gameweek 37',
  'Predict the result of 6 Premier League matches from Gameweek 37. '
  'Highest score wins 50% of the pot. All proceeds support Hillside FC.',
  'Pick Home Win (H), Draw (D), or Away Win (A) for each match. '
  'Each correct result scores 1 point. Ties are broken by entry number '
  '(earlier entry wins). Prize paid within 7 days of settlement.',
  'settled',
  500,                    -- £5.00
  'percentage', 5000,     -- 50% of pot (prize_pct_bps = 5000)
  0,                      -- prize_pence unused for percentage type
  '50% of total entry pot',
  4000,                   -- 40% club
  800,                    -- 8% platform
  200,                    -- 2% weekly boost
  '2026-05-08 08:00:00+01',
  '2026-05-17 14:00:00+01',
  '2026-05-20 18:00:00+01',
  ADMIN_ID,
  TRUE,
  '{"points_per_correct": 1}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Fixtures (actual_result: H H D A H H)
INSERT INTO public.fixtures (id, competition_id, fixture_order, home_team, away_team, kickoff_at, actual_result)
VALUES
  (F1_ID, PRED_ID, 0, 'Arsenal',      'Man Utd',        '2026-05-17 12:30:00+01', 'H'),
  (F2_ID, PRED_ID, 1, 'Liverpool',    'Wolves',          '2026-05-17 15:00:00+01', 'H'),
  (F3_ID, PRED_ID, 2, 'Chelsea',      'Tottenham',       '2026-05-17 15:00:00+01', 'D'),
  (F4_ID, PRED_ID, 3, 'Newcastle',    'Bournemouth',     '2026-05-17 15:00:00+01', 'A'),
  (F5_ID, PRED_ID, 4, 'Aston Villa',  'Brighton',        '2026-05-17 17:30:00+01', 'H'),
  (F6_ID, PRED_ID, 5, 'Everton',      'Fulham',          '2026-05-17 17:30:00+01', 'H')
ON CONFLICT (id) DO NOTHING;


-- 4b. Last Man Standing 2025-26 — open, round 4 in progress
INSERT INTO public.competitions (
  id, club_id, created_by, type, title, description, rules_text, status,
  entry_fee_pence, prize_type, prize_pct_bps, prize_pence, prize_description,
  club_pct_bps, platform_fee_bps, weekly_boost_contribution_bps,
  opens_at, closes_at, terms_accepted, config
) VALUES (
  LMS_ID, HILLSIDE_ID, CADMIN1_ID,
  'last_man_standing',
  'Last Man Standing — 2025/26 Season',
  'Pick one Premier League team to win each week. '
  'If your team wins, you survive into the next round. '
  'You can''t pick the same team twice. Last player standing wins 60% of the pot.',
  'Pick one team per round before the round deadline. If your team wins, you stay in. '
  'A draw or loss eliminates you. If all remaining players are eliminated in the same round, '
  'the prize pot is shared equally among them. No team can be picked more than once per entry.',
  'open',
  1000,                   -- £10.00
  'percentage', 6000,     -- 60% of pot
  0,
  '60% of total entry pot',
  3000,                   -- 30% club
  800,                    -- 8% platform
  200,                    -- 2% weekly boost
  '2026-04-01 08:00:00+01',
  '2026-06-15 23:59:00+01',
  TRUE,
  jsonb_build_object(
    'max_rounds',           20,
    'allow_team_reuse',     FALSE,
    'round_deadline_hours', 24,
    'available_teams', ARRAY[
      'Arsenal','Aston Villa','Bournemouth','Brentford','Brighton',
      'Chelsea','Crystal Palace','Everton','Fulham','Ipswich Town',
      'Leicester City','Liverpool','Man City','Man Utd','Newcastle',
      'Nottm Forest','Southampton','Tottenham','West Ham','Wolves'
    ]
  )
) ON CONFLICT (id) DO NOTHING;

-- LMS Rounds
INSERT INTO public.competition_rounds (id, competition_id, round_number, title, deadline_at, status, result_data, settled_at)
VALUES
  (R1_ID, LMS_ID, 1, 'Round 1 — GW34',
   '2026-05-01 12:00:00+01', 'settled',
   '{"winning_teams": ["Arsenal"], "result_summary": "Arsenal 3-0 Wolves. Arsenal picked by Alice, Bob, Eddie — all survived."}'::jsonb,
   '2026-05-02 18:00:00+01'),

  (R2_ID, LMS_ID, 2, 'Round 2 — GW35',
   '2026-05-08 12:00:00+01', 'settled',
   '{"winning_teams": ["Liverpool"], "result_summary": "Liverpool 3-0 Southampton. Crystal Palace lost 0-1 to Bournemouth — Bob eliminated."}'::jsonb,
   '2026-05-09 18:00:00+01'),

  (R3_ID, LMS_ID, 3, 'Round 3 — GW36',
   '2026-05-15 12:00:00+01', 'settled',
   '{"winning_teams": ["Aston Villa"], "result_summary": "Aston Villa 2-1 West Ham. Alice and Eddie both survive into Round 4."}'::jsonb,
   '2026-05-16 18:00:00+01'),

  (R4_ID, LMS_ID, 4, 'Round 4 — GW37',
   '2026-05-29 12:00:00+01', 'open',
   NULL, NULL)

ON CONFLICT (competition_id, round_number) DO NOTHING;


-- 4c. End of Season Team Card — open, 20 slots
INSERT INTO public.competitions (
  id, club_id, created_by, type, title, description, rules_text, status,
  entry_fee_pence, prize_type, prize_pct_bps, prize_pence, prize_description,
  club_pct_bps, platform_fee_bps, weekly_boost_contribution_bps,
  opens_at, closes_at, terms_accepted, config
) VALUES (
  CARD_ID, HILLSIDE_ID, CADMIN1_ID,
  'team_card',
  'End of Season Team Card Draw',
  'Claim a Premier League team for just £5. One team will be drawn at the '
  'end of the season — that team''s slot holder wins a £25 club shop voucher. '
  'All remaining proceeds go directly to Hillside FC.',
  'Each participant claims one slot. Slots are first-come, first-served. '
  'The winning team will be announced via our social media channels within '
  '48 hours of the final Premier League fixtures.',
  'open',
  500,                    -- £5.00
  'description', 0, 0,
  '£25 Hillside FC club shop voucher for the holder of the winning team slot',
  9000,                   -- 90% club (prize is club-funded)
  800,                    -- 8% platform
  200,                    -- 2% weekly boost
  '2026-05-01 08:00:00+01',
  '2026-07-31 23:59:00+01',
  TRUE,
  '{"reveal_method": "manual"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 20 team card slots — slots 7, 12, 3 taken (active); slot 15 reserved (pending)
INSERT INTO public.team_card_slots (id, competition_id, slot_number, team_name)
VALUES
  ('00000007-0001-4000-8000-000000000000', CARD_ID,  1, 'Arsenal'),
  ('00000007-0002-4000-8000-000000000000', CARD_ID,  2, 'Aston Villa'),
  ('00000007-0003-4000-8000-000000000000', CARD_ID,  3, 'Bournemouth'),
  ('00000007-0004-4000-8000-000000000000', CARD_ID,  4, 'Brentford'),
  ('00000007-0005-4000-8000-000000000000', CARD_ID,  5, 'Brighton'),
  ('00000007-0006-4000-8000-000000000000', CARD_ID,  6, 'Chelsea'),
  ('00000007-0007-4000-8000-000000000000', CARD_ID,  7, 'Crystal Palace'),
  ('00000007-0008-4000-8000-000000000000', CARD_ID,  8, 'Everton'),
  ('00000007-0009-4000-8000-000000000000', CARD_ID,  9, 'Fulham'),
  ('00000007-0010-4000-8000-000000000000', CARD_ID, 10, 'Ipswich Town'),
  ('00000007-0011-4000-8000-000000000000', CARD_ID, 11, 'Leicester City'),
  ('00000007-0012-4000-8000-000000000000', CARD_ID, 12, 'Liverpool'),
  ('00000007-0013-4000-8000-000000000000', CARD_ID, 13, 'Man City'),
  ('00000007-0014-4000-8000-000000000000', CARD_ID, 14, 'Man Utd'),
  ('00000007-0015-4000-8000-000000000000', CARD_ID, 15, 'Newcastle'),
  ('00000007-0016-4000-8000-000000000000', CARD_ID, 16, 'Nottm Forest'),
  ('00000007-0017-4000-8000-000000000000', CARD_ID, 17, 'Southampton'),
  ('00000007-0018-4000-8000-000000000000', CARD_ID, 18, 'Tottenham'),
  ('00000007-0019-4000-8000-000000000000', CARD_ID, 19, 'West Ham'),
  ('00000007-0020-4000-8000-000000000000', CARD_ID, 20, 'Wolves')
ON CONFLICT (competition_id, slot_number) DO NOTHING;


-- 4d. New Changing Rooms Fund — donation, open
INSERT INTO public.competitions (
  id, club_id, created_by, type, title, description, rules_text, status,
  entry_fee_pence, prize_type, prize_pct_bps, prize_pence, prize_description,
  club_pct_bps, platform_fee_bps, weekly_boost_contribution_bps,
  opens_at, closes_at, terms_accepted, config
) VALUES (
  DONA_ID, HILLSIDE_ID, CADMIN1_ID,
  'donation',
  'New Changing Rooms Fund 2026',
  'Help us raise £1,000 towards brand new changing facilities at Hillside Rec. '
  'Our current changing rooms are over 30 years old and urgently need replacing. '
  'Every pound helps — thank you!',
  'This is a donation fundraiser. Your contribution goes directly to Hillside FC''s '
  'changing room project (less ClubBoost''s 8% platform fee). '
  'No prize. 100% community fundraising.',
  'open',
  500,                    -- minimum donation £5.00
  'none', 0, 0, NULL,
  9200,                   -- 92% to club
  800,                    -- 8% platform
  0,                      -- no boost contribution for donation type
  '2026-05-01 08:00:00+01',
  '2026-07-31 23:59:00+01',
  TRUE,
  '{"target_amount_pence": 100000, "show_progress": true}'::jsonb
) ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 5. ENTRIES  (payment_id set after payments are inserted)
-- ============================================================

-- ── Predictor entries ──────────────────────────────────────────
-- Actual results: F1=H, F2=H, F3=D, F4=A, F5=H, F6=H
-- Alice:   H H D A H H → 6/6 ✓ (winner)
-- Bob:     H H H A D H → 4/6 (f3,f5 wrong)
-- Charlie: D H D H H A → 3/6 (f1,f4,f6 wrong)
-- Diana:   H D D A H A → 4/6 (f2,f6 wrong) — tied with Bob, but higher entry number

INSERT INTO public.entries (
  id, competition_id, participant_id, entry_number, status,
  entry_data, points_total, entered_at
) VALUES
  (EP_ALICE_ID, PRED_ID, ALICE_ID, 1, 'winner',
   jsonb_build_object('predictions', jsonb_build_array(
     jsonb_build_object('fixture_id', F1_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F2_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F3_ID, 'predicted_result', 'D'),
     jsonb_build_object('fixture_id', F4_ID, 'predicted_result', 'A'),
     jsonb_build_object('fixture_id', F5_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F6_ID, 'predicted_result', 'H')
   )), 6, '2026-05-08 09:12:00+01'),

  (EP_BOB_ID, PRED_ID, BOB_ID, 2, 'active',
   jsonb_build_object('predictions', jsonb_build_array(
     jsonb_build_object('fixture_id', F1_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F2_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F3_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F4_ID, 'predicted_result', 'A'),
     jsonb_build_object('fixture_id', F5_ID, 'predicted_result', 'D'),
     jsonb_build_object('fixture_id', F6_ID, 'predicted_result', 'H')
   )), 4, '2026-05-08 10:30:00+01'),

  (EP_CHARLIE_ID, PRED_ID, CHARLIE_ID, 3, 'active',
   jsonb_build_object('predictions', jsonb_build_array(
     jsonb_build_object('fixture_id', F1_ID, 'predicted_result', 'D'),
     jsonb_build_object('fixture_id', F2_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F3_ID, 'predicted_result', 'D'),
     jsonb_build_object('fixture_id', F4_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F5_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F6_ID, 'predicted_result', 'A')
   )), 3, '2026-05-09 14:22:00+01'),

  (EP_DIANA_ID, PRED_ID, DIANA_ID, 4, 'active',
   jsonb_build_object('predictions', jsonb_build_array(
     jsonb_build_object('fixture_id', F1_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F2_ID, 'predicted_result', 'D'),
     jsonb_build_object('fixture_id', F3_ID, 'predicted_result', 'D'),
     jsonb_build_object('fixture_id', F4_ID, 'predicted_result', 'A'),
     jsonb_build_object('fixture_id', F5_ID, 'predicted_result', 'H'),
     jsonb_build_object('fixture_id', F6_ID, 'predicted_result', 'A')
   )), 4, '2026-05-10 08:45:00+01')

ON CONFLICT (competition_id, entry_number) DO NOTHING;


-- ── LMS entries ────────────────────────────────────────────────
-- Round outcomes:
--   R1 (Arsenal won):      Alice ✓  Bob ✓  Charlie ✗  Diana ✗  Eddie ✓
--   R2 (Liverpool won):    Alice ✓  Bob ✗  Eddie ✓
--   R3 (Aston Villa won):  Alice ✓  Eddie ✓
--   R4 (open):             Alice → Tottenham, Eddie → Chelsea

INSERT INTO public.entries (
  id, competition_id, participant_id, entry_number, status,
  entry_data, points_total, entered_at, eliminated_at
) VALUES
  (EL_ALICE_ID, LMS_ID, ALICE_ID, 1, 'active',
   jsonb_build_object('picks', jsonb_build_array(
     jsonb_build_object('round_id', R1_ID, 'team_picked', 'Arsenal'),
     jsonb_build_object('round_id', R2_ID, 'team_picked', 'Liverpool'),
     jsonb_build_object('round_id', R3_ID, 'team_picked', 'Aston Villa'),
     jsonb_build_object('round_id', R4_ID, 'team_picked', 'Tottenham')
   )), 0, '2026-05-05 10:00:00+01', NULL),

  (EL_BOB_ID, LMS_ID, BOB_ID, 2, 'eliminated',
   jsonb_build_object('picks', jsonb_build_array(
     jsonb_build_object('round_id', R1_ID, 'team_picked', 'Arsenal'),
     jsonb_build_object('round_id', R2_ID, 'team_picked', 'Crystal Palace')
   )), 0, '2026-05-05 11:14:00+01', '2026-05-09 18:00:00+01'),

  (EL_CHARLIE_ID, LMS_ID, CHARLIE_ID, 3, 'eliminated',
   jsonb_build_object('picks', jsonb_build_array(
     jsonb_build_object('round_id', R1_ID, 'team_picked', 'Man Utd')
   )), 0, '2026-05-06 09:30:00+01', '2026-05-02 18:00:00+01'),

  (EL_DIANA_ID, LMS_ID, DIANA_ID, 4, 'eliminated',
   jsonb_build_object('picks', jsonb_build_array(
     jsonb_build_object('round_id', R1_ID, 'team_picked', 'Newcastle')
   )), 0, '2026-05-06 12:00:00+01', '2026-05-02 18:00:00+01'),

  (EL_EDDIE_ID, LMS_ID, EDDIE_ID, 5, 'active',
   jsonb_build_object('picks', jsonb_build_array(
     jsonb_build_object('round_id', R1_ID, 'team_picked', 'Arsenal'),
     jsonb_build_object('round_id', R2_ID, 'team_picked', 'Liverpool'),
     jsonb_build_object('round_id', R3_ID, 'team_picked', 'Aston Villa'),
     jsonb_build_object('round_id', R4_ID, 'team_picked', 'Chelsea')
   )), 0, '2026-05-07 16:45:00+01', NULL)

ON CONFLICT (competition_id, entry_number) DO NOTHING;


-- ── Team Card entries ──────────────────────────────────────────
-- Alice=slot 7 (Crystal Palace), Charlie=slot 12 (Liverpool),
-- Eddie=slot 3 (Bournemouth), Bob=slot 15 (Newcastle, pending_payment)

INSERT INTO public.entries (
  id, competition_id, participant_id, entry_number, status,
  entry_data, points_total, entered_at
) VALUES
  (EC_ALICE_ID,   CARD_ID, ALICE_ID,   1, 'active',
   '{"slot_number": 7}'::jsonb,  0, '2026-05-20 09:05:00+01'),
  (EC_CHARLIE_ID, CARD_ID, CHARLIE_ID, 2, 'active',
   '{"slot_number": 12}'::jsonb, 0, '2026-05-20 09:22:00+01'),
  (EC_EDDIE_ID,   CARD_ID, EDDIE_ID,   3, 'active',
   '{"slot_number": 3}'::jsonb,  0, '2026-05-20 10:11:00+01'),
  (EC_BOB_ID,     CARD_ID, BOB_ID,     4, 'pending_payment',
   '{"slot_number": 15}'::jsonb, 0, '2026-05-22 08:50:00+01')

ON CONFLICT (competition_id, entry_number) DO NOTHING;


-- ── Donation entries ───────────────────────────────────────────
INSERT INTO public.entries (
  id, competition_id, participant_id, entry_number, status,
  entry_data, points_total, entered_at
) VALUES
  (ED_ALICE_ID,   DONA_ID, ALICE_ID,   1, 'active',
   '{"message": "Great cause, Tom! Good luck with the build. 💪"}'::jsonb,
   0, '2026-05-19 11:00:00+01'),
  (ED_BOB_ID,     DONA_ID, BOB_ID,     2, 'active',
   '{"message": "Happy to help. Best club in Manchester!"}'::jsonb,
   0, '2026-05-20 14:30:00+01'),
  (ED_CHARLIE_ID, DONA_ID, CHARLIE_ID, 3, 'active',
   '{"message": null}'::jsonb,
   0, '2026-05-21 09:15:00+01'),
  (ED_DIANA_ID,   DONA_ID, DIANA_ID,   4, 'active',
   '{"message": "Small contribution from me — keep up the great work!"}'::jsonb,
   0, '2026-05-22 10:00:00+01')

ON CONFLICT (competition_id, entry_number) DO NOTHING;


-- ============================================================
-- 6. PAYMENTS  (entries must exist first for entry_id FK)
-- ============================================================
-- Financial splits reference:
--   Predictor:  £5.00  → prize 250p / club 200p / platform 40p / boost 10p / stripe 27p
--   LMS:        £10.00 → prize 600p / club 300p / platform 80p / boost 20p / stripe 34p
--   Team Card:  £5.00  → club 450p / platform 40p / boost 10p / stripe 27p
--   Donation:   £5.00  → club 460p / platform 40p / boost 0p  / stripe 27p

INSERT INTO public.payments (
  id, competition_id, user_id, entry_id,
  amount_pence, gross_amount_pence, stripe_fee_pence,
  platform_service_fee_pence, weekly_boost_contribution_pence,
  club_fundraising_amount_pence, prize_pool_contribution_pence,
  currency, status,
  stripe_payment_intent_id, payment_method_last4,
  paid_at
) VALUES

  -- ── Predictor payments ────────────────────────────────────
  (PP_ALICE_ID, PRED_ID, ALICE_ID, EP_ALICE_ID,
   500, 500, 27, 40, 10, 200, 250, 'gbp', 'succeeded',
   'pi_demo_pred_alice', '4242', '2026-05-08 09:12:30+01'),

  (PP_BOB_ID, PRED_ID, BOB_ID, EP_BOB_ID,
   500, 500, 27, 40, 10, 200, 250, 'gbp', 'succeeded',
   'pi_demo_pred_bob', '1234', '2026-05-08 10:31:00+01'),

  (PP_CHARLIE_ID, PRED_ID, CHARLIE_ID, EP_CHARLIE_ID,
   500, 500, 27, 40, 10, 200, 250, 'gbp', 'succeeded',
   'pi_demo_pred_charlie', '5678', '2026-05-09 14:23:00+01'),

  (PP_DIANA_ID, PRED_ID, DIANA_ID, EP_DIANA_ID,
   500, 500, 27, 40, 10, 200, 250, 'gbp', 'succeeded',
   'pi_demo_pred_diana', '9999', '2026-05-10 08:46:00+01'),

  -- ── LMS payments ──────────────────────────────────────────
  (PL_ALICE_ID, LMS_ID, ALICE_ID, EL_ALICE_ID,
   1000, 1000, 34, 80, 20, 300, 600, 'gbp', 'succeeded',
   'pi_demo_lms_alice', '4242', '2026-05-05 10:01:00+01'),

  (PL_BOB_ID, LMS_ID, BOB_ID, EL_BOB_ID,
   1000, 1000, 34, 80, 20, 300, 600, 'gbp', 'succeeded',
   'pi_demo_lms_bob', '1234', '2026-05-05 11:15:00+01'),

  (PL_CHARLIE_ID, LMS_ID, CHARLIE_ID, EL_CHARLIE_ID,
   1000, 1000, 34, 80, 20, 300, 600, 'gbp', 'succeeded',
   'pi_demo_lms_charlie', '5678', '2026-05-06 09:31:00+01'),

  (PL_DIANA_ID, LMS_ID, DIANA_ID, EL_DIANA_ID,
   1000, 1000, 34, 80, 20, 300, 600, 'gbp', 'succeeded',
   'pi_demo_lms_diana', '9999', '2026-05-06 12:01:00+01'),

  (PL_EDDIE_ID, LMS_ID, EDDIE_ID, EL_EDDIE_ID,
   1000, 1000, 34, 80, 20, 300, 600, 'gbp', 'succeeded',
   'pi_demo_lms_eddie', '3333', '2026-05-07 16:46:00+01'),

  -- ── Team Card payments (3 active; Bob still pending_payment) ─
  (PC_ALICE_ID, CARD_ID, ALICE_ID, EC_ALICE_ID,
   500, 500, 27, 40, 10, 450, 0, 'gbp', 'succeeded',
   'pi_demo_card_alice', '4242', '2026-05-20 09:06:00+01'),

  (PC_CHARLIE_ID, CARD_ID, CHARLIE_ID, EC_CHARLIE_ID,
   500, 500, 27, 40, 10, 450, 0, 'gbp', 'succeeded',
   'pi_demo_card_charlie', '5678', '2026-05-20 09:23:00+01'),

  (PC_EDDIE_ID, CARD_ID, EDDIE_ID, EC_EDDIE_ID,
   500, 500, 27, 40, 10, 450, 0, 'gbp', 'succeeded',
   'pi_demo_card_eddie', '3333', '2026-05-20 10:12:00+01'),

  -- ── Donation payments ─────────────────────────────────────
  (PD_ALICE_ID, DONA_ID, ALICE_ID, ED_ALICE_ID,
   500, 500, 27, 40, 0, 460, 0, 'gbp', 'succeeded',
   'pi_demo_dona_alice', '4242', '2026-05-19 11:01:00+01'),

  (PD_BOB_ID, DONA_ID, BOB_ID, ED_BOB_ID,
   500, 500, 27, 40, 0, 460, 0, 'gbp', 'succeeded',
   'pi_demo_dona_bob', '1234', '2026-05-20 14:31:00+01'),

  (PD_CHARLIE_ID, DONA_ID, CHARLIE_ID, ED_CHARLIE_ID,
   500, 500, 27, 40, 0, 460, 0, 'gbp', 'succeeded',
   'pi_demo_dona_charlie', '5678', '2026-05-21 09:16:00+01'),

  (PD_DIANA_ID, DONA_ID, DIANA_ID, ED_DIANA_ID,
   500, 500, 27, 40, 0, 460, 0, 'gbp', 'succeeded',
   'pi_demo_dona_diana', '9999', '2026-05-22 10:01:00+01')

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 7. LINK ENTRIES ↔ PAYMENTS
-- ============================================================

UPDATE public.entries SET payment_id = PP_ALICE_ID   WHERE id = EP_ALICE_ID;
UPDATE public.entries SET payment_id = PP_BOB_ID      WHERE id = EP_BOB_ID;
UPDATE public.entries SET payment_id = PP_CHARLIE_ID  WHERE id = EP_CHARLIE_ID;
UPDATE public.entries SET payment_id = PP_DIANA_ID    WHERE id = EP_DIANA_ID;
UPDATE public.entries SET payment_id = PL_ALICE_ID    WHERE id = EL_ALICE_ID;
UPDATE public.entries SET payment_id = PL_BOB_ID      WHERE id = EL_BOB_ID;
UPDATE public.entries SET payment_id = PL_CHARLIE_ID  WHERE id = EL_CHARLIE_ID;
UPDATE public.entries SET payment_id = PL_DIANA_ID    WHERE id = EL_DIANA_ID;
UPDATE public.entries SET payment_id = PL_EDDIE_ID    WHERE id = EL_EDDIE_ID;
UPDATE public.entries SET payment_id = PC_ALICE_ID    WHERE id = EC_ALICE_ID;
UPDATE public.entries SET payment_id = PC_CHARLIE_ID  WHERE id = EC_CHARLIE_ID;
UPDATE public.entries SET payment_id = PC_EDDIE_ID    WHERE id = EC_EDDIE_ID;
-- EC_BOB_ID stays NULL (pending_payment)
UPDATE public.entries SET payment_id = PD_ALICE_ID    WHERE id = ED_ALICE_ID;
UPDATE public.entries SET payment_id = PD_BOB_ID      WHERE id = ED_BOB_ID;
UPDATE public.entries SET payment_id = PD_CHARLIE_ID  WHERE id = ED_CHARLIE_ID;
UPDATE public.entries SET payment_id = PD_DIANA_ID    WHERE id = ED_DIANA_ID;


-- ============================================================
-- 8. TEAM CARD SLOT ASSIGNMENTS
-- ============================================================
-- Set entry_id on taken/reserved slots.

UPDATE public.team_card_slots SET entry_id = EC_ALICE_ID,   assigned_at = '2026-05-20 09:06:00+01'
  WHERE competition_id = CARD_ID AND slot_number = 7;

UPDATE public.team_card_slots SET entry_id = EC_CHARLIE_ID, assigned_at = '2026-05-20 09:23:00+01'
  WHERE competition_id = CARD_ID AND slot_number = 12;

UPDATE public.team_card_slots SET entry_id = EC_EDDIE_ID,   assigned_at = '2026-05-20 10:12:00+01'
  WHERE competition_id = CARD_ID AND slot_number = 3;

-- Bob's slot reserved (pending_payment — no assigned_at yet)
UPDATE public.team_card_slots SET entry_id = EC_BOB_ID
  WHERE competition_id = CARD_ID AND slot_number = 15;


-- ============================================================
-- 9. PAYMENT LEDGER
-- ============================================================
-- Append-only ledger. One CREDIT row (entry gross) plus DEBIT rows
-- for each split component, per payment.

INSERT INTO public.payment_ledger (
  competition_id, club_id, user_id, payment_id, entry_id,
  ledger_type, direction, amount_pence, description
) VALUES

  -- ── Predictor — Alice ────────────────────────────────────
  (PRED_ID, HILLSIDE_ID, ALICE_ID, PP_ALICE_ID, EP_ALICE_ID, 'entry_gross',                'credit', 500, 'Entry fee — Predictor GW37'),
  (PRED_ID, HILLSIDE_ID, ALICE_ID, PP_ALICE_ID, EP_ALICE_ID, 'platform_service_fee',       'debit',   40, 'Platform service fee (8%)'),
  (PRED_ID, HILLSIDE_ID, ALICE_ID, PP_ALICE_ID, EP_ALICE_ID, 'prize_pool_allocation',      'debit',  250, 'Prize pool allocation (50%)'),
  (PRED_ID, HILLSIDE_ID, ALICE_ID, PP_ALICE_ID, EP_ALICE_ID, 'club_fundraising_amount',   'debit',  200, 'Club fundraising share (40%)'),
  (PRED_ID, HILLSIDE_ID, ALICE_ID, PP_ALICE_ID, EP_ALICE_ID, 'clubboost_weekly_contribution','debit', 10, 'Weekly Boost contribution (2%)'),

  -- ── Predictor — Bob ──────────────────────────────────────
  (PRED_ID, HILLSIDE_ID, BOB_ID, PP_BOB_ID, EP_BOB_ID, 'entry_gross',                'credit', 500, 'Entry fee — Predictor GW37'),
  (PRED_ID, HILLSIDE_ID, BOB_ID, PP_BOB_ID, EP_BOB_ID, 'platform_service_fee',       'debit',   40, 'Platform service fee (8%)'),
  (PRED_ID, HILLSIDE_ID, BOB_ID, PP_BOB_ID, EP_BOB_ID, 'prize_pool_allocation',      'debit',  250, 'Prize pool allocation (50%)'),
  (PRED_ID, HILLSIDE_ID, BOB_ID, PP_BOB_ID, EP_BOB_ID, 'club_fundraising_amount',   'debit',  200, 'Club fundraising share (40%)'),
  (PRED_ID, HILLSIDE_ID, BOB_ID, PP_BOB_ID, EP_BOB_ID, 'clubboost_weekly_contribution','debit', 10, 'Weekly Boost contribution (2%)'),

  -- ── Predictor — Charlie ───────────────────────────────────
  (PRED_ID, HILLSIDE_ID, CHARLIE_ID, PP_CHARLIE_ID, EP_CHARLIE_ID, 'entry_gross',                'credit', 500, 'Entry fee — Predictor GW37'),
  (PRED_ID, HILLSIDE_ID, CHARLIE_ID, PP_CHARLIE_ID, EP_CHARLIE_ID, 'platform_service_fee',       'debit',   40, 'Platform service fee (8%)'),
  (PRED_ID, HILLSIDE_ID, CHARLIE_ID, PP_CHARLIE_ID, EP_CHARLIE_ID, 'prize_pool_allocation',      'debit',  250, 'Prize pool allocation (50%)'),
  (PRED_ID, HILLSIDE_ID, CHARLIE_ID, PP_CHARLIE_ID, EP_CHARLIE_ID, 'club_fundraising_amount',   'debit',  200, 'Club fundraising share (40%)'),
  (PRED_ID, HILLSIDE_ID, CHARLIE_ID, PP_CHARLIE_ID, EP_CHARLIE_ID, 'clubboost_weekly_contribution','debit', 10, 'Weekly Boost contribution (2%)'),

  -- ── Predictor — Diana ─────────────────────────────────────
  (PRED_ID, HILLSIDE_ID, DIANA_ID, PP_DIANA_ID, EP_DIANA_ID, 'entry_gross',                'credit', 500, 'Entry fee — Predictor GW37'),
  (PRED_ID, HILLSIDE_ID, DIANA_ID, PP_DIANA_ID, EP_DIANA_ID, 'platform_service_fee',       'debit',   40, 'Platform service fee (8%)'),
  (PRED_ID, HILLSIDE_ID, DIANA_ID, PP_DIANA_ID, EP_DIANA_ID, 'prize_pool_allocation',      'debit',  250, 'Prize pool allocation (50%)'),
  (PRED_ID, HILLSIDE_ID, DIANA_ID, PP_DIANA_ID, EP_DIANA_ID, 'club_fundraising_amount',   'debit',  200, 'Club fundraising share (40%)'),
  (PRED_ID, HILLSIDE_ID, DIANA_ID, PP_DIANA_ID, EP_DIANA_ID, 'clubboost_weekly_contribution','debit', 10, 'Weekly Boost contribution (2%)'),

  -- ── Predictor settlement (prize paid, club share disbursed) ──
  -- Prize pot: 4 × 250p = 1000p → paid to Alice
  (PRED_ID, HILLSIDE_ID, ALICE_ID, NULL, EP_ALICE_ID, 'payout', 'debit', 1000, 'Prize payout to winner — Alice Thompson'),
  -- Club fundraising: 4 × 200p = 800p → paid to Hillside FC
  (PRED_ID, HILLSIDE_ID, NULL, NULL, NULL, 'payout', 'debit', 800, 'Club fundraising payout — Hillside FC'),

  -- ── LMS — Alice ───────────────────────────────────────────
  (LMS_ID, HILLSIDE_ID, ALICE_ID, PL_ALICE_ID, EL_ALICE_ID, 'entry_gross',                'credit', 1000, 'Entry fee — Last Man Standing'),
  (LMS_ID, HILLSIDE_ID, ALICE_ID, PL_ALICE_ID, EL_ALICE_ID, 'platform_service_fee',       'debit',    80, 'Platform service fee (8%)'),
  (LMS_ID, HILLSIDE_ID, ALICE_ID, PL_ALICE_ID, EL_ALICE_ID, 'prize_pool_allocation',      'debit',   600, 'Prize pool allocation (60%)'),
  (LMS_ID, HILLSIDE_ID, ALICE_ID, PL_ALICE_ID, EL_ALICE_ID, 'club_fundraising_amount',   'debit',   300, 'Club fundraising share (30%)'),
  (LMS_ID, HILLSIDE_ID, ALICE_ID, PL_ALICE_ID, EL_ALICE_ID, 'clubboost_weekly_contribution','debit',  20, 'Weekly Boost contribution (2%)'),

  -- ── LMS — Bob ─────────────────────────────────────────────
  (LMS_ID, HILLSIDE_ID, BOB_ID, PL_BOB_ID, EL_BOB_ID, 'entry_gross',                'credit', 1000, 'Entry fee — Last Man Standing'),
  (LMS_ID, HILLSIDE_ID, BOB_ID, PL_BOB_ID, EL_BOB_ID, 'platform_service_fee',       'debit',    80, 'Platform service fee (8%)'),
  (LMS_ID, HILLSIDE_ID, BOB_ID, PL_BOB_ID, EL_BOB_ID, 'prize_pool_allocation',      'debit',   600, 'Prize pool allocation (60%)'),
  (LMS_ID, HILLSIDE_ID, BOB_ID, PL_BOB_ID, EL_BOB_ID, 'club_fundraising_amount',   'debit',   300, 'Club fundraising share (30%)'),
  (LMS_ID, HILLSIDE_ID, BOB_ID, PL_BOB_ID, EL_BOB_ID, 'clubboost_weekly_contribution','debit',  20, 'Weekly Boost contribution (2%)'),

  -- ── LMS — Charlie ─────────────────────────────────────────
  (LMS_ID, HILLSIDE_ID, CHARLIE_ID, PL_CHARLIE_ID, EL_CHARLIE_ID, 'entry_gross',                'credit', 1000, 'Entry fee — Last Man Standing'),
  (LMS_ID, HILLSIDE_ID, CHARLIE_ID, PL_CHARLIE_ID, EL_CHARLIE_ID, 'platform_service_fee',       'debit',    80, 'Platform service fee (8%)'),
  (LMS_ID, HILLSIDE_ID, CHARLIE_ID, PL_CHARLIE_ID, EL_CHARLIE_ID, 'prize_pool_allocation',      'debit',   600, 'Prize pool allocation (60%)'),
  (LMS_ID, HILLSIDE_ID, CHARLIE_ID, PL_CHARLIE_ID, EL_CHARLIE_ID, 'club_fundraising_amount',   'debit',   300, 'Club fundraising share (30%)'),
  (LMS_ID, HILLSIDE_ID, CHARLIE_ID, PL_CHARLIE_ID, EL_CHARLIE_ID, 'clubboost_weekly_contribution','debit',  20, 'Weekly Boost contribution (2%)'),

  -- ── LMS — Diana ───────────────────────────────────────────
  (LMS_ID, HILLSIDE_ID, DIANA_ID, PL_DIANA_ID, EL_DIANA_ID, 'entry_gross',                'credit', 1000, 'Entry fee — Last Man Standing'),
  (LMS_ID, HILLSIDE_ID, DIANA_ID, PL_DIANA_ID, EL_DIANA_ID, 'platform_service_fee',       'debit',    80, 'Platform service fee (8%)'),
  (LMS_ID, HILLSIDE_ID, DIANA_ID, PL_DIANA_ID, EL_DIANA_ID, 'prize_pool_allocation',      'debit',   600, 'Prize pool allocation (60%)'),
  (LMS_ID, HILLSIDE_ID, DIANA_ID, PL_DIANA_ID, EL_DIANA_ID, 'club_fundraising_amount',   'debit',   300, 'Club fundraising share (30%)'),
  (LMS_ID, HILLSIDE_ID, DIANA_ID, PL_DIANA_ID, EL_DIANA_ID, 'clubboost_weekly_contribution','debit',  20, 'Weekly Boost contribution (2%)'),

  -- ── LMS — Eddie ───────────────────────────────────────────
  (LMS_ID, HILLSIDE_ID, EDDIE_ID, PL_EDDIE_ID, EL_EDDIE_ID, 'entry_gross',                'credit', 1000, 'Entry fee — Last Man Standing'),
  (LMS_ID, HILLSIDE_ID, EDDIE_ID, PL_EDDIE_ID, EL_EDDIE_ID, 'platform_service_fee',       'debit',    80, 'Platform service fee (8%)'),
  (LMS_ID, HILLSIDE_ID, EDDIE_ID, PL_EDDIE_ID, EL_EDDIE_ID, 'prize_pool_allocation',      'debit',   600, 'Prize pool allocation (60%)'),
  (LMS_ID, HILLSIDE_ID, EDDIE_ID, PL_EDDIE_ID, EL_EDDIE_ID, 'club_fundraising_amount',   'debit',   300, 'Club fundraising share (30%)'),
  (LMS_ID, HILLSIDE_ID, EDDIE_ID, PL_EDDIE_ID, EL_EDDIE_ID, 'clubboost_weekly_contribution','debit',  20, 'Weekly Boost contribution (2%)'),

  -- ── Team Card — Alice ──────────────────────────────────────
  (CARD_ID, HILLSIDE_ID, ALICE_ID, PC_ALICE_ID, EC_ALICE_ID, 'entry_gross',               'credit', 500, 'Entry fee — Team Card Draw'),
  (CARD_ID, HILLSIDE_ID, ALICE_ID, PC_ALICE_ID, EC_ALICE_ID, 'platform_service_fee',      'debit',   40, 'Platform service fee (8%)'),
  (CARD_ID, HILLSIDE_ID, ALICE_ID, PC_ALICE_ID, EC_ALICE_ID, 'club_fundraising_amount',  'debit',  450, 'Club fundraising share (90%)'),
  (CARD_ID, HILLSIDE_ID, ALICE_ID, PC_ALICE_ID, EC_ALICE_ID, 'clubboost_weekly_contribution','debit', 10, 'Weekly Boost contribution (2%)'),

  -- ── Team Card — Charlie ────────────────────────────────────
  (CARD_ID, HILLSIDE_ID, CHARLIE_ID, PC_CHARLIE_ID, EC_CHARLIE_ID, 'entry_gross',               'credit', 500, 'Entry fee — Team Card Draw'),
  (CARD_ID, HILLSIDE_ID, CHARLIE_ID, PC_CHARLIE_ID, EC_CHARLIE_ID, 'platform_service_fee',      'debit',   40, 'Platform service fee (8%)'),
  (CARD_ID, HILLSIDE_ID, CHARLIE_ID, PC_CHARLIE_ID, EC_CHARLIE_ID, 'club_fundraising_amount',  'debit',  450, 'Club fundraising share (90%)'),
  (CARD_ID, HILLSIDE_ID, CHARLIE_ID, PC_CHARLIE_ID, EC_CHARLIE_ID, 'clubboost_weekly_contribution','debit', 10, 'Weekly Boost contribution (2%)'),

  -- ── Team Card — Eddie ──────────────────────────────────────
  (CARD_ID, HILLSIDE_ID, EDDIE_ID, PC_EDDIE_ID, EC_EDDIE_ID, 'entry_gross',               'credit', 500, 'Entry fee — Team Card Draw'),
  (CARD_ID, HILLSIDE_ID, EDDIE_ID, PC_EDDIE_ID, EC_EDDIE_ID, 'platform_service_fee',      'debit',   40, 'Platform service fee (8%)'),
  (CARD_ID, HILLSIDE_ID, EDDIE_ID, PC_EDDIE_ID, EC_EDDIE_ID, 'club_fundraising_amount',  'debit',  450, 'Club fundraising share (90%)'),
  (CARD_ID, HILLSIDE_ID, EDDIE_ID, PC_EDDIE_ID, EC_EDDIE_ID, 'clubboost_weekly_contribution','debit', 10, 'Weekly Boost contribution (2%)'),

  -- ── Donation — Alice ───────────────────────────────────────
  (DONA_ID, HILLSIDE_ID, ALICE_ID, PD_ALICE_ID, ED_ALICE_ID, 'donation_gross',            'credit', 500, 'Donation — Changing Rooms Fund'),
  (DONA_ID, HILLSIDE_ID, ALICE_ID, PD_ALICE_ID, ED_ALICE_ID, 'platform_service_fee',      'debit',   40, 'Platform service fee (8%)'),
  (DONA_ID, HILLSIDE_ID, ALICE_ID, PD_ALICE_ID, ED_ALICE_ID, 'club_fundraising_amount',  'debit',  460, 'Club fundraising share (92%)'),

  -- ── Donation — Bob ─────────────────────────────────────────
  (DONA_ID, HILLSIDE_ID, BOB_ID, PD_BOB_ID, ED_BOB_ID, 'donation_gross',            'credit', 500, 'Donation — Changing Rooms Fund'),
  (DONA_ID, HILLSIDE_ID, BOB_ID, PD_BOB_ID, ED_BOB_ID, 'platform_service_fee',      'debit',   40, 'Platform service fee (8%)'),
  (DONA_ID, HILLSIDE_ID, BOB_ID, PD_BOB_ID, ED_BOB_ID, 'club_fundraising_amount',  'debit',  460, 'Club fundraising share (92%)'),

  -- ── Donation — Charlie ─────────────────────────────────────
  (DONA_ID, HILLSIDE_ID, CHARLIE_ID, PD_CHARLIE_ID, ED_CHARLIE_ID, 'donation_gross',            'credit', 500, 'Donation — Changing Rooms Fund'),
  (DONA_ID, HILLSIDE_ID, CHARLIE_ID, PD_CHARLIE_ID, ED_CHARLIE_ID, 'platform_service_fee',      'debit',   40, 'Platform service fee (8%)'),
  (DONA_ID, HILLSIDE_ID, CHARLIE_ID, PD_CHARLIE_ID, ED_CHARLIE_ID, 'club_fundraising_amount',  'debit',  460, 'Club fundraising share (92%)'),

  -- ── Donation — Diana ───────────────────────────────────────
  (DONA_ID, HILLSIDE_ID, DIANA_ID, PD_DIANA_ID, ED_DIANA_ID, 'donation_gross',            'credit', 500, 'Donation — Changing Rooms Fund'),
  (DONA_ID, HILLSIDE_ID, DIANA_ID, PD_DIANA_ID, ED_DIANA_ID, 'platform_service_fee',      'debit',   40, 'Platform service fee (8%)'),
  (DONA_ID, HILLSIDE_ID, DIANA_ID, PD_DIANA_ID, ED_DIANA_ID, 'club_fundraising_amount',  'debit',  460, 'Club fundraising share (92%)')
;


-- ============================================================
-- 10. PLATFORM FEES
-- ============================================================

INSERT INTO public.platform_fees (
  competition_id, payment_id, club_id, period_month, fee_amount_pence, status
) VALUES
  -- Predictor (4 × 40p = 160p)
  (PRED_ID, PP_ALICE_ID,   HILLSIDE_ID, '2026-05', 40, 'captured'),
  (PRED_ID, PP_BOB_ID,     HILLSIDE_ID, '2026-05', 40, 'captured'),
  (PRED_ID, PP_CHARLIE_ID, HILLSIDE_ID, '2026-05', 40, 'captured'),
  (PRED_ID, PP_DIANA_ID,   HILLSIDE_ID, '2026-05', 40, 'captured'),
  -- LMS (5 × 80p = 400p)
  (LMS_ID, PL_ALICE_ID,   HILLSIDE_ID, '2026-05', 80, 'captured'),
  (LMS_ID, PL_BOB_ID,     HILLSIDE_ID, '2026-05', 80, 'captured'),
  (LMS_ID, PL_CHARLIE_ID, HILLSIDE_ID, '2026-05', 80, 'captured'),
  (LMS_ID, PL_DIANA_ID,   HILLSIDE_ID, '2026-05', 80, 'captured'),
  (LMS_ID, PL_EDDIE_ID,   HILLSIDE_ID, '2026-05', 80, 'captured'),
  -- Team Card (3 × 40p = 120p)
  (CARD_ID, PC_ALICE_ID,   HILLSIDE_ID, '2026-05', 40, 'captured'),
  (CARD_ID, PC_CHARLIE_ID, HILLSIDE_ID, '2026-05', 40, 'captured'),
  (CARD_ID, PC_EDDIE_ID,   HILLSIDE_ID, '2026-05', 40, 'captured'),
  -- Donation (4 × 40p = 160p)
  (DONA_ID, PD_ALICE_ID,   HILLSIDE_ID, '2026-05', 40, 'captured'),
  (DONA_ID, PD_BOB_ID,     HILLSIDE_ID, '2026-05', 40, 'captured'),
  (DONA_ID, PD_CHARLIE_ID, HILLSIDE_ID, '2026-05', 40, 'captured'),
  (DONA_ID, PD_DIANA_ID,   HILLSIDE_ID, '2026-05', 40, 'captured')
ON CONFLICT (payment_id) DO NOTHING;


-- ============================================================
-- 11. PAYOUTS  (predictor settled; LMS/card/donation still pending)
-- ============================================================

INSERT INTO public.payouts (
  id, competition_id, club_id, payout_type, recipient_user_id,
  amount_pence, status, payment_reference, notes, initiated_by, paid_at
) VALUES
  -- Alice wins £10.00 (4 entries × 250p prize allocation)
  (POUT_PRIZE_ID, PRED_ID, HILLSIDE_ID, 'prize_winner', ALICE_ID,
   1000, 'paid',
   'HILL-PRED-GW37-PRIZE',
   'Prize for Predictor GW37. Alice scored 6/6 — perfect score!',
   ADMIN_ID, '2026-05-21 14:00:00+01'),

  -- Hillside FC receives £8.00 club fundraising share
  (POUT_CLUB_ID, PRED_ID, HILLSIDE_ID, 'club_fundraising', NULL,
   800, 'paid',
   'HILL-PRED-GW37-CLUB',
   'Club fundraising share from Predictor GW37 (40% of 4 × £5 = £8.00)',
   ADMIN_ID, '2026-05-21 14:00:00+01')

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 12. WEEKLY BOOST PERIODS & CONTRIBUTIONS
-- ============================================================

-- Period 1: 2026-05-05 to 2026-05-11 — awarded to Hillside FC
INSERT INTO public.clubboost_weekly_boost_periods (
  id, period_name, period_start, period_end,
  total_pool_pence, status, closed_at, awarded_at, created_by
) VALUES (
  BOOST_P1_ID,
  'Week of 5 May 2026',
  '2026-05-05', '2026-05-11',
  2500,          -- £25.00 total (140p from comps + 2360p admin topup)
  'awarded',
  '2026-05-12 09:00:00+01',
  '2026-05-12 10:00:00+01',
  ADMIN_ID
) ON CONFLICT (id) DO NOTHING;

-- Period 2: 2026-05-19 to 2026-05-25 — active (current week)
INSERT INTO public.clubboost_weekly_boost_periods (
  id, period_name, period_start, period_end,
  total_pool_pence, status, created_by
) VALUES (
  BOOST_P2_ID,
  'Week of 19 May 2026',
  '2026-05-19', '2026-05-25',
  2030,          -- £20.30 (30p from team card entries + 2000p admin topup)
  'active',
  ADMIN_ID
) ON CONFLICT (id) DO NOTHING;

-- Clear any existing demo boost contributions so the seed is idempotent.
DELETE FROM public.clubboost_weekly_boost_contributions
  WHERE period_id IN (BOOST_P1_ID, BOOST_P2_ID);

-- Period 1 contributions: LMS payments (May 5-7) + Predictor (May 8)
INSERT INTO public.clubboost_weekly_boost_contributions (
  period_id, payment_id, entry_id, club_id, competition_id,
  amount_pence, source_type
) VALUES
  (BOOST_P1_ID, PL_ALICE_ID,   EL_ALICE_ID,   HILLSIDE_ID, LMS_ID,  20, 'competition_payment'),
  (BOOST_P1_ID, PL_BOB_ID,     EL_BOB_ID,     HILLSIDE_ID, LMS_ID,  20, 'competition_payment'),
  (BOOST_P1_ID, PL_CHARLIE_ID, EL_CHARLIE_ID, HILLSIDE_ID, LMS_ID,  20, 'competition_payment'),
  (BOOST_P1_ID, PL_DIANA_ID,   EL_DIANA_ID,   HILLSIDE_ID, LMS_ID,  20, 'competition_payment'),
  (BOOST_P1_ID, PL_EDDIE_ID,   EL_EDDIE_ID,   HILLSIDE_ID, LMS_ID,  20, 'competition_payment'),
  (BOOST_P1_ID, PP_ALICE_ID,   EP_ALICE_ID,   HILLSIDE_ID, PRED_ID, 10, 'competition_payment'),
  (BOOST_P1_ID, PP_BOB_ID,     EP_BOB_ID,     HILLSIDE_ID, PRED_ID, 10, 'competition_payment'),
  (BOOST_P1_ID, PP_CHARLIE_ID, EP_CHARLIE_ID, HILLSIDE_ID, PRED_ID, 10, 'competition_payment'),
  (BOOST_P1_ID, PP_DIANA_ID,   EP_DIANA_ID,   HILLSIDE_ID, PRED_ID, 10, 'competition_payment'),
  -- Admin top-up to bring total to £25.00
  (BOOST_P1_ID, NULL, NULL, NULL, NULL, 2360, 'admin_topup')
;

-- Period 2 contributions: Team Card payments (May 20) + admin top-up
INSERT INTO public.clubboost_weekly_boost_contributions (
  period_id, payment_id, entry_id, club_id, competition_id,
  amount_pence, source_type
) VALUES
  (BOOST_P2_ID, PC_ALICE_ID,   EC_ALICE_ID,   HILLSIDE_ID, CARD_ID, 10, 'competition_payment'),
  (BOOST_P2_ID, PC_CHARLIE_ID, EC_CHARLIE_ID, HILLSIDE_ID, CARD_ID, 10, 'competition_payment'),
  (BOOST_P2_ID, PC_EDDIE_ID,   EC_EDDIE_ID,   HILLSIDE_ID, CARD_ID, 10, 'competition_payment'),
  -- Admin top-up
  (BOOST_P2_ID, NULL, NULL, NULL, NULL, 2000, 'admin_topup')
;

-- Eligibility for Period 2 (Hillside FC is enrolled and eligible)
INSERT INTO public.boost_eligible_clubs (
  period_id, club_id, is_eligible,
  eligibility_reason, is_manually_overridden
) VALUES (
  BOOST_P2_ID, HILLSIDE_ID, TRUE,
  'Club has ≥1 active competition with boost contributions this period',
  FALSE
) ON CONFLICT (period_id, club_id) DO NOTHING;

-- Weekly Boost Award — Period 1 → Hillside FC (£25.00)
INSERT INTO public.clubboost_weekly_boost_awards (
  id, period_id, club_id, awarded_by,
  amount_pence, status, reason, is_public, published_at,
  published_summary, awarded_at
) VALUES (
  BOOST_A1_ID, BOOST_P1_ID, HILLSIDE_ID, ADMIN_ID,
  2500, 'paid',
  'Hillside FC was the only enrolled club with active competitions this week. '
  'They ran 2 live fundraisers with 9 paying entries.',
  TRUE,
  '2026-05-12 10:00:00+01',
  'Hillside FC won the ClubBoost Weekly Boost for the week of 5 May — £25 added to their fundraising total!',
  '2026-05-12 10:00:00+01'
) ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 13. AUDIT LOG
-- ============================================================

INSERT INTO public.audit_log (
  actor_id, club_id, entity_type, entity_id, action, after_state
) VALUES
  -- Club lifecycle
  (CADMIN1_ID, HILLSIDE_ID,  'club', HILLSIDE_ID,  'club_created',
   '{"name":"Hillside FC","status":"pending"}'::jsonb),
  (ADMIN_ID,   HILLSIDE_ID,  'club', HILLSIDE_ID,  'club_approved',
   '{"status":"approved"}'::jsonb),
  (CADMIN2_ID, NORTHGATE_ID, 'club', NORTHGATE_ID, 'club_created',
   '{"name":"Northgate United","status":"pending"}'::jsonb),
  (CADMIN3_ID, RIVERSIDE_ID, 'club', RIVERSIDE_ID, 'club_created',
   '{"name":"Riverside Sports FC","status":"pending"}'::jsonb),
  (ADMIN_ID,   RIVERSIDE_ID, 'club', RIVERSIDE_ID, 'club_approved',
   '{"status":"approved"}'::jsonb),
  (ADMIN_ID,   RIVERSIDE_ID, 'club', RIVERSIDE_ID, 'club_suspended',
   '{"status":"suspended","reason":"Repeated non-payment of prizes. Suspended pending investigation."}'::jsonb),

  -- Predictor lifecycle
  (CADMIN1_ID, HILLSIDE_ID, 'competition', PRED_ID, 'competition_created',
   '{"title":"Premier League Predictor — Gameweek 37","type":"predictor"}'::jsonb),
  (CADMIN1_ID, HILLSIDE_ID, 'competition', PRED_ID, 'competition_published',
   '{"status":"open"}'::jsonb),
  (ADMIN_ID,   HILLSIDE_ID, 'competition', PRED_ID, 'competition_closed',
   '{"status":"closed"}'::jsonb),
  (ADMIN_ID,   HILLSIDE_ID, 'competition', PRED_ID, 'competition_settled',
   '{"status":"settled","winner_entry_id":"00000005-0001-4000-8000-000000000000"}'::jsonb),

  -- LMS lifecycle
  (CADMIN1_ID, HILLSIDE_ID, 'competition', LMS_ID, 'competition_created',
   '{"title":"Last Man Standing — 2025/26 Season","type":"last_man_standing"}'::jsonb),
  (CADMIN1_ID, HILLSIDE_ID, 'competition', LMS_ID, 'competition_published',
   '{"status":"open"}'::jsonb),

  -- Payments (sample)
  (NULL, HILLSIDE_ID, 'payment', PP_ALICE_ID, 'payment_succeeded',
   '{"amount_pence":500,"user":"Alice Thompson"}'::jsonb),
  (NULL, HILLSIDE_ID, 'payment', PL_ALICE_ID, 'payment_succeeded',
   '{"amount_pence":1000,"user":"Alice Thompson"}'::jsonb),

  -- Payout
  (ADMIN_ID, HILLSIDE_ID, 'payout', POUT_PRIZE_ID, 'payout_paid',
   '{"amount_pence":1000,"recipient":"Alice Thompson","reference":"HILL-PRED-GW37-PRIZE"}'::jsonb),
  (ADMIN_ID, HILLSIDE_ID, 'payout', POUT_CLUB_ID,  'payout_paid',
   '{"amount_pence":800,"recipient":"Hillside FC","reference":"HILL-PRED-GW37-CLUB"}'::jsonb),

  -- Weekly Boost
  (ADMIN_ID, HILLSIDE_ID, 'weekly_boost', BOOST_A1_ID, 'boost_awarded',
   '{"period":"Week of 5 May 2026","amount_pence":2500,"club":"Hillside FC"}'::jsonb)
;

END $$;

-- ============================================================
-- VERIFICATION QUERIES  (run after seeding to sanity-check)
-- ============================================================
-- SELECT count(*) FROM auth.users WHERE email LIKE '%demo%' OR email LIKE '%clubboost%';
-- SELECT name, status FROM public.clubs ORDER BY name;
-- SELECT title, status, type FROM public.competitions ORDER BY created_at;
-- SELECT count(*) FROM public.entries;
-- SELECT count(*) FROM public.payments WHERE status = 'succeeded';
-- SELECT count(*) FROM public.payment_ledger;
-- SELECT period_name, status, total_pool_pence FROM public.clubboost_weekly_boost_periods;
