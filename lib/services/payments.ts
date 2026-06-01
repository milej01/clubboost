// ============================================================
// ClubBoost — Payment Service
//
// All monetary values in pence. Column names match 002 schema.
//
// Idempotency strategy:
//   Checkout creation: idempotency_key = "pay_{entryId}" stored on
//     the payment record and sent as Stripe-Idempotency-Key header.
//   Webhook handlers: every event is deduplicated via webhook_events
//     table (checked before any DB write in the webhook route).
// ============================================================

import { stripe }          from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateSplit, estimateStripeFee } from '@/lib/utils'
import { logAudit }        from './audit'
import { recordPaymentLedger, recordRefundLedger } from './ledger'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { recordPaymentContribution } from './weekly-boost'
import {
  notifyEntryConfirmed,
  notifyPaymentReceipt,
  notifyRefundConfirmed,
} from './notification-hooks'
import type { Competition, Club, Payment, CompetitionType } from '@/types/app'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL!

// ── Checkout creation ───────────────────────────────────────

export async function createCheckoutSession(params: {
  competition: Competition
  club:        Club
  entryId:     string
  participantId: string
}) {
  const { competition, club, entryId, participantId } = params

  const weeklyBoostEnabled = await isFeatureEnabled('weekly_boost')
  const boostBps           = weeklyBoostEnabled ? competition.weekly_boost_contribution_bps : 0

  const split = calculateSplit(competition.entry_fee_pence, {
    prizePctBps:    competition.prize_type === 'percentage' ? competition.prize_pct_bps : 0,
    clubPctBps:     competition.club_pct_bps,
    platformFeeBps: competition.platform_fee_bps,
    weeklyBoostBps: boostBps,
  })

  // Platform collects: platform fee + boost via application_fee_amount
  const applicationFeePence = split.platform + split.boost

  // Stable idempotency key — safe to retry if checkout creation fails mid-flight
  const idempotencyKey = `pay_${entryId}`

  const db = createAdminClient()

  // Upsert payment record (idempotent on idempotency_key)
  const { data: payment, error: paymentError } = await db
    .from('payments')
    .upsert(
      {
        competition_id:                   competition.id,
        user_id:                          participantId,
        entry_id:                         entryId,
        amount_pence:                     competition.entry_fee_pence,
        gross_amount_pence:               competition.entry_fee_pence,
        stripe_fee_pence:                 split.stripeFee,
        platform_service_fee_pence:       split.platform,
        weekly_boost_contribution_pence:  split.boost,
        club_fundraising_amount_pence:    split.club,
        prize_pool_contribution_pence:    split.prize,
        currency:                         'gbp',
        status:                           'pending',
        idempotency_key:                  idempotencyKey,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: false },
    )
    .select()
    .single()

  if (paymentError || !payment) {
    throw new Error(`Failed to create payment record: ${paymentError?.message}`)
  }

  // Link payment → entry
  await db.from('entries').update({ payment_id: payment.id }).eq('id', entryId)

  // Create Stripe Checkout Session
  // Pass idempotency key so duplicate POSTs from retries return the same session
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency:     'gbp',
            product_data: {
              name:        `${competition.title} — Entry`,
              description: `Fundraising competition by ${club.name}`,
            },
            unit_amount: competition.entry_fee_pence,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        ...(club.stripe_account_id && club.stripe_onboarded
          ? {
              application_fee_amount: applicationFeePence,
              transfer_data: { destination: club.stripe_account_id },
            }
          : {}),
        metadata: {
          competition_id: competition.id,
          entry_id:       entryId,
          participant_id: participantId,
          payment_id:     payment.id,
          club_id:        club.id,
          idempotency_key: idempotencyKey,
        },
      },
      success_url: `${BASE_URL}/c/${club.slug}/${competition.id}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/c/${club.slug}/${competition.id}`,
      metadata: {
        competition_id:  competition.id,
        entry_id:        entryId,
        participant_id:  participantId,
        payment_id:      payment.id,
        idempotency_key: idempotencyKey,
      },
    },
    // Stripe idempotency key header — same key = same session returned
    { idempotencyKey },
  )

  // Store session ID so webhook lookup works
  await db
    .from('payments')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', payment.id)

  return { sessionUrl: session.url!, paymentId: payment.id }
}

