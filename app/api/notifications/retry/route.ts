// POST /api/notifications/retry
//
// Retry worker for failed email notifications.
// Designed to be called by Vercel Cron or any external scheduler.
//
// Authentication: requires CRON_SECRET header (or platform admin session).
//
// Vercel cron example (vercel.json):
//   {
//     "crons": [{ "path": "/api/notifications/retry", "schedule": "*/15 * * * *" }]
//   }
//
// The route also accepts a manual POST from platform admins.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { retryFailedNotifications } from '@/lib/services/notifications'

export async function POST(req: NextRequest) {
  // Allow Vercel Cron via Authorization header
  const authHeader  = req.headers.get('authorization')
  const cronSecret  = process.env.CRON_SECRET
  const isCron      = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    // Fall back to platform admin session check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createAdminClient()
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const result = await retryFailedNotifications(50)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[/api/notifications/retry]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
