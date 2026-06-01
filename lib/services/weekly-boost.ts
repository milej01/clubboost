// ============================================================
// ClubBoost — Weekly Boost Service
//
// All DB access uses the admin client (service role) because this
// module is only ever called from server actions, not client code.
// Every public function returns { data, error } or { error } to
// keep error handling at the action layer.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit }           from './audit'
import {
  summariseFund,
  computeClubEligibility,
} from './boost-calculator'
import type {
  BoostPeriod, BoostPeriodDetail, BoostFundItem, BoostAward,
  BoostEligibleClub, BoostSponsor, BoostContributionSource,
  ClubBoostSummary,
} from '@/types/app'

// ── Internal helpers ──────────────────────────────────────────

async function logBoostEvent(params: {
  periodId?:  string | null
  clubId?:    string | null
  actorId?:   string | null
  actorRole?: string | null
  eventType:  string
  payload:    Record<string, unknown>
}): Promise<void> {
  try {
    const db = createAdminClient()
    await db.from('boost_audit_events').insert({
      period_id:  params.periodId  ?? null,
      club_id:    params.clubId   ?? null,
      actor_id:   params.actorId  ?? null,
      actor_role: params.actorRole ?? 'platform_admin',
      event_type: params.eventType,
      payload:    params.payload,
    })
  } catch (err) {
    console.error('[boost-audit] Failed to write boost audit event:', err)
  }
}

// ── Period management ─────────────────────────────────────────

export interface CreatePeriodInput {
  periodName:    string
  periodStart:   string     // DATE 'YYYY-MM-DD'
  periodEnd:     string     // DATE 'YYYY-MM-DD'
  publishedRules?: string
  notes?:          string
  actorId:         string
}

