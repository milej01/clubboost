# ClubBoost

Digital fundraising platform for grassroots football clubs and local sports teams.

---

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- [Stripe account](https://stripe.com) (test mode is fine for development)
- A Supabase project (free tier works)

---

## Local Setup

### 1. Clone and install

```bash
git clone <repo>
cd clubboost
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | See step 5 below |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |

### 3. Run the database migration

```bash
# Push migrations to your Supabase project
npx supabase db push

# OR reset and re-apply from scratch
npx supabase db reset --linked
```

The migration (`supabase/migrations/001_initial_schema.sql`) creates:
- All tables with correct constraints
- Row Level Security (RLS) policies
- Helper functions (`is_platform_admin`, `is_club_admin`)
- Auth trigger to create profiles on signup
- Default feature flags (weekly_boost disabled by default)

### 4. Seed demo data (optional)

```bash
# Edit supabase/seed.sql to replace placeholder UUIDs with real user IDs
# Then run:
npx supabase db execute --file supabase/seed.sql
```

Or paste the SQL directly into the Supabase SQL editor.

**To get user IDs:**
1. Create users via the signup flow (`/register`) or Supabase Auth dashboard
2. Copy their UUIDs from `Authentication → Users`
3. Replace `00000000-0000-0000-0000-000000000001` (admin) and `00000000-0000-0000-0000-000000000002` (club_admin) in `seed.sql`

### 5. Set up Stripe webhook (local)

Install Stripe CLI:
```bash
brew install stripe/stripe-cli/stripe
stripe login
```

Forward webhooks to your local server:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret (`whsec_...`) into `.env.local` as `STRIPE_WEBHOOK_SECRET`.

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Creating a platform admin

After signup, update the user's role in the Supabase SQL editor:

```sql
UPDATE public.profiles
SET role = 'platform_admin'
WHERE id = 'your-user-uuid-here';
```

Platform admins can access `/admin` and manage clubs, feature flags, and Weekly Boost.

---

## Key URLs

| URL | Description |
|---|---|
| `/` | Landing page |
| `/register` | Create account |
| `/login` | Sign in |
| `/dashboard` | Club admin dashboard |
| `/dashboard/competitions/new` | Create a competition |
| `/dashboard/stripe` | Stripe Connect onboarding |
| `/dashboard/club/settings` | Edit club profile |
| `/c/[clubSlug]/[competitionId]` | Public competition page |
| `/c/[clubSlug]/[competitionId]/enter` | Entry form |
| `/admin` | Platform admin panel |
| `/admin/clubs` | Manage club approvals |
| `/admin/feature-flags` | Toggle platform features |
| `/admin/weekly-boost` | Award Weekly Boost (feature flagged) |
| `/api/webhooks/stripe` | Stripe webhook endpoint |

---

## User flows

### Club admin
1. Register → create club (`/dashboard/club/settings`)
2. Platform admin approves club (`/admin/clubs`)
3. Connect Stripe (`/dashboard/stripe`)
4. Create competition (`/dashboard/competitions/new`)
5. Publish → share link with supporters
6. Close entries → settle manually (`/dashboard/competitions/[id]/settle`)
7. Initiate payouts (created as `pending_review`, paid manually)

### Participant
1. Click shared link → `/c/[clubSlug]/[competitionId]`
2. Enter competition → pay via Stripe Checkout
3. Return to confirmation page
4. Check results when competition is settled

### Platform admin
1. Review and approve/reject club applications (`/admin/clubs`)
2. Toggle feature flags (`/admin/feature-flags`)
3. Monitor payments (`/admin/payments`)
4. Award Weekly Boost (`/admin/weekly-boost`) — requires `weekly_boost` flag enabled

---

## Architecture

```
app/
├── (auth)/          — login, register
├── c/[clubSlug]/    — public competition pages
├── dashboard/       — club admin (auth-gated)
├── admin/           — platform admin (role-gated)
└── api/webhooks/    — Stripe webhook handler

lib/
├── supabase/        — browser / server / admin clients
├── stripe/          — client, Connect helpers, webhook verifier
├── services/        — data access layer (clubs, competitions, payments, etc.)
├── game-engine/     — modular competition logic per type
├── validations/     — Zod schemas
└── feature-flags.ts — cached flag lookup

actions/             — Next.js Server Actions (auth, clubs, competitions, etc.)
components/
├── ui/              — base components (Button, Input, Card, Badge, etc.)
├── competitions/    — CompetitionCard, entry forms, status badge
├── clubs/           — stripe onboarding banner
├── nav/             — dashboard and admin navigation
└── shared/          — FeatureGate, PotSplitVisualizer
types/
├── app.ts           — all domain types
└── database.ts      — generated from Supabase schema (run `npm run db:types`)
```

---

## Competition types

| Type | Entry form | Settlement |
|---|---|---|
| `predictor` | Pick H/D/A for 6 fixtures | Admin enters actual results; system scores |
| `last_man_standing` | Pick one team per round | Admin processes round-by-round results |
| `team_card` | Select an available team slot | Admin reveals winning slot number |
| `donation` | Optional message only | Auto-closed; no winner |

---

## Payment flow

```
Participant → Stripe Checkout
  → funds to platform account (minus application_fee retained by Stripe Connect)
  → checkout.session.completed webhook
  → payment record updated (succeeded)
  → entry status → active

Settlement:
  → Payout records created (pending_review)
  → Platform admin marks paid manually
  → Club fundraising share already in club's Stripe account
  → Winner prize paid manually (bank transfer) and recorded
```

---

## Feature flags

| Flag key | Default | Description |
|---|---|---|
| `weekly_boost` | **disabled** | ClubBoost Weekly Boost feature |
| `donation_only` | enabled | Donation fundraiser type |
| `csv_export` | enabled | CSV export for entries/payments |
| `team_card` | enabled | Team Card competition type |
| `last_man_standing` | enabled | Last Man Standing type |

Flags are toggled in `/admin/feature-flags` without a deployment.

---

## Money handling

- All amounts stored as **integers in pence** (never floats)
- Percentages stored as **basis points**: 100 bps = 1%
- `calculateSplit()` in `lib/utils.ts` computes the per-entry breakdown
- Splits are snapshotted to the competition at creation time

---

## Development notes

- TypeScript strict mode — no `any`
- Server Components for data fetching; Client Components for forms/interaction
- RLS enforces club-scoping at the database level
- Service role client (`lib/supabase/admin.ts`) bypasses RLS — server only
- Audit log is append-only, written via service role
- Webhook handler returns 200 even on application errors (prevents Stripe retries for non-transient failures)
- Entry numbers auto-generated by DB trigger (race condition acceptable for MVP)

---

## Generating TypeScript types from Supabase

After schema changes:

```bash
npm run db:types
```

This regenerates `types/database.ts` from your local Supabase instance.

---

## Environment notes

- Stripe API version pinned to `2025-01-27.acacia` in `lib/stripe/client.ts`
- Update this when upgrading Stripe SDK versions
- Supabase SSR uses cookie-based sessions for App Router compatibility
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser
