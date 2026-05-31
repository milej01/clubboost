/**
 * Admin-only service queries.
 * All functions use the admin client (bypasses RLS).
 * Callers are responsible for ensuring the actor is a platform_admin.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { formatPence } from '@/lib/utils'

export const ADMIN_PAGE_SIZE = 25

// ── Types ────────────────────────────────────────────────────

export interface AdminClubRow {
  id:               string
  name:             string
  slug:             string
  status:           string
  sport:            string | null
  location:         string | null
  contact_email:    string | null
  stripe_onboarded: boolean
  weekly_boost_eligible: boolean
  created_at:       string
  competition_count: number
  total_raised_pence: number
}

export interface AdminCompetitionRow {
  id:              string
  title:           string
  type:            string
  status:          string
  entry_fee_pence: number
  entry_count:     number
  total_pot_pence: number
  closes_at:       string | null
  created_at:      string
  club_id:         string
  club_name:       string
  club_slug:       string
}

export interface AdminPaymentRow {
  id:                          string
  created_at:                  string
  status:                      string
  amount_pence:                number
  platform_fee_pence:          number
  club_fundraising_amount_pence: number
  prize_pool_contribution_pence: number
  stripe_payment_intent_id:    string | null
  competition_id:              string
  competition_title:           string
  club_name:                   string
  user_email:                  string | null
}

export interface AdminAuditRow {
  id:          string
  created_at:  string
  actor_id:    string | null
  actor_name:  string | null
  entity_type: string
  entity_id:   string | null
  action:      string
  club_id:     string | null
  after_state: Record<string, unknown> | null
}

export interface PlatformSettings {
  platform_fee_bps:         number
  weekly_boost_default_bps: number
  min_entry_fee_pence:      number
  max_entry_fee_pence:      number
  terms_version:            string
}

export interface AdminStats {
  club_count:           number
  pending_club_count:   number
  approved_club_count:  number
  active_competition_count: number
  total_volume_pence:   number
  platform_revenue_pence: number
  weekly_boost_balance_pence: number
  total_entries:        number
}

// ── Clubs ────────────────────────────────────────────────────

export interface GetClubsParams {
  status?:  string
  q?:       string
  page?:    number
}

export async function getAdminClubs({ status, q, page = 1 }: GetClubsParams = {}): Promise<{
  clubs: AdminClubRow[]
  total: number
  totalPages: number
}> {
  const db   = createAdminClient()
  const from = (page - 1) * ADMIN_PAGE_SIZE
  const to   = from + ADMIN_PAGE_SIZE - 1

  let query = db
    .from('clubs')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (q)      query = query.ilike('name', `%${q}%`)

  const { data: clubs, count } = await query.range(from, to)
  if (!clubs) return { clubs: [], total: 0, totalPages: 0 }

  // Enrich with competition count + total raised (batch, not per-row)
  const clubIds = clubs.map(c => c.id)

  const { data: compCounts } = await db
    .from('competitions')
    .select('club_id')
    .in('club_id', clubIds)
    .is('deleted_at', null)

  const { data: paymentTotals } = await db
    .from('payments')
    .select('amount_pence, competition_id')
    .eq('status', 'succeeded')

  // Build lookup maps
  const countMap: Record<string, number> = {}
  for (const c of compCounts ?? []) {
    countMap[c.club_id] = (countMap[c.club_id] ?? 0) + 1
  }

  // Get competition→club mapping
  const { data: compClubs } = await db
    .from('competitions')
    .select('id, club_id')
    .in('club_id', clubIds)

  const compToClub: Record<string, string> = {}
  for (const cc of compClubs ?? []) compToClub[cc.id] = cc.club_id

  const raisedMap: Record<string, number> = {}
  for (const p of paymentTotals ?? []) {
    const cid = compToClub[p.competition_id]
    if (cid) raisedMap[cid] = (raisedMap[cid] ?? 0) + p.amount_pence
  }

  const rows: AdminClubRow[] = clubs.map(c => ({
    id:               c.id,
    name:             c.name,
    slug:             c.slug ?? '',
    status:           c.status,
    sport:            c.sport ?? null,
    location:         c.location ?? null,
    contact_email:    c.contact_email ?? null,
    stripe_onboarded: c.stripe_onboarded ?? false,
    weekly_boost_eligible: c.weekly_boost_eligible ?? false,
    created_at:       c.created_at,
    competition_count: countMap[c.id] ?? 0,
    total_raised_pence: raisedMap[c.id] ?? 0,
  }))

  const total = count ?? 0
  return { clubs: rows, total, totalPages: Math.ceil(total / ADMIN_PAGE_SIZE) }
}

// Full club detail for admin
export async function getAdminClubDetail(clubId: string) {
  const db = createAdminClient()

  const [{ data: club }, { data: competitions }, { data: recentPayments }, { data: members }] =
    await Promise.all([
      db.from('clubs').select('*').eq('id', clubId).single(),
      db.from('competitions')
        .select('id, title, type, status, entry_fee_pence, closes_at, created_at')
        .eq('club_id', clubId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10),
      db.from('payments')
        .select('id, amount_pence, platform_fee_pence, status, created_at, stripe_payment_intent_id, competition_id')
        .eq('status', 'succeeded')
        .order('created_at', { ascending: false })
        .limit(20),
      db.from('club_members')
        .select('user_id, role, profiles(display_name, email)')
        .eq('club_id', clubId),
    ])

  if (!club) return null

  // Get entry counts per competition
  const compIds = (competitions ?? []).map(c => c.id)
  const { data: entryCounts } = compIds.length
    ? await db
        .from('entries')
        .select('competition_id')
        .in('competition_id', compIds)
        .in('status', ['active', 'winner', 'eliminated'])
    : { data: [] }

  const entryMap: Record<string, number> = {}
  for (const e of entryCounts ?? []) {
    entryMap[e.competition_id] = (entryMap[e.competition_id] ?? 0) + 1
  }

  // Filter recent payments to this club's competitions
  const clubCompIds = new Set(compIds)
  const clubPayments = (recentPayments ?? []).filter(p => clubCompIds.has(p.competition_id))

  const totalRaised = clubPayments.reduce((s, p) => s + p.amount_pence, 0)
  const totalFees   = clubPayments.reduce((s, p) => s + (p.platform_fee_pence ?? 0), 0)

  return {
    club,
    competitions: (competitions ?? []).map(c => ({
      ...c,
      entry_count: entryMap[c.id] ?? 0,
    })),
    recentPayments: clubPayments,
    members:        members ?? [],
    stats: {
      competition_count: (competitions ?? []).length,
      total_raised_pence: totalRaised,
      total_fees_pence:   totalFees,
      active_count: (competitions ?? []).filter(c => c.status === 'open').length,
    },
  }
}

// ── Competitions ─────────────────────────────────────────────

export interface GetCompetitionsParams {
  status?:  string
  type?:    string
  club_id?: string
  q?:       string
  page?:    number
}

export async function getAdminCompetitions({
  status, type, club_id, q, page = 1,
}: GetCompetitionsParams = {}): Promise<{
  competitions: AdminCompetitionRow[]
  total: number
  totalPages: number
}> {
  const db   = createAdminClient()
  const from = (page - 1) * ADMIN_PAGE_SIZE
  const to   = from + ADMIN_PAGE_SIZE - 1

  let query = db
    .from('competitions')
    .select('*, club:clubs(name, slug)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (status)  query = query.eq('status', status)
  if (type)    query = query.eq('type', type)
  if (club_id) query = query.eq('club_id', club_id)
  if (q)       query = query.ilike('title', `%${q}%`)

  const { data, count } = await query.range(from, to)
  if (!data) return { competitions: [], total: 0, totalPages: 0 }

  // Get entry counts in bulk
  const ids = data.map(c => c.id)
  const { data: entries } = ids.length
    ? await db
        .from('entries')
        .select('competition_id')
        .in('competition_id', ids)
        .in('status', ['active', 'winner', 'eliminated'])
    : { data: [] }

  const entryMap: Record<string, number> = {}
  for (const e of entries ?? []) {
    entryMap[e.competition_id] = (entryMap[e.competition_id] ?? 0) + 1
  }

  const rows: AdminCompetitionRow[] = data.map(c => {
    const club = c.club as { name: string; slug: string } | null
    const count = entryMap[c.id] ?? 0
    return {
      id:              c.id,
      title:           c.title,
      type:            c.type,
      status:          c.status,
      entry_fee_pence: c.entry_fee_pence,
      entry_count:     count,
      total_pot_pence: count * c.entry_fee_pence,
      closes_at:       c.closes_at ?? null,
      created_at:      c.created_at,
      club_id:         c.club_id,
      club_name:       club?.name ?? '—',
      club_slug:       club?.slug ?? '',
    }
  })

  const total = count ?? 0
  return { competitions: rows, total, totalPages: Math.ceil(total / ADMIN_PAGE_SIZE) }
}

export async function getAdminCompetitionDetail(id: string) {
  const db = createAdminClient()

  const [{ data: comp }, { data: entries }, { data: auditLogs }] = await Promise.all([
    db.from('competitions')
      .select('*, club:clubs(name, slug, id)')
      .eq('id', id)
      .single(),
    db.from('entries')
      .select('id, status, created_at, entry_data, participant_id, profiles(display_name, email)')
      .eq('competition_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('audit_log')
      .select('id, action, created_at, after_state, actor_id, profiles(display_name)')
      .eq('entity_id', id)
      .eq('entity_type', 'competition')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (!comp) return null

  return { competition: comp, entries: entries ?? [], auditLogs: auditLogs ?? [] }
}

// ── Payments ─────────────────────────────────────────────────

export interface GetPaymentsParams {
  status?:  string
  q?:       string
  page?:    number
}

export async function getAdminPaymentsPaginated({ status, q, page = 1 }: GetPaymentsParams = {}): Promise<{
  payments: AdminPaymentRow[]
  total:    number
  totalPages: number
}> {
  const db   = createAdminClient()
  const from = (page - 1) * ADMIN_PAGE_SIZE
  const to   = from + ADMIN_PAGE_SIZE - 1

  let query = db
    .from('payments')
    .select(
      `id, created_at, status, amount_pence, platform_fee_pence,
       club_fundraising_amount_pence, prize_pool_contribution_pence,
       stripe_payment_intent_id, competition_id,
       competition:competitions(title, club:clubs(name)),
       profile:profiles(email)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (q)      query = query.ilike('stripe_payment_intent_id', `%${q}%`)

  const { data, count } = await query.range(from, to)
  if (!data) return { payments: [], total: 0, totalPages: 0 }

  const rows: AdminPaymentRow[] = data.map(p => {
    const comp    = p.competition as { title: string; club: { name: string } | null } | null
    const profile = p.profile as { email: string } | null
    return {
      id:                          p.id,
      created_at:                  p.created_at,
      status:                      p.status,
      amount_pence:                p.amount_pence,
      platform_fee_pence:          p.platform_fee_pence ?? 0,
      club_fundraising_amount_pence: p.club_fundraising_amount_pence ?? 0,
      prize_pool_contribution_pence: p.prize_pool_contribution_pence ?? 0,
      stripe_payment_intent_id:    p.stripe_payment_intent_id ?? null,
      competition_id:              p.competition_id,
      competition_title:           comp?.title ?? '—',
      club_name:                   comp?.club?.name ?? '—',
      user_email:                  profile?.email ?? null,
    }
  })

  const total = count ?? 0
  return { payments: rows, total, totalPages: Math.ceil(total / ADMIN_PAGE_SIZE) }
}

// ── Audit log ────────────────────────────────────────────────

export interface GetAuditParams {
  entity_type?: string
  q?:           string
  page?:        number
}

export async function getAdminAuditLog({ entity_type, q, page = 1 }: GetAuditParams = {}): Promise<{
  logs:       AdminAuditRow[]
  total:      number
  totalPages: number
}> {
  const db   = createAdminClient()
  const from = (page - 1) * ADMIN_PAGE_SIZE
  const to   = from + ADMIN_PAGE_SIZE - 1

  let query = db
    .from('audit_log')
    .select('*, actor:profiles(display_name)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (entity_type) query = query.eq('entity_type', entity_type)
  if (q)           query = query.or(`action.ilike.%${q}%,entity_id.ilike.%${q}%`)

  const { data, count } = await query.range(from, to)
  if (!data) return { logs: [], total: 0, totalPages: 0 }

  const logs: AdminAuditRow[] = data.map(l => {
    const actor = l.actor as { display_name: string } | null
    return {
      id:          l.id,
      created_at:  l.created_at,
      actor_id:    l.actor_id ?? null,
      actor_name:  actor?.display_name ?? null,
      entity_type: l.entity_type,
      entity_id:   l.entity_id ?? null,
      action:      l.action,
      club_id:     l.club_id ?? null,
      after_state: l.after_state as Record<string, unknown> | null,
    }
  })

  const total = count ?? 0
  return { logs, total, totalPages: Math.ceil(total / ADMIN_PAGE_SIZE) }
}

// ── Platform stats ───────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const db = createAdminClient()

  const [
    { count: clubCount },
    { count: pendingCount },
    { count: approvedCount },
    { count: activeCompCount },
    { data: payments },
    { data: boostPeriods },
    { count: entryCount },
  ] = await Promise.all([
    db.from('clubs').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('clubs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('clubs').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    db.from('competitions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('payments').select('amount_pence, platform_fee_pence').eq('status', 'succeeded'),
    db.from('weekly_boost_periods')
      .select('fund_balance_pence')
      .eq('status', 'active')
      .limit(1),
    db.from('entries').select('*', { count: 'exact', head: true }).in('status', ['active', 'winner', 'eliminated']),
  ])

  const totalVolume   = (payments ?? []).reduce((s, p) => s + p.amount_pence, 0)
  const totalRevenue  = (payments ?? []).reduce((s, p) => s + (p.platform_fee_pence ?? 0), 0)
  const boostBalance  = boostPeriods?.[0]?.fund_balance_pence ?? 0

  return {
    club_count:               clubCount ?? 0,
    pending_club_count:       pendingCount ?? 0,
    approved_club_count:      approvedCount ?? 0,
    active_competition_count: activeCompCount ?? 0,
    total_volume_pence:       totalVolume,
    platform_revenue_pence:   totalRevenue,
    weekly_boost_balance_pence: boostBalance,
    total_entries:            entryCount ?? 0,
  }
}

// ── Platform settings ────────────────────────────────────────

export async function getPlatformSettings(): Promise<PlatformSettings | null> {
  const db = createAdminClient()
  const { data } = await db
    .from('platform_settings')
    .select('*')
    .single()

  if (!data) return {
    platform_fee_bps:         300,  // 3%
    weekly_boost_default_bps: 200,  // 2%
    min_entry_fee_pence:      100,  // £1
    max_entry_fee_pence:      10000, // £100
    terms_version:            '1.0',
  }

  return data as PlatformSettings
}

// ── Feature flags ────────────────────────────────────────────

export interface FeatureFlag {
  key:         string
  enabled:     boolean
  description: string
  metadata:    Record<string, unknown> | null
  updated_at:  string
}

export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('feature_flags')
    .select('*')
    .order('key')

  return (data ?? []) as FeatureFlag[]
}

// ── CSV helpers ──────────────────────────────────────────────

export function paymentsToCsv(payments: AdminPaymentRow[]): string {
  const header = [
    'ID', 'Date', 'Status', 'Amount (£)', 'Platform Fee (£)',
    'Club Fundraising (£)', 'Prize Pool (£)',
    'Competition', 'Club', 'User Email', 'Stripe PI',
  ].join(',')

  const rows = payments.map(p => [
    p.id,
    p.created_at,
    p.status,
    (p.amount_pence / 100).toFixed(2),
    (p.platform_fee_pence / 100).toFixed(2),
    (p.club_fundraising_amount_pence / 100).toFixed(2),
    (p.prize_pool_contribution_pence / 100).toFixed(2),
    `"${p.competition_title.replace(/"/g, '""')}"`,
    `"${p.club_name.replace(/"/g, '""')}"`,
    p.user_email ?? '',
    p.stripe_payment_intent_id ?? '',
  ].join(','))

  return [header, ...rows].join('\n')
}

export function clubsToCsv(clubs: AdminClubRow[]): string {
  const header = [
    'ID', 'Name', 'Slug', 'Status', 'Sport', 'Location',
    'Contact Email', 'Stripe Onboarded', 'Boost Eligible',
    'Competitions', 'Total Raised (£)', 'Joined',
  ].join(',')

  const rows = clubs.map(c => [
    c.id,
    `"${c.name.replace(/"/g, '""')}"`,
    c.slug,
    c.status,
    c.sport ?? '',
    c.location ?? '',
    c.contact_email ?? '',
    c.stripe_onboarded ? 'Yes' : 'No',
    c.weekly_boost_eligible ? 'Yes' : 'No',
    c.competition_count,
    (c.total_raised_pence / 100).toFixed(2),
    c.created_at,
  ].join(','))

  return [header, ...rows].join('\n')
}
