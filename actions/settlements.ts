'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompetitionById, getCompetitionEntries, updateFixtureResult } from '@/lib/services/competitions'
import { markEntryAsWinner, updateEntryPoints } from '@/lib/services/entries'
import { initiatePrizePayout, initiateClubPayout } from '@/lib/services/payouts'
import { getEngine, competitionTypeToGameType } from '@/lib/game-engine'
import { logAudit } from '@/lib/services/audit'
import type { ActionResult } from '@/types/app'
import { revalidatePath } from 'next/cache'

export async function settleCompetitionAction(
  competitionId: string,
  resultData: unknown
): Promise<ActionResult<{ winnerId: string | null; prizePence: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const competition = await getCompetitionById(competitionId)
  if (!competition) return { success: false, error: 'Competition not found' }
  if (competition.status !== 'closed') return { success: false, error: 'Competition must be closed before settling' }

  const entries = await getCompetitionEntries(competitionId)
  const engine  = getEngine(competition.type)

  // Build a GameState from the DB competition + entries for the engine
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameState: any = {
    type:             competitionTypeToGameType(competition.type),
    config:           competition.config,
    entries,
    status:           competition.status,
    // LMS-specific
    currentRound:     (competition.config as Record<string, unknown>)?.current_round ?? 1,
    roundResults:     (competition.config as Record<string, unknown>)?.round_results  ?? [],
    // Donation-specific
    totalRaisedPence: 0,
  }

  const result = engine.settleCompetition(gameState, resultData)

  if (!result.success) return { success: false, error: result.error }

  const db = createAdminClient()

  // Update points for predictor entries
  if (competition.type === 'predictor' && result.data.leaderboard) {
    for (const row of result.data.leaderboard) {
      await updateEntryPoints(row.entry_id, row.points_total)
    }
    // Store fixture results
    const data = resultData as { fixture_results?: Array<{ fixture_id: string; result: 'H' | 'D' | 'A' }> }
    if (data?.fixture_results) {
      for (const fr of data.fixture_results) {
        await updateFixtureResult(fr.fixture_id, fr.result, user.id)
      }
    }
  }

  // Team card: mark winning slot
  if (competition.type === 'team_card') {
    const data = resultData as { winning_slot_number?: number }
    if (data?.winning_slot_number) {
      await db
        .from('team_card_slots')
        .update({ is_winner: true })
        .eq('competition_id', competitionId)
        .eq('slot_number', data.winning_slot_number)
    }
  }

  // Mark winner
  if (result.data.winner_entry_id) {
    await markEntryAsWinner(result.data.winner_entry_id, user.id)
  }

  // Mark competition as settled
  await db
    .from('competitions')
    .update({ status: 'settled', settled_at: new Date().toISOString(), settled_by: user.id })
    .eq('id', competitionId)

  // Create payout records (both pending_review; no auto-transfer in MVP)
  if (result.data.winner_entry_id && result.data.prize_pence > 0) {
    await initiatePrizePayout({
      competitionId,
      winnerEntryId: result.data.winner_entry_id,
      prizePence:    result.data.prize_pence,
      actorId:       user.id,
    })
  }

  const activeEntries = (entries as Array<{ status: string }>).filter(e => e.status === 'active')
  const clubSharePence = Math.floor(
    activeEntries.length * competition.entry_fee_pence * competition.club_pct_bps / 10000
  )
  if (clubSharePence > 0 && competition.club_id) {
    await initiateClubPayout({
      competitionId,
      clubId:      competition.club_id,
      amountPence: clubSharePence,
      actorId:     user.id,
    })
  }

  await logAudit({
    actorId:    user.id,
    clubId:     competition.club_id,
    entityType: 'competition',
    entityId:   competitionId,
    action:     'competition_settled',
    afterState: {
      winner_entry_id: result.data.winner_entry_id,
      prize_pence:     result.data.prize_pence,
      notes:           result.data.notes,
    },
  })

  revalidatePath(`/dashboard/competitions/${competitionId}`)

  return {
    success: true,
    data: {
      winnerId:    result.data.winner_entry_id,
      prizePence:  result.data.prize_pence,
    },
  }
}
