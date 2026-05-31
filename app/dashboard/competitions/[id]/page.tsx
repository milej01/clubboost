import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import {
  ChevronLeft, Users, Trophy, TrendingUp, CreditCard,
  ExternalLink, Clock, Zap, Share2,
} from 'lucide-react'
import type { Metadata } from 'next'

import { getClubsForUser } from '@/lib/services/clubs'
import { getCompetitionWithEntryCount, getCompetitionEntries } from '@/lib/services/competitions'
import { getPaymentsForCompetition } from '@/lib/services/payments'
import { formatPence, formatDate, calculateSplit, bpsToPercent } from '@/lib/utils'
import { CompetitionStatusBadge } from '@/components/competitions/competition-status-badge'
import { FundraiserActions } from './fundraiser-actions'
import { CsvExportButton } from '@/components/admin/csv-export-button'

export const metadata: Metadata = { title: 'Fundraiser — Dashboard' }

const ENTRY_STATUS: Record<string, { label: string; cls: string }> = {
  active:     { label: 'Active',     cls: 'bg-green-100 text-green-700' },
  winner:     { label: 'Winner 🏆',  cls: 'bg-primary-100 text-primary-700' },
  eliminated: { label: 'Eliminated', cls: 'bg-red-100 text-red-500' },
  refunded:   { label: 'Refunded',   cls: 'bg-slate-100 text-slate-500' },
}

