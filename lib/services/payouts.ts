// ============================================================
// ClubBoost — Payouts Service
//
// All payouts start as 'pending_review'. Platform admin manually
// approves and marks as paid. No automated Stripe transfers in MVP.
//
// Column names match 002_complete_schema.sql + 004 additions.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { recordPayoutLedger } from './ledger'
import { logAudit }          from './audit'
import type { Payout, PayoutType, PayoutWithRelations } from '@/types/app'

// ── Create ──────────────────────────────────────────────────

export async function createPayout(params: {
  competitionId:   string
  clubId?:         string
  recipientUserId?: string
  payoutType:      PayoutType
  amountPence:     number
  notes?:          string
  initiatedBy?:    string
}): Promise<{ payout: Payout | null; error: string | null }> {
  if (params.amountPence <= 0) {
    return { payout: null, error: 'Payout amount must be greater than zero' }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('payouts')
    .insert({
      competition_id:   params.competitionId,
      club_id:          params.clubId            ?? null,
      recipient_user_id: params.recipientUserId  ?? null,
      payout_type:      params.payoutType,
      amount_pence:     params.amountPence,
      status:           'pending_review',
      notes:            params.notes             ?? null,
      initiated_by:     params.initiatedBy       ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    return { payout: null, error: error?.message ?? 'Failed to create payout' }
  }

  await logAudit({
    actorId:    params.initiatedBy ?? 'system',
    entityType: 'payout',
    entityId:   data.id,
    action:     'payout_initiated',
    afterState: { payout_type: params.payoutType, amount_pence: params.amountPence },
  })

  return { payout: data as Payout, error: null }
}

// ── Status transitions ──────────────────────────────────────

export async function approvePayout(
  payoutId: string,
  actorId:  string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()

  const { data: payout } = await db.from('payouts').select('status').eq('id', payoutId).single()
  if (!payout) return { error: 'Payout not found' }
  if (payout.status !== 'pending_review') return { error: 'Only pending_review payouts can be approved' }

  const { error } = await db.from('payouts').update({
    status:      'processing',
    approved_by: actorId,
    approved_at: new Date().toISOString(),
  }).eq('id', payoutId)

  if (error) return { error: error.message }

  await logAudit({
    actorId, entityType: 'payout', entityId: payoutId,
    action: 'payout_approved',
  })

  return { error: null }
}

export async function markPayoutPaid(params: {
  payoutId:         string
  actorId:          string
  paymentReference?: string
  stripeTransferId?: string
}): Promise<{ error: string | null }> {
  const db = createAdminClient()

  const { data: payout } = await db
    .from('payouts')
    .select('*, competition:competitions!inner(club_id)')
    .eq('id', params.payoutId)
    .single()

  if (!payout) return { error: 'Payout not found' }
  if (!['processing', 'pending_review'].includes(payout.status)) {
    return { error: 'Payout is not in a payable state' }
  }

  const { error } = await db.from('payouts').update({
    status:             'paid',
    paid_at:            new Date().toISOString(),
    payment_reference:  params.paymentReference ?? null,
    stripe_transfer_id: params.stripeTransferId ?? null,
    approved_by:        payout.approved_by ?? params.actorId,
    approved_at:        payout.approved_at ?? new Date().toISOString(),
  }).eq('id', params.payoutId)

  if (error) return { error: error.message }

  // Write ledger row when money actually leaves
  await recordPayoutLedger(payout as Payout, payout.competition.club_id)

  await logAudit({
    actorId: params.actorId,
    entityType: 'payout',
    entityId: params.payoutId,
    action: 'payout_completed',
    afterState: {
      payment_reference:  params.paymentReference,
      stripe_transfer_id: params.stripeTransferId,
    },
  })

  return { error: null }
}

export async function cancelPayout(
  payoutId: string,
  actorId:  string,
  reason?:  string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()

  const { data: payout } = await db.from('payouts').select('status').eq('id', payoutId).single()
  if (!payout) return { error: 'Payout not found' }
  if (payout.status === 'paid') return { error: 'Cannot cancel a paid payout' }

  const { error } = await db.from('payouts').update({
    status:       'cancelled',
    cancelled_at: new Date().toISOString(),
    cancelled_by: actorId,
    notes:        reason ? `Cancelled: ${reason}` : 'Cancelled by admin',
  }).eq('id', payoutId)

  if (error) return { error: error.message }

  await logAudit({
    actorId, entityType: 'payout', entityId: payoutId,
    action: 'payout_cancelled', afterState: { reason },
  })

  return { error: null }
}

// ── Queries ─────────────────────────────────────────────────

export async function getPayoutsForCompetition(competitionId: string): Promise<PayoutWithRelations[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('payouts')
    .select(`
      *,
      club:clubs(id, name),
      recipient:profiles(id, display_name),
      competition:competitions(id, title)
    `)
    .eq('competition_id', competitionId)
    .order('created_at', { ascending: false })
  return (data ?? []) as PayoutWithRelations[]
}

export async function getPayoutsForClub(clubId: string): Promise<PayoutWithRelations[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('payouts')
    .select(`
      *,
      club:clubs(id, name),
      recipient:profiles(id, display_name),
      competition:competitions(id, title)
    `)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
  return (data ?? []) as PayoutWithRelations[]
}

export async function getAllPayoutsAdmin(status?: string): Promise<PayoutWithRelations[]> {
  const db = createAdminClient()
  let q = db
    .from('payouts')
    .select(`
      *,
      club:clubs(id, name),
      recipient:profiles(id, display_name),
      competition:competitions(id, title)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) q = q.eq('status', status)

  const { data } = await q
  return (data ?? []) as PayoutWithRelations[]
}

// ── Settlement helpers ───────────────────────────────────────

export async function initiatePrizePayout(params: {
  competitionId:  string
  winnerEntryId:  string
  prizePence:     number
  actorId:        string
  clubId?:        string
}): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { data: entry } = await db
    .from('entries')
    .select('user_id')
    .eq('id', params.winnerEntryId)
    .single()

  if (!entry) return { error: 'Winner entry not found' }

  const { error } = await createPayout({
    competitionId:   params.competitionId,
    clubId:          params.clubId,
    recipientUserId: entry.user_id,
    payoutType:      'prize_winner',
    amountPence:     params.prizePence,
    notes:           'Prize payout — pending admin approval and manual bank transfer',
    initiatedBy:     params.actorId,
  })

  return { error }
}

export async function initiateClubPayout(params: {
  competitionId: string
  clubId:        string
  amountPence:   number
  actorId:       string
}): Promise<{ error: string | null }> {
  const { error } = await createPayout({
    competitionId: params.competitionId,
    clubId:        params.clubId,
    payoutType:    'club_fundraising',
    amountPence:   params.amountPence,
    notes:         'Club fundraising share — pending admin approval',
    initiatedBy:   params.actorId,
  })
  return { error }
}