export async function createPeriod(
  input: CreatePeriodInput,
): Promise<{ period: BoostPeriod | null; error: string | null }> {
  if (!input.periodName.trim()) return { period: null, error: 'Period name is required' }
  if (input.periodStart >= input.periodEnd) {
    return { period: null, error: 'Period end must be after period start' }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('clubboost_weekly_boost_periods')
    .insert({
      period_name:    input.periodName.trim(),
      period_start:   input.periodStart,
      period_end:     input.periodEnd,
      total_pool_pence: 0,
      status:          'draft',
      published_rules: input.publishedRules ?? null,
      notes:           input.notes ?? null,
      created_by:      input.actorId,
    })
    .select()
    .single()

  if (error || !data) return { period: null, error: error?.message ?? 'Failed to create period' }

  await logBoostEvent({
    periodId:  data.id,
    actorId:   input.actorId,
    eventType: 'period_created',
    payload:   { period_name: input.periodName, period_start: input.periodStart, period_end: input.periodEnd },
  })

  await logAudit({
    actorId:    input.actorId,
    entityType: 'boost_period',
    entityId:   data.id,
    action:     'weekly_boost_period_created',
    afterState: { period_name: input.periodName },
  })

  return { period: data as BoostPeriod, error: null }
}

export async function updatePeriodStatus(
  periodId: string,
  status:   'active' | 'closed' | 'awarded',
  actorId:  string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const extra: Record<string, unknown> = {}
  if (status === 'closed')  extra.closed_at  = new Date().toISOString()
  if (status === 'awarded') extra.awarded_at = new Date().toISOString()

  const { error } = await db
    .from('clubboost_weekly_boost_periods')
    .update({ status, ...extra })
    .eq('id', periodId)

  if (error) return { error: error.message }

  await logBoostEvent({
    periodId,
    actorId,
    eventType: status === 'closed' ? 'period_closed' : 'period_status_changed',
    payload:   { status },
  })

  if (status === 'closed') {
    await logAudit({
      actorId,
      entityType: 'boost_period',
      entityId:   periodId,
      action:     'weekly_boost_period_closed',
      afterState: { status },
    })
  }

  return { error: null }
}

export async function updatePeriodRules(
  periodId:       string,
  publishedRules: string,
  notes:          string | null,
  actorId:        string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('clubboost_weekly_boost_periods')
    .update({ published_rules: publishedRules, notes })
    .eq('id', periodId)

  if (error) return { error: error.message }

  await logBoostEvent({
    periodId,
    actorId,
    eventType: 'period_rules_updated',
    payload:   {},
  })

  return { error: null }
}

// ── Fund contributions ────────────────────────────────────────

export interface AddFundItemInput {
  periodId:      string
  sourceType:    BoostContributionSource
  amountPence:   number
  description?:  string
  clubId?:       string
  competitionId?: string
  paymentId?:    string
  entryId?:      string
  sponsorId?:    string
  createdBy:     string
}

export async function addFundItem(
  input: AddFundItemInput,
): Promise<{ item: BoostFundItem | null; error: string | null }> {
  if (input.amountPence <= 0) return { item: null, error: 'Amount must be greater than zero' }

  const db = createAdminClient()

  // Verify period exists and is not closed/awarded
  const { data: period } = await db
    .from('clubboost_weekly_boost_periods')
    .select('status')
    .eq('id', input.periodId)
    .single()

  if (!period) return { item: null, error: 'Boost period not found' }
  if (period.status === 'awarded') return { item: null, error: 'Cannot add contributions to an awarded period' }

  const { data, error } = await db
    .from('clubboost_weekly_boost_contributions')
    .insert({
      period_id:      input.periodId,
      source_type:    input.sourceType,
      amount_pence:   input.amountPence,
      description:    input.description ?? null,
      club_id:        input.clubId       ?? null,
      competition_id: input.competitionId ?? null,
      payment_id:     input.paymentId    ?? null,
      entry_id:       input.entryId      ?? null,
      sponsor_id:     input.sponsorId    ?? null,
      created_by:     input.createdBy,
    })
    .select()
    .single()

  if (error || !data) return { item: null, error: error?.message ?? 'Failed to add fund item' }

  // Update the period's running total
  await db.rpc('rpc_boost_increment_pool', {
    p_period_id:   input.periodId,
    p_amount_pence: input.amountPence,
  }).then(() => {
    // Fallback if RPC not available: direct update with coalesce
  }).catch(async () => {
    await db
      .from('clubboost_weekly_boost_periods')
      .update({ total_pool_pence: db.rpc as unknown as number })
      .eq('id', input.periodId)
  })

  // Simpler approach: recompute total from contributions
  await recomputePeriodTotal(input.periodId)

  await logBoostEvent({
    periodId:  input.periodId,
    clubId:    input.clubId ?? null,
    actorId:   input.createdBy,
    eventType: 'contribution_added',
    payload:   { source_type: input.sourceType, amount_pence: input.amountPence },
  })

  return { item: data as BoostFundItem, error: null }
}

/** Recompute and update a period's total_pool_pence from its contributions. */
async function recomputePeriodTotal(periodId: string): Promise<void> {
  const db = createAdminClient()
  const { data: contributions } = await db
    .from('clubboost_weekly_boost_contributions')
    .select('amount_pence')
    .eq('period_id', periodId)

  const total = (contributions ?? []).reduce((s, c) => s + c.amount_pence, 0)
  await db
    .from('clubboost_weekly_boost_periods')
    .update({ total_pool_pence: total })
    .eq('id', periodId)
}

/**
 * Record a competition payment contribution.
 * Called by the payment service when a payment succeeds on a competition
 * that has weekly_boost_contribution_bps > 0 and there's an active period.
 */
export async function recordPaymentContribution(params: {
  periodId?:      string   // optional — looks up active period if omitted
  paymentId:      string
  entryId:        string
  clubId:         string
  competitionId:  string
  amountPence:    number
}): Promise<{ error: string | null }> {
  // Resolve period: use provided periodId or fall back to the current active period
  let periodId = params.periodId
  if (!periodId) {
    const activePeriod = await getActivePeriod()
    if (!activePeriod) {
      // No active period — silently skip (not an error; just no boost period running)
      return { error: null }
    }
    periodId = activePeriod.id
  }

  const { item, error } = await addFundItem({
    periodId,
    sourceType:     'competition_payment',
    amountPence:    params.amountPence,
    clubId:         params.clubId,
    competitionId:  params.competitionId,
    paymentId:      params.paymentId,
    entryId:        params.entryId,
    createdBy:      params.clubId,  // system-initiated, club credited
    description:    'Automatic contribution from competition entry',
  })

  if (error || !item) return { error }

  await logAudit({
    actorId:    null,
    clubId:     params.clubId,
    entityType: 'boost_contribution',
    entityId:   item.id,
    action:     'weekly_boost_contribution_recorded',
    afterState: { amount_pence: params.amountPence, payment_id: params.paymentId },
  })

  return { error: null }
}

// ── Active period lookup (for payment processing) ─────────────

/**
 * Returns the single active boost period, or null if none.
 * Used by payment processing to determine where to route contributions.
 */
export async function getActivePeriod(): Promise<BoostPeriod | null> {
  const db = createAdminClient()
  const { data } = await db
    .from('clubboost_weekly_boost_periods')
    .select('*')
    .eq('status', 'active')
    .order('period_start', { ascending: false })
    .limit(1)
    .single()

  return data as BoostPeriod | null
}

// ── Sponsor management ────────────────────────────────────────

export async function createSponsor(params: {
  name:         string
  contactName?: string
  contactEmail?: string
  logoUrl?:     string
  websiteUrl?:  string
  notes?:       string
  createdBy:    string
}): Promise<{ sponsor: BoostSponsor | null; error: string | null }> {
  if (!params.name.trim()) return { sponsor: null, error: 'Sponsor name is required' }

  const db = createAdminClient()
  const { data, error } = await db
    .from('boost_sponsors')
    .insert({
      name:          params.name.trim(),
      contact_name:  params.contactName  ?? null,
      contact_email: params.contactEmail ?? null,
      logo_url:      params.logoUrl      ?? null,
      website_url:   params.websiteUrl   ?? null,
      notes:         params.notes        ?? null,
      created_by:    params.createdBy,
    })
    .select()
    .single()

  if (error || !data) return { sponsor: null, error: error?.message ?? 'Failed to create sponsor' }

  await logBoostEvent({
    actorId:   params.createdBy,
    eventType: 'sponsor_created',
    payload:   { name: params.name },
  })

  await logAudit({
    actorId:    params.createdBy,
    entityType: 'boost_sponsor',
    entityId:   data.id,
    action:     'weekly_boost_sponsor_added',
    afterState: { name: params.name },
  })

  return { sponsor: data as BoostSponsor, error: null }
}

export async function getSponsors(): Promise<BoostSponsor[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('boost_sponsors')
    .select('*')
    .order('name')
  return (data ?? []) as BoostSponsor[]
}

export async function updateSponsorStatus(
  sponsorId: string,
  isActive:  boolean,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('boost_sponsors')
    .update({ is_active: isActive })
    .eq('id', sponsorId)
  return { error: error?.message ?? null }
}

// ── Eligibility ───────────────────────────────────────────────

/**
 * Compute which clubs are eligible for a given period, then merge with
 * any stored overrides. Returns a merged list ready for display.
 */
export async function computeEligibleClubs(
  periodId: string,
): Promise<BoostEligibleClub[]> {
  const db = createAdminClient()

  // Get period dates
  const { data: period } = await db
    .from('clubboost_weekly_boost_periods')
    .select('period_start, period_end')
    .eq('id', periodId)
    .single()

  if (!period) return []

  // All approved + enrolled clubs
  const { data: clubs } = await db
    .from('clubs')
    .select('id, name, slug, logo_url, stripe_onboarded, weekly_boost_enrolled, status, deleted_at')
    .is('deleted_at', null)
    .in('status', ['approved'])
    .order('name')

  if (!clubs?.length) return []

  // Clubs that have competition contributions in this period
  const { data: contributingClubs } = await db
    .from('clubboost_weekly_boost_contributions')
    .select('club_id, amount_pence')
    .eq('period_id', periodId)
    .not('club_id', 'is', null)

  const contributionsByClub: Record<string, number> = {}
  for (const c of contributingClubs ?? []) {
    if (c.club_id) {
      contributionsByClub[c.club_id] = (contributionsByClub[c.club_id] ?? 0) + c.amount_pence
    }
  }

  // Clubs with competitions overlapping the period
  const { data: activeCompetitions } = await db
    .from('competitions')
    .select('club_id')
    .in('status', ['open', 'closed', 'settled'])
    .lte('opens_at', period.period_end)
    .gte('closes_at', period.period_start)
    .is('deleted_at', null)

  const clubsWithComps = new Set((activeCompetitions ?? []).map(c => c.club_id))

  // Also consider clubs with any entry-bearing contribution in this period
  for (const clubId of Object.keys(contributionsByClub)) {
    clubsWithComps.add(clubId)
  }

  // Existing manual overrides
  const { data: overrides } = await db
    .from('boost_eligible_clubs')
    .select('*')
    .eq('period_id', periodId)

  const overrideMap = new Map(
    (overrides ?? []).map((o: Record<string, unknown>) => [o.club_id as string, o])
  )

  const results: BoostEligibleClub[] = clubs.map(club => {
    const eligibility = computeClubEligibility({
      clubId:                  club.id,
      isApproved:              club.status === 'approved',
      isStripeOnboarded:       club.stripe_onboarded,
      isEnrolled:              club.weekly_boost_enrolled,
      hasCompetitionsInPeriod: clubsWithComps.has(club.id),
      contributionPence:       contributionsByClub[club.id] ?? 0,
    })

    const override = overrideMap.get(club.id) as unknown as Record<string, unknown> | undefined

    if (override?.is_manually_overridden) {
      return {
        id:                     override.id as string,
        period_id:              periodId,
        club_id:                club.id,
        is_eligible:            override.is_eligible as boolean,
        eligibility_reason:     eligibility.reason,
        ineligibility_reason:   eligibility.ineligibilityReason,
        is_manually_overridden: true,
        override_reason:        override.override_reason as string | null,
        override_by:            override.override_by as string | null,
        override_at:            override.override_at as string | null,
        created_at:             override.created_at as string,
        updated_at:             override.updated_at as string,
        club:                   club as unknown as import('@/types/app').Club,
        contribution_total_pence: contributionsByClub[club.id] ?? 0,
      }
    }

    return {
      id:                     override?.id as string ?? '',
      period_id:              periodId,
      club_id:                club.id,
      is_eligible:            eligibility.isEligible,
      eligibility_reason:     eligibility.reason,
      ineligibility_reason:   eligibility.ineligibilityReason,
      is_manually_overridden: false,
      override_reason:        null,
      override_by:            null,
      override_at:            null,
      created_at:             new Date().toISOString(),
      updated_at:             new Date().toISOString(),
      club:                   club as unknown as import('@/types/app').Club,
      contribution_total_pence: contributionsByClub[club.id] ?? 0,
    }
  })

  // Sort: eligible first, then by contribution desc, then name
  return results.sort((a, b) => {
    if (a.is_eligible !== b.is_eligible) return a.is_eligible ? -1 : 1
    const ac = a.contribution_total_pence ?? 0
    const bc = b.contribution_total_pence ?? 0
    if (bc !== ac) return bc - ac
    return (a.club?.name ?? '').localeCompare(b.club?.name ?? '')
  })
}

export async function setEligibilityOverride(params: {
  periodId:       string
  clubId:         string
  isEligible:     boolean
  overrideReason: string
  actorId:        string
}): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('boost_eligible_clubs')
    .upsert({
      period_id:              params.periodId,
      club_id:                params.clubId,
      is_eligible:            params.isEligible,
      is_manually_overridden: true,
      override_reason:        params.overrideReason,
      override_by:            params.actorId,
      override_at:            new Date().toISOString(),
    }, { onConflict: 'period_id,club_id' })

  if (error) return { error: error.message }

  await logBoostEvent({
    periodId:  params.periodId,
    clubId:    params.clubId,
    actorId:   params.actorId,
    eventType: 'eligibility_overridden',
    payload:   { is_eligible: params.isEligible, reason: params.overrideReason },
  })

  await logAudit({
    actorId:    params.actorId,
    clubId:     params.clubId,
    entityType: 'boost_eligible_clubs',
    action:     'weekly_boost_eligibility_overridden',
    afterState: { is_eligible: params.isEligible, override_reason: params.overrideReason },
  })

  return { error: null }
}

