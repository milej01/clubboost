'use server'

import { createClient }        from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { isFeatureEnabled }    from '@/lib/feature-flags'
import {
  createPeriod,
  updatePeriodStatus,
  updatePeriodRules,
  addFundItem,
  createSponsor,
  updateSponsorStatus,
  setEligibilityOverride,
  awardClub,
  cancelAward,
  confirmAward,
  publishAwards,
  markAwardPaid,
  exportPeriodReport,
} from '@/lib/services/weekly-boost'
import { createPayout } from '@/lib/services/payouts'
import { revalidatePath } from 'next/cache'
import type { ActionResult, BoostContributionSource } from '@/types/app'

// ── Auth helpers ──────────────────────────────────────────────

async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Unauthorized' as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'platform_admin') {
    return { user: null, error: 'Platform admin access required' as const }
  }
  return { user, error: null }
}

async function requireClubAdmin(clubId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Unauthorized' as const }

  const { data: member } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .maybeSingle()

  if (!member) return { user: null, error: 'Club admin access required' as const }
  return { user, error: null }
}

async function requireBoostEnabled() {
  const enabled = await isFeatureEnabled('weekly_boost')
  if (!enabled) return 'Weekly Boost feature is not currently enabled'
  return null
}

// ── Period actions ────────────────────────────────────────────

export async function createBoostPeriodAction(params: {
  periodName:     string
  periodStart:    string
  periodEnd:      string
  publishedRules?: string
  notes?:          string
}): Promise<ActionResult<{ periodId: string }>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const boostError = await requireBoostEnabled()
  if (boostError) return { success: false, error: boostError }

  const { period, error } = await createPeriod({ ...params, actorId: user.id })
  if (error || !period) return { success: false, error: error ?? 'Failed to create period' }

  revalidatePath('/admin/weekly-boost')
  return { success: true, data: { periodId: period.id } }
}

export async function updatePeriodStatusAction(
  periodId: string,
  status:   'active' | 'closed' | 'awarded',
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await updatePeriodStatus(periodId, status, user.id)
  if (error) return { success: false, error }

  revalidatePath('/admin/weekly-boost')
  revalidatePath(`/admin/weekly-boost/${periodId}`)
  return { success: true, data: undefined }
}

export async function updatePeriodRulesAction(params: {
  periodId:       string
  publishedRules: string
  notes?:         string
}): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await updatePeriodRules(
    params.periodId,
    params.publishedRules,
    params.notes ?? null,
    user.id,
  )
  if (error) return { success: false, error }

  revalidatePath(`/admin/weekly-boost/${params.periodId}`)
  return { success: true, data: undefined }
}

// ── Fund contribution actions ─────────────────────────────────

export async function addFundItemAction(params: {
  periodId:      string
  sourceType:    BoostContributionSource
  amountPence:   number
  description?:  string
  sponsorId?:    string
  clubId?:       string
  competitionId?: string
}): Promise<ActionResult<{ itemId: string }>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const boostError = await requireBoostEnabled()
  if (boostError) return { success: false, error: boostError }

  const { item, error } = await addFundItem({ ...params, createdBy: user.id })
  if (error || !item) return { success: false, error: error ?? 'Failed to add contribution' }

  revalidatePath(`/admin/weekly-boost/${params.periodId}`)
  return { success: true, data: { itemId: item.id } }
}

// ── Sponsor actions ───────────────────────────────────────────

export async function createSponsorAction(params: {
  name:          string
  contactName?:  string
  contactEmail?: string
  logoUrl?:      string
  websiteUrl?:   string
  notes?:        string
}): Promise<ActionResult<{ sponsorId: string }>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { sponsor, error } = await createSponsor({ ...params, createdBy: user.id })
  if (error || !sponsor) return { success: false, error: error ?? 'Failed to create sponsor' }

  revalidatePath('/admin/weekly-boost/sponsors')
  return { success: true, data: { sponsorId: sponsor.id } }
}

export async function updateSponsorStatusAction(
  sponsorId: string,
  isActive:  boolean,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await updateSponsorStatus(sponsorId, isActive)
  if (error) return { success: false, error }

  revalidatePath('/admin/weekly-boost/sponsors')
  return { success: true, data: undefined }
}

