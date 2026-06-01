import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Calendar, CheckCircle2, Clock, Info, Share2, Shield, Users, Zap } from 'lucide-react'
import type { Metadata } from 'next'

import { getClubBySlug } from '@/lib/services/clubs'
import { getCompetitionWithEntryCount, getCompetitionFixtures } from '@/lib/services/competitions'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { getEngine } from '@/lib/game-engine'
import { PotSplitVisualizer } from '@/components/shared/pot-split-visualizer'
import { CompetitionStatusBadge } from '@/components/competitions/competition-status-badge'
import { Alert } from '@/components/ui/alert'
import { calculateSplit, formatPence, formatDate } from '@/lib/utils'
import type { PotSplit } from '@/types/app'

interface PageParams {
  clubSlug:      string
  competitionId: string
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { clubSlug, competitionId } = await params
  const [club, competition] = await Promise.all([
    getClubBySlug(clubSlug),
    getCompetitionWithEntryCount(competitionId),
  ])
  if (!club || !competition) return {}
  return {
    title: `${competition.title} — ${club.name}`,
    description: competition.description ?? `Support ${club.name} by entering their ${competition.title} fundraiser`,
    openGraph: {
      title: `${competition.title} — ${club.name}`,
      description: `Enter and support your local club. Entry: ${formatPence(competition.entry_fee_pence)}`,
    },
  }
}

const TYPE_LABELS: Record<string, string> = {
  predictor:         'Six-Result Predictor',
  last_man_standing: 'Last Man Standing',
  team_card:         'Football Team Card',
  donation:          'Donation Fundraiser',
}

const TYPE_EMOJI: Record<string, string> = {
  predictor:         '⚽',
  last_man_standing: '🏆',
  team_card:         '🃏',
  donation:          '💚',
}