// ── Awards ────────────────────────────────────────────────────

export interface AwardClubInput {
  periodId:    string
  clubId:      string
  amountPence: number
  reason?:     string
  actorId:     string
}

export async function awardClub(
  input: AwardClubInput,
): Promise<{ award: BoostAward | null; error: string | null }> {
  if (input.amountPence <= 0) return { award: null, error: 'Award amount must be greater than zero' }

  const db = createAdminClient()

  // Check for existing non-cancelled award for this club+period
  const { data: existing } = await db
    .from('clubboost_weekly_boost_awards')
    .select('id')
    .eq('period_id', input.periodId)
    .eq('club_id', input.clubId)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existing) {
    return { award: null, error: 'This club already has an active award for this period' }
  }

  // Verify period exists
  const { data: period } = await db
    .from('clubboost_weekly_boost_periods')
    .select('status, total_pool_pence')
    .eq('id', input.periodId)
    .single()

  if (!period) return { award: null, error: 'Boost period not found' }
  if (period.status === 'awarded') {
    return { award: null, error: 'Period is already fully awarded' }
  }

  // Check available fund
  const { data: existingAwards } = await db
    .from('clubboost_weekly_boost_awards')
    .select('amount_pence')
    .eq('period_id', input.periodId)
    .neq('status', 'cancelled')

  const alreadyAwarded = (existingAwards ?? []).reduce((s, a) => s + a.amount_pence, 0)
  const available = period.total_pool_pence - alreadyAwarded

  if (input.amountPence > available) {
    return {
      award: null,
      error: `Award amount £${(input.amountPence / 100).toFixed(2)} exceeds available fund £${(available / 100).toFixed(2)}`,
    }
  }

  const { data: award, error } = await db
    .from('clubboost_weekly_boost_awards')
    .insert({
      period_id:   input.periodId,
      club_id:     input.clubId,
      awarded_by:  input.actorId,
      amount_pence: input.amountPence,
      reason:      input.reason ?? null,
      status:      'pending',
      is_public:   false,
      awarded_at:  new Date().toISOString(),
    })
    .select('*, club:clubs(id, name, slug, logo_url)')
    .single()

  if (error || !award) return { award: null, error: error?.message ?? 'Failed to create award' }

  await logBoostEvent({
    periodId:  input.periodId,
    clubId:    input.clubId,
    actorId:   input.actorId,
    eventType: 'award_granted',
    payload:   { amount_pence: input.amountPence, reason: input.reason },
  })

  await logAudit({
    actorId:    input.actorId,
    clubId:     input.clubId,
    entityType: 'boost_award',
    entityId:   award.id,
    action:     'weekly_boost_awarded',
    afterState: { amount_pence: input.amountPence, period_id: input.periodId },
  })

  return { award: award as unknown as BoostAward, error: null }
}

