import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Zap, CheckCircle2, XCircle, Clock, TrendingUp, Trophy, ArrowRight, Info } from 'lucide-react'
import type { Metadata } from 'next'

import { getClubsForUser } from '@/lib/services/clubs'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPence, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Weekly Boost — Dashboard' }

export default async function DashboardWeeklyBoostPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clubs = await getClubsForUser(user.id)
  const club  = clubs[0]
  if (!club) redirect('/dashboard')

  const db = createAdminClient()

  // Fetch current active boost period
  const { data: activePeriod } = await db
    .from('clubboost_weekly_boost_periods')
    .select('*')
    .eq('status', 'active')
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch this club's contributions (last 10)
  const { data: contributions } = await db
    .from('clubboost_weekly_boost_contributions')
    .select('amount_pence, source_type, description, created_at, period_id')
    .eq('club_id', club.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Fetch awards received by this club
  const { data: awards } = await db
    .from('clubboost_weekly_boost_awards')
    .select('amount_pence, status, notes, created_at, period:clubboost_weekly_boost_periods(period_name, period_start, period_end)')
    .eq('club_id', club.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Contribution total (all time)
  const totalContributed = (contributions ?? []).reduce(
    (s, c) => s + (c.amount_pence as number),
    0,
  )
  const totalAwarded = ((awards ?? []) as Array<{ amount_pence: number; status: string }>)
    .filter(a => a.status === 'paid')
    .reduce((s, a) => s + a.amount_pence, 0)

  type Award = {
    amount_pence:  number
    status:  string
    notes:         string | null
    created_at:    string
    period:        { period_name: string; period_start: string; period_end: string } | null
  }

  type Contribution = {
    amount_pence: number
    source_type:  string
    description:  string | null
    created_at:   string
    period_id:    string
  }

  const AWARD_STATUS: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
    confirmed: { label: 'Confirmed', cls: 'bg-blue-100 text-blue-700' },
    paid:      { label: 'Paid ✓',    cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
  }

  const isEligible  = club.weekly_boost_eligible ?? false
  const isEnrolled  = club.weekly_boost_enrolled  ?? false

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          Weekly Boost
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          An optional shared fund that can give your club an extra fundraising boost each week.
        </p>
      </div>

      {/* Eligibility card */}
      <div className={`rounded-2xl border p-5 ${
        isEligible
          ? 'border-amber-200 bg-amber-50'
          : 'border-slate-200 bg-white'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isEligible ? 'bg-amber-100' : 'bg-slate-100'
          }`}>
            {isEligible
              ? <CheckCircle2 className="h-5 w-5 text-amber-600" />
              : <XCircle className="h-5 w-5 text-slate-400" />
            }
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">
              {isEligible ? 'Your club is eligible for Weekly Boost' : 'Not yet eligible'}
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {isEligible
                ? isEnrolled
                  ? 'Your club is participating in Weekly Boost draws. Contributions are added automatically when supporters enter your fundraisers.'
                  : 'You\'re eligible but not currently enrolled. Contact the ClubBoost team to opt in.'
                : 'Weekly Boost eligibility is granted by the ClubBoost team based on your club\'s fundraising activity. Keep running competitions to qualify.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Current period */}
      {activePeriod ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Current period</h2>
          </div>
          <div className="px-5 py-4 grid sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500">Period name</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{activePeriod.period_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Dates</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">
                {formatDate(activePeriod.period_start)} – {formatDate(activePeriod.period_end)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Pool size</p>
              <p className="text-sm font-bold text-amber-700 mt-0.5">
                {formatPence(activePeriod.total_pool_pence ?? 0)}
              </p>
            </div>
          </div>
          {activePeriod.published_rules && (
            <div className="px-5 pb-4">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">This week&apos;s rules</p>
              <p className="text-sm text-slate-600">{activePeriod.published_rules}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <Zap className="h-6 w-6 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No active boost period right now. Check back soon!</p>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5" /> Total contributed (all time)
          </p>
          <p className="text-2xl font-extrabold text-slate-900">{formatPence(totalContributed)}</p>
          <p className="text-xs text-slate-400 mt-1">
            Added from your fundraisers to the shared pool
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5 mb-2">
            <Trophy className="h-3.5 w-3.5" /> Total boost awards received
          </p>
          <p className="text-2xl font-extrabold text-amber-800">{formatPence(totalAwarded)}</p>
          <p className="text-xs text-amber-600 mt-1">
            Paid out to your club from Weekly Boost
          </p>
        </div>
      </div>

      {/* Contributions history */}
      {(contributions ?? []).length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Recent contributions</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {(contributions as Contribution[]).map((c, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm text-slate-700">
                    {c.description ?? c.source_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(c.created_at)}</p>
                </div>
                <p className="text-sm font-semibold text-amber-700">+{formatPence(c.amount_pence)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Awards history */}
      {(awards ?? []).length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Boost awards</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {(awards as Award[]).map((a, i) => {
              const as_ = AWARD_STATUS[a.status] ?? { label: a.status, cls: 'bg-slate-100 text-slate-500' }
              return (
                <div key={i} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatPence(a.amount_pence)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.period?.period_name ?? 'Weekly Boost'} · {formatDate(a.created_at)}
                    </p>
                    {a.notes && (
                      <p className="text-xs text-slate-500 mt-0.5">{a.notes}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold flex-shrink-0 ${as_.cls}`}>
                    {as_.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : isEligible && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <Trophy className="h-6 w-6 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">No awards yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Keep running fundraisers — your club will be considered for boost awards each week.
          </p>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
          <Info className="h-4 w-4 text-slate-400" /> How Weekly Boost works
        </h3>
        <ol className="space-y-2">
          {[
            'A small % of each entry fee from enrolled clubs contributes to a shared weekly prize fund.',
            'Every week, the platform team awards the fund to eligible clubs — spreading the boost fairly.',
            'Your club keeps any boost award on top of your regular fundraising share.',
            'The more fundraisers you run, the more you contribute — and the stronger your case for an award.',
          ].map((step, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-600">
              <span className="h-5 w-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <Link
          href="/weekly-boost"
          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
        >
          Full explainer <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