// ── Webhook handlers ────────────────────────────────────────

/**
 * Called when checkout.session.completed with payment_status='paid'.
 * Idempotency: webhook_events table prevents double-processing.
 */
export async function handlePaymentSucceeded(params: {
  checkoutSessionId: string
  paymentIntentId:   string
  chargeId:          string | null
  applicationFeeId?: string | null
  cardBrand?:        string | null
  cardLast4?:        string | null
}) {
  const db = createAdminClient()

  const { data: payment } = await db
    .from('payments')
    .select(`
      *,
      competition:competitions!inner (id, type, club_id)
    `)
    .eq('stripe_checkout_session_id', params.checkoutSessionId)
    .single()

  if (!payment) {
    console.error('[payment] No payment for session', params.checkoutSessionId)
    return
  }

  // Skip if already processed (belt-and-suspenders beyond webhook_events check)
  if (payment.status === 'succeeded') {
    console.log('[payment] Already succeeded, skipping:', payment.id)
    return
  }

  // Try to get actual Stripe fee from the charge
  let actualStripeFee = payment.stripe_fee_pence
  if (params.chargeId) {
    try {
      const charge = await stripe.charges.retrieve(params.chargeId, {
        expand: ['balance_transaction'],
      })
      const bt = charge.balance_transaction
      if (bt && typeof bt === 'object' && 'fee' in bt) {
        actualStripeFee = (bt as { fee: number }).fee
      }
    } catch {
      // Non-fatal — keep the estimate
    }
  }

  // Update payment to succeeded
  const { error: updateError } = await db.from('payments').update({
    status:                      'succeeded',
    stripe_payment_intent_id:    params.paymentIntentId,
    stripe_charge_id:            params.chargeId,
    stripe_application_fee_id:   params.applicationFeeId ?? null,
    stripe_fee_pence:            actualStripeFee,
    payment_method_type:         params.cardBrand ? 'card' : null,
    payment_method_brand:        params.cardBrand ?? null,
    payment_method_last4:        params.cardLast4 ?? null,
    paid_at:                     new Date().toISOString(),
  }).eq('id', payment.id)

  if (updateError) {
    console.error('[payment] Failed to update payment status:', updateError.message)
    return
  }

  // Activate the entry
  await db.from('entries').update({ status: 'active' }).eq('payment_id', payment.id)

  // Record ledger (using the updated stripe fee)
  const fullPayment: Payment = {
    ...payment,
    stripe_fee_pence: actualStripeFee,
    status: 'succeeded',
  }

  await recordPaymentLedger(
    fullPayment,
    payment.competition.type as CompetitionType,
    payment.competition.club_id,
  )

  // Record platform_fee row
  const periodMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  if (payment.platform_service_fee_pence > 0) {
    await db.from('platform_fees').upsert(
      {
        competition_id:  payment.competition_id,
        payment_id:      payment.id,
        club_id:         payment.competition.club_id,
        period_month:    periodMonth,
        fee_amount_pence: payment.platform_service_fee_pence,
        stripe_application_fee_id: params.applicationFeeId ?? null,
        status:          'captured',
      },
      { onConflict: 'payment_id' },
    )
  }

  // Record Weekly Boost contribution if applicable
  if (payment.weekly_boost_contribution_pence > 0) {
    await recordPaymentContribution({
      paymentId:    payment.id,
      entryId:      payment.entry_id,
      competitionId: payment.competition_id,
      clubId:       payment.competition.club_id,
      amountPence:  payment.weekly_boost_contribution_pence,
    })
  }

  await logAudit({
    actorId:    payment.user_id,
    entityType: 'payment',
    entityId:   payment.id,
    action:     'payment_succeeded',
    afterState: {
      amount_pence:                   payment.amount_pence,
      stripe_fee_pence:               actualStripeFee,
      platform_service_fee_pence:     payment.platform_service_fee_pence,
      club_fundraising_amount_pence:  payment.club_fundraising_amount_pence,
    },
  })

  // ── Notifications (non-blocking) ────────────────────────────
  // Look up entry number + club name for the confirmation email
  const { data: entry } = await db
    .from('entries')
    .select('id, entry_number, entry_data, competition:competitions(title, type, club:clubs(name, slug))')
    .eq('payment_id', payment.id)
    .maybeSingle()

  if (entry) {
    const comp      = (entry as any).competition
    const club      = comp?.club
    const entryData = (entry.entry_data ?? {}) as unknown as Record<string, unknown>

    // Build a one-line selection summary from entry_data
    let summary = ''
    if (comp?.type === 'predictor') {
      const preds = (entryData.predictions as Array<{ predicted_result: string }> | undefined) ?? []
      // 1/X/2 notation; also handle legacy H/D/A
      const labels: Record<string, string> = { '1': '1', H: '1', 'X': 'X', D: 'X', '2': '2', A: '2' }
      summary = preds.map((p, i) => `Match ${i + 1}: ${labels[p.predicted_result] ?? p.predicted_result}`).join('\n')
    } else if (comp?.type === 'last_man_standing') {
      const picks = (entryData.picks as Array<{ team_picked: string }> | undefined) ?? []
      summary = picks[0] ? `Round 1: ${picks[0].team_picked}` : ''
    } else if (comp?.type === 'donation') {
      summary = (entryData as any).message ?? ''
    }

    const paidAt = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    void notifyEntryConfirmed({
      participantId:    payment.user_id,
      competition:      { ...payment.competition, title: comp?.title, type: comp?.type } as any,
      clubName:         club?.name ?? '',
      clubSlug:         club?.slug ?? '',
      entryNumber:      entry.entry_number,
      selectionSummary: summary,
    })

    void notifyPaymentReceipt({
      participantId:    payment.user_id,
      competitionTitle: comp?.title ?? '',
      clubName:         club?.name ?? '',
      amountPence:      payment.amount_pence,
      paymentDate:      paidAt,
      cardBrand:        params.cardBrand ?? null,
      cardLast4:        params.cardLast4 ?? null,
      paymentIntentId:  params.paymentIntentId,
    })
  }
}

