/**
 * Supabase mock helpers for Vitest unit tests.
 *
 * These utilities remove the need to start a live Supabase instance for tests
 * that only care about service-layer logic (guards, calculations, state machines).
 *
 * Usage:
 *   vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
 *   import { createAdminClient } from '@/lib/supabase/admin'
 *   // in each test:
 *   vi.mocked(createAdminClient).mockReturnValue(makeDb({ ... }))
 */

import { vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Fluent chain builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a chainable Supabase-like query builder that resolves `result`
 * when awaited (either directly or via `.single()` / `.maybeSingle()`).
 *
 * Every method except the two terminal ones returns a new chain with the
 * same underlying result, so call order doesn't matter for simple tests.
 */
export function chain(result: Record<string, unknown> = { data: null, error: null }) {
  const p = Promise.resolve(result)

  const self: Record<string, unknown> = {
    // Builder methods — each returns a new chain with the same result
    select:     (..._: unknown[]) => chain(result),
    insert:     (..._: unknown[]) => chain(result),
    update:     (..._: unknown[]) => chain(result),
    upsert:     (..._: unknown[]) => chain(result),
    delete:     (..._: unknown[]) => chain(result),
    eq:         (..._: unknown[]) => chain(result),
    neq:        (..._: unknown[]) => chain(result),
    in:         (..._: unknown[]) => chain(result),
    not:        (..._: unknown[]) => chain(result),
    is:         (..._: unknown[]) => chain(result),
    gt:         (..._: unknown[]) => chain(result),
    gte:        (..._: unknown[]) => chain(result),
    lt:         (..._: unknown[]) => chain(result),
    lte:        (..._: unknown[]) => chain(result),
    order:      (..._: unknown[]) => chain(result),
    limit:      (..._: unknown[]) => chain(result),
    range:      (..._: unknown[]) => chain(result),
    filter:     (..._: unknown[]) => chain(result),
    match:      (..._: unknown[]) => chain(result),
    ilike:      (..._: unknown[]) => chain(result),
    like:       (..._: unknown[]) => chain(result),
    contains:   (..._: unknown[]) => chain(result),
    overlaps:   (..._: unknown[]) => chain(result),
    textSearch: (..._: unknown[]) => chain(result),
    head:       (..._: unknown[]) => chain(result),

    // Terminal methods — return the underlying Promise
    single:      () => p,
    maybeSingle: () => p,

    // Make the chain itself awaitable (for `await db.from().update().eq()` patterns)
    then:    p.then.bind(p),
    catch:   p.catch.bind(p),
    finally: p.finally.bind(p),
  }

  return self as ReturnType<typeof _dummyChainType>
}

// Type inference helper (never called)
function _dummyChainType() { return chain({}) }

// ─────────────────────────────────────────────────────────────────────────────
// Per-table database mock
// ─────────────────────────────────────────────────────────────────────────────

type TableResult = Record<string, unknown>

/**
 * Build a mock DB client where each table has one fixed response.
 *
 * For functions that call the same table multiple times with different
 * expected results, use `makeDbSequenced` instead.
 */
export function makeDb(responses: Record<string, TableResult> = {}) {
  const DEFAULT: TableResult = { data: null, error: null }
  return {
    from: vi.fn((table: string) => chain(responses[table] ?? DEFAULT)),
  }
}

/**
 * Build a mock DB client where `from()` calls return responses in sequence
 * (using `mockReturnValueOnce` under the hood).
 *
 * Each element in `sequence` is either:
 *   - a table result `{ data, error }` — returned from the next `from()` call
 *   - the string `'*default*'` — falls through to `defaultResult`
 *
 * Example:
 *   makeDbSequenced([
 *     { data: compRow },          // 1st from('competitions') → current status
 *     { error: null },            // 2nd from('clubs')        → club status
 *     { error: null },            // 3rd from('competitions') → update
 *     { data: null, error: null },// 4th from('audit_log')   → logAudit insert
 *   ])
 */
export function makeDbSequenced(sequence: TableResult[]) {
  const fromMock = vi.fn()
  for (const result of sequence) {
    fromMock.mockReturnValueOnce(chain(result))
  }
  // Fallback for any calls beyond the sequence
  fromMock.mockReturnValue(chain({ data: null, error: null }))
  return { from: fromMock }
}

/**
 * Convenience: spy on every `.insert()` call across all tables so you
 * can assert which tables were written.
 *
 * Returns `{ from, insertSpy }`.
 */
export function makeDbWithInsertSpy(responses: Record<string, TableResult> = {}) {
  const insertSpy = vi.fn((..._: unknown[]) => chain({ data: null, error: null }))
  const DEFAULT: TableResult = { data: null, error: null }

  return {
    from: vi.fn((table: string) => {
      const base = chain(responses[table] ?? DEFAULT) as any
      // Wrap insert so the spy fires before the chain continues
      base.insert = (...args: unknown[]) => {
        insertSpy(table, ...args)
        return chain({ data: null, error: null })
      }
      return base
    }),
    insertSpy,
  }
}
