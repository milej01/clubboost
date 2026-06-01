'use server'

import { createClient } from '@/lib/supabase/server'
import { setClubStatus } from '@/lib/services/clubs'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/services/audit'
import { refundPayment } from '@/lib/services/payments'
import { markPayoutPaid } from '@/lib/services/payouts'
import type { ActionResult, ClubStatus } from '@/types/app'
import { revalidatePath } from 'next/cache'
import type { PlatformSettings } from '@/lib/services/admin'

async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'platform_admin') return { user: null, error: 'Admin access required' }
  return { user, error: null }
}

export async function approveClubAction(
  clubId: string,
  status: ClubStatus,
  reason?: string
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await setClubStatus(clubId, user.id, status, reason)
  if (error) return { success: false, error }

  revalidatePath('/admin/clubs')
  revalidatePath(`/admin/clubs/${clubId}`)
  return { success: true, data: undefined }
}

export async function toggleFeatureFlagAction(
  key: string,
  enabled: boolean
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('feature_flags')
    .update({ enabled })
    .eq('key', key)

  if (error) return { success: false, error: error.message }

  await logAudit({
    actorId: user.id,
    entityType: 'feature_flag',
    entityId: null,
    action: 'admin_override',
    afterState: { key, enabled },
  })

  revalidatePath('/admin/feature-flags')
  return { success: true, data: undefined }
}

export async function updateFlagMetaAction(
  key: string,
  metadata: Record<string, unknown>
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('feature_flags')
    .update({ metadata })
    .eq('key', key)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/feature-flags')
  return { success: true, data: undefined }
}

export async function adminRefundPaymentAction(
  paymentId: string,
  reason: string
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await refundPayment({ paymentId, reason, actorId: user.id })
  if (error) return { success: false, error }

  revalidatePath('/admin/payments')
  return { success: true, data: undefined }
}

export async function markPayoutPaidAction(
  payoutId: string,
  stripeTransferId?: string
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await markPayoutPaid({ payoutId, actorId: user.id, stripeTransferId })
  if (error) return { success: false, error }

  revalidatePath('/admin')
  return { success: true, data: undefined }
}

export async function setClubBoostEligibilityAction(
  clubId: string,
  eligible: boolean
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('clubs')
    .update({ weekly_boost_eligible: eligible })
    .eq('id', clubId)

  if (error) return { success: false, error: error.message }

  await logAudit({
    actorId: user.id, clubId,
    entityType: 'club', entityId: clubId,
    action: 'admin_override',
    afterState: { weekly_boost_eligible: eligible },
  })

  revalidatePath(`/admin/clubs/${clubId}`)
  return { success: true, data: undefined }
}

// ── Competition controls ─────────────────────────────────────

export async function adminSetCompetitionStatusAction(
  competitionId: string,
  status: 'open' | 'closed' | 'cancelled',
  reason?: string,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const db = createAdminClient()
  const { data: existing } = await db
    .from('competitions')
    .select('status, title, club_id')
    .eq('id', competitionId)
    .single()

  if (!existing) return { success: false, error: 'Competition not found' }

  const { error } = await db
    .from('competitions')
    .update({ status })
    .eq('id', competitionId)

  if (error) return { success: false, error: error.message }

  await logAudit({
    actorId:     user.id,
    clubId:      existing.club_id,
    entityType:  'competition',
    entityId:    competitionId,
    action:      status === 'cancelled' ? 'competition_cancelled' : 'competition_status_changed',
    beforeState: { status: existing.status },
    afterState:  { status, reason: reason ?? null },
  })

  revalidatePath('/admin/competitions')
  revalidatePath(`/admin/competitions/${competitionId}`)
  return { success: true, data: undefined }
}

export async function adminForceSettleCompetitionAction(
  competitionId: string,
  notes: string,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const db = createAdminClient()
  const { data: existing } = await db
    .from('competitions')
    .select('status, title, club_id')
    .eq('id', competitionId)
    .single()

  if (!existing) return { success: false, error: 'Competition not found' }
  if (existing.status === 'settled') return { success: false, error: 'Already settled' }

  const { error } = await db
    .from('competitions')
    .update({ status: 'settled' })
    .eq('id', competitionId)

  if (error) return { success: false, error: error.message }

  await logAudit({
    actorId:    user.id,
    clubId:     existing.club_id,
    entityType: 'competition',
    entityId:   competitionId,
    action:     'competition_settled',
    afterState: { forced_by_admin: true, notes },
  })

  revalidatePath('/admin/competitions')
  revalidatePath(`/admin/competitions/${competitionId}`)
  return { success: true, data: undefined }
}

// ── Platform settings ────────────────────────────────────────

export async function updatePlatformSettingsAction(
  settings: Partial<PlatformSettings>,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  if (settings.platform_fee_bps !== undefined &&
      (settings.platform_fee_bps < 0 || settings.platform_fee_bps > 2000)) {
    return { success: false, error: 'Platform fee must be between 0% and 20%' }
  }
  if (settings.weekly_boost_default_bps !== undefined &&
      (settings.weekly_boost_default_bps < 0 || settings.weekly_boost_default_bps > 1000)) {
    return { success: false, error: 'Weekly Boost rate must be between 0% and 10%' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('platform_settings')
    .upsert({ id: 1, ...settings, updated_by: user.id, updated_at: new Date().toISOString() })

  if (error) return { success: false, error: error.message }

  await logAudit({
    actorId:    user.id,
    entityType: 'platform_settings',
    entityId:   null,
    action:     'admin_override',
    afterState: settings as Record<string, unknown>,
  })

  revalidatePath('/admin/settings')
  return { success: true, data: undefined }
}

// ── Feature flags ────────────────────────────────────────────

export async function upsertFeatureFlagAction(
  key:          string,
  enabled:      boolean,
  description?: string,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const db = createAdminClient()
  const update: Record<string, unknown> = { enabled, updated_at: new Date().toISOString() }
  if (description !== undefined) update.description = description

  const { error } = await db
    .from('feature_flags')
    .upsert({ key, ...update })

  if (error) return { success: false, error: error.message }

  await logAudit({
    actorId:    user.id,
    entityType: 'feature_flag',
    entityId:   null,
    action:     'admin_override',
    afterState: { key, enabled },
  })

  revalidatePath('/admin/feature-flags')
  return { success: true, data: undefined }
}