/**
 * Called when checkout.session.expired or payment_intent.payment_failed.
 */
export async function handlePaymentFailed(identifier: string) {
  const db = createAdminClient()

  // Try to match by checkout session ID first, then payment intent ID
  let payment: Payment | null = null

  const { data: bySession } = await db
    .from('payments')
    .select('*')
    .eq('stripe_checkout_session_id', identifier)
    .single()

  if (bySession) {
    payment = bySession
  } else {
    const { data: byIntent } = await db
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', identifier)
      .single()
    payment = byIntent
  }

  if (!payment || payment.status !== 'pending') return

  await db.from('payments').update({
    status:     'failed',
    failed_at:  new Date().toISOString(),
  }).eq('id', payment.id)

  await db.from('entries').update({ status: 'pending_payment' }).eq('payment_id', payment.id)

  await logAudit({
    actorId:    payment.user_id,
    entityType: 'payment',
    entityId:   payment.id,
    action:     'payment_failed',
  })
}

// ── Refunds ─────────────────────────────────────────────────

/**
 * Initiate a full refund via Stripe and record in the refunds table.
 * The webhook (charge.refunded) will confirm the refund and update payment status.
 */
export async function refundPayment(params: {
  paymentId: string
  reason:    string
  actorId:   string
}): Promise<{ refundId: string | null; error: string | null }> {
  const db = createAdminClient()

  const { data: payment } = await db
    .from('payments')
    .select('*, competition:competitions!inner(club_id)')
    .eq('id', params.paymentId)
    .single()

  if (!payment) return { refundId: null, error: 'Payment not found' }
  if (payment.status !== 'succeeded') {
    return { refundId: null, error: 'Only succeeded payments can be refunded' }
  }

  // Create refund record first (idempotent; Stripe will confirm asynchronously)
  const { data: refundRecord, error: refundError } = await db
    .from('refunds')
    .insert({
      payment_id:   params.paymentId,
      entry_id:     payment.entry_id,
      initiated_by: params.actorId,
      reason:       params.reason,
      amount_pence: payment.gross_amount_pence || payment.amount_pence,
      status:       'pending',
    })
    .select()
    .single()

  if (refundError || !refundRecord) {
    return { refundId: null, error: refundError?.message ?? 'Failed to create refund record' }
  }

  // Issue Stripe refund if we have a payment intent
  if (payment.stripe_payment_intent_id) {
    try {
      const stripeRefund = await stripe.refunds.create(
        {
          payment_intent: payment.stripe_payment_intent_id,
          reason:         'requested_by_customer',
          metadata: {
            refund_id:  refundRecord.id,
            payment_id: params.paymentId,
            reason:     params.reason,
            actor_id:   params.actorId,
          },
        },
        { idempotencyKey: `refund_${refundRecord.id}` },
      )

      await db.from('refunds').update({
        stripe_refund_id: stripeRefund.id,
        status:           stripeRefund.status === 'succeeded' ? 'succeeded' : 'pending',
        refunded_at:      stripeRefund.status === 'succeeded' ? new Date().toISOString() : null,
      }).eq('id', refundRecord.id)

      if (stripeRefund.status === 'succeeded') {
        await finaliseRefund(refundRecord.id, payment, params.actorId)
      }
    } catch (stripeErr) {
      // Mark refund as failed; don't surface Stripe internal errors to caller
      await db.from('refunds').update({
        status:         'failed',
        failure_reason: stripeErr instanceof Error ? stripeErr.message : 'Stripe error',
      }).eq('id', refundRecord.id)

      return { refundId: refundRecord.id, error: 'Stripe refund failed — check refund record' }
    }
  } else {
    // No Stripe charge (e.g. test env) — mark succeeded immediately
    await finaliseRefund(refundRecord.id, payment, params.actorId)
  }

  return { refundId: refundRecord.id, error: null }
}

