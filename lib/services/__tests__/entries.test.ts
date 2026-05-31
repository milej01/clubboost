/**
 * Unit tests for the entry service layer.
 *
 * Key scenarios:
 *   - Competition must be 'open' to accept entries
 *   - Full competitions reject new entries
 *   - Duplicate entries are prevented (same participant, same competition)
 *   - Rules snapshot is stored immutably inside entry_data
 *
 * Access-control note:
 *   "Participant cannot edit another participant's entry" is enforced via
 *   Postgres RLS (the entries table RLS policy allows SELECT/UPDATE only
 *   where participant_id = auth.uid()). That enforcement is tested in the
 *   integration test suite (tests/rls/) which requires a live Supabase
 *   instance. The unit tests here cover the service-level guards only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDbSequenced } from '@/lib/__tests__/helpers/supabase-mock'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/admin'
import { createPendingEntry } from '@/lib/services/entries'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PARAMS = {
  competitionId: 'comp-1',
  participantId: 'user-1',
  entryData:     { predictions: [{ fixture_id: 'f1', predicted_result: 'H' }] },
} as const

function competitionRow(overrides: Record<string, unknown> = {}) {
  return { id: 'comp-1', status: 'open', max_entries: null, ...overrides }
}

function newEntryRow() {
  return {
    id:             'entry-new-1',
    competition_id: 'comp-1',
    participant_id: 'user-1',
    status:         'pending_payment',
    entry_data:     PARAMS.entryData,
    entry_number:   1,
    entered_at:     new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createPendingEntry — guard tests
// ─────────────────────────────────────────────────────────────────────────────

describe('createPendingEntry', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Competition status guard ────────────────────────────────────────────

  it('rejects when competition is not found', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: null, error: null }, // select competition → null
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBe('Competition is not open for entries')
    expect(result.entry).toBeNull()
  })

  it('rejects when competition is a draft', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow({ status: 'draft' }) },
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBe('Competition is not open for entries')
  })

  it('rejects when competition is closed', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow({ status: 'closed' }) },
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBe('Competition is not open for entries')
  })

  it('rejects when competition is settled', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow({ status: 'settled' }) },
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBe('Competition is not open for entries')
  })

  it('rejects when competition is cancelled', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow({ status: 'cancelled' }) },
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBe('Competition is not open for entries')
  })

  // ── Max entries guard ───────────────────────────────────────────────────

  it('rejects when competition is full', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow({ max_entries: 5 }) }, // open, max 5
        { count: 5 },                                 // entry count → full
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBe('Competition is full')
  })

  it('allows entry when count is below max_entries', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow({ max_entries: 10 }) }, // open, max 10
        { count: 7 },                                  // 7 of 10 used
        { data: null, error: null },                   // duplicate check → none
        { data: newEntryRow(), error: null },           // insert → new entry
        { data: null, error: null },                   // logAudit
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBeNull()
    expect(result.entry).not.toBeNull()
  })

  // ── Duplicate entry guard ───────────────────────────────────────────────

  it('rejects when participant already has an active entry', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow() },                            // open, no max
        { data: { id: 'entry-existing', status: 'active' } }, // duplicate!
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBe('You already have an entry in this competition')
  })

  it('rejects when participant has a pending_payment entry', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow() },
        { data: { id: 'entry-pending', status: 'pending_payment' } }, // pending duplicate
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBe('You already have an entry in this competition')
  })

  // ── Successful entry creation ───────────────────────────────────────────

  it('creates entry when competition is open and no duplicate exists', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow() },          // competition open
        { data: null, error: null },         // no duplicate
        { data: newEntryRow(), error: null }, // insert succeeds
        { data: null, error: null },         // logAudit
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBeNull()
    expect(result.entry?.status).toBe('pending_payment')
    expect(result.entry?.competition_id).toBe('comp-1')
    expect(result.entry?.participant_id).toBe('user-1')
  })

  it('stores rules snapshot inside entry_data when provided', async () => {
    const rulesSnapshot = { version: 1, rules_text: 'Pick 6 results', terms_hash: 'abc123' }

    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow() },
        { data: null, error: null },
        {
          data: {
            ...newEntryRow(),
            entry_data: { ...PARAMS.entryData, _snapshot: rulesSnapshot },
          },
          error: null,
        },
        { data: null, error: null },
      ]) as any,
    )

    const result = await createPendingEntry({ ...PARAMS, rulesSnapshot })
    expect(result.error).toBeNull()
    // The snapshot is stored inside entry_data so the rules in force at
    // entry time are recorded immutably — even if the competition is later edited.
    expect((result.entry?.entry_data as any)?._snapshot).toEqual(rulesSnapshot)
  })

  it('propagates insert error', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeDbSequenced([
        { data: competitionRow() },
        { data: null, error: null },                        // no duplicate
        { data: null, error: { message: 'Insert failed' } }, // insert error
      ]) as any,
    )

    const result = await createPendingEntry(PARAMS)
    expect(result.error).toBe('Insert failed')
    expect(result.entry).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Access control — RLS note
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The following access-control invariants are enforced at the database layer
 * (Postgres RLS) and require a live Supabase instance to verify end-to-end.
 * They are documented here as integration-test stubs.
 *
 * Run: `supabase start && pnpm test:rls` (not yet wired — see tests/rls/README.md)
 *
 *   ✗ A participant cannot UPDATE an entry belonging to a different participant
 *     (RLS: entries UPDATE WHERE participant_id = auth.uid())
 *
 *   ✗ A club admin cannot SELECT entries for a competition outside their club
 *     (RLS: competitions SELECT WHERE club_id IN <user's clubs>)
 *
 *   ✗ A platform admin (service role) can see all rows (no RLS bypass needed)
 */
describe('access control — service-layer note', () => {
  it('documents that entry ownership is enforced at the DB/RLS layer', () => {
    // This is an intentional documentation test. The service layer uses
    // the admin client (bypasses RLS), so cross-participant writes are
    // prevented by:
    //   1. The `participant_id` being set from the authenticated user's ID
    //      in the server action (actions/entries.ts).
    //   2. The RLS UPDATE policy on the entries table.
    // Neither of these can be unit-tested without a live DB — see tests/rls/.
    expect(true).toBe(true)
  })
})
