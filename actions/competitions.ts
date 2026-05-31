'use server'

import { createClient } from '@/lib/supabase/server'
import {
  createCompetition,
  publishCompetition,
  closeCompetition,
  setCompetitionStatus,
} from '@/lib/services/competitions'
import { competitionSchema } from '@/lib/validations/competition'
import type { ActionResult, CompetitionType } from '@/types/app'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createCompetitionAction(
  clubId: string,
  prevState: ActionResult<{ competitionId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ competitionId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Parse fixtures from formData (predictor)
  const type = formData.get('type') as CompetitionType
  const fixtures = []
  for (let i = 0; i < 6; i++) {
    const home = formData.get(`fixture_${i}_home`)
    const away = formData.get(`fixture_${i}_away`)
    if (home && away) {
      fixtures.push({
        fixture_order: i,
        home_team: String(home),
        away_team: String(away),
        kickoff_at: formData.get(`fixture_${i}_kickoff`) as string | undefined,
      })
    }
  }

  // Parse team slots
  const teamSlots = []
  const slotsRaw = formData.get('team_slots')
  if (slotsRaw) {
    try {
      const parsed = JSON.parse(slotsRaw as string)
      teamSlots.push(...parsed)
    } catch { /* ignore */ }
  }

  // Parse available teams for LMS
  const teamsRaw = formData.get('available_teams')
  const availableTeams = teamsRaw
    ? String(teamsRaw).split('\n').map(t => t.trim()).filter(Boolean)
    : []

  const parsed = competitionSchema.safeParse({
    type,
    title:              formData.get('title'),
    description:        formData.get('description') || undefined,
    rules_text:         formData.get('rules_text') || undefined,
    entry_fee_pounds:   formData.get('entry_fee_pounds'),
    max_entries:        formData.get('max_entries') || undefined,
    prize_type:         formData.get('prize_type'),
    prize_pct:          formData.get('prize_pct') || undefined,
    prize_pounds:       formData.get('prize_pounds') || undefined,
    prize_description:  formData.get('prize_description') || undefined,
    club_pct:           formData.get('club_pct'),
    platform_fee_pct:   formData.get('platform_fee_pct'),
    weekly_boost_contribution_pct: formData.get('weekly_boost_contribution_pct') ?? '0',
    opens_at:           formData.get('opens_at') || undefined,
    closes_at:          formData.get('closes_at') || undefined,
    fixtures:           fixtures.length ? fixtures : undefined,
    team_slots:         teamSlots.length ? teamSlots : undefined,
    max_rounds:         formData.get('max_rounds') || undefined,
    allow_team_reuse:   formData.get('allow_team_reuse') === 'true',
    available_teams:    availableTeams.length ? availableTeams : undefined,
    round_deadline_hours: formData.get('round_deadline_hours') || undefined,
    target_amount_pounds: formData.get('target_amount_pounds') || undefined,
    show_progress:      formData.get('show_progress') !== 'false',
    terms_accepted:     formData.get('terms_accepted') === 'true',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const { competition, error } = await createCompetition(clubId, user.id, parsed.data)
  if (error || !competition) return { success: false, error: error ?? 'Failed to create competition' }

  revalidatePath('/dashboard')
  return { success: true, data: { competitionId: competition.id } }
}

export async function publishCompetitionAction(competitionId: string): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await publishCompetition(competitionId, user.id)
  if (error) return { success: false, error }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/competitions/${competitionId}`)
  return { success: true, data: undefined }
}

export async function closeCompetitionAction(competitionId: string): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await closeCompetition(competitionId, user.id)
  if (error) return { success: false, error }

  revalidatePath(`/dashboard/competitions/${competitionId}`)
  return { success: true, data: undefined }
}

export async function cancelCompetitionAction(competitionId: string): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await setCompetitionStatus(competitionId, 'cancelled', user.id)
  if (error) return { success: false, error }

  revalidatePath(`/dashboard/competitions/${competitionId}`)
  return { success: true, data: undefined }
}

export async function duplicateCompetitionAction(
  competitionId: string,
): Promise<ActionResult<{ competitionId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const db = createAdminClient()

  // Fetch source competition
  const { data: src } = await db
    .from('competitions')
    .select('*')
    .eq('id', competitionId)
    .single()

  if (!src) return { success: false, error: 'Competition not found' }

  // Verify the caller is a member of the club
  const { data: membership } = await db
    .from('club_members')
    .select('role')
    .eq('club_id', src.club_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return { success: false, error: 'Access denied' }

  // Create a new draft copy
  const { data: copy, error } = await db
    .from('competitions')
    .insert({
      club_id:         src.club_id,
      created_by:      user.id,
      type:            src.type,
      title:           `${src.title} (copy)`,
      description:     src.description,
      rules_text:      src.rules_text,
      status:          'draft',
      entry_fee_pence: src.entry_fee_pence,
      max_entries:     src.max_entries,
      prize_type:      src.prize_type,
      prize_pence:     src.prize_pence,
      prize_pct_bps:   src.prize_pct_bps,
      prize_description: src.prize_description,
      club_pct_bps:    src.club_pct_bps,
      platform_fee_bps: src.platform_fee_bps,
      weekly_boost_contribution_bps: src.weekly_boost_contribution_bps,
      config:          src.config,
      terms_accepted:  src.terms_accepted,
      // opens_at / closes_at intentionally omitted — set fresh dates
    })
    .select('id')
    .single()

  if (error || !copy) return { success: false, error: error?.message ?? 'Failed to duplicate' }

  revalidatePath('/dashboard/competitions')
  return { success: true, data: { competitionId: copy.id } }
}