export default async function PublicCompetitionPage({ params }: { params: Promise<PageParams> }) {
  const { clubSlug, competitionId } = await params

  const [club, competition, weeklyBoostEnabled] = await Promise.all([
    getClubBySlug(clubSlug),
    getCompetitionWithEntryCount(competitionId),
    isFeatureEnabled('weekly_boost'),
  ])

  if (!club || !competition || club.status !== 'approved') notFound()
  if (['draft', 'cancelled'].includes(competition.status)) notFound()

  const boostBps = weeklyBoostEnabled ? competition.weekly_boost_contribution_bps : 0

  const split = calculateSplit(competition.entry_fee_pence, {
    prizePctBps:    competition.prize_type === 'percentage' ? competition.prize_pct_bps : 0,
    clubPctBps:     competition.club_pct_bps,
    platformFeeBps: competition.platform_fee_bps,
    weeklyBoostBps: boostBps,
  })

  const potSplit: PotSplit = {
    entry_fee_pence: competition.entry_fee_pence,
    prize_pence:     split.prize,
    club_pence:      split.club,
    platform_pence:  split.platform,
    boost_pence:     split.boost,
    prize_pct:       split.prize / competition.entry_fee_pence * 100,
    club_pct:        split.club  / competition.entry_fee_pence * 100,
    platform_pct:    split.platform / competition.entry_fee_pence * 100,
    boost_pct:       split.boost / competition.entry_fee_pence * 100,
  }

  const engine    = getEngine(competition.type)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules     = engine.explainRulesForParticipant(competition.config as any)

  const fixtures  = competition.type === 'predictor'
    ? await getCompetitionFixtures(competition.id)
    : []

  const entryCount    = competition.entry_count ?? 0
  const totalPotPence = entryCount * competition.entry_fee_pence
  const isOpen        = competition.status === 'open'

  const typeLabel = TYPE_LABELS[competition.type] ?? competition.type
  const typeEmoji = TYPE_EMOJI[competition.type] ?? '🎯'

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Club banner */}
      <div className="bg-primary-700 px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            <p className="text-primary-200 text-xs font-medium uppercase tracking-wider">{club.sport ?? 'Football'}</p>
            <p className="font-bold text-white">{club.name}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5">
            <Zap className="h-3.5 w-3.5 text-white" />
            <span className="text-xs font-semibold text-white">ClubBoost</span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5 pb-24">

        {/* Competition header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl flex-shrink-0" role="img" aria-label={typeLabel}>{typeEmoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{typeLabel}</span>
                <CompetitionStatusBadge status={competition.status} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 leading-snug">{competition.title}</h1>
              {competition.description && (
                <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{competition.description}</p>
              )}
            </div>
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Entry fee</p>
              <p className="text-xl font-extrabold text-slate-900 tabular-nums">
                {competition.entry_fee_pence === 0 ? 'Free' : formatPence(competition.entry_fee_pence)}
              </p>
            </div>
            <div className="rounded-xl bg-primary-50 border border-primary-100 p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Prize pot</p>
              <p className="text-xl font-extrabold text-primary-700 tabular-nums">
                {formatPence(totalPotPence)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Entries</p>
              <p className="text-xl font-extrabold text-slate-900 tabular-nums">{entryCount}</p>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            {competition.closes_at && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                Closes {formatDate(competition.closes_at)}
              </span>
            )}
            {competition.max_entries && (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 flex-shrink-0" />
                {entryCount} / {competition.max_entries} entries
              </span>
            )}
            {competition.closes_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                Results {formatDate(competition.closes_at)}
              </span>
            )}
          </div>
        </div>

        {/* Status banners */}
        {competition.status === 'settled' && (
          <Alert variant="success" title="Competition settled">
            This competition has been settled. Results have been announced.
          </Alert>
        )}
        {competition.status === 'closed' && (
          <Alert variant="warning" title="Entries have closed">
            This competition is no longer accepting entries. Results coming soon.
          </Alert>
        )}

        {/* How it works */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-4 w-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">How this competition works</h2>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">How to enter</p>
              <p className="text-sm text-slate-700 leading-relaxed">{rules.summary}</p>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">How the winner is decided</p>
              <p className="text-sm text-slate-700 leading-relaxed">{rules.howToWin}</p>
            </div>
            {rules.scoring && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Scoring</p>
                <p className="text-sm text-slate-700 leading-relaxed">{rules.scoring}</p>
              </div>
            )}
          </div>
        </div>

        {/* Fixtures (predictor only) */}
        {competition.type === 'predictor' && fixtures.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="font-semibold text-slate-900 mb-4">Fixtures to predict</h2>
            <div className="space-y-2">
              {fixtures.map((f, i) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm"
                >
                  <span className="w-5 text-xs text-slate-400 tabular-nums">{i + 1}</span>
                  <span className="flex-1 font-medium text-slate-900">{f.home_team}</span>
                  <span className="text-xs text-slate-400 font-medium px-2">vs</span>
                  <span className="flex-1 font-medium text-slate-900 text-right">{f.away_team}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pot breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="font-semibold text-slate-900 mb-4">Where does your entry fee go?</h2>
          <PotSplitVisualizer split={potSplit} entryCount={entryCount} />
        </div>

        {/* Rules text */}
        {competition.rules_text && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="font-semibold text-slate-900 mb-3">Competition rules</h2>
            <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{competition.rules_text}</p>
          </div>
        )}

        {/* Weekly Boost notice */}
        {weeklyBoostEnabled && boostBps > 0 && (
          <div className="rounded-2xl border border-boost-200 bg-boost-50 p-5 flex items-start gap-3">
            <Zap className="h-5 w-5 text-boost-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-boost-800 text-sm mb-1">Weekly Boost included</p>
              <p className="text-sm text-boost-700 leading-relaxed">
                A small share of your entry goes into the weekly ClubBoost prize pool. Drawn every Friday — you could win just by supporting your club.
              </p>
            </div>
          </div>
        )}

        {/* Trust */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Safe &amp; transparent</p>
            <p>Payments are processed securely by Stripe.</p>
            <p className="text-slate-400">This is a fundraising competition, not gambling. Entry fees support {club.name}.</p>
          </div>
        </div>

      </main>

      {/* Sticky enter CTA */}
      {isOpen && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-4">
          <div className="mx-auto max-w-2xl flex items-center gap-3">
            <Link
              href={`/c/${clubSlug}/${competition.id}/enter`}
              className="flex-1 rounded-2xl bg-primary-600 py-4 text-center text-base font-bold text-white hover:bg-primary-700 transition-colors shadow-cta"
            >
              {competition.entry_fee_pence === 0
                ? 'Enter for free →'
                : `Enter — ${formatPence(competition.entry_fee_pence)} →`}
            </Link>
            <button
              aria-label="Share this fundraiser"
              className="flex-shrink-0 rounded-2xl border border-slate-200 p-4 text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">
            Supports {club.name} · Powered by ClubBoost
          </p>
        </div>
      )}
    </div>
  )
}
