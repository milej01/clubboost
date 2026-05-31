# ClubBoost Demo Guide

A complete demo environment with realistic grassroots football data, covering every
user role, competition type, and financial flow in the platform.

---

## Quick start

```bash
# Full reset — drops DB, re-applies all migrations, loads demo data
./supabase/demo-reset.sh

# Re-seed only (keeps schema, replaces data)
./supabase/demo-reset.sh --seed-only

# Or load the seed manually into any Postgres instance
psql $DATABASE_URL -f supabase/demo-seed.sql
```

After seeding, open the app at **http://localhost:3000** and log in with any account below.

---

## Demo credentials

> **All accounts share the same password: `Demo1234!`**

### Platform Admin

| Field | Value |
|-------|-------|
| Email | `admin@clubboost.demo` |
| Password | `Demo1234!` |
| What you can do | Approve / reject / suspend clubs, view all competitions and payments, manage Weekly Boost periods and awards, settle competitions, issue payouts |

### Club Admins

| Club | Email | Status |
|------|-------|--------|
| Hillside FC | `secretary@hillside-fc.demo` | **Approved** — Stripe onboarded, Weekly Boost enrolled |
| Northgate United | `admin@northgate-united.demo` | **Pending** — awaiting admin approval |
| Riverside Sports | `manager@riverside-sports.demo` | **Suspended** — non-payment of prizes |

### Participants

| Name | Email | Activity |
|------|-------|----------|
| Alice Thompson | `alice@demo.clubboost` | Predictor winner, LMS active (survivor), Team Card slot 7, Donation |
| Bob Hargreaves | `bob@demo.clubboost` | Predictor (4/6), LMS eliminated round 2, Team Card slot reserved (pending payment), Donation |
| Charlie Osei | `charlie@demo.clubboost` | Predictor (3/6), LMS eliminated round 1, Team Card slot 12, Donation |
| Diana Patel | `diana@demo.clubboost` | Predictor (4/6), LMS eliminated round 1, Donation |
| Eddie Mwangi | `eddie@demo.clubboost` | LMS active (survivor), Team Card slot 3 |

---

## What's in the demo

### Clubs

| Club | Status | Notes |
|------|--------|-------|
| **Hillside FC** | Approved | Stripe onboarded (`acct_demo_hillside_stripe`), Weekly Boost enrolled. Runs all 4 demo competitions. |
| **Northgate United** | Pending | Applied 3 days ago. No competitions yet. Demonstrates the approval queue. |
| **Riverside Sports FC** | Suspended | Stripe onboarded but suspended for non-payment of prizes. Demonstrates the suspension flow. |

### Competitions (all under Hillside FC)

#### 1. Premier League Predictor — Gameweek 37 *(settled)*

| Field | Value |
|-------|-------|
| Type | Predictor (6 fixtures, H/D/A) |
| Status | **Settled** |
| Entry fee | £5.00 |
| Prize | 50% of pot → £10.00 |
| Club share | 40% → £8.00 |
| Platform fee | 8% |
| Weekly Boost | 2% |
| Entries | 4 (Alice, Bob, Charlie, Diana) |

**Fixtures & results (Gameweek 37):**

| # | Home | Away | Result |
|---|------|------|--------|
| 1 | Arsenal | Man Utd | **H** (Arsenal won) |
| 2 | Liverpool | Wolves | **H** (Liverpool won) |
| 3 | Chelsea | Tottenham | **D** (Draw) |
| 4 | Newcastle | Bournemouth | **A** (Bournemouth won) |
| 5 | Aston Villa | Brighton | **H** (Villa won) |
| 6 | Everton | Fulham | **H** (Everton won) |

**Scores:**

| Entrant | Picks | Score | Result |
|---------|-------|-------|--------|
| Alice | H H D A H H | **6/6** | 🏆 **Winner — £10.00** |
| Bob | H H H A D H | 4/6 | Runner-up |
| Diana | H D D A H A | 4/6 | 4th (tied with Bob; higher entry number) |
| Charlie | D H D H H A | 3/6 | 4th |

---

#### 2. Last Man Standing — 2025/26 Season *(open, round 4)*

| Field | Value |
|-------|-------|
| Type | Last Man Standing |
| Status | **Open** — round 4 in progress |
| Entry fee | £10.00 |
| Prize | 60% of pot → £30.00 (if settled now) |
| Club share | 30% |
| Platform fee | 8% |
| Entries | 5 (Alice, Bob, Charlie, Diana, Eddie) |
| Active | 2 (Alice, Eddie) |
| Eliminated | 3 (Bob round 2, Charlie & Diana round 1) |

**Round history:**

| Round | Event | Winner teams | Eliminated |
|-------|-------|-------------|------------|
| R1 (GW34) | Arsenal 3-0 Wolves | Arsenal | Charlie (Man Utd), Diana (Newcastle) |
| R2 (GW35) | Liverpool 3-0 Southampton | Liverpool | Bob (Crystal Palace) |
| R3 (GW36) | Aston Villa 2-1 West Ham | Aston Villa | — |
| R4 (GW37) | *In progress* | — | — |

**Current round picks:** Alice → Tottenham, Eddie → Chelsea

---

#### 3. End of Season Team Card Draw *(open)*

