import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Zap, CheckCircle, XCircle, Users, DollarSign, Award } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge }   from '@/components/ui/badge'
import { Button }  from '@/components/ui/button'
import { Alert }   from '@/components/ui/alert'
import { getPeriodDetail } from '@/lib/services/weekly-boost'
import { PeriodStatusPanel }    from './period-status-panel'
import { AddContributionForm }  from './add-contribution-form'
import { AwardClubForm }        from './award-club-form'
import { EligibleClubsTable }   from './eligible-clubs-table'
import { ContributionsTable }   from './contributions-table'
import { AwardsTable }          from './awards-table'
import { PublishAwardsForm }    from './publish-awards-form'
import type { BoostPeriodDetail } from '@/types/app'

function fmt(pence: number) {
  return `£${(pence / 100).toFixed(2)}`
}

function statusColor(status: string) {
  return status === 'active'  ? 'bg-green-100 text-green-700' :
         status === 'awarded' ? 'bg-blue-100  text-blue-700'  :
         status === 'closed'  ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
}

export default async function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getPeriodDetail(id)
  if (!detail) notFound()

  const pendingAwards  = detail.awards.filter(a => a.status === 'pending')
  const confirmedAwards = detail.awards.filter(a => a.status === 'confirmed')
  const paidAwards     = detail.awards.filter(a => a.status === 'paid')
  const awardedTotal   = detail.awards
    .filter(a => a.status !== 'cancelled')
    .reduce((s, a) => s + a.amount_pence, 0)
  const remaining      = detail.total_fund_pence - awardedTotal
  const eligibleCount  = detail.eligible_clubs.filter(c => c.is_eligible).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/weekly-boost">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All periods</Button>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="h-5 w-5 text-primary-600 flex-shrink-0" />
          <h1 className="text-xl font-bold text-slate-900 truncate">{detail.period_name}</h1>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${statusColor(detail.status)}`}>
            {detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Fund</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(detail.total_fund_pence)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Awarded</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{fmt(awardedTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Remaining</p>
            <p className={`text-2xl font-bold mt-1 ${remaining > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
              {fmt(remaining)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Eligible Clubs</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{eligibleCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Period info + status actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Period information</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Start date</p>
                  <p className="font-medium">{detail.period_start}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">End date</p>
                  <p className="font-medium">{detail.period_end}</p>
                </div>
              </div>
              {detail.published_rules && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Published rules</p>
                  <p className="text-slate-700 whitespace-pre-line">{detail.published_rules}</p>
                </div>
              )}
              {detail.notes && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Internal notes</p>
                  <p className="text-slate-500 italic whitespace-pre-line">{detail.notes}</p>
                </div>
              )}
              {/* Fund breakdown by source */}
              {Object.keys(detail.fund_by_source).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Fund breakdown</p>
                  <div className="space-y-1">
                    {(Object.entries(detail.fund_by_source) as [string, number][]).map(([source, pence]) => (
                      <div key={source} className="flex justify-between">
                        <span className="text-slate-600 capitalize">{source.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{fmt(pence)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add contribution */}
          {detail.status !== 'awarded' && (
            <AddContributionForm periodId={detail.id} remainingPence={remaining} />
          )}
        </div>

        {/* Status management panel */}
        <PeriodStatusPanel detail={detail} remainingPence={remaining} />
      </div>

      {/* Eligible clubs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Eligible clubs ({eligibleCount})
            </CardTitle>
          </div>
        </CardHeader>
        <EligibleClubsTable
          periodId={detail.id}
          clubs={detail.eligible_clubs}
          periodStatus={detail.status}
        />
      </Card>

      {/* Award clubs */}
      {detail.status !== 'awarded' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Award clubs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AwardClubForm
              periodId={detail.id}
              totalFundPence={detail.total_fund_pence}
              remainingPence={remaining}
              eligibleClubs={detail.eligible_clubs.filter(c => c.is_eligible)}
            />
          </CardContent>
        </Card>
      )}

      {/* Awards */}
      {detail.awards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Awards ({detail.awards.length})</CardTitle>
          </CardHeader>
          <AwardsTable awards={detail.awards} periodId={detail.id} />
        </Card>
      )}

      {/* Publish */}
      {(pendingAwards.length > 0 || confirmedAwards.length > 0) && detail.status !== 'awarded' && (
        <PublishAwardsForm periodId={detail.id} pendingCount={pendingAwards.length + confirmedAwards.length} />
      )}

      {/* Contributions ledger */}
      {detail.fund_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Contributions ledger ({detail.fund_items.length})
            </CardTitle>
          </CardHeader>
          <ContributionsTable items={detail.fund_items} />
        </Card>
      )}
    </div>
  )
}
