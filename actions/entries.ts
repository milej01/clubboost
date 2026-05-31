'use server'

import { createClient } from '@/lib/supabase/server'
import { createPendingEntry } from '@/lib/services/entries'
import { getCompetitionById } from '@/lib/services/competitions'
import { createCheckoutSession } from '@/lib/services/payments'
import type { ActionResult, EntryData } from '@/types/app'
import { revalidatePath } from 'next/cache'

export async function enterCompetitionAction(
  competitionId: string,
  entryData: EntryData
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'You must be logged in to enter a competition' }

  const competition = await getCompetitionById(competitionId)
  if (!competition) return { success: false, error: 'Competition not found' }
  if (!competition.club) return { success: false, error: 'Club not found' }

  // Build an immutable snapshot of the competition rules as they stood at entry time.
  // This is stored in entry_data._snapshot so there is an audit trail even if
  // the competition record is later edited.
  const rulesSnapshot: Record<string, unknown> = {
    captured_at:      new Date().toISOString(),
    title:            competition.title,
    type:             competition.type,
    entry_fee_pence:  competition.entry_fee_pence,
    prize_type:       competition.prize_type,
    prize_pence:      competition.prize_pence,
    prize_pct_bps:    competition.prize_pct_bps,
    prize_description: competition.prize_description,
    rules_text:       competition.rules_text,
    closes_at:        competition.closes_at,
    club_pct_bps:     competition.club_pct_bps,
    platform_fee_bps: competition.platform_fee_bps,
    weekly_boost_contribution_bps: competition.weekly_boost_contribution_bps,
  }

  // For donation / free competitions, entry fee may be 0
  if (competition.entry_fee_pence === 0) {
    const { entry, error } = await createPendingEntry({
      competitionId,
      participantId: user.id,
      entryData,
      rulesSnapshot,
    })
    if (error || !entry) return { success: false, error: error ?? 'Failed to create entry' }

    // Activate immediately for free entries
    const db = (await import('@/lib/supabase/admin')).createAdminClient()
    await db.from('entries').update({ status: 'active' }).eq('id', entry.id)

    revalidatePath('/my/dashboard')
    return { success: true, data: { checkoutUrl: `/c/${competition.club.slug}/${competitionId}/confirmation` } }
  }

  const { entry, error: entryError } = await createPendingEntry({
    competitionId,
    participantId: user.id,
    entryData,
    rulesSnapshot,
  })
  if (entryError || !entry) return { success: false, error: entryError ?? 'Failed to create entry' }

  try {
    const { sessionUrl } = await createCheckoutSession({
      competition,
      club: competition.club,
      entryId: entry.id,
      participantId: user.id,
    })
    return { success: true, data: { checkoutUrl: sessionUrl } }
  } catch (err) {
    // Clean up pending entry if checkout creation fails
    const db = (await import('@/lib/supabase/admin')).createAdminClient()
    await db.from('entries').delete().eq('id', entry.id)
    return { success: false, error: err instanceof Error ? err.message : 'Payment setup failed' }
  }
}