| Field | Value |
|-------|-------|
| Type | Team Card (20 slots) |
| Status | **Open** |
| Entry fee | £5.00 per slot |
| Prize | £25 club shop voucher (description type) |
| Club share | 90% |
| Slots taken | 4 of 20 |

**Slot status:**

| Slot | Team | Status | Holder |
|------|------|--------|--------|
| 3 | Bournemouth | ✅ Taken | Eddie |
| 7 | Crystal Palace | ✅ Taken | Alice |
| 12 | Liverpool | ✅ Taken | Charlie |
| 15 | Newcastle | 🟡 Reserved | Bob (pending payment) |
| 1,2,4–6,8–11,13,14,16–20 | Various | ⬜ Available | — |

---

#### 4. New Changing Rooms Fund 2026 *(open, donation)*

| Field | Value |
|-------|-------|
| Type | Donation fundraiser |
| Status | **Open** |
| Minimum donation | £5.00 |
| Target | £1,000 |
| Raised so far | £20.00 (4 donations) |
| Club share | 92% |
| Platform fee | 8% |
| Progress | 2% of target |

---

### Weekly Boost

| Period | Dates | Status | Pool | Club |
|--------|-------|--------|------|------|
| Week of 5 May | 2026-05-05 – 2026-05-11 | **Awarded** | £25.00 | Hillside FC ✅ |
| Week of 19 May | 2026-05-19 – 2026-05-25 | **Active** | £20.30 | — |

Period 1 pool breakdown:
- 5 LMS entries × 20p = £1.00
- 4 Predictor entries × 10p = £0.40
- Admin top-up = £23.60
- **Total: £25.00 → awarded to Hillside FC**

Period 2 pool (so far):
- 3 Team Card entries × 10p = £0.30
- Admin top-up = £20.00
- **Total: £20.30**

---

### Financial summary (as of seed)

| Item | Amount |
|------|--------|
| Total gross payments | **£85.00** (17 paid entries) |
| Platform fees captured | **£8.40** |
| Prize paid (predictor) | **£10.00** (Alice) |
| Club fundraising paid (predictor) | **£8.00** (Hillside FC) |
| LMS prize pool (live) | **£30.00** (awaiting settlement) |
| Team Card club share (live) | **£13.50** (awaiting settlement) |
| Donation club share (live) | **£18.40** (ongoing) |
| Weekly Boost awarded | **£25.00** (Period 1 → Hillside) |

---

## Public pages you can view without logging in

- `/c/hillside-fc` — Hillside FC public fundraiser page (competition list)
- `/c/hillside-fc/00000002-0002-4000-8000-000000000000` — LMS competition page
- `/c/hillside-fc/00000002-0003-4000-8000-000000000000` — Team Card page (see slot grid)
- `/c/hillside-fc/00000002-0004-4000-8000-000000000000` — Donation page (progress bar)

---

## Resetting to a clean state

```bash
# Option 1: Full wipe and reseed (recommended — takes ~30 seconds)
./supabase/demo-reset.sh

# Option 2: Reseed without dropping tables
./supabase/demo-reset.sh --seed-only

# Option 3: Remote / staging database
psql "$STAGING_DATABASE_URL" -f supabase/demo-seed.sql
# Note: seed inserts auth.users directly — only works with service-role access.
# On Supabase Cloud, use the SQL editor (project settings → SQL editor)
# or the service role connection string.
```

### Removing demo data only (without full reset)

If you want to clear just the demo rows without dropping the schema:

```sql
-- Run in SQL editor or psql as service role
DELETE FROM auth.users
WHERE email IN (
  'admin@clubboost.demo',
  'secretary@hillside-fc.demo',
  'admin@northgate-united.demo',
  'manager@riverside-sports.demo',
  'alice@demo.clubboost',
  'bob@demo.clubboost',
  'charlie@demo.clubboost',
  'diana@demo.clubboost',
  'eddie@demo.clubboost'
);
-- Cascade deletes will clean up profiles, entries, payments, etc.
-- Club and competition rows reference profiles (created_by),
-- so delete those manually first if needed.
```

---

## Applying the seed to a remote Supabase project

1. Open your project's **SQL Editor** in the Supabase dashboard.
2. Paste the contents of `supabase/demo-seed.sql`.
3. Run the query (it uses `DO $$ ... END $$` so it's a single statement).

Or via the service-role connection string:

```bash
psql "postgresql://postgres:[YOUR-SERVICE-KEY]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/demo-seed.sql
```

> **Note:** The seed inserts directly into `auth.users`. This requires service-role access.
> Never use the anon key for this — it won't have permission.

---

## UUID reference (for URL construction)

| Entity | ID |
|--------|----|
| Hillside FC | `00000001-0001-4000-8000-000000000000` |
| Predictor competition | `00000002-0001-4000-8000-000000000000` |
| LMS competition | `00000002-0002-4000-8000-000000000000` |
| Team Card competition | `00000002-0003-4000-8000-000000000000` |
| Donation competition | `00000002-0004-4000-8000-000000000000` |
| Boost Period 1 | `00000009-0001-4000-8000-000000000000` |
| Boost Period 2 | `00000009-0002-4000-8000-000000000000` |
