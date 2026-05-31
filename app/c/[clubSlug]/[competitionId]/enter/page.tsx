import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClubBySlug } from '@/lib/services/clubs'
import { getCompetitionWithEntryCount, getCompetitionFixtures } from '@/lib/services/competitions'
import { createAdminClient } from '@/lib/supabase/admin'
import { PredictorForm } from '@/components/competitions/forms/predictor-form'
import { LMSForm }       from '@/components/competitions/forms/lms-form'
import { TeamCardForm }  from '@/components/competitions/forms/team-card-form'
import { DonationForm }  from '@/components/competitions/forms/donation-form'
import { formatPence, formatDate } from '@/lib/utils'
import Link from 'next/link'
import {
  ChevronLeft, ShieldCheck, Lock, Trophy,
  FileText, Clock,
} from 'lucide-react'
import type { Fixture, LMSEntryData, TeamCardSlotRecord, EnrichedTeamCardSlot } from '@/types/app'
import type { Metadata } from 'next'

interface PageParams {
  clubSlug:      string
  competitionId: string
}

export const metadata: Metadata = { title: 'Enter competition' }


const TYPE_LABEL: Record<string, string> = {
  predictor:         'Score Predictor',
  last_man_standing: 'Last Man Standing',
  team_card:         'Team Card',
  donation:          'Donation',
}

