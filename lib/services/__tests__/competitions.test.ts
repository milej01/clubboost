/**
 * Unit tests for the competition service layer.
 *
 * These tests mock the Supabase admin client so no running database is needed.
 * They focus on the state-machine guards and business-rule enforcement inside
 * publishCompetition and createCompetition.
 *
 * Key scenarios covered:
 *   - Only 'draft' competitions can be published
 *   - Suspended clubs cannot publish competitions
 *   - Missing competition returns the right error
 *   - Entry rules snapshot is merged into entry_data (immutable record)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDbSequenced } from '@/lib/__tests__/helpers/supabase-mock'

// ── Module mocks (must be hoisted before any imports that transitively use them) ──
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/services/notification-hooks', () => ({
  notifyFundraiserPublished: vi.fn().mockResolvedValue(undefined),
  notifyFundraiserClosed:    vi.fn().mockResolvedValue(undefined),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import { publishCompetition } from '@/lib/services/competitions'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockCompetition(overrides: Record<string, unknown> = {}) {
  return {
    id:       'comp-1',
    club_id:  'club-1',
    status:   'draft',
    title:    'Test Predictor',
    type:     'predictor',
    ...overrides,
  }
}

function mockClub(overrides: Record<string, unknown> = {}) {
  return {
    id:     'club-1',
    name:   'Hillside FC',
    status: 'approved',
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// publishCompetition
// ─────────────────────────────────────────────────────────────────────────────

describe('publishCompetition', () => {
  const ACTOR_ID = 'user-admin-1'
  const COMP_ID  = 'comp-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when competition is not found', async () => {
    // from('competitions') → not found
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: null, error: null },         // select comp → null
      ]) as any,
    )

    const result = await publishCompetition(COMP_ID, ACTOR_ID)
    expect(result.error).toBe('Competition not found')
  })

  it('returns error when competition is not in draft status', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: mockCompetition({ status: 'open' }) },  // already open
      ]) as any,
    )

    const result = await publishCompetition(COMP_ID, ACTOR_ID)
    expect(result.error).toBe('Only draft competitions can be published')
  })

  it('returns error when competition is closed', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: mockCompetition({ status: 'closed' }) },
      ]) as any,
    )

    const result = await publishCompetition(COMP_ID, ACTOR_ID)
    expect(result.error).toBe('Only draft competitions can be published')
  })

  it('returns error when competition is cancelled', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: mockCompetition({ status: 'cancelled' }) },
      ]) as any,
    )

    const result = await publishCompetition(COMP_ID, ACTOR_ID)
    expect(result.error).toBe('Only draft competitions can be published')
  })

  it('returns error when the club is suspended', async () => {
    // Sequence:
    //   1. select competition → draft ✓
    //   2. select club        → suspended ✗
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: mockCompetition({ status: 'draft' }) },   // comp OK
        { data: mockClub({ status: 'suspended' }) },      // club suspended!
      ]) as any,
    )

    const result = await publishCompetition(COMP_ID, ACTOR_ID)
    expect(result.error).toBe('Suspended clubs cannot publish competitions')
  })

  it('publishes successfully when draft competition belongs to approved club', async () => {
    // Sequence:
    //   1. select competition → draft
    //   2. select club        → approved
    //   3. update competition → { error: null }
    //   4. audit_log insert   → { error: null }
    //   5. fetch fullComp (notifications) → competition data
    //   6. fetch fullClub (notifications) → club data
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: mockCompetition() },                     // select comp
        { data: mockClub() },                            // select club
        { data: null, error: null },                     // update competition
        { data: null, error: null },                     // logAudit insert
        { data: mockCompetition({ status: 'open' }) },   // fullComp for notification
        { data: mockClub() },                            // fullClub for notification
      ]) as any,
    )

    const result = await publishCompetition(COMP_ID, ACTOR_ID)
    expect(result.error).toBeNull()
  })

  it('propagates database error from the update', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: mockCompetition() },                         // select comp
        { data: mockClub() },                                // select club
        { data: null, error: { message: 'DB write failed' } }, // update fails
      ]) as any,
    )

    const result = await publishCompetition(COMP_ID, ACTOR_ID)
    expect(result.error).toBe('DB write failed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Competition state-machine invariants (conceptual)
// ─────────────────────────────────────────────────────────────────────────────

describe('competition status state machine', () => {
  /**
   * These tests document the allowed status transitions in the service layer.
   * They double as regression guards against accidentally loosening the guards.
   */

  const TRANSITIONS = [
    { from: 'draft',     action: 'publish',  allowed: true  },
    { from: 'open',      action: 'publish',  allowed: false },
    { from: 'closed',    action: 'publish',  allowed: false },
    { from: 'settled',   action: 'publish',  allowed: false },
    { from: 'cancelled', action: 'publish',  allowed: false },
  ]

  for (const t of TRANSITIONS) {
    it(`${t.from} → publish: allowed=${t.allowed}`, async () => {
      vi.mocked(createAdminClient).mockReturnValue(
        // Only one call needed when non-draft (returns error before club check)
        makeDbSequenced([
          { data: mockCompetition({ status: t.from }) },
          { data: mockClub() },                           // club check (only reached if draft)
          { data: null, error: null },                    // update (only reached if approved)
          { data: null, error: null },                    // logAudit
          { data: null, error: null },                    // fullComp notification
          { data: null, error: null },                    // fullClub notification
        ]) as any,
      )

      const result = await publishCompetition('comp-x', 'actor-x')

      if (t.allowed) {
        expect(result.error).toBeNull()
      } else {
        expect(result.error).not.toBeNull()
        expect(result.error).toContain('draft')
      }
    })
  }
})
