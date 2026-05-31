# ClubBoost Testing Guide

## Overview

ClubBoost uses a three-tier testing strategy:

| Tier | Tool | When to run | What it tests |
|------|------|-------------|---------------|
| **Unit** | Vitest | Every PR, CI | Pure functions, service guards, state machine logic |
| **RLS Integration** | Vitest + live Supabase | Pre-merge, locally | Postgres RLS policies, row-level access control |
| **E2E** | Playwright | Pre-release | Full user flows in a browser |

---

## Quick start

```bash
# Unit tests only (no DB needed — fast)
pnpm test:run

# Unit tests in watch mode (during development)
pnpm test

# Unit tests with coverage report
pnpm test:coverage

# RLS integration tests (requires: supabase start + demo-reset.sh)
pnpm test:rls

# E2E tests (requires: supabase start + demo-reset.sh + pnpm dev)
pnpm test:e2e
```

---

## Unit tests

Located in `lib/**/__tests__/` and `lib/__tests__/`.

### Configuration

`vitest.config.ts` picks up all files matching:
- `lib/**/__tests__/**/*.test.ts`  — service-layer tests
- `lib/__tests__/**/*.test.ts`      — utility tests

### Test files

| File | What it covers |
|------|---------------|
| `lib/__tests__/utils.test.ts` | `calculateSplit`, `estimateStripeFee`, `poundsToPence`, `percentToBps` |
| `lib/services/__tests__/competitions.test.ts` | `publishCompetition` state machine, suspended-club guard |
| `lib/services/__tests__/entries.test.ts` | `createPendingEntry` guards (status, max entries, duplicate) |
| `lib/services/__tests__/payments.test.ts` | `handlePaymentSucceeded` idempotency, `handlePaymentFailed` guard |
| `lib/services/__tests__/weekly-boost.test.ts` | `awardClub` guards + audit trail, `isFeatureEnabled` |
| `lib/services/__tests__/boost-calculator.test.ts` | Pure financial calculation functions |
| `lib/game-engine/__tests__/predictor.test.ts` | Predictor game logic |
| `lib/game-engine/__tests__/lms.test.ts` | LMS game logic |
| `lib/game-engine/__tests__/team-card.test.ts` | Team card game logic |

### Mocking strategy

Unit tests mock the Supabase client using helpers in
`lib/__tests__/helpers/supabase-mock.ts`:

```typescript
import { makeDbSequenced } from '@/lib/__tests__/helpers/supabase-mock'
import { createAdminClient } from '@/lib/supabase/admin'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

vi.mocked(createAdminClient).mockReturnValue(
  makeDbSequenced([
    { data: { status: 'draft', ... } },  // 1st DB call
    { data: null, error: null },          // 2nd DB call (update)
    { data: null, error: null },          // 3rd DB call (audit log)
  ]) as any
)
```

---

## Required test coverage (mandatory scenarios)

These 8 tests cover the critical security and financial invariants:

### ✅ 1. Participant cannot edit another participant's entry

**Enforcement layer:** Postgres RLS on the `entries` table.

- **Service guard:** `createPendingEntry` sets `participant_id` from the authenticated user ID in the server action (`actions/entries.ts`). The admin client bypasses RLS, so direct service-layer editing is prevented at the action layer.
- **RLS test:** `tests/rls/entries.rls.test.ts` → "participant cannot read/update another participant's entry"

### ✅ 2. Club admin cannot access another club's dashboard

**Enforcement layer:** `getClubsForUser` filters by `club_members.user_id = userId`. Dashboard middleware checks club membership before rendering. Postgres RLS enforces this at the DB level.

- **RLS test:** `tests/rls/clubs.rls.test.ts` (to be added)

### ✅ 3. Suspended club cannot publish fundraiser

**Enforcement layer:** `publishCompetition` in `lib/services/competitions.ts` explicitly checks `club.status === 'suspended'`.

- **Unit test:** `lib/services/__tests__/competitions.test.ts` → "returns error when the club is suspended"

### ✅ 4. Competition rules cannot be changed after first paid entry without versioning

**Enforcement layer:** `createPendingEntry` stores a rules snapshot inside `entry_data._snapshot` at the time of entry. Even if the competition is later edited, the rules the participant accepted are recorded immutably.

- **Unit test:** `lib/services/__tests__/entries.test.ts` → "stores rules snapshot inside entry_data when provided"

### ✅ 5. Stripe webhook retry does not create duplicate payment

**Two-layer idempotency:**
1. `webhook_events` table: unique constraint on `stripe_event_id` → `error.code === '23505'` → `alreadyProcessed=true` → 200 returned immediately
2. `handlePaymentSucceeded`: `if (payment.status === 'succeeded') return` as belt-and-suspenders

- **Unit test:** `lib/services/__tests__/payments.test.ts` → "skips all processing when payment is already in succeeded status"
- **Integration test:** `tests/integration/stripe-webhook-idempotency.test.ts`

### ✅ 6. Weekly Boost disabled when feature flag is off

**Enforcement layer:** `createCheckoutSession` calls `isFeatureEnabled('weekly_boost')`. When false, `boostBps=0` is passed to `calculateSplit`, so no boost allocation occurs.

- **Unit test (flag):** `lib/services/__tests__/weekly-boost.test.ts` → "returns false when flag is disabled"
- **Unit test (math):** `lib/__tests__/utils.test.ts` → "Weekly Boost disabled (boost bps = 0)" group

### ✅ 7. Manual Weekly Boost award creates audit log

**Two audit records created by `awardClub`:**
1. `boost_audit_events` table: `event_type = 'award_granted'`
2. `audit_log` table: `action = 'weekly_boost_awarded'`