export default async function EnterCompetitionPage({ params }: { params: Promise<PageParams> }) {
  const { clubSlug, competitionId } = await params

  // ── Auth wall ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/c/${clubSlug}/${competitionId}/enter`)
  }

  const [club, competition] = await Promise.all([
    getClubBySlug(clubSlug),
    getCompetitionWithEntryCount(competitionId),
  ])

  if (!club || !competition || competition.status !== 'open') notFound()

  const db = createAdminClient()

  // ── Duplicate entry guard ─────────────────────────────────
  const { data: existingEntry } = await db
    .from('entries')
    .select('id, status')
    .eq('competition_id', competitionId)
    .eq('participant_id', user.id)
    .in('status', ['active', 'pending_payment'])
    .maybeSingle()

  if (existingEntry) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card">
          <p className="text-4xl mb-3">🎟️</p>
          <h2 className="text-xl font-bold text-slate-900 mb-2">You&apos;re already entered</h2>
          <p className="text-sm text-slate-500 mb-6">
            {existingEntry.status === 'pending_payment'
              ? 'Your entry is awaiting payment confirmation. Check your email for details.'
              : 'You already have an active entry in this competition.'}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/c/${clubSlug}/${competitionId}`}
              className="rounded-2xl bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors text-center"
            >
              View competition
            </Link>
            <Link
              href="/my/dashboard"
              className="rounded-2xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors text-center"
            >
              My entries
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Type-specific data loading ────────────────────────────
  let fixtures: Fixture[]          = []
  let enrichedSlots: EnrichedTeamCardSlot[] = []
  let usedTeams: string[]          = []

  if (competition.type === 'predictor') {
    fixtures = await getCompetitionFixtures(competitionId) as Fixture[]
  }

  if (competition.type === 'team_card') {
    const { data: slotData } = await db
      .from('team_card_slots')
      .select('*')
      .eq('competition_id', competitionId)
      .order('slot_number')

    // Enrich each slot with its linked entry's status so the UI can
    // distinguish "Reserved (pending payment)" from "Taken (active)".
    const claimedEntryIds = (slotData ?? [])
      .filter(s => s.entry_id)
      .map(s => s.entry_id as string)

    let entryStatusMap: Record<string, string> = {}
    if (claimedEntryIds.length > 0) {
      const { data: entryRows } = await db
        .from('entries')
        .select('id, status')
        .in('id', claimedEntryIds)
      for (const e of entryRows ?? []) {
        entryStatusMap[e.id] = e.status
      }
    }

    enrichedSlots = (slotData ?? []).map(s => ({
      ...(s as TeamCardSlotRecord),
      entryStatus: s.entry_id ? (entryStatusMap[s.entry_id] ?? null) : null,
    }))
  }

  if (competition.type === 'last_man_standing') {
    // If the user somehow already has a settled entry (e.g. refunded then re-entering),
    // capture their previously used teams so the UI can grey them out.
    const { data: prevEntry } = await db
      .from('entries')
      .select('entry_data')
      .eq('competition_id', competitionId)
      .eq('participant_id', user.id)
      .neq('status', 'pending_payment')
      .maybeSingle()

    if (prevEntry?.entry_data) {
      const d = prevEntry.entry_data as LMSEntryData
      usedTeams = (d.picks ?? []).map(p => p.team_picked)
    }
  }

  // ── Entry count for capacity display ─────────────────────
  const availableSlots = competition.max_entries
    ? competition.max_entries - (competition.entry_count ?? 0)
    : null

  const TYPE_EMOJI: Record<string, string> = {
    predictor:         '⚽',
    last_man_standing: '🏆',
    team_card:         '🃏',
    donation:          '💚',
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar */}
      <div
        className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm"
      >
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center gap-3">
          <Link
            href={`/c/${clubSlug}/${competitionId}`}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{competition.title}</p>
            <p className="text-xs text-slate-400 truncate">{club.name}</p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-400">
            <Lock className="h-3 w-3" />
            Secure
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Competition summary card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-4">
          <span className="text-3xl flex-shrink-0" role="img" aria-label={competition.type}>
            {TYPE_EMOJI[competition.type] ?? '🎯'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm">{competition.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{club.name} · {TYPE_LABEL[competition.type] ?? competition.type}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-extrabold text-primary-700">{formatPence(competition.entry_fee_pence)}</p>
            {availableSlots !== null && (
              <p className="text-xs text-slate-400 mt-0.5">{availableSlots} spot{availableSlots !== 1 ? 's' : ''} left</p>
            )}
            {competition.closes_at && (
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-0.5 justify-end">
                <Clock className="h-3 w-3" />
                Closes {formatDate(competition.closes_at)}
              </p>
            )}
          </div>
        </div>

        {/* Rules / description (collapsible) */}
        {(competition.description || competition.rules_text) && (
          <details className="rounded-2xl border border-slate-200 bg-white overflow-hidden group">
            <summary className="px-5 py-4 cursor-pointer flex items-center gap-2 text-sm font-medium text-slate-700 select-none hover:bg-slate-50 transition-colors">
              <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
              Competition rules &amp; details
              <span className="ml-auto text-slate-400 text-xs group-open:hidden">Tap to expand</span>
              <span className="ml-auto text-slate-400 text-xs hidden group-open:inline">Collapse</span>
            </summary>
            <div className="px-5 pb-5 space-y-3 border-t border-slate-100">
              {competition.description && (
                <p className="text-sm text-slate-600 leading-relaxed pt-4">{competition.description}</p>
              )}
              {competition.rules_text && (
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {competition.rules_text}
                </div>
              )}
            </div>
          </details>
        )}

        {/* Prize info */}
        {competition.prize_type !== 'none' && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 flex items-start gap-3">
            <Trophy className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Prize</p>
              <p className="text-sm text-amber-700 mt-0.5">
                {competition.prize_type === 'percentage' && `${Math.round((competition.prize_pct_bps / 100))}% of the entry pot`}
                {competition.prize_type === 'fixed' && formatPence(competition.prize_pence)}
                {competition.prize_type === 'description' && competition.prize_description}
              </p>
            </div>
          </div>
        )}

        {/* The form */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">
              {competition.type === 'donation' ? 'Make your donation' : 'Make your selections'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {competition.type === 'predictor' && 'Predict the result of every match below'}
              {competition.type === 'last_man_standing' && 'Pick your team for round 1'}
              {competition.type === 'team_card' && 'Choose an available team slot'}
              {competition.type === 'donation' && `Your donation goes directly to ${club.name}`}
            </p>
          </div>
          <div className="p-5">
            {competition.type === 'predictor' && (
              <PredictorForm
                competition={competition}
                fixtures={fixtures}
                clubName={club.name}
                clubSlug={club.slug}
              />
            )}
            {competition.type === 'last_man_standing' && (
              <LMSForm
                competition={competition}
                usedTeams={usedTeams}
                clubName={club.name}
                clubSlug={club.slug}
              />
            )}
            {competition.type === 'team_card' && (
              <TeamCardForm
                competition={competition}
                slots={enrichedSlots}
                clubName={club.name}
                clubSlug={club.slug}
              />
            )}
            {competition.type === 'donation' && (
              <DonationForm
                competition={competition}
                clubName={club.name}
                clubSlug={club.slug}
              />
            )}
          </div>
        </div>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3" /> Secure payment by Stripe
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Fundraising for {club.name}
          </span>
        </div>

      </div>
    </div>
  )
}