// ── Eligibility actions ───────────────────────────────────────

export async function setEligibilityOverrideAction(params: {
  periodId:       string
  clubId:         string
  isEligible:     boolean
  overrideReason: string
}): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await setEligibilityOverride({ ...params, actorId: user.id })
  if (error) return { success: false, error }

  revalidatePath(`/admin/weekly-boost/${params.periodId}`)
  return { success: true, data: undefined }
}

// ── Award actions ─────────────────────────────────────────────

export async function awardClubAction(params: {
  periodId:    string
  clubId:      string
  amountPence: number
  reason?:     string
}): Promise<ActionResult<{ awardId: string }>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const boostError = await requireBoostEnabled()
  if (boostError) return { success: false, error: boostError }

  const { award, error } = await awardClub({ ...params, actorId: user.id })
  if (error || !award) return { success: false, error: error ?? 'Failed to create award' }

  revalidatePath('/admin/weekly-boost')
  revalidatePath(`/admin/weekly-boost/${params.periodId}`)
  return { success: true, data: { awardId: award.id } }
}

export async function cancelAwardAction(
  awardId: string,
  reason?: string,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await cancelAward(awardId, user.id, reason)
  if (error) return { success: false, error }

  revalidatePath('/admin/weekly-boost')
  return { success: true, data: undefined }
}

export async function confirmAwardAction(awardId: string): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await confirmAward(awardId, user.id)
  if (error) return { success: false, error }

  return { success: true, data: undefined }
}

export async function publishAwardsAction(
  periodId:         string,
  publishedSummary?: string,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await publishAwards(periodId, user.id, publishedSummary)
  if (error) return { success: false, error }

  revalidatePath('/admin/weekly-boost')
  revalidatePath(`/admin/weekly-boost/${periodId}`)
  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

/** Award + immediately initiate a payout to the club. */
export async function awardAndPayoutAction(params: {
  periodId:    string
  clubId:      string
  amountPence: number
  reason?:     string
}): Promise<ActionResult<{ awardId: string; payoutId: string }>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const boostError = await requireBoostEnabled()
  if (boostError) return { success: false, error: boostError }

  // Create award
  const { award, error: awardError } = await awardClub({ ...params, actorId: user.id })
  if (awardError || !award) return { success: false, error: awardError ?? 'Failed to create award' }

  // Create payout
  const { payout, error: payoutError } = await createPayout({
    competitionId: '00000000-0000-0000-0000-000000000000',   // platform-level
    clubId:        params.clubId,
    type:          'weekly_boost',
    amountPence:   params.amountPence,
    notes:         `Weekly Boost award for period ${params.periodId}. ${params.reason ?? ''}`.trim(),
    initiatedBy:   user.id,
  })

  if (payout) {
    await markAwardPaid(award.id, payout.id, user.id)
  }

  revalidatePath('/admin/weekly-boost')
  revalidatePath(`/admin/weekly-boost/${params.periodId}`)
  return {
    success: true,
    data: { awardId: award.id, payoutId: payout?.id ?? '' },
  }
}

// ── Club-facing actions ───────────────────────────────────────

export async function enrollInBoostAction(
  clubId:   string,
  enrolled: boolean,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requireClubAdmin(clubId)
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('clubs')
    .update({ weekly_boost_enrolled: enrolled })
    .eq('id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/club/settings')
  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

// ── Export action ─────────────────────────────────────────────

export async function exportPeriodReportAction(
  periodId: string,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const csv = await exportPeriodReport(periodId)
  const filename = `weekly-boost-${periodId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`

  return { success: true, data: { csv, filename } }
}

// ── Backward compatibility ────────────────────────────────────

/** @deprecated use awardClubAction */
export async function awardWeeklyBoostAction(params: {
  periodId:    string
  clubId:      string
  amountPence: number
  source:      BoostContributionSource
  notes?:      string
}): Promise<ActionResult<{ awardId: string }>> {
  return awardClubAction({ ...params, reason: params.notes })
}

/** @deprecated use enrollInBoostAction */
export async function enrollClubInBoostAction(
  clubId:   string,
  enrolled: boolean,
): Promise<ActionResult<void>> {
  return enrollInBoostAction(clubId, enrolled)
}