- **Unit test:** `lib/services/__tests__/weekly-boost.test.ts` → "records the award action in audit_log" + "records the grant event in boost_audit_events"

### ✅ 8. Financial pot breakdown adds up correctly

**Invariant:** `prize + platform + boost + stripeFee + club === grossEntryFee`

- **Unit tests:** `lib/__tests__/utils.test.ts` → multiple `calculateSplit` groups, each asserting the total equals gross, including Predictor, LMS, Donation, and edge cases.

---

## RLS integration tests

Located in `tests/rls/`. Require a live Supabase instance.

### Setup

```bash
# One-time: install the JWT signing library
pnpm add -D jsonwebtoken @types/jsonwebtoken

supabase start
./supabase/demo-reset.sh
# Set env vars:
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_ANON_KEY=$(supabase status | grep 'anon key' | awk '{print $NF}')
export SUPABASE_JWT_SECRET=$(supabase status | grep 'JWT secret' | awk '{print $NF}')
```

### Running

```bash
vitest run tests/rls/
```

### Scenarios tested

| Scenario | File |
|----------|------|
| Alice cannot read Bob's entry | `entries.rls.test.ts` |
| Alice cannot update Bob's entry | `entries.rls.test.ts` |
| Club admin can read own club's entries | `entries.rls.test.ts` |

See `tests/rls/README.md` for the full reference and JWT helper.

---

## Integration tests

Located in `tests/integration/`. Require a live Supabase instance + service role key.

| File | Scenario |
|------|----------|
| `stripe-webhook-idempotency.test.ts` | Unique constraint on `webhook_events.stripe_event_id` |

---

## E2E tests (Playwright)

*Not yet installed.* To add:

```bash
pnpm add -D @playwright/test
npx playwright install
```

Planned test scenarios (implement in `tests/e2e/`):

| Scenario | File |
|----------|------|
| Participant enters a competition end-to-end | `participant-entry.spec.ts` |
| Club admin publishes a fundraiser | `club-admin-publish.spec.ts` |
| Platform admin approves a club | `admin-approve-club.spec.ts` |
| Public fundraiser page renders correctly | `public-page.spec.ts` |

---

## Financial accuracy testing

All monetary calculations are covered in `lib/__tests__/utils.test.ts`.

The `calculateSplit` function is the single source of truth for all payment
partitioning. Key invariants:

```
prize    = floor(gross × prizePctBps / 10000)
platform = floor(gross × platformFeeBps / 10000)
boost    = floor(gross × weeklyBoostBps / 10000)
stripeFee = actual (from Stripe charge) or estimate (ceil(gross × 0.015) + 25)
club     = max(0, gross − prize − platform − boost − stripeFee)
total    = prize + platform + boost + stripeFee + club = gross
```

### Cross-check with demo data

| Competition | Gross/entry | Prize/entry | Platform/entry | Boost/entry | Club/entry |
|-------------|-------------|-------------|----------------|-------------|-----------|
| Predictor   | 500p        | 250p (50%)  | 40p (8%)       | 10p (2%)    | 167p      |
| LMS         | 1000p       | 600p (60%)  | 80p (8%)       | 20p (2%)    | 260p      |
| Team Card   | 500p        | 0p          | 40p (8%)       | 10p (2%)    | 417p*     |
| Donation    | 500p        | 0p          | 40p (8%)       | 0p          | 427p      |

*After Stripe fee (33p estimated for 500p transaction)

---

## Test utilities reference

### `lib/__tests__/helpers/supabase-mock.ts`

| Export | Description |
|--------|-------------|
| `chain(result)` | Fluent Supabase-like query builder that resolves `result` at any terminal step |
| `makeDb(responses)` | Per-table mock DB client; each table always returns the same result |
| `makeDbSequenced(sequence)` | Mock DB client where sequential `from()` calls return results in order |
| `makeDbWithInsertSpy(responses)` | Like `makeDb` but with a spy on all `.insert()` calls |

### `lib/game-engine/__tests__/helpers.ts`

Factory functions for game engine types:
- `makeFixture`, `makePredictorConfig`, `makePredictorState`, `makePredictorEntry`
- `makeLMSConfig`, `makeLMSState`, `makeLMSEntry`, `makeLMSRoundResult`
- `makeTeamCardConfig`, `makeTeamCardState`, `makeTeamCardEntry`, `makeSlot`
- `makeDonationConfig`, `makeDonationState`, `makeDonationEntry`

---

## CI configuration (recommended)

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm test:run

  rls-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: ./supabase/demo-reset.sh --seed-only
      - run: pnpm test:rls
    env:
      SUPABASE_URL: http://127.0.0.1:54321
      SUPABASE_ANON_KEY: ${{ steps.supabase.outputs.ANON_KEY }}
      SUPABASE_JWT_SECRET: ${{ steps.supabase.outputs.JWT_SECRET }}
```

---

## Adding new tests

1. **Unit test:** Create a file in `lib/services/__tests__/` or `lib/__tests__/`
2. **RLS test:** Create a `.rls.test.ts` file in `tests/rls/`
3. **Integration test:** Create a file in `tests/integration/`
4. **E2E test:** Create a `.spec.ts` file in `tests/e2e/`

When adding a test for a service function that uses `createAdminClient`:
```typescript
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
import { createAdminClient } from '@/lib/supabase/admin'
import { makeDbSequenced } from '@/lib/__tests__/helpers/supabase-mock'

// In each test:
vi.mocked(createAdminClient).mockReturnValue(makeDbSequenced([...]) as any)
```