export async function cancelAward(
  awardId:  string,
  actorId:  string,
  reason?:  string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('clubboost_weekly_boost_awards')
    .update({ status: 'cancelled', reason: reason ?? 'Cancelled by admin' })
    .eq('id', awardId)
    .neq('status', 'paid')   // cannot cancel a paid award

  return { error: error?.message ?? null }
}

export async function confirmAward(
  awardId: string,
  actorId: string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('clubboost_weekly_boost_awards')
    .update({ status: 'confirmed' })
    .eq('id', awardId)
    .eq('status', 'pending')

  return { error: error?.message ?? null }
}

export async function publishAwards(
  periodId:        string,
  actorId:         string,
  publishedSummary?: string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('clubboost_weekly_boost_awards')
    .update({
      is_public:        true,
      published_at:     new Date().toISOString(),
      published_summary: publishedSummary ?? null,
    })
    .eq('period_id', periodId)
    .neq('status', 'cancelled')

  if (error) return { error: error.message }

  // Also mark the period as awarded
  await db
    .from('clubboost_weekly_boost_periods')
    .update({ status: 'awarded', awarded_at: new Date().toISOString() })
    .eq('id', periodId)

  await logBoostEvent({
    periodId,
    actorId,
    eventType: 'awards_published',
    payload:   { published_summary: publishedSummary ?? null },
  })

  await logAudit({
    actorId,
    entityType: 'boost_period',
    entityId:   periodId,
    action:     'weekly_boost_award_published',
    afterState: { status: 'awarded' },
  })

  return { error: null }
}

