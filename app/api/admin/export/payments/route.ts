import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { paymentsToCsv } from '@/lib/services/admin'
import type { AdminPaymentRow } from '@/lib/services/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'platform_admin' ? user : null
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') ?? undefined
  const q      = searchParams.get('q')      ?? undefined

  const db = createAdminClient()

  let query = db
    .from('payments')
    .select(
      `id, created_at, status, amount_pence, platform_fee_pence,
       club_fundraising_amount_pence, prize_pool_contribution_pence,
       stripe_payment_intent_id, competition_id,
       competition:competitions(title, club:clubs(name)),
       profile:profiles(email)`,
    )
    .order('created_at', { ascending: false })
    .limit(50_000)

  if (status) query = query.eq('status', status)
  if (q)      query = query.ilike('stripe_payment_intent_id', `%${q}%`)

  const { data } = await query

  const rows: AdminPaymentRow[] = (data ?? []).map((p: Record<string, unknown>) => {
    const comp    = p.competition as { title: string; club: { name: string } | null } | null
    const profile = p.profile    as { email: string } | null
    return {
      id:                          p.id as string,
      created_at:                  p.created_at as string,
      status:                      p.status as string,
      amount_pence:                p.amount_pence as number,
      platform_fee_pence:          (p.platform_fee_pence as number) ?? 0,
      club_fundraising_amount_pence: (p.club_fundraising_amount_pence as number) ?? 0,
      prize_pool_contribution_pence: (p.prize_pool_contribution_pence as number) ?? 0,
      stripe_payment_intent_id:    (p.stripe_payment_intent_id as string | null) ?? null,
      competition_id:              p.competition_id as string,
      competition_title:           comp?.title ?? '—',
      club_name:                   comp?.club?.name ?? '—',
      user_email:                  profile?.email ?? null,
    }
  })

  const csv      = paymentsToCsv(rows)
  const filename = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
