// ============================================================
// Notification Service
//
// Single entry point for all outbound email sending.
// Handles:
//   - Unsubscribe checks for marketing emails
//   - Notification record creation (for audit + retry)
//   - Template rendering
//   - Provider dispatch
//   - Retry bookkeeping
//   - Unsubscribe token generation
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { getEmailProvider }  from '@/lib/email/provider'
import {
  renderEmail,
  EMAIL_TYPES,
  MARKETING_EMAIL_TYPES,
  type EmailType,
  type EmailDataMap,
} from '@/lib/email/templates/index'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clubboost.co.uk'

// ── Retry configuration ───────────────────────────────────────
// Delays in minutes before each retry attempt.
const RETRY_DELAYS_MINUTES = [5, 30, 120] // attempt 1 → 5min, 2 → 30min, 3 → 2hr

// ── Public API ────────────────────────────────────────────────

export interface SendNotificationParams<T extends EmailType> {
  type:    T
  to:      { email: string; name?: string; userId?: string }
  data:    EmailDataMap[T]
}

export interface SendNotificationResult {
  notificationId: string | null
  skipped:        boolean
  error:          string | null
}

/**
 * Send an email notification.
 *
 * @example
 * await sendNotification({
 *   type: EMAIL_TYPES.ENTRY_CONFIRMATION,
 *   to:   { email: 'james@example.com', name: 'James', userId: user.id },
 *   data: { participantName: 'James', ... },
 * })
 */