export async function markAwardPaid(
  awardId:  string,
  payoutId: string,
  actorId:  string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('clubboost_weekly_boost_awards')
    .update({ status: 'paid', payout_id: payoutId })
    .eq('id', awardId)

  return { error: error?.message ?? null }
}

// ── Read operations (admin) ────────────────────────────────────

export async function getPeriodsAdmin(): Promise<BoostPeriod[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('clubboost_weekly_boost_periods')
    .select('*')
    .order('period_start', { ascending: false })
  return (data ?? []) as BoostPeriod[]
}

export async function getPeriodDetail(periodId: string): Promise<BoostPeriodDetail | null> {
  const db = createAdminClient()

  const [{ data: period }, { data: rawItems }, { data: rawAwards }] = await Promise.all([
    db.from('clubboost_weekly_boost_periods').select('*').eq('id', periodId).single(),
    db.from('clubboost_weekly_boost_contributions')
       .select('*, club:clubs(id,name,slug), competition:competitions(id,title), sponsor:boost_sponsors(id,name)')
       .eq('period_id', periodId)
       .order('created_at'),
    db.from('clubboost_weekly_boost_awards')
       .select('*, club:clubs(id,name,slug,logo_url)')
       .eq('period_id', periodId)
       .order('created_at'),
  ])

  if (!period) return null

  const items = (rawItems ?? []) as BoostFundItem[]
  const awards = (rawAwards ?? []) as BoostAward[]
  const summary = summariseFund(items)

  const eligibleClubs = await computeEligibleClubs(periodId)

  return {
    ...(period as BoostPeriod),
    fund_items:       items,
    eligible_clubs:   eligibleClubs,
    awards,
    total_fund_pence: summary.totalPence,
    fund_by_source:   summary.bySource,
  }
}

