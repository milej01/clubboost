import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from './audit'
import type { Entry, EntryData } from '@/types/app'

export async function createPendingEntry(params: {
  competitionId:  string
  participantId:  string
  entryData:      EntryData
  rulesSnapshot?: Record<string, unknown>
}): Promise<{ entry: Entry | null; error: string | null }> {
  const db = createAdminClient()

  // Guard: check competition is open
  const { data: comp } = await db
    .from('competitions')
    .select('status, max_entries')
    .eq('id', params.competitionId)
    .single()

  if (!comp || comp.status !== 'open') {
    return { entry: null, error: 'Competition is not open for entries' }
  }

  // Guard: max entries
  if (comp.max_entries) {
    const { count } = await db
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', params.competitionId)
      .in('status', ['active', 'eliminated', 'winner'])

    if ((count ?? 0) >= comp.max_entries) {
      return { entry: null, error: 'Competition is full' }
    }
  }

  // Guard: duplicate entry prevention
  const { data: existing } = await db
    .from('entries')
    .select('id, status')
    .eq('competition_id', params.competitionId)
    .eq('participant_id', params.participantId)
    .in('status', ['pending_payment', 'active'])
    .single()

  if (existing) {
    return { entry: null, error: 'You already have an entry in this competition' }
  }

  // Merge rules snapshot into entry_data so the terms accepted at entry time
  // are recorded immutably — even if the competition is later edited.
  const storedData: Record<string, unknown> = {
    ...(params.entryData as unknown as Record<string, unknown>),
    ...(params.rulesSnapshot ? { _snapshot: params.rulesSnapshot } : {}),
  }

  const { data: entry, error } = await db
    .from('entries')
    .insert({
      competition_id: params.competitionId,
      participant_id: params.participantId,
      status:         'pending_payment',
      entry_data:     storedData,
    })
    .select()
    .single()

  if (error || !entry) return { entry: null, error: error?.message ?? 'Failed to create entry' }

  await logAudit({
    actorId:    params.participantId,
    entityType: 'entry',
    entityId:   entry.id,
    action:     'competition_entered',
    afterState: { competition_id: params.competitionId },
  })

  return { entry: entry as Entry, error: null }
}

export async function getEntryById(id: string): Promise<Entry | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('entries').select('*').eq('id', id).single()
  return data as Entry | null
}

export async function getEntriesForParticipant(participantId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('entries')
    .select('*, competition:competitions(title, type, status, closes_at, club:clubs(name, slug))')
    .eq('participant_id', participantId)
    .neq('status', 'pending_payment')
    .order('entered_at', { ascending: false })
  return data ?? []
}

export async function getLeaderboard(competitionId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('entries')
    .select('*, participant:profiles(id, display_name)')
    .eq('competition_id', competitionId)
    .in('status', ['active', 'eliminated', 'winner'])
    .order('points_total', { ascending: false })
    .order('entry_number', { ascending: true })

  return (data ?? []).map((e, i) => ({
    ...e,
    rank: i + 1,
  }))
}

export async function markEntryAsWinner(
  entryId: string,
  actorId: string
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('entries')
    .update({ status: 'winner' })
    .eq('id', entryId)

  if (error) return { error: error.message }

  await logAudit({
    actorId, entityType: 'entry', entityId: entryId,
    action: 'competition_settled', afterState: { winner: true },
  })

  return { error: null }
}

export async function updateEntryPoints(entryId: string, points: number) {
  const db = createAdminClient()
  await db.from('entries').update({ points_total: points }).eq('id', entryId)
}
