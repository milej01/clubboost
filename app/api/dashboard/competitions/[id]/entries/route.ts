import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: competitionId } = await params

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const db = createAdminClient()

  // Verify the competition belongs to one of the user's clubs
  const { data: comp } = await db
    .from('competitions')
    .select('id, title, club_id, entry_fee_pence, type')
    .eq('id', competitionId)
    .single()

  if (!comp) return new NextResponse('Not found', { status: 404 })

  const { data: membership } = await db
    .from('club_members')
    .select('role')
    .eq('club_id', comp.club_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return new NextResponse('Forbidden', { status: 403 })

  // Fetch entries with participant info
  const { data: entries } = await db
    .from('entries')
    .select('entry_number, status, entered_at, points_total, entry_data, participant:profiles(display_name, email)')
    .eq('competition_id', competitionId)
    .neq('status', 'pending_payment')
    .order('entry_number')

  if (!entries) return new NextResponse('No entries', { status: 200 })

  // Build CSV
  const header = [
    'Entry #',
    'Name',
    'Status',
    'Points',
    'Entered',
    'Selections',
  ].join(',')

  const rows = entries.map(e => {
    const participant = e.participant as { display_name?: string; email?: string } | null
    const selections  = e.entry_data
      ? Object.values(e.entry_data as unknown as Record<string, unknown>).join(' | ')
      : ''
    return [
      e.entry_number,
      `"${(participant?.display_name ?? 'Anonymous').replace(/"/g, '""')}"`,
      e.status,
      e.points_total ?? '',
      e.entered_at ? new Date(e.entered_at).toISOString().slice(0, 16).replace('T', ' ') : '',
      `"${selections.replace(/"/g, '""')}"`,
    ].join(',')
  })

  const csv      = [header, ...rows].join('\n')
  const safe     = comp.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const filename = `entries-${safe}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