export async function getAwardsForPeriod(periodId: string): Promise<BoostAward[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('clubboost_weekly_boost_awards')
    .select('*, club:clubs(id,name,slug,logo_url)')
    .eq('period_id', periodId)
    .order('created_at')
  return (data ?? []) as BoostAward[]
}

export async function getPeriodContributions(periodId: string): Promise<BoostFundItem[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('clubboost_weekly_boost_contributions')
    .select('*, club:clubs(id,name,slug), competition:competitions(id,title), sponsor:boost_sponsors(id,name)')
    .eq('period_id', periodId)
    .order('created_at', { ascending: false })
  return (data ?? []) as BoostFundItem[]
}

// ── Read operations (club dashboard) ─────────────────────────

export async function getClubBoostSummary(clubId: string): Promise<ClubBoostSummary> {
  const db = createAdminClient()

  // Get active period (if any)
  const { data: activePeriod } = await db
    .from('clubboost_weekly_boost_periods')
    .select('*')
    .eq('status', 'active')
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Get club info
  const { data: club } = await db
    .from('clubs')
    .select('stripe_onboarded, weekly_boost_enrolled, status')
    .eq('id', clubId)
    .single()

  // Club's total contributions in the active period
  let totalContributedPence = 0
  let isEligible = false
  let eligibilityReason: string | null = null

  if (activePeriod && club) {
    const { data: contributions } = await db
      .from('clubboost_weekly_boost_contributions')
      .select('amount_pence')
      .eq('period_id', activePeriod.id)
      .eq('club_id', clubId)

    totalContributedPence = (contributions ?? []).reduce((s, c) => s + c.amount_pence, 0)

    // Check for manual override
    const { data: override } = await db
      .from('boost_eligible_clubs')
      .select('is_eligible, eligibility_reason, ineligibility_reason, is_manually_overridden')
      .eq('period_id', activePeriod.id)
      .eq('club_id', clubId)
      .maybeSingle()

    if (override?.is_manually_overridden) {
      isEligible = override.is_eligible
      eligibilityReason = override.is_eligible
        ? (override.eligibility_reason ?? 'Selected by platform admin')
        : (override.ineligibility_reason ?? 'Excluded by platform admin')
    } else {
      const result = computeClubEligibility({
        clubId,
        isApproved:              club.status === 'approved',
        isStripeOnboarded:       club.stripe_onboarded,
        isEnrolled:              club.weekly_boost_enrolled,
        hasCompetitionsInPeriod: totalContributedPence > 0,
        contributionPence:       totalContributedPence,
      })
      isEligible = result.isEligible
      eligibilityReason = result.isEligible ? result.reason : result.ineligibilityReason
    }
  }

  // Award history (public only)
  const { data: awards } = await db
    .from('clubboost_weekly_boost_awards')
    .select('*, period:clubboost_weekly_boost_periods(id,period_name,period_start,period_end)')
    .eq('club_id', clubId)
    .eq('is_public', true)
    .neq('status', 'cancelled')
    .order('awarded_at', { ascending: false })

  return {
    is_enrolled:              club?.weekly_boost_enrolled ?? false,
    active_period:            activePeriod as BoostPeriod | null,
    is_eligible:              isEligible,
    eligibility_reason:       eligibilityReason,
    total_contributed_pence:  totalContributedPence,
    award_history:            (awards ?? []) as BoostAward[],
  }
}

