# RLS Integration Tests

These tests verify Postgres Row Level Security policies by creating Supabase
clients with different JWT identities and asserting that each identity can only
read/write what it's authorised to.

## Prerequisites

```bash
supabase start           # local Supabase must be running
./supabase/demo-reset.sh # load demo data so test users exist
```

## Running

```bash
pnpm test:rls
# or
vitest run --project rls
```

These tests are intentionally **separate** from the unit test suite (`pnpm test`)
because they require a live database. Never run them in CI unless `supabase start`
is available.

## Test scenarios

| File | Scenario |
|------|----------|
| `entries.rls.test.ts` | Participant cannot read/write another participant's entry |
| `clubs.rls.test.ts`   | Club admin cannot read/write data for a different club |
| `payments.rls.test.ts` | Participant cannot read another participant's payment |
| `admin.rls.test.ts`   | Platform admin can see all rows (service-role bypass) |

## How they work

Each test:
1. Creates a Supabase client with a custom JWT signed for a specific user
2. Attempts an operation that should be allowed
3. Attempts the same operation as a different user and asserts it fails

```typescript
import { createClient } from '@supabase/supabase-js'

const aliceClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${aliceJwt}` } }
})

// Alice can read her own entry
const { data: own } = await aliceClient
  .from('entries')
  .select('*')
  .eq('id', ALICE_ENTRY_ID)
  .single()
expect(own).not.toBeNull()

// Alice cannot read Bob's entry (RLS blocks it → empty array)
const { data: other } = await aliceClient
  .from('entries')
  .select('*')
  .eq('id', BOB_ENTRY_ID)
expect(other).toHaveLength(0)
```

## Helper: generate test JWTs

```typescript
import { sign } from 'jsonwebtoken'

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET! // from supabase status

function makeJwt(userId: string, role: 'authenticated' | 'anon' = 'authenticated') {
  return sign(
    { sub: userId, role, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 },
    JWT_SECRET,
    { algorithm: 'HS256' }
  )
}
```

## Demo user UUIDs (from demo-seed.sql)

```
ALICE   = '00000000-0006-4000-8000-000000000000'
BOB     = '00000000-0007-4000-8000-000000000000'
CHARLIE = '00000000-0008-4000-8000-000000000000'
DIANA   = '00000000-0009-4000-8000-000000000000'
EDDIE   = '00000000-0010-4000-8000-000000000000'
HILLSIDE_SECRETARY = '00000000-0002-4000-8000-000000000000'
NORTHGATE_ADMIN    = '00000000-0003-4000-8000-000000000000'
```