/**
 * Finalise a refund: update payment status, deactivate entry, write ledger.
 * Called either synchronously (no Stripe charge) or from the webhook.
 */
export async function finaliseRefund(
  refundId:    string,
  payment:     Payment & { competition?: { club_id: string } },
  actorId:     string,
): Promise<void> {
  const db = createAdminClient()

  const { data: refund } = await db
    .from('refunds')
    .select('*')
    .eq('id', refundId)
    .single()

  if (!refund) return

  await db.from('payments').update({
    status:      'refunded',
  }).eq('id', payment.id)

  await db.from('entries').update({ status: 'refunded' }).eq('payment_id', payment.id)

  // Resolve club_id (from join or separate query)
  let clubId = payment.competition?.club_id
  if (!clubId) {
    const { data: comp } = await db
      .from('competitions')
      .select('club_id')
      .eq('id', payment.competition_id)
      .single()
    clubId = comp?.club_id
  }

  if (clubId) {
    await recordRefundLedger(refund, payment, clubId)
  }

  await logAudit({
    actorId,
    entityType: 'payment',
    entityId:   payment.id,
    action:     'payment_refunded',
    afterState: { refund_id: refundId, amount_pence: refund.amount_pence, reason: refund.reason },
  })

  // Notify the participant of their refund (non-blocking)
  const originalPaymentDate = payment.paid_at
    ? new Date(payment.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'recently'

  // Look up competition title for the email
  const { data: comp } = await db
    .from('competitions')
    .select('title')
    .eq('id', payment.competition_id)
    .maybeSingle()

  void notifyRefundConfirmed({
    participantId:       payment.user_id,
    competitionTitle:    comp?.title ?? 'your competition',
    refundAmountPence:   refund.amount_pence,
    reason:              refund.reason ?? 'Requested refund',
    originalPaymentDate,
  })
}

/**
 * Handle charge.refunded webhook — confirm refund status from Stripe.
 */
export async function handleRefundWebhook(params: {
  chargeId:       string
  stripeRefundId: string
  status:         string
}): Promise<void> {
  const db = createAdminClient()

  const { data: payment } = await db
    .from('payments')
    .select('*, competition:competitions!inner(club_id)')
    .eq('stripe_charge_id', params.chargeId)
    .single()

  if (!payment) return

  const { data: refund } = await db
    .from('refunds')
    .select('*')
    .eq('stripe_refund_id', params.stripeRefundId)
    .single()

  if (!refund || refund.status === 'succeeded') return

  await db.from('refunds').update({
    status:      params.status === 'succeeded' ? 'succeeded' : 'failed',
    refunded_at: params.status === 'succeeded' ? new Date().toISOString() : null,
  }).eq('id', refund.id)

  if (params.status === 'succeeded') {
    await finaliseRefund(refund.id, payment, payment.user_id)
  }
}

// ── Queries ─────────────────────────────────────────────────

export async function getPaymentById(id: string): Promise<Payment | null> {
  const db = createAdminClient()
  const { data } = await db.from('payments').select('*').eq('id', id).single()
  return data
}

export async function getPaymentsForCompetition(competitionId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('payments')
    .select('*, participant:profiles(id, display_name)')
    .eq('competition_id', competitionId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getAllPaymentsAdmin(limit = 200) {
  const db = createAdminClient()
  const { data } = await db
    .from('payments')
    .select(`
      *,
      participant:profiles(display_name),
      competition:competitions(title, club_id, club:clubs(name))
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getRefundsForPayment(paymentId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('refunds')
    .select('*, initiator:profiles(display_name)')
    .eq('payment_id', paymentId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getAllRefundsAdmin(limit = 100) {
  const db = createAdminClient()
  const { data } = await db
    .from('refunds')
    .select(`
      *,
      initiator:profiles(display_name),
      payment:payments(
        amount_pence, competition:competitions(title, club:clubs(name))
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getPaymentStatsAdmin() {
  const db = createAdminClient()

  const { data: payments } = await db
    .from('payments')
    .select('status, amount_pence, platform_service_fee_pence, created_at')

  const all = payments ?? []
  const succeeded = all.filter(p => p.status === 'succeeded')

  return {
    totalCount:             all.length,
    succeededCount:         succeeded.length,
    failedCount:            all.filter(p => p.status === 'failed').length,
    pendingCount:           all.filter(p => p.status === 'pending').length,
    refundedCount:          all.filter(p => p.status === 'refunded').length,
    totalVolumePence:       succeeded.reduce((s, p) => s + p.amount_pence, 0),
    totalPlatformFeePence:  succeeded.reduce((s, p) => s + p.platform_service_fee_pence, 0),
  }
}

export async function getPaymentsForClub(clubId: string, limit = 100) {
  const db = createAdminClient()
  const { data: competitions } = await db
    .from('competitions')
    .select('id')
    .eq('club_id', clubId)

  const compIds = (competitions ?? []).map(c => c.id)
  if (!compIds.length) return []

  const { data } = await db
    .from('payments')
    .select(`
      *,
      competition:competitions(title),
      participant:profiles(display_name)
    `)
    .in('competition_id', compIds)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(limit)

  return data ?? []
}