export async function getAwardsForClub(clubId: string): Promise<BoostAward[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('clubboost_weekly_boost_awards')
    .select('*, period:clubboost_weekly_boost_periods(id,period_name,period_start,period_end)')
    .eq('club_id', clubId)
    .eq('is_public', true)
    .neq('status', 'cancelled')
    .order('awarded_at', { ascending: false })
  return (data ?? []) as BoostAward[]
}

// ── Export ────────────────────────────────────────────────────

/**
 * Generate a CSV report for a period.
 * Returns a CSV string suitable for download.
 */
export async function exportPeriodReport(periodId: string): Promise<string> {
  const detail = await getPeriodDetail(periodId)
  if (!detail) return 'Error: period not found'

  const lines: string[] = [
    // Period header
    `"Weekly Boost Period Report"`,
    `"Period","${detail.period_name}"`,
    `"Dates","${detail.period_start} to ${detail.period_end}"`,
    `"Status","${detail.status}"`,
    `"Total Fund","£${(detail.total_fund_pence / 100).toFixed(2)}"`,
    ``,
    // Contributions
    `"CONTRIBUTIONS"`,
    `"Date","Source","Club","Competition","Amount"`,
    ...detail.fund_items.map(item =>
      [
        `"${item.created_at.split('T')[0]}"`,
        `"${item.source_type}"`,
        `"${item.club?.name ?? '-'}"`,
        `"${item.competition?.title ?? '-'}"`,
        `"£${(item.amount_pence / 100).toFixed(2)}"`,
      ].join(',')
    ),
    ``,
    // Awards
    `"AWARDS"`,
    `"Club","Amount","Status","Reason","Awarded At"`,
    ...detail.awards.map(award =>
      [
        `"${award.club?.name ?? award.club_id}"`,
        `"£${(award.amount_pence / 100).toFixed(2)}"`,
        `"${award.status}"`,
        `"${award.reason ?? ''}"`,
        `"${award.awarded_at.split('T')[0]}"`,
      ].join(',')
    ),
  ]

  return lines.join('\n')
}
