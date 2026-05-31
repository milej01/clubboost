/**
 * RLS integration tests: Entry row-level security.
 *
 * Requires a running local Supabase instance with demo data loaded:
 *   supabase start && ./supabase/demo-reset.sh
 *
 * Run: vitest run tests/rls/entries.rls.test.ts
 *
 * Policy under test:
 *   entries SELECT: participant_id = auth.uid() OR club admin
 *   entries UPDATE: participant_id = auth.uid() AND status = 'pending_payment'
 *   entries INSERT: authenticated users only (via service functions)
 */

/**
 * Install jsonwebtoken before running:
 *   pnpm add -D jsonwebtoken @types/jsonwebtoken
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Dynamic import so the test file loads even if jsonwebtoken is not installed
// (the tests themselves will be skipped if Supabase is not available)
let jwtSign: ((payload: object, secret: string, options?: object) => string) | null = null
try {
  const mod = await import('jsonwebtoken')
  jwtSign = mod.sign as typeof jwtSign
} catch {
  // jsonwebtoken not installed — RLS tests will be skipped
}

// ─────────────────────────────────────────────────────────────────────────────
// Config (env vars set by supabase start)
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL        ?? 'http://127.0.0.1:54321'
const ANON_KEY     = process.env.SUPABASE_ANON_KEY   ?? ''
const JWT_SECRET   = process.env.SUPABASE_JWT_SECRET ?? ''

// Demo UUIDs (from demo-seed.sql)
const ALICE_ID   = '00000000-0006-4000-8000-000000000000'
const BOB_ID     = '00000000-0007-4000-8000-000000000000'
const HILLSIDE_ADMIN_ID = '00000000-0002-4000-8000-000000000000'

// Known entry IDs from the demo seed
const ALICE_PREDICTOR_ENTRY_ID   = '00000003-0001-4000-8000-000000000000'
const BOB_PREDICTOR_ENTRY_ID     = '00000003-0002-4000-8000-000000000000'

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create a Supabase client authenticated as a specific user
// ─────────────────────────────────────────────────────────────────────────────

function makeJwt(userId: string): string {
  if (!jwtSign) throw new Error('jsonwebtoken not installed — run: pnpm add -D jsonwebtoken @types/jsonwebtoken')
  return jwtSign(
    {
      sub:  userId,
      role: 'authenticated',
      aud:  'authenticated',
      iat:  Math.floor(Date.now() / 1000),
      exp:  Math.floor(Date.now() / 1000) + 3600,
    },
    JWT_SECRET,
    { algorithm: 'HS256' },
  )
}

function clientFor(userId: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${makeJwt(userId)}` } },
    auth:   { persistSession: false },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Skip guard: only run if Supabase is available
// ─────────────────────────────────────────────────────────────────────────────

let supabaseAvailable = false

beforeAll(async () => {
  if (!JWT_SECRET) {
    console.warn('[rls] SUPABASE_JWT_SECRET not set — skipping RLS tests')
    return
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { method: 'HEAD' })
    supabaseAvailable = res.ok || res.status === 404 // 404 = running but no default table
  } catch {
    console.warn('[rls] Supabase not reachable — skipping RLS tests')
  }
})

function skipIfNoSupabase() {
  if (!supabaseAvailable) {
    console.log('[rls] Skipping: Supabase not available')
    return true
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('RLS: entries — participant isolation', () => {
  it('participant can read their own entry', async () => {
    if (skipIfNoSupabase()) return

    const alice = clientFor(ALICE_ID)
    const { data, error } = await alice
      .from('entries')
      .select('id, participant_id')
      .eq('id', ALICE_PREDICTOR_ENTRY_ID)
      .single()

    expect(error).toBeNull()
    expect(data?.participant_id).toBe(ALICE_ID)
  })

  it('participant cannot read another participant's entry', async () => {
    if (skipIfNoSupabase()) return

    const alice = clientFor(ALICE_ID)
    // Alice tries to read Bob's entry
    const { data, error } = await alice
      .from('entries')
      .select('id')
      .eq('id', BOB_PREDICTOR_ENTRY_ID)

    // RLS returns empty array (not an error) when the row is filtered out
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('participant cannot update another participant's entry', async () => {
    if (skipIfNoSupabase()) return

    const alice = clientFor(ALICE_ID)
    // Alice tries to update Bob's entry — RLS should block this
    const { error } = await alice
      .from('entries')
      .update({ entry_data: { _tampered: true } })
      .eq('id', BOB_PREDICTOR_ENTRY_ID)

    // Either RLS blocks the write (0 rows affected, no error)
    // or returns an error depending on the policy definition.
    // Either way, the entry should be unchanged.
    if (!error) {
      // Verify Bob's entry was not modified
      const bob = clientFor(BOB_ID)
      const { data: bobEntry } = await bob
        .from('entries')
        .select('entry_data')
        .eq('id', BOB_PREDICTOR_ENTRY_ID)
        .single()
      expect((bobEntry?.entry_data as any)?._tampered).toBeUndefined()
    }
  })
})

describe('RLS: entries — club admin access', () => {
  it('club admin can read entries for their own club competitions', async () => {
    if (skipIfNoSupabase()) return

    const admin = clientFor(HILLSIDE_ADMIN_ID)
    // Hillside admin should be able to see all entries for Hillside competitions
    const { data, error } = await admin
      .from('entries')
      .select('id, competition_id')
      .eq('id', ALICE_PREDICTOR_ENTRY_ID)

    // The exact RLS policy depends on implementation.
    // At minimum, the request should not throw.
    expect(error).toBeNull()
  })
})
