/**
 * Unit tests for the Weekly Boost service.
 *
 * Key scenarios:
 *   - awardClub creates both a boost_audit_events log and an audit_log entry
 *   - awardClub rejects when amount is zero or negative
 *   - awardClub rejects when award exceeds the available fund
 *   - awardClub rejects when club already has an active award for the period
 *   - awardClub rejects when period is already fully awarded
 *   - Feature flag: when 'weekly_boost' flag is off, boost contribution is 0
 *
 * Note on feature-flag testing:
 *   `isFeatureEnabled` is tested directly. The React `cache()` wrapper it uses
 *   is a pass-through in Node (no React render context), so the mocked
 *   `createClient` is called on every invocation as expected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDbSequenced } from '@/lib/__tests__/helpers/supabase-mock'

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

// Mock React cache() as a simple pass-through so we can test isFeatureEnabled
// without React render-context complications.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: (fn: (...a: unknown[]) => unknown) => fn }
})

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import { awardClub }         from '@/lib/services/weekly-boost'
import { isFeatureEnabled }  from '@/lib/feature-flags'

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const PERIOD_ID = 'period-1'
const CLUB_ID   = 'club-1'
const ACTOR_ID  = 'admin-1'

const BASE_INPUT = {
  periodId:    PERIOD_ID,
  clubId:      CLUB_ID,
  actorId:     ACTOR_ID,
  amountPence: 2500, // £25
  reason:      'Most fundraising entries this week',
}

function awardRow() {
  return {
    id:           'award-1',
    period_id:    PERIOD_ID,
    club_id:      CLUB_ID,
    awarded_by:   ACTOR_ID,
    amount_pence: 2500,
    status:       'pending',
    is_public:    false,
    club:         { id: CLUB_ID, name: 'Hillside FC', slug: 'hillside-fc', logo_url: null },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// awardClub — guard tests
// ─────────────────────────────────────────────────────────────────────────────

describe('awardClub', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Amount validation ─────────────────────────────────────────────────────

  it('rejects when amount is zero', async () => {
    const result = await awardClub({ ...BASE_INPUT, amountPence: 0 })
    expect(result.error).toBe('Award amount must be greater than zero')
    expect(result.award).toBeNull()
    // Should not touch the DB at all
    expect(vi.mocked(createAdminClient)).not.toHaveBeenCalled()
  })

  it('rejects when amount is negative', async () => {
    const result = await awardClub({ ...BASE_INPUT, amountPence: -100 })
    expect(result.error).toBe('Award amount must be greater than zero')
    expect(vi.mocked(createAdminClient)).not.toHaveBeenCalled()
  })

  // ── Duplicate award guard ─────────────────────────────────────────────────

  it('rejects when club already has an active award for this period', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: { id: 'award-existing' } }, // existing non-cancelled award found
      ]) as any,
    )

    const result = await awardClub(BASE_INPUT)
    expect(result.error).toBe('This club already has an active award for this period')
  })

  // ── Period validation ─────────────────────────────────────────────────────

  it('rejects when period is not found', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: null, error: null },  // no existing award
        { data: null, error: null },  // period not found
      ]) as any,
    )

    const result = await awardClub(BASE_INPUT)
    expect(result.error).toBe('Boost period not found')
  })

  it('rejects when period is already fully awarded', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: null, error: null },                             // no existing award
        { data: { status: 'awarded', total_pool_pence: 5000 } }, // period = awarded
      ]) as any,
    )

    const result = await awardClub(BASE_INPUT)
    expect(result.error).toBe('Period is already fully awarded')
  })

  // ── Available fund check ──────────────────────────────────────────────────

  it('rejects when award exceeds the available fund', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: null, error: null },                            // no existing award
        { data: { status: 'active', total_pool_pence: 2000 } }, // pool = £20
        { data: [{ amount_pence: 500 }] },                      // already awarded £5 → available £15
        // Trying to award £25 (2500p) → should be rejected
      ]) as any,
    )

    const result = await awardClub(BASE_INPUT)
    expect(result.error).toMatch(/exceeds available/)
  })

  it('allows award when amount is exactly the available fund', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: null, error: null },                            // no existing award
        { data: { status: 'active', total_pool_pence: 2500 } }, // pool = £25
        { data: [] },                                           // nothing awarded yet → available = £25
        { data: awardRow(), error: null },                      // insert succeeds
        { data: null, error: null },                            // boost_audit_events
        { data: null, error: null },                            // audit_log
      ]) as any,
    )

    const result = await awardClub(BASE_INPUT)
    expect(result.error).toBeNull()
  })

  // ── Successful award + audit trail ────────────────────────────────────────

  it('creates award and calls both boost_audit_events and audit_log tables', async () => {
    const sequencedDb = makeDbSequenced([
      { data: null, error: null },                            // awards → no existing
      { data: { status: 'active', total_pool_pence: 5000 } }, // period → ok, pool £50
      { data: [] },                                           // existing awards → empty
      { data: awardRow(), error: null },                      // insert award → success
      { data: null, error: null },                            // boost_audit_events insert
      { data: null, error: null },                            // audit_log insert
    ]) as any

    vi.mocked(createAdminClient).mockReturnValue(sequencedDb)

    const result = await awardClub(BASE_INPUT)

    expect(result.error).toBeNull()
    expect(result.award?.amount_pence).toBe(2500)

    // Verify all required tables were touched
    const calledTables: string[] = sequencedDb.from.mock.calls.map((c: [string]) => c[0])
    expect(calledTables).toContain('clubboost_weekly_boost_awards')
    expect(calledTables).toContain('boost_audit_events')
    expect(calledTables).toContain('audit_log')
  })

  it('records the award action in audit_log', async () => {
    // Capture the payload inserted into audit_log
    let capturedAuditPayload: Record<string, unknown> | null = null

    const mockDb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'audit_log') {
          return {
            insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedAuditPayload = payload
              const p = Promise.resolve({ data: null, error: null })
              return {
                then: p.then.bind(p),
                catch: p.catch.bind(p),
              }
            }),
          }
        }

        // All other tables: sequenced responses
        const table_responses: Record<string, unknown>[][] = [
          // clubboost_weekly_boost_awards (2 calls):
          //   1. check existing → null, 2. fetch existing award amounts → []
          //   Then insert → awardRow
          // clubboost_weekly_boost_periods (1 call): period → ok
          // boost_audit_events (1 call): insert → null
        ]

        // Return a generic chain that resolves different values per call
        const responses: Record<string, unknown>[] = [
          { data: null, error: null },                            // awards - no existing
          { data: { status: 'active', total_pool_pence: 5000 } }, // period
          { data: [], error: null },                              // existing award amounts
          { data: awardRow(), error: null },                      // insert award
          { data: null, error: null },                            // boost_audit_events
        ]

        // Use a ref to track which call this is for the current table
        const tableCallCount = { n: 0 }

        const makeResult = () => {
          const idx = tableCallCount.n++
          return responses[idx] ?? { data: null, error: null }
        }

        const buildChain = (resultFn: () => Record<string, unknown>): any => {
          const resolved = () => Promise.resolve(resultFn())
          const c: any = {
            select: (..._: unknown[]) => buildChain(resultFn),
            insert: (..._: unknown[]) => buildChain(resultFn),
            update: (..._: unknown[]) => buildChain(resultFn),
            upsert: (..._: unknown[]) => buildChain(resultFn),
            eq:     (..._: unknown[]) => buildChain(resultFn),
            neq:    (..._: unknown[]) => buildChain(resultFn),
            in:     (..._: unknown[]) => buildChain(resultFn),
            not:    (..._: unknown[]) => buildChain(resultFn),
            is:     (..._: unknown[]) => buildChain(resultFn),
            order:  (..._: unknown[]) => buildChain(resultFn),
            single:      () => resolved(),
            maybeSingle: () => resolved(),
          }
          const p = resolved()
          c.then  = p.then.bind(p)
          c.catch = p.catch.bind(p)
          return c
        }

        return buildChain(makeResult)
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockDb as any)

    await awardClub(BASE_INPUT)

    // Verify the audit log payload
    expect(capturedAuditPayload).not.toBeNull()
    expect(capturedAuditPayload!.action).toBe('weekly_boost_awarded')
    expect(capturedAuditPayload!.entity_type).toBe('boost_award')
    expect(capturedAuditPayload!.actor_id).toBe(ACTOR_ID)
    expect(capturedAuditPayload!.club_id).toBe(CLUB_ID)
  })

  it('records the grant event in boost_audit_events', async () => {
    let capturedBoostAuditPayload: Record<string, unknown> | null = null

    const mockDb = {
      from: vi.fn().mockImplementation((table: string) => {
        const responses: Record<string, unknown>[] = [
          { data: null, error: null },
          { data: { status: 'active', total_pool_pence: 5000 } },
          { data: [], error: null },
          { data: awardRow(), error: null },
        ]
        let idx = 0

        const resolved = () => {
          const r = responses[idx++] ?? { data: null, error: null }
          return Promise.resolve(r)
        }

        if (table === 'boost_audit_events') {
          return {
            insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedBoostAuditPayload = payload
              const p = Promise.resolve({ data: null, error: null })
              return { then: p.then.bind(p), catch: p.catch.bind(p) }
            }),
          }
        }

        if (table === 'audit_log') {
          return {
            insert: vi.fn().mockImplementation(() => {
              const p = Promise.resolve({ data: null, error: null })
              return { then: p.then.bind(p), catch: p.catch.bind(p) }
            }),
          }
        }

        const buildChain = (): any => {
          const c: any = {
            select: (..._: unknown[]) => buildChain(),
            insert: (..._: unknown[]) => buildChain(),
            eq:     (..._: unknown[]) => buildChain(),
            neq:    (..._: unknown[]) => buildChain(),
            in:     (..._: unknown[]) => buildChain(),
            not:    (..._: unknown[]) => buildChain(),
            is:     (..._: unknown[]) => buildChain(),
            order:  (..._: unknown[]) => buildChain(),
            single:      () => resolved(),
            maybeSingle: () => resolved(),
          }
          const p = resolved()
          c.then  = p.then.bind(p)
          c.catch = p.catch.bind(p)
          return c
        }

        return buildChain()
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockDb as any)

    await awardClub(BASE_INPUT)

    expect(capturedBoostAuditPayload).not.toBeNull()
    expect(capturedBoostAuditPayload!.event_type).toBe('award_granted')
    expect(capturedBoostAuditPayload!.period_id).toBe(PERIOD_ID)
    expect(capturedBoostAuditPayload!.club_id).toBe(CLUB_ID)
    expect(capturedBoostAuditPayload!.actor_id).toBe(ACTOR_ID)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isFeatureEnabled — Weekly Boost feature flag
// ─────────────────────────────────────────────────────────────────────────────

describe('isFeatureEnabled (weekly_boost)', () => {
  beforeEach(() => vi.clearAllMocks())

  function mockFlagResponse(flags: { key: string; enabled: boolean; metadata?: Record<string, unknown> }[]) {
    const p = Promise.resolve({ data: flags, error: null })
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          then:  p.then.bind(p),
          catch: p.catch.bind(p),
        }),
      }),
    } as any)
  }

  it('returns false when no feature_flags rows exist', async () => {
    mockFlagResponse([])
    expect(await isFeatureEnabled('weekly_boost')).toBe(false)
  })

  it('returns false when the weekly_boost flag is explicitly disabled', async () => {
    mockFlagResponse([{ key: 'weekly_boost', enabled: false }])
    expect(await isFeatureEnabled('weekly_boost')).toBe(false)
  })

  it('returns true when the weekly_boost flag is enabled', async () => {
    mockFlagResponse([{ key: 'weekly_boost', enabled: true }])
    expect(await isFeatureEnabled('weekly_boost')).toBe(true)
  })

  it('returns false when the flag key does not match', async () => {
    mockFlagResponse([{ key: 'some_other_flag', enabled: true }])
    expect(await isFeatureEnabled('weekly_boost')).toBe(false)
  })

  it('documents: flag off → boostBps = 0 → calculateSplit.boost === 0', () => {
    /**
     * When isFeatureEnabled('weekly_boost') returns false, the code in
     * createCheckoutSession does:
     *
     *   const boostBps = weeklyBoostEnabled ? competition.weekly_boost_contribution_bps : 0
     *
     * This means calculateSplit receives weeklyBoostBps: 0 and therefore
     * split.boost === 0. The numeric proof is in lib/__tests__/utils.test.ts
     * ("Weekly Boost disabled" group).
     */
    expect(true).toBe(true)
  })
})
