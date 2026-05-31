import Link from 'next/link'
import { Zap, Plus, ChevronRight, TrendingUp, Users, Trophy, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge }   from '@/components/ui/badge'
import { Button }  from '@/components/ui/button'
import { Alert }   from '@/components/ui/alert'
import { getPeriodsAdmin, getAwardsForPeriod } from '@/lib/services/weekly-boost'
import { isFeatureEnabled } from '@/lib/feature-flags'
import type { BoostPeriod, BoostAward } from '@/types/app'

// ── Helpers ───────────────────────────────────────────────────

function statusBadge(status: BoostPeriod['status']) {
  const map = {
    draft:   { label: 'Draft',   className: 'bg-slate-100 text-slate-600' },
    active:  { label: 'Active',  className: 'bg-green-100 text-green-700' },
    closed:  { label: 'Closed',  className: 'bg-amber-100 text-amber-700' },
    awarded: { label: 'Awarded', className: 'bg-blue-100  text-blue-700'  },
  }
  const { label, className } = map[status] ?? map.draft
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>{label}</span>
}

function awardStatusBadge(status: BoostAward['status']) {
  const map = {
    pending:   'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100  text-blue-700',
    paid:      'bg-green-100 text-green-700',
    cancelled: 'bg-red-100   text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? ''}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function fmt(pence: number) {
  return `£${(pence / 100).toFixed(2)}`
}

// ── Page ──────────────────────────────────────────────────────

export default async function WeeklyBoostAdminPage() {
  const [periods, boostEnabled] = await Promise.all([
    getPeriodsAdmin(),
    isFeatureEnabled('weekly_boost'),
  ])

  // Attach recent awards to each period (just for the overview)
  const periodsWithAwards = await Promise.all(
    periods.slice(0, 6).map(async period => ({
      period,
      awards: await getAwardsForPeriod(period.id),
    }))
  )

  // Summary stats
  const totalAwarded = periodsWithAwards
    .flatMap(p => p.awards)
    .filter(a => a.status !== 'cancelled')
    .reduce((s, a) => s + a.amount_pence, 0)

  const activePeriod = periods.find(p => p.status === 'active') ?? null
  const pendingAwards = periodsWithAwards.flatMap(p => p.awards).filter(a => a.status === 'pending')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Weekly Boost</h1>
            <p className="text-sm text-slate-500">Manage boost periods, fund contributions, and club awards</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/weekly-boost/sponsors">
            <Button variant="secondary" size="sm">Sponsors</Button>
          </Link>
          <Link href="/admin/weekly-boost/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New period</Button>
          </Link>
        </div>
      </div>

      {/* Feature flag warning */}
      {!boostEnabled && (
        <Alert variant="warning" title="Feature disabled">
          The <strong>weekly_boost</strong> feature flag is off. Award actions will be blocked.{' '}
          <Link href="/admin/feature-flags" className="underline">Enable it →</Link>
        </Alert>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Periods</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{periods.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Awarded</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{fmt(totalAwarded)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Fund</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {activePeriod ? fmt(activePeriod.total_pool_pence) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pending Awards</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{pendingAwards.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active period callout */}
      {activePeriod && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <TrendingUp className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">{activePeriod.period_name}</p>
                  <p className="text-sm text-green-700">
                    {activePeriod.period_start} – {activePeriod.period_end} ·{' '}
                    Current fund: <strong>{fmt(activePeriod.total_pool_pence)}</strong>
                  </p>
                </div>
              </div>
              <Link href={`/admin/weekly-boost/${activePeriod.id}`}>
                <Button size="sm">Manage <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period list */}
      <Card>
        <CardHeader>
          <CardTitle>All Periods</CardTitle>
        </CardHeader>
        {periods.length === 0 ? (
          <CardContent>
            <div className="py-8 text-center">
              <Clock className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No boost periods yet.</p>
              <Link href="/admin/weekly-boost/new" className="mt-3 inline-block">
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />Create first period</Button>
              </Link>
            </div>
          </CardContent>
        ) : (
          <div className="divide-y divide-slate-100">
            {periodsWithAwards.map(({ period, awards }) => {
              const activeAwards = awards.filter(a => a.status !== 'cancelled')
              const totalPaidOut = activeAwards.reduce((s, a) => s + a.amount_pence, 0)
              return (
                <Link
                  key={period.id}
                  href={`/admin/weekly-boost/${period.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 truncate">{period.period_name}</span>
                      {statusBadge(period.status)}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {period.period_start} – {period.period_end}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-500">Fund</p>
                      <p className="text-sm font-semibold text-slate-900">{fmt(period.total_pool_pence)}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-500">Awarded</p>
                      <p className="text-sm font-semibold text-green-700">
                        {activeAwards.length > 0 ? `${fmt(totalPaidOut)} (${activeAwards.length})` : '—'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
