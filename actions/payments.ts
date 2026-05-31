'use server'

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath }    from 'next/cache'
import { refundPayment }     from '@/lib/services/payments'
import {
  approvePayout,
  markPayoutPaid,
  cancelPayout,
} from '@/lib/services/payouts'
import { logAudit } from '@/lib/services/audit'
import type { ActionResult } from '@/types/app'

// ── Auth helpers ────────────────────────────────────────────

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
    return { user: null, error: 'Admin access required' as const }
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
    .single()

  if (!member || !['owner', 'admin'].includes(member.role)) {
    return { user: null, error: 'Club admin access required' as const }
  }
  return { user, error: null }
}

// ── Refund actions ──────────────────────────────────────────

export async function initiateRefundAction(
  paymentId: string,
  reason:    string,
): Promise<ActionResult<{ refundId: string }>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  if (!reason.trim()) return { success: false, error: 'Refund reason is required' }

  const { refundId, error } = await refundPayment({
    paymentId,
    reason: reason.trim(),
    actorId: user.id,
  })

  if (error || !refundId) return { success: false, error: error ?? 'Refund failed' }

  revalidatePath('/admin/payments')
  revalidatePath(`/admin/payments/${paymentId}`)
  return { success: true, data: { refundId } }
}

// ── Payout actions ──────────────────────────────────────────

export async function approvePayoutAction(
  payoutId: string,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await approvePayout(payoutId, user.id)
  if (error) return { success: false, error }

  revalidatePath('/admin/payouts')
  return { success: true, data: undefined }
}

export async function markPayoutPaidAction(params: {
  payoutId:         string
  paymentReference?: string
}): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await markPayoutPaid({
    payoutId:         params.payoutId,
    actorId:          user.id,
    paymentReference: params.paymentReference,
  })

  if (error) return { success: false, error }

  revalidatePath('/admin/payouts')
  return { success: true, data: undefined }
}

export async function cancelPayoutAction(
  payoutId: string,
  reason?:  string,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const { error } = await cancelPayout(payoutId, user.id, reason)
  if (error) return { success: false, error }

  revalidatePath('/admin/payouts')
  return { success: true, data: undefined }
}

// ── Admin payment annotation ────────────────────────────────

export async function addPaymentNoteAction(
  paymentId: string,
  note:      string,
): Promise<ActionResult<void>> {
  const { user, error: authError } = await requirePlatformAdmin()
  if (authError || !user) return { success: false, error: authError ?? 'Unauthorized' }

  const db = createAdminClient()
  const { data: payment } = await db
    .from('payments')
    .select('metadata')
    .eq('id', paymentId)
    .single()

  if (!payment) return { success: false, error: 'Payment not found' }

  const existingNotes = (payment.metadata as Record<string, unknown>)?.admin_notes as string[] ?? []
  const newNote = { note, by: user.id, at: new Date().toISOString() }

  const { error } = await db
    .from('payments')
    .update({ metadata: { ...payment.metadata, admin_notes: [...existingNotes, newNote] } })
    .eq('id', paymentId)

  if (error) return { success: false, error: error.message }

  await logAudit({
    actorId: user.id,
    entityType: 'payment',
    entityId: paymentId,
    action: 'admin_override',
    afterState: { note },
  })

  revalidatePath(`/admin/payments/${paymentId}`)
  return { success: true, data: undefined }
}