export async function sendNotification<T extends EmailType>(
  params: SendNotificationParams<T>,
): Promise<SendNotificationResult> {
  const db       = createAdminClient()
  const provider = getEmailProvider()
  const isMarketing = MARKETING_EMAIL_TYPES.has(params.type)

  // ── 1. Unsubscribe check (marketing only) ─────────────────
  if (isMarketing) {
    const { data: pref } = await db
      .from('notification_preferences')
      .select('unsubscribed')
      .eq('email', params.to.email)
      .eq('category', 'marketing')
      .maybeSingle()

    if (pref?.unsubscribed) {
      // Log as skipped — important for audit trail
      await db.from('notifications').insert({
        user_id:           params.to.userId ?? null,
        to_email:          params.to.email,
        to_name:           params.to.name ?? null,
        notification_type: params.type,
        category:          'marketing',
        subject:           `[skipped] ${params.type}`,
        template_data:     params.data as unknown as Record<string, unknown>,
        status:            'skipped',
        provider:          provider.name,
      })

      return { notificationId: null, skipped: true, error: null }
    }
  }

  // ── 2. Render the template ────────────────────────────────
  let rendered: { subject: string; html: string; text: string }
  try {
    rendered = renderEmail(params.type, params.data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Template render failed'
    console.error('[notifications] render error:', msg)
    return { notificationId: null, skipped: false, error: msg }
  }

  // ── 3. Generate unsubscribe token (marketing emails) ─────
  let unsubscribeUrl: string | undefined
  if (isMarketing) {
    const { data: tokenRow } = await db
      .from('unsubscribe_tokens')
      .insert({
        user_id:  params.to.userId ?? null,
        email:    params.to.email,
        category: 'marketing',
      })
      .select('token')
      .single()

    if (tokenRow?.token) {
      unsubscribeUrl = `${BASE_URL}/api/notifications/unsubscribe?token=${tokenRow.token}`
      // Inject the real URL into the HTML (replaces placeholder '#unsubscribe')
      rendered.html = rendered.html.replace(/#unsubscribe/g, unsubscribeUrl)
    }
  }

  // ── 4. Create notification record (status: pending) ───────
  const { data: notifRow, error: dbError } = await db
    .from('notifications')
    .insert({
      user_id:           params.to.userId ?? null,
      to_email:          params.to.email,
      to_name:           params.to.name ?? null,
      notification_type: params.type,
      category:          isMarketing ? 'marketing' : 'transactional',
      subject:           rendered.subject,
      template_data:     params.data as unknown as Record<string, unknown>,
      status:            'pending',
      provider:          provider.name,
    })
    .select('id')
    .single()

  if (dbError || !notifRow) {
    console.error('[notifications] failed to create notification record:', dbError?.message)
    // Still attempt the send — don't block email on DB failure
  }

  const notifId = notifRow?.id ?? null

  // ── 5. Send ───────────────────────────────────────────────
  const { messageId, error: sendError } = await provider.send({
    to:      { email: params.to.email, name: params.to.name },
    subject: rendered.subject,
    html:    rendered.html,
    text:    rendered.text,
    tags:    {
      notification_type: params.type,
      category:          isMarketing ? 'marketing' : 'transactional',
    },
  })

  // ── 6. Update notification record with result ─────────────
  if (notifId) {
    if (sendError) {
      const nextRetryAt = nextRetryDelay(0)
      await db.from('notifications').update({
        status:        'failed',
        error_message: sendError,
        failed_at:     new Date().toISOString(),
        next_retry_at: nextRetryAt?.toISOString() ?? null,
      }).eq('id', notifId)
    } else {
      await db.from('notifications').update({
        status:              'sent',
        provider_message_id: messageId ?? null,
        sent_at:             new Date().toISOString(),
      }).eq('id', notifId)
    }
  }

  if (sendError) {
    return { notificationId: notifId, skipped: false, error: sendError }
  }

  return { notificationId: notifId, skipped: false, error: null }
}

// ── Retry worker ──────────────────────────────────────────────

/**
 * Retry failed notifications.
 * Call this from a cron endpoint — it processes up to `limit` notifications
 * that are due for retry.
 */
export async function retryFailedNotifications(limit = 50): Promise<{
  attempted: number
  succeeded: number
  stillFailing: number
}> {
  const db       = createAdminClient()
  const provider = getEmailProvider()

  const { data: pending } = await db
    .from('notifications')
    .select('*')
    .eq('status', 'failed')
    .lte('next_retry_at', new Date().toISOString())
    .lt('retry_count', db.rpc)  // workaround — use raw filter below
    .order('next_retry_at', { ascending: true })
    .limit(limit)

  // Filter retry_count < max_retries in JS (Supabase filter on column comparison)
  const due = (pending ?? []).filter(
    (n: NotificationRow) => n.retry_count < n.max_retries
  )

  let succeeded = 0
  let stillFailing = 0

  for (const notif of due as NotificationRow[]) {
    // Re-render the template from stored template_data
    let rendered: { subject: string; html: string; text: string }
    try {
      rendered = renderEmail(
        notif.notification_type as EmailType,
        notif.template_data as EmailDataMap[EmailType],
      )
    } catch {
      stillFailing++
      continue
    }

    const { error: sendError } = await provider.send({
      to:      { email: notif.to_email, name: notif.to_name ?? undefined },
      subject: rendered.subject,
      html:    rendered.html,
      text:    rendered.text,
    })

    const newRetryCount = notif.retry_count + 1

    if (sendError) {
      const nextDelay = nextRetryDelay(newRetryCount)
      await db.from('notifications').update({
        retry_count:   newRetryCount,
        error_message: sendError,
        next_retry_at: nextDelay?.toISOString() ?? null,
        // Mark permanently failed if we've exhausted retries
        status: newRetryCount >= notif.max_retries ? 'failed' : 'failed',
      }).eq('id', notif.id)
      stillFailing++
    } else {
      await db.from('notifications').update({
        status:      'sent',
        retry_count: newRetryCount,
        sent_at:     new Date().toISOString(),
        next_retry_at: null,
        error_message: null,
      }).eq('id', notif.id)
      succeeded++
    }
  }

  return { attempted: due.length, succeeded, stillFailing }
}

// ── Unsubscribe ───────────────────────────────────────────────

export async function unsubscribeByToken(token: string): Promise<{
  email: string | null
  category: string | null
  error: string | null
}> {
  const db = createAdminClient()

  const { data: tokenRow } = await db
    .from('unsubscribe_tokens')
    .select('email, category, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!tokenRow) return { email: null, category: null, error: 'Invalid unsubscribe link' }
  if (tokenRow.used_at) return { email: tokenRow.email, category: tokenRow.category, error: null } // idempotent
  if (new Date(tokenRow.expires_at) < new Date()) {
    return { email: null, category: null, error: 'This unsubscribe link has expired' }
  }

  // Mark token as used
  await db.from('unsubscribe_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)

  // Upsert preference
  await db.from('notification_preferences').upsert(
    {
      email:            tokenRow.email,
      category:         tokenRow.category,
      unsubscribed:     true,
      unsubscribed_at:  new Date().toISOString(),
    },
    { onConflict: 'email,category' },
  )

  return { email: tokenRow.email, category: tokenRow.category, error: null }
}

export async function resubscribe(email: string, category: string): Promise<void> {
  const db = createAdminClient()
  await db.from('notification_preferences').upsert(
    { email, category, unsubscribed: false, unsubscribed_at: null },
    { onConflict: 'email,category' },
  )
}

// ── Helpers ───────────────────────────────────────────────────

function nextRetryDelay(retryCount: number): Date | null {
  const delayMinutes = RETRY_DELAYS_MINUTES[retryCount]
  if (delayMinutes === undefined) return null
  return new Date(Date.now() + delayMinutes * 60 * 1000)
}

interface NotificationRow {
  id:                string
  user_id:           string | null
  to_email:          string
  to_name:           string | null
  notification_type: string
  category:          string
  subject:           string
  template_data:     Record<string, unknown>
  status:            string
  provider:          string | null
  provider_message_id: string | null
  error_message:     string | null
  retry_count:       number
  max_retries:       number
  next_retry_at:     string | null
  sent_at:           string | null
}