export default async function FundraiserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clubs = await getClubsForUser(user.id)
  const club  = clubs[0]
  if (!club) redirect('/dashboard')

  const [competition, entries, payments] = await Promise.all([
    getCompetitionWithEntryCount(id),
    getCompetitionEntries(id),
    getPaymentsForCompetition(id),
  ])

  if (!competition) notFound()

  // Verify this competition belongs to the user's club
  if (competition.club_id !== club.id) notFound()

  // Financial breakdown
  const confirmedEntries = (entries as Array<{ status: string }>)
    .filter(e => ['active', 'winner', 'eliminated'].includes(e.status))
  const entryCount = confirmedEntries.length

  const split = calculateSplit(competition.entry_fee_pence, {
    prizePctBps:    competition.prize_pct_bps    ?? 0,
    clubPctBps:     competition.club_pct_bps     ?? 0,
    platformFeeBps: competition.platform_fee_bps ?? 0,
    weeklyBoostBps: competition.weekly_boost_contribution_bps ?? 0,
  })

  const grossPence   = entryCount * competition.entry_fee_pence
  const prizePence   = entryCount * split.prize
  const clubPence    = entryCount * split.club
  const platformPence = entryCount * split.platform
  const boostPence   = entryCount * split.boost

  // Progress bar widths (as % of gross)
  const seg = (pence: number) => grossPence > 0 ? Math.round((pence / grossPence) * 100) : 0

  // Payment stats
  const succeededPayments = (payments as Array<{ status: string; amount_pence: number }>)
    .filter(p => p.status === 'succeeded')
  const totalReceived = succeededPayments.reduce((s, p) => s + p.amount_pence, 0)

  // Leaderboard — sort by points desc for predictors, otherwise by entry_number
  type Entry = {
    id:            string
    entry_number:  number
    status:        string
    points_total:  number | null
    entered_at:    string
    entry_data:    Record<string, unknown> | null
    participant:   { display_name: string } | null
  }

  const sortedEntries = [...(entries as Entry[])].sort((a, b) => {
    if (competition.type === 'predictor') {
      return (b.points_total ?? 0) - (a.points_total ?? 0)
    }
    return a.entry_number - b.entry_number
  })

  const compClub = competition.club as { name: string; slug: string } | null
  const publicUrl = compClub?.slug ? `/c/${compClub.slug}/${id}` : null
  const fillPct   = competition.max_entries && entryCount > 0
    ? Math.min(100, Math.round((entryCount / competition.max_entries) * 100))
    : null

  return (
    <div className="space-y-6">

      {/* Breadcrumb + back */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard/competitions" className="hover:text-slate-700 flex items-center gap-1 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Fundraisers
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{competition.title}</h1>
            <CompetitionStatusBadge status={competition.status} />
          </div>
          <p className="text-sm text-slate-500 capitalize">
            {competition.type.replace(/_/g, ' ')}
            {' · '}
            {formatPence(competition.entry_fee_pence)} per entry
            {competition.closes_at && (
              <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                {competition.status === 'open' ? 'Closes' : 'Closed'} {formatDate(competition.closes_at)}
              </span>
            )}
          </p>
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Public fundraiser page
            </a>
          )}
        </div>

        {/* Entry fill bar (if capped) */}
        {fillPct !== null && (
          <div className="w-full sm:w-52 flex-shrink-0">
            <div className="flex items-center justify-between mb-1 text-xs text-slate-500">
              <span>Spots filled</span>
              <span className="font-semibold text-slate-700">{entryCount} / {competition.max_entries}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${fillPct >= 90 ? 'bg-amber-500' : 'bg-primary-500'}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <p className="text-right text-xs text-slate-400 mt-0.5">{fillPct}% full</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {['draft', 'open', 'closed'].includes(competition.status) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <FundraiserActions
            competitionId={id}
            status={competition.status}
            clubSlug={compClub?.slug}
          />
        </div>
      )}

      {/* Financial breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" /> Money raised
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Based on {entryCount} confirmed {entryCount === 1 ? 'entry' : 'entries'}</p>
        </div>

        {/* Segmented progress bar */}
        {grossPence > 0 ? (
          <>
            <div className="px-5 pt-4 pb-2">
              <div className="flex h-4 rounded-full overflow-hidden">
                <div className="bg-primary-500" style={{ width: `${seg(clubPence)}%` }} title={`Club: ${formatPence(clubPence)}`} />
                <div className="bg-amber-400" style={{ width: `${seg(prizePence)}%` }} title={`Prize: ${formatPence(prizePence)}`} />
                <div className="bg-blue-400"  style={{ width: `${seg(boostPence)}%` }} title={`Boost: ${formatPence(boostPence)}`} />
                <div className="bg-slate-200" style={{ width: `${seg(platformPence)}%` }} title={`Fee: ${formatPence(platformPence)}`} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {[
                  { label: 'Club fundraising', pence: clubPence,    bps: competition.club_pct_bps ?? 0,     colour: 'bg-primary-500' },
                  { label: 'Prize pool',        pence: prizePence,   bps: competition.prize_pct_bps ?? 0,    colour: 'bg-amber-400' },
                  { label: 'Weekly Boost',       pence: boostPence,   bps: competition.weekly_boost_contribution_bps ?? 0, colour: 'bg-blue-400' },
                  { label: 'Platform fee',       pence: platformPence, bps: competition.platform_fee_bps ?? 0, colour: 'bg-slate-200' },
                ].filter(s => s.bps > 0).map(s => (
                  <div key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className={`h-2.5 w-2.5 rounded-sm ${s.colour}`} />
                    {s.label}
                    <span className="font-semibold text-slate-900">{formatPence(s.pence)}</span>
                    <span className="text-slate-400">({bpsToPercent(s.bps)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y divide-slate-100 border-t border-slate-100">
              {[
                { label: 'Gross raised',   value: formatPence(grossPence),    accent: '' },
                { label: 'Your share',     value: formatPence(clubPence),      accent: 'text-primary-700' },
                { label: 'Prize pool',     value: formatPence(prizePence),     accent: '' },
                { label: 'Payments in',    value: formatPence(totalReceived),  accent: '' },
              ].map(({ label, value, accent }) => (
                <div key={label} className="px-4 py-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`text-base font-bold mt-0.5 ${accent || 'text-slate-900'}`}>{value}</p>
                </div>
              ))}
            </div>

            {competition.weekly_boost_contribution_bps > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 bg-amber-50 flex items-center gap-2 text-xs text-amber-700">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>
                  <strong>{formatPence(boostPence)}</strong> contributed to the Weekly Boost prize fund from this fundraiser
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-400">No confirmed entries yet. Share your fundraiser to get started!</p>
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 transition-colors"
              >
                <Share2 className="h-4 w-4" /> Share fundraiser page
              </a>
            )}
          </div>
        )}
      </div>

      {/* Per-entry breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-slate-400" /> Per-entry split
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Where each {formatPence(competition.entry_fee_pence)} entry goes</p>
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { label: 'Your club fundraising', value: formatPence(split.club),     accent: 'text-primary-700', pct: bpsToPercent(competition.club_pct_bps ?? 0) },
            { label: 'Prize pool',             value: formatPence(split.prize),    accent: '',                 pct: bpsToPercent(competition.prize_pct_bps ?? 0) },
            { label: 'Weekly Boost fund',      value: formatPence(split.boost),    accent: 'text-amber-600',   pct: bpsToPercent(competition.weekly_boost_contribution_bps ?? 0) },
            { label: 'Platform fee',           value: formatPence(split.platform), accent: 'text-slate-400',   pct: bpsToPercent(competition.platform_fee_bps ?? 0) },
          ].filter(row => row.pct > 0).map(row => (
            <div key={row.label} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">{row.label}</p>
                <p className="text-xs text-slate-400">{row.pct}% of entry fee</p>
              </div>
              <p className={`text-sm font-bold ${row.accent || 'text-slate-900'}`}>{row.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Participant list / Leaderboard */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-3">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" />
            {competition.type === 'predictor' ? 'Leaderboard' : 'Participants'}
            <span className="text-sm font-normal text-slate-400">({entryCount})</span>
          </h2>
          {entryCount > 0 && (
            <CsvExportButton
              href={`/api/dashboard/competitions/${id}/entries`}
              label="Export CSV"
              className="text-xs"
            />
          )}
        </div>

        {sortedEntries.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="h-6 w-6 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              No confirmed entries yet.
              {publicUrl && (
                <>
                  {' '}
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                    Share the link ↗
                  </a>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-10">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Supporter</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  {competition.type === 'predictor' && (
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Points</th>
                  )}
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Entered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedEntries.map((entry, rank) => {
                  const es = ENTRY_STATUS[entry.status] ?? { label: entry.status, cls: 'bg-slate-100 text-slate-500' }
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">
                        {competition.type === 'predictor' ? rank + 1 : entry.entry_number}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {entry.participant?.display_name ?? 'Anonymous'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${es.cls}`}>
                          {es.label}
                        </span>
                      </td>
                      {competition.type === 'predictor' && (
                        <td className="px-4 py-3 text-center font-bold text-slate-900 tabular-nums">
                          {entry.points_total ?? 0}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(entry.entered_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
