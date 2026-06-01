import Link from 'next/link'
import { CheckCircle2, Clock, Heart, Share2, Trophy, Zap, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubBySlug } from '@/lib/services/clubs'
import { getCompetitionWithEntryCount } from '@/lib/services/competitions'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { formatPence } from '@/lib/utils'
import type { PredictorEntryData, LMSEntryData, TeamCardEntryData, DonationEntryData } from '@/types/app'

export const metadata: Metadata = { title: 'Entry confirmed!' }

interface PageParams {
  clubSlug:      string
  competitionId: string
}

const TYPE_LABEL: Record<string, string> = {
  predictor:         'Score Predictor',
  last_man_standing: 'Last Man Standing',
  team_card:         'Team Card',
  donation:          'Donation',
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params:       Promise<PageParams>
  searchParams: Promise<{ session_id?: string }>
}) {
  const { clubSlug, competitionId } = await params
  const { session_id } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [club, competition, weeklyBoostEnabled] = await Promise.all([
    getClubBySlug(clubSlug),
    getCompetitionWithEntryCount(competitionId),
    isFeatureEnabled('weekly_boost'),
  ])

  const clubName        = club?.name ?? 'your club'
  const competitionName = competition?.title ?? 'this competition'
  const boostBps        = competition?.weekly_boost_contribution_bps ?? 0

  // Look up the user's entry for this competition so we can show their selections.
  let entry: {
    id: string
    status: string
    entry_data: Record<string, unknown>
    entry_number: number
  } | null = null

  if (user) {
    const db = createAdminClient()

    // If we have a session_id, find the entry via the payment.
    // Otherwise fall back to participant_id + competition_id lookup.
    if (session_id) {
      const { data: payment } = await db
        .from('payments')
        .select('entry_id, status')
        .eq('stripe_checkout_session_id', session_id)
        .maybeSingle()

      if (payment?.entry_id) {
        const { data: e } = await db
          .from('entries')
          .select('id, status, entry_data, entry_number')
          .eq('id', payment.entry_id)
          .maybeSingle()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entry = e as any
      }
    }

    if (!entry) {
      const { data: e } = await db
        .from('entries')
        .select('id, status, entry_data, entry_number')
        .eq('competition_id', competitionId)
        .eq('participant_id', user.id)
        .in('status', ['active', 'pending_payment'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entry = e as any
    }
  }

  const isActive          = entry?.status === 'active'
  const isPendingPayment  = entry?.status === 'pending_payment'

  // ── Entry data helpers ────────────────────────────────────

  function renderSelections() {
    if (!entry || !competition) return null
    const data = entry.entry_data as unknown as Record<string, unknown>

    if (competition.type === 'predictor') {
      const d = data as unknown as PredictorEntryData
      const predictions = d.predictions ?? []
      if (!predictions.length) return null

      const LABEL: Record<string, string> = { H: 'Home Win', D: 'Draw', A: 'Away Win' }
      return (
        <div className="space-y-1.5">
          {predictions.map((p, i) => (
            <div key={p.fixture_id ?? i} className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Match {i + 1}</span>
              <span className="font-semibold text-slate-900">{LABEL[p.predicted_result] ?? p.predicted_result}</span>
            </div>
          ))}
          {(data.tiebreaker_total_goals as number) !== undefined && (
            <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-1.5 mt-1.5">
              <span className="text-slate-500">Tiebreaker (total goals)</span>
              <span className="font-semibold text-slate-900">{data.tiebreaker_total_goals as number}</span>
            </div>
          )}
        </div>
      )
    }

    if (competition.type === 'last_man_standing') {
      const d = data as unknown as LMSEntryData
      const pick = d.picks?.[0]
      if (!pick) return null
      return (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Round 1 pick</span>
          <span className="font-semibold text-slate-900">{pick.team_picked}</span>
        </div>
      )
    }

    if (competition.type === 'team_card') {
      const d = data as unknown as TeamCardEntryData
      return (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Your slot</span>
          <span className="font-semibold text-slate-900">Slot #{d.slot_number}</span>
        </div>
      )
    }

    if (competition.type === 'donation') {
      const d = data as unknown as DonationEntryData
      return d.message ? (
        <div className="text-sm">
          <p className="text-slate-500 mb-1">Your message</p>
          <p className="text-slate-700 italic">&quot;{d.message}&quot;</p>
        </div>
      ) : null
    }

    return null
  }

  const selections = renderSelections()

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-slate-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-5">

        {/* Main success card */}
        <div className="rounded-3xl border border-green-200 bg-white p-8 text-center shadow-card-md">

          {/* Icon — green tick if active, clock if still pending */}
          <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${
            isPendingPayment ? 'bg-amber-100' : 'bg-green-100'
          }`}>
            {isPendingPayment
              ? <Clock className="h-10 w-10 text-amber-500" />
              : <CheckCircle2 className="h-10 w-10 text-green-600" />
            }
          </div>

          {isPendingPayment ? (
            <>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Payment processing…</h1>
              <p className="text-slate-500 leading-relaxed mb-6">
                Your entry to <strong className="text-slate-700">{competitionName}</strong> is being
                confirmed. You'll receive an email once your payment clears — this usually takes a few
                seconds.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-2">You&apos;re in! 🎉</h1>
              <p className="text-slate-500 leading-relaxed mb-6">
                Your entry to <strong className="text-slate-700">{competitionName}</strong> is confirmed.
                Good luck, and thanks for supporting {clubName}!
              </p>
            </>
          )}

          {/* Confirmation checklist */}
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 space-y-2 text-left mb-6">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>A confirmation email has been sent to you</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>Your payment was processed securely by Stripe</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>Results will be announced after the competition closes</span>
            </div>
            {competition && (
              <div className="flex items-start gap-2">
                <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>
                  {competition.type === 'predictor' && 'Scores will be matched after all fixtures are played'}
                  {competition.type === 'last_man_standing' && 'You\'ll be notified before each new round opens'}
                  {competition.type === 'team_card' && 'Your slot is locked in — the winning team will be drawn at close'}
                  {competition.type === 'donation' && `100% of your donation goes straight to ${clubName}`}
                </span>
              </div>
            )}
          </div>

          {/* Entry reference */}
          {entry && (
            <p className="text-xs text-slate-400 mb-4">
              Entry #{entry.entry_number} ·{' '}
              {competition ? TYPE_LABEL[competition.type] ?? competition.type : ''}
              {competition?.entry_fee_pence
                ? ` · ${formatPence(competition.entry_fee_pence)}`
                : ''}
            </p>
          )}

          {/* Your selections summary */}
          {selections && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-left mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Your selections
              </p>
              {selections}
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            <Link
              href="/my/dashboard"
              className="rounded-2xl bg-primary-600 py-3.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors text-center flex items-center justify-center gap-2"
            >
              View my entries
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/c/${clubSlug}/${competitionId}`}
              className="rounded-2xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share with friends
            </Link>
          </div>
        </div>

        {/* Weekly Boost notice */}
        {weeklyBoostEnabled && boostBps > 0 && isActive && (
          <div className="rounded-2xl border border-amber-200 bg-white p-5 flex items-start gap-3 shadow-sm">
            <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm mb-1">
                You&apos;re in the Weekly Boost draw too!
              </p>
              <p className="text-sm text-slate-500 leading-relaxed">
                A share of your entry has been added to this week&apos;s ClubBoost prize pool.
                The draw is every Friday — you could win a bonus prize on top of the competition.
              </p>
            </div>
          </div>
        )}

        {/* Thank you */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 flex items-center gap-3 shadow-sm">
          <Heart className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-slate-600 leading-relaxed">
            Every entry directly supports{' '}
            <strong className="text-slate-800">{clubName}</strong>.
            Thank you for being a brilliant supporter.
          </p>
        </div>

        <p className="text-center text-xs text-slate-400">
          Powered by{' '}
          <Link href="/" className="font-medium text-primary-600 hover:underline">
            ClubBoost
          </Link>
          {' '}— fundraising for grassroots sport
        </p>

      </div>
    </div>
  )
}
