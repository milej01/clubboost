import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { poundsToPence, percentToBps } from '@/lib/utils'
import { logAudit } from './audit'
import { notifyFundraiserPublished, notifyFundraiserClosed } from './notification-hooks'
import type { Competition, CompetitionWithClub, CompetitionStatus, Club } from '@/types/app'
import type { CompetitionFormData } from '@/lib/validations/competition'

export async function getCompetitionById(id: string): Promise<CompetitionWithClub | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('competitions')
    .select('*, club:clubs(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  return data as CompetitionWithClub | null
}

export async function getCompetitionWithEntryCount(id: string) {
  const supabase = await createClient()
  const { data: competition } = await supabase
    .from('competitions')
    .select('*, club:clubs(*)')
    .eq('id', id)
    .single()

  if (!competition) return null

  const { count } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .eq('competition_id', id)
    .in('status', ['active', 'eliminated', 'winner'])

  return {
    ...(competition as CompetitionWithClub),
    entry_count: count ?? 0,
    total_pot_pence: (count ?? 0) * (competition as Competition).entry_fee_pence,
  }
}

export async function getCompetitionsForClub(clubId: string): Promise<Competition[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('competitions')
    .select('*')
    .eq('club_id', clubId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return (data as Competition[]) ?? []
}

export async function getOpenCompetitionsForClub(clubId: string): Promise<Competition[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('competitions')
    .select('*')
    .eq('club_id', clubId)
    .eq('status', 'open')
    .is('deleted_at', null)
    .order('closes_at', { ascending: true })
  return (data as Competition[]) ?? []
}

export async function createCompetition(
  clubId: string,
  userId: string,
  formData: CompetitionFormData
): Promise<{ competition: Competition | null; error: string | null }> {
  const db = createAdminClient()

  // Build type-specific config
  let config: Record<string, unknown> = {}

  if (formData.type === 'predictor') {
    config = {
      fixtures: formData.fixtures ?? [],
      points_per_correct: 1,
    }
  } else if (formData.type === 'last_man_standing') {
    config = {
      max_rounds:           formData.max_rounds ?? 10,
      allow_team_reuse:     formData.allow_team_reuse ?? false,
      available_teams:      formData.available_teams ?? [],
      round_deadline_hours: formData.round_deadline_hours ?? 24,
    }
  } else if (formData.type === 'team_card') {
    config = { slots: formData.team_slots ?? [], reveal_method: 'manual' }
  } else if (formData.type === 'donation') {
    config = {
      target_amount_pence: formData.target_amount_pounds
        ? poundsToPence(formData.target_amount_pounds)
        : null,
      show_progress: formData.show_progress ?? true,
    }
  }

  const prizePctBps = formData.prize_type === 'percentage'
    ? percentToBps(formData.prize_pct ?? 0)
    : 0

  const { data: competition, error } = await db
    .from('competitions')
    .insert({
      club_id:       clubId,
      created_by:    userId,
      type:          formData.type,
      title:         formData.title,
      description:   formData.description,
      rules_text:    formData.rules_text,
      status:        'draft',
      entry_fee_pence: poundsToPence(formData.entry_fee_pounds),
      max_entries:   formData.max_entries ?? null,
      prize_type:    formData.prize_type,
      prize_pence:   formData.prize_type === 'fixed'
        ? poundsToPence(formData.prize_pounds ?? 0)
        : 0,
      prize_pct_bps: prizePctBps,
      prize_description: formData.prize_description,
      club_pct_bps:  percentToBps(formData.club_pct),
      platform_fee_bps: percentToBps(formData.platform_fee_pct),
      weekly_boost_contribution_bps: percentToBps(formData.weekly_boost_contribution_pct),
      opens_at:      formData.opens_at ?? null,
      closes_at:     formData.closes_at ?? null,
      config,
      terms_accepted: formData.terms_accepted,
    })
    .select()
    .single()

  if (error || !competition) return { competition: null, error: error?.message ?? 'Failed to create competition' }

  // Create fixtures for predictor
  if (formData.type === 'predictor' && formData.fixtures?.length) {
    await db.from('fixtures').insert(
      formData.fixtures.map((f, i) => ({
        competition_id: competition.id,
        fixture_order:  i,
        home_team:      f.home_team,
        away_team:      f.away_team,
        kickoff_at:     f.kickoff_at ?? null,
      }))
    )
  }

  // Create slots for team card
  if (formData.type === 'team_card' && formData.team_slots?.length) {
    await db.from('team_card_slots').insert(
      formData.team_slots.map(s => ({
        competition_id: competition.id,
        slot_number:    s.slot_number,
        team_name:      s.team_name,
      }))
    )
  }

  await logAudit({
    actorId:    userId,
    clubId,
    entityType: 'competition',
    entityId:   competition.id,
    action:     'competition_created',
    afterState: { title: competition.title, type: competition.type },
  })

  return { competition: competition as Competition, error: null }
}

export async function publishCompetition(
  competitionId: string,
  actorId: string
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { data: comp } = await db
    .from('competitions')
    .select('club_id, status, title')
    .eq('id', competitionId)
    .single()

  if (!comp) return { error: 'Competition not found' }
  if (comp.status !== 'draft') return { error: 'Only draft competitions can be published' }

  // Guard: suspended clubs cannot publish
  const { data: club } = await db
    .from('clubs')
    .select('status')
    .eq('id', comp.club_id)
    .single()

  if (club?.status === 'suspended') {
    return { error: 'Suspended clubs cannot publish competitions' }
  }

  const { error } = await db
    .from('competitions')
    .update({ status: 'open' })
    .eq('id', competitionId)

  if (error) return { error: error.message }

  await logAudit({
    actorId, clubId: comp.club_id,
    entityType: 'competition', entityId: competitionId,
    action: 'competition_published',
    afterState: { title: comp.title },
  })

  // Notify club owner that their fundraiser is live (non-blocking)
  const { data: fullComp } = await db.from('competitions').select('*').eq('id', competitionId).maybeSingle()
  const { data: fullClub } = await db.from('clubs').select('*').eq('id', comp.club_id).maybeSingle()
  if (fullComp && fullClub) {
    void notifyFundraiserPublished(fullComp as Competition, fullClub as Club)
  }

  return { error: null }
}

export async function closeCompetition(
  competitionId: string,
  actorId: string
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { data: comp } = await db
    .from('competitions')
    .select('club_id, title')
    .eq('id', competitionId)
    .single()

  const { error } = await db
    .from('competitions')
    .update({ status: 'closed' })
    .eq('id', competitionId)

  if (error) return { error: error.message }

  await logAudit({
    actorId, clubId: comp?.club_id,
    entityType: 'competition', entityId: competitionId,
    action: 'competition_closed',
    afterState: { title: comp?.title },
  })

  // Notify club owner with closing summary (non-blocking)
  if (comp) {
    const [{ data: fullComp }, { data: fullClub }] = await Promise.all([
      db.from('competitions').select('*').eq('id', competitionId).maybeSingle(),
      db.from('clubs').select('*').eq('id', comp.club_id).maybeSingle(),
    ])
    const { count: finalEntryCount } = await db
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId)
      .in('status', ['active', 'eliminated', 'winner'])

    const { data: payments } = await db
      .from('payments')
      .select('club_fundraising_amount_pence, prize_pool_contribution_pence')
      .eq('competition_id', competitionId)
      .eq('status', 'succeeded')

    const grossRaisedPence   = (payments ?? []).reduce((s, p) => s + (p.club_fundraising_amount_pence ?? 0) + (p.prize_pool_contribution_pence ?? 0), 0)
    const yourSharePence     = (payments ?? []).reduce((s, p) => s + (p.club_fundraising_amount_pence ?? 0), 0)
    const prizePoolPence     = (payments ?? []).reduce((s, p) => s + (p.prize_pool_contribution_pence ?? 0), 0)

    if (fullComp && fullClub) {
      void notifyFundraiserClosed({
        competition:     fullComp as Competition,
        club:            fullClub as Club,
        finalEntryCount: finalEntryCount ?? 0,
        grossRaisedPence,
        yourSharePence,
        prizePoolPence,
      })
    }
  }

  return { error: null }
}

export async function setCompetitionStatus(
  competitionId: string,
  status: CompetitionStatus,
  actorId: string
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('competitions')
    .update({ status })
    .eq('id', competitionId)
  return { error: error?.message ?? null }
}

export async function getAllCompetitionsAdmin() {
  const db = createAdminClient()
  const { data } = await db
    .from('competitions')
    .select('*, club:clubs(name, slug, status)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getCompetitionEntries(competitionId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('entries')
    .select('*, participant:profiles(id, display_name), payment:payments(amount_pence, status)')
    .eq('competition_id', competitionId)
    .neq('status', 'pending_payment')
    .order('entry_number')
  return data ?? []
}

export async function getCompetitionFixtures(competitionId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fixtures')
    .select('*')
    .eq('competition_id', competitionId)
    .order('fixture_order')
  return data ?? []
}

export async function updateFixtureResult(
  fixtureId: string,
  result: 'H' | 'D' | 'A',
  actorId: string
) {
  const db = createAdminClient()
  await db.from('fixtures').update({ actual_result: result }).eq('id', fixtureId)
  await logAudit({
    actorId, entityType: 'fixture', entityId: fixtureId,
    action: 'admin_override', afterState: { actual_result: result },
  })
}
