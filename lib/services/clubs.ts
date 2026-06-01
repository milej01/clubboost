import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/utils'
import { logAudit } from './audit'
import {
  notifyClubApplicationReceived,
  notifyClubApproved,
  notifyClubRejected,
} from './notification-hooks'
import type { Club, ClubWithStats, ClubStatus } from '@/types/app'
import type { ClubFormData } from '@/lib/validations/club'

export async function getClubBySlug(slug: string): Promise<Club | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clubs')
    .select('*')
    .eq('slug', slug)
    .single()
  return data
}

export async function getClubById(id: string): Promise<Club | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clubs')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

export async function getClubsForUser(userId: string): Promise<Club[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clubs')
    .select('*, club_members!inner(user_id, role)')
    .eq('club_members.user_id', userId)
    .is('deleted_at', null)
  return (data as Club[]) ?? []
}

export async function getAllClubsAdmin(): Promise<ClubWithStats[]> {
  const db = createAdminClient()
  const { data: clubs } = await db
    .from('clubs')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (!clubs) return []

  // Aggregate stats per club
  const stats = await Promise.all(
    clubs.map(async (club) => {
      const { data: payments } = await db
        .from('payments')
        .select('amount_pence, club_fundraising_amount_pence')
        .eq('competition_id', club.id)   // via competitions; simplified
        .eq('status', 'succeeded')

      const { count: competitionCount } = await db
        .from('competitions')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .is('deleted_at', null)

      const { count: activeCount } = await db
        .from('competitions')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', club.id)
        .eq('status', 'open')

      return {
        ...club,
        total_raised_pence: 0, // computed below via competition payments
        competition_count: competitionCount ?? 0,
        active_competition_count: activeCount ?? 0,
        entry_count: payments?.length ?? 0,
      } as ClubWithStats
    })
  )

  return stats
}

export async function createClub(
  userId: string,
  data: ClubFormData
): Promise<{ club: Club | null; error: string | null }> {
  const supabase = await createClient()

  let slug = slugify(data.name)

  // Ensure slug uniqueness
  const { data: existing } = await supabase
    .from('clubs')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const { data: club, error } = await supabase
    .from('clubs')
    .insert({
      ...data,
      slug,
      created_by: userId,
      status: 'pending',
    })
    .select()
    .single()

  if (error || !club) return { club: null, error: error?.message ?? 'Failed to create club' }

  // Add creator as owner
  await supabase.from('club_members').insert({
    club_id: club.id,
    user_id: userId,
    role: 'owner',
  })

  // Update user role to club_admin if not already platform_admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role === 'participant') {
    await supabase
      .from('profiles')
      .update({ role: 'club_admin' })
      .eq('id', userId)
  }

  await logAudit({
    actorId:    userId,
    clubId:     club.id,
    entityType: 'club',
    entityId:   club.id,
    action:     'club_created',
    afterState: { name: club.name, slug: club.slug },
  })

  // Notify admin of new application (non-blocking)
  void notifyClubApplicationReceived(club as Club)

  return { club: club as Club, error: null }
}

export async function updateClub(
  clubId: string,
  actorId: string,
  data: Partial<ClubFormData>
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('clubs')
    .update(data)
    .eq('id', clubId)

  if (error) return { error: error.message }

  await logAudit({
    actorId, clubId,
    entityType: 'club', entityId: clubId,
    action: 'club_updated', afterState: data as unknown as Record<string, unknown>,
  })

  return { error: null }
}

export async function setClubStatus(
  clubId: string,
  actorId: string,
  status: ClubStatus,
  reason?: string
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { data: before } = await db
    .from('clubs')
    .select('status')
    .eq('id', clubId)
    .single()

  const update: Record<string, unknown> = { status }
  if (status === 'rejected')  update.rejection_reason  = reason ?? null
  if (status === 'suspended') update.suspension_reason = reason ?? null

  const { error } = await db.from('clubs').update(update).eq('id', clubId)
  if (error) return { error: error.message }

  const actionMap: Record<string, string> = {
    approved:  'club_approved',
    rejected:  'club_rejected',
    suspended: 'club_suspended',
  }

  await logAudit({
    actorId, clubId,
    entityType: 'club', entityId: clubId,
    action:      actionMap[status] ?? 'club_updated',
    beforeState: { status: before?.status },
    afterState:  { status, reason },
  })

  // Send status-change emails to the club contact (non-blocking)
  const { data: fullClub } = await db.from('clubs').select('*').eq('id', clubId).maybeSingle()
  if (fullClub) {
    if (status === 'approved') void notifyClubApproved(fullClub as Club)
    if (status === 'rejected') void notifyClubRejected(fullClub as Club, reason)
  }

  return { error: null }
}

export async function setStripeOnboarded(
  clubId: string,
  stripeAccountId: string
): Promise<void> {
  const db = createAdminClient()
  await db
    .from('clubs')
    .update({ stripe_account_id: stripeAccountId, stripe_onboarded: true })
    .eq('id', clubId)
}

export async function getClubStats(clubId: string) {
  const db = createAdminClient()

  const { data: competitions } = await db
    .from('competitions')
    .select('id, status')
    .eq('club_id', clubId)
    .is('deleted_at', null)

  const competitionIds = (competitions ?? []).map(c => c.id)

  if (!competitionIds.length) {
    return { total_raised_pence: 0, competition_count: 0, entry_count: 0, active_count: 0 }
  }

  const { data: payments } = await db
    .from('payments')
    .select('club_fundraising_amount_pence')
    .in('competition_id', competitionIds)
    .eq('status', 'succeeded')

  const { count: entryCount } = await db
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .in('competition_id', competitionIds)
    .eq('status', 'active')

  const totalRaised = (payments ?? []).reduce((sum, p) => sum + (p.club_fundraising_amount_pence ?? 0), 0)

  return {
    total_raised_pence: totalRaised,
    competition_count: competitions?.length ?? 0,
    entry_count: entryCount ?? 0,
    active_count: (competitions ?? []).filter(c => c.status === 'open').length,
  }
}
