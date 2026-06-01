// ============================================================
// ClubBoost — Stripe Webhook Handler
//
// Idempotency: every event is recorded in webhook_events before
// processing. If the event ID already exists, processing is skipped
// and 200 is returned immediately (safe for Stripe retries).
//
// Error handling: application errors return 200 to prevent Stripe
// from retrying. Signature errors return 400 so Stripe knows to stop.
//
// Set runtime = 'nodejs' because the Edge runtime doesn't support
// stripe.webhooks.constructEvent (needs native crypto).
// ============================================================

import { NextResponse, type NextRequest } from 'next/server'
import { constructWebhookEvent }          from '@/lib/stripe/webhooks'
import {
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleRefundWebhook,
} from '@/lib/services/payments'
import { setStripeOnboarded } from '@/lib/services/clubs'
import { createAdminClient }  from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// ── Idempotency guard ──────────────────────────────────────

async function markEventProcessed(
  eventId:   string,
  eventType: string,
  livemode:  boolean,
  payload:   unknown,
): Promise<{ alreadyProcessed: boolean }> {
  const db = createAdminClient()

  const { error } = await db.from('webhook_events').insert({
    stripe_event_id: eventId,
    event_type:      eventType,
    livemode,
    payload,
  })

  // Unique violation = already processed
  if (error?.code === '23505') {
    return { alreadyProcessed: true }
  }

  if (error) {
    // Non-duplicate error — log but proceed (don't block processing)
    console.error('[webhook] Failed to record event:', error.message)
  }

  return { alreadyProcessed: false }
}

// ── Main handler ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // ── Verify signature ────────────────────────────────────
  let event: Stripe.Event
  try {
    event = constructWebhookEvent(body, signature)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── Idempotency check ───────────────────────────────────
  const { alreadyProcessed } = await markEventProcessed(
    event.id,
    event.type,
    event.livemode,
    event.data,
  )

  if (alreadyProcessed) {
    console.log('[webhook] Duplicate event, skipping:', event.id, event.type)
    return NextResponse.json({ received: true, duplicate: true })
  }

  // ── Dispatch ─────────────────────────────────────────────
  try {
    await dispatch(event)
    return NextResponse.json({ received: true })
  } catch (err) {
    // Return 200 to prevent Stripe retrying for application errors.
    // The event is already recorded, so retries would be skipped anyway.
    console.error(`[webhook] Error handling ${event.type} (${event.id}):`, err)
    return NextResponse.json({ error: 'Processing error', received: true }, { status: 200 })
  }
}

// ── Event dispatch ─────────────────────────────────────────

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {

    // ── Payment flow ───────────────────────────────────────

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.payment_status === 'paid') {
        // Extract card details from payment method details if available
        const pi = session.payment_intent as string | null

        await handlePaymentSucceeded({
          checkoutSessionId: session.id,
          paymentIntentId:   pi ?? '',
          chargeId:          null,           // fetched inside handlePaymentSucceeded
          applicationFeeId:  null,           // fetched from charge
        })
      }
      break
    }

    case 'payment_intent.succeeded': {
      // Belt-and-suspenders — fires after checkout.session.completed
      const pi = event.data.object as Stripe.PaymentIntent

      // Only act if we haven't already processed via checkout.session.completed
      const db = createAdminClient()
      const { data: payment } = await db
        .from('payments')
        .select('id, status')
        .eq('stripe_payment_intent_id', pi.id)
        .single()

      if (payment && payment.status !== 'succeeded') {
        const charge = pi.latest_charge as string | null
        await handlePaymentSucceeded({
          checkoutSessionId: pi.metadata?.checkout_session_id ?? '',
          paymentIntentId:   pi.id,
          chargeId:          charge,
        })
      }
      break
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session
      await handlePaymentFailed(session.id)
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent
      await handlePaymentFailed(pi.id)
      break
    }

    // ── Refunds ────────────────────────────────────────────

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      // charge.refunds is a list; process the most recent one
      if (charge.refunds?.data?.length) {
        const latest = charge.refunds.data[0]
        await handleRefundWebhook({
          chargeId:       charge.id,
          stripeRefundId: latest.id,
          status:         latest.status ?? 'pending',
        })
      }
      break
    }

    case 'refund.updated': {
      const refundObj = event.data.object as Stripe.Refund
      if (refundObj.charge) {
        await handleRefundWebhook({
          chargeId:       refundObj.charge as string,
          stripeRefundId: refundObj.id,
          status:         refundObj.status ?? 'pending',
        })
      }
      break
    }

    // ── Stripe Connect — club onboarding ──────────────────

    case 'account.updated': {
      const account = event.data.object as Stripe.Account

      if (account.charges_enabled && account.details_submitted) {
        const db = createAdminClient()
        const { data: club } = await db
          .from('clubs')
          .select('id')
          .eq('stripe_account_id', account.id)
          .single()

        if (club) {
          await setStripeOnboarded(club.id, account.id)
          console.log('[webhook] Club Stripe onboarding confirmed:', club.id)
        }
      }
      break
    }

    // ── Application fee events (revenue accounting) ───────

    case 'application_fee.created': {
      const fee = event.data.object as Stripe.ApplicationFee
      // Record the application fee ID against the payment for reconciliation
      const db = createAdminClient()
      await db
        .from('payments')
        .update({ stripe_application_fee_id: fee.id })
        .eq('stripe_payment_intent_id', fee.originating_transaction as string)
      break
    }

    // ── Unhandled (safe to ignore) ────────────────────────
    default:
      // Logged; no action needed
      console.log('[webhook] Unhandled event type:', event.type)
      break
  }
}
