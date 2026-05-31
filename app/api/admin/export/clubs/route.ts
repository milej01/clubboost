import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminClubs, clubsToCsv } from '@/lib/services/admin'

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

  // Export all (up to 10k) — no pagination for export
  const PAGE_LIMIT = 10_000
  const { clubs } = await getAdminClubs({ status, q, page: 1 })

  // For export we want all, so fetch without pagination limit
  const db = createAdminClient()
  let query = db
    .from('clubs')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(PAGE_LIMIT)

  if (status) query = query.eq('status', status)
  if (q)      query = query.ilike('name', `%${q}%`)

  const { data: allClubs } = await query

  // Enrich with competition count and total raised
  const clubIds = (allClubs ?? []).map((c: { id: string }) => c.id)
  const { data: compData } = clubIds.length
    ? await db.from('competitions').select('club_id').in('club_id', clubIds).is('deleted_at', null)
    : { data: [] }
  const { data: compClubs } = clubIds.length
    ? await db.from('competitions').select('id, club_id').in('club_id', clubIds)
    : { data: [] }
  const { data: payments } = await db
    .from('payments')
    .select('amount_pence, competition_id')
    .eq('status', 'succeeded')

  const countMap: Record<string, number> = {}
  for (const c of compData ?? []) {
    countMap[(c as { club_id: string }).club_id] = (countMap[(c as { club_id: string }).club_id] ?? 0) + 1
  }
  const compToClub: Record<string, string> = {}
  for (const cc of compClubs ?? []) {
    compToClub[(cc as { id: string; club_id: string }).id] = (cc as { id: string; club_id: string }).club_id
  }
  const raisedMap: Record<string, number> = {}
  for (const p of payments ?? []) {
    const cid = compToClub[(p as { competition_id: string }).competition_id]
    if (cid) raisedMap[cid] = (raisedMap[cid] ?? 0) + (p as { amount_pence: number }).amount_pence
  }

  const rows = (allClubs ?? []).map((c: Record<string, unknown>) => ({
    id:               c.id as string,
    name:             c.name as string,
    slug:             (c.slug ?? '') as string,
    status:           c.status as string,
    sport:            (c.sport ?? null) as string | null,
    location:         (c.location ?? null) as string | null,
    contact_email:    (c.contact_email ?? null) as string | null,
    stripe_onboarded: (c.stripe_onboarded ?? false) as boolean,
    weekly_boost_eligible: (c.weekly_boost_eligible ?? false) as boolean,
    created_at:       c.created_at as string,
    competition_count: countMap[c.id as string] ?? 0,
    total_raised_pence: raisedMap[c.id as string] ?? 0,
  }))

  const csv      = clubsToCsv(rows)
  const filename = `clubs-export-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
