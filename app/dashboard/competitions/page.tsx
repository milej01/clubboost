import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, Trophy, Clock, Users, TrendingUp, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'

import { getClubsForUser } from '@/lib/services/clubs'
import { getCompetitionsForClub } from '@/lib/services/competitions'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPence, formatDate, calculateSplit } from '@/lib/utils'

export const metadata: Metadata = { title: 'Fundraisers — Dashboard' }

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400' },
  open:      { label: 'Live',      cls: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
  closed:    { label: 'Closed',    cls: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  settled:   { label: 'Settled',   cls: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-500',       dot: 'bg-red-400' },
}

const TYPE_LABELS: Record<string, string> = {
  predictor:         'Predictor',
  last_man_standing: 'Last Man Standing',
  team_card:         'Team Card',
  donation:          'Donation',
}

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function CompetitionsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filterStatus = sp.status ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clubs = await getClubsForUser(user.id)
  const club  = clubs[0]
  if (!club) redirect('/dashboard')

  const competitions = await getCompetitionsForClub(club.id)

  // Batch-fetch entry counts
  const ids = competitions.map(c => c.id)
  const db  = createAdminClient()
  const { data: entriesData } = ids.length
    ? await db.from('entries').select('competition_id').in('competition_id', ids).neq('status', 'pending_payment')
    : { data: [] }

  const entryMap: Record<string, number> = {}
  for (const e of entriesData ?? []) {
    entryMap[e.competition_id] = (entryMap[e.competition_id] ?? 0) + 1
  }

  // Filter by status tab
  const filtered = filterStatus
    ? competitions.filter(c => c.status === filterStatus)
    : competitions

  const counts = {
    all:      competitions.length,
    open:     competitions.filter(c => c.status === 'open').length,
    draft:    competitions.filter(c => c.status === 'draft').length,
    closed:   competitions.filter(c => c.status === 'closed').length,
    settled:  competitions.filter(c => c.status === 'settled').length,
  }

  const TABS = [
    { label: 'All',     value: '',        count: counts.all },
    { label: 'Live',    value: 'open',    count: counts.open },
    { label: 'Drafts',  value: 'draft',   count: counts.draft },
    { label: 'Closed',  value: 'closed',  count: counts.closed },
    { label: 'Settled', value: 'settled', count: counts.settled },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fundraisers</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {counts.all} total · {counts.open} live
          </p>
        </div>
        {club.status === 'approved' && (
          <Link
            href="/dashboard/competitions/new"
            className="flex items-center gap-2 rounded-2xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New fundraiser
          </Link>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <Link
            key={tab.value}
            href={tab.value ? `/dashboard/competitions?status=${tab.value}` : '/dashboard/competitions'}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filterStatus === tab.value
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300 hover:text-primary-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none ${
                filterStatus === tab.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Competitions list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Trophy className="h-6 w-6 text-slate-300" />
          </div>
          {filterStatus ? (
            <>
              <p className="font-medium text-slate-700 mb-1">No {filterStatus} fundraisers</p>
              <Link href="/dashboard/competitions" className="text-sm text-primary-600 hover:underline">
                View all
              </Link>
            </>
          ) : (
            <>
              <p className="font-medium text-slate-700 mb-1">No fundraisers yet</p>
              <p className="text-sm text-slate-400 mb-5">
                Create your first fundraising competition to start raising money.
              </p>
              {club.status === 'approved' && (
                <Link
                  href="/dashboard/competitions/new"
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create fundraiser
                </Link>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(comp => {
            const sc         = STATUS_CONFIG[comp.status] ?? STATUS_CONFIG.draft
            const entryCount = entryMap[comp.id] ?? 0
            const split      = calculateSplit(comp.entry_fee_pence, {
              prizePctBps:    comp.prize_pct_bps ?? 0,
              clubPctBps:     comp.club_pct_bps  ?? 0,
              platformFeeBps: comp.platform_fee_bps ?? 0,
              weeklyBoostBps: comp.weekly_boost_contribution_bps ?? 0,
            })
            const clubRaisedPence = entryCount * split.club
            const fillPct = comp.max_entries
              ? Math.min(100, Math.round((entryCount / comp.max_entries) * 100))
              : null

            return (
              <div
                key={comp.id}
                className="rounded-2xl border border-slate-200 bg-white hover:border-primary-200 hover:shadow-card transition-all"
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h2 className="font-semibold text-slate-900 text-base truncate">{comp.title}</h2>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${sc.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {TYPE_LABELS[comp.type] ?? comp.type}
                        {' · '}
                        {formatPence(comp.entry_fee_pence)} entry
                        {comp.closes_at && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            Closes {formatDate(comp.closes_at)}
                          </span>
                        )}
                      </p>
                    </div>

                    <Link
                      href={`/dashboard/competitions/${comp.id}`}
                      className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline flex-shrink-0"
                    >
                      Manage <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  {/* Stats row */}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Users className="h-3 w-3" /> Entries
                      </p>
                      <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                        {entryCount}
                        {comp.max_entries && (
                          <span className="text-sm font-normal text-slate-400"> / {comp.max_entries}</span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl bg-primary-50 px-3 py-2.5">
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-primary-600" /> Your share
                      </p>
                      <p className="text-lg font-bold text-primary-700 mt-0.5">
                        {formatPence(clubRaisedPence)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> Prize pot
                      </p>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">
                        {formatPence(entryCount * split.prize)}
                      </p>
                    </div>
                  </div>

                  {/* Entry progress bar (only if max_entries set and competition open) */}
                  {fillPct !== null && comp.status === 'open' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-slate-500">Entry spots filled</p>
                        <p className="text-xs font-semibold text-slate-700">{fillPct}%</p>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${fillPct >= 90 ? 'bg-amber-500' : 'bg-primary-500'}`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
