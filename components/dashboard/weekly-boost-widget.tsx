import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap, CheckCircle, XCircle, ChevronRight } from 'lucide-react'
import { getClubBoostSummary } from '@/lib/services/weekly-boost'
import { isFeatureEnabled } from '@/lib/feature-flags'
import type { ClubBoostSummary } from '@/types/app'

interface Props {
  clubId: string
}

function EligibilityBadge({ eligible }: { eligible: boolean | null }) {
  if (eligible === null) return <Badge variant="secondary">Not assessed</Badge>
  return eligible
    ? (
      <Badge variant="success" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" /> Eligible this week
      </Badge>
    ) : (
      <Badge variant="error" className="flex items-center gap-1">
        <XCircle className="h-3 w-3" /> Not eligible
      </Badge>
    )
}

async function BoostWidgetContent({ clubId }: Props) {
  const [summary, enabled] = await Promise.all([
    getClubBoostSummary(clubId),
    isFeatureEnabled('weekly_boost'),
  ])

  if (!enabled) return null

  const recentAwards = summary.recent_awards.slice(0, 3)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          ClubBoost Weekly Boost
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Eligibility this week */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Current eligibility</span>
          <EligibilityBadge eligible={summary.is_eligible_this_period} />
        </div>

        {/* Eligibility reason */}
        {summary.eligibility_reason && (
          <p className="text-xs text-slate-500 -mt-2">{summary.eligibility_reason}</p>
        )}

        {/* This period contribution */}
        {summary.current_period_contribution_pence !== null && (
          <div className="flex items-center justify-between py-2 border-t border-slate-100">
            <span className="text-sm text-slate-600">Your contribution this period</span>
            <span className="font-semibold text-slate-900">
              £{(summary.current_period_contribution_pence / 100).toFixed(2)}
            </span>
          </div>
        )}

        {/* Total contributed all time */}
        <div className="flex items-center justify-between py-2 border-t border-slate-100">
          <span className="text-sm text-slate-600">Total contributed (all time)</span>
          <span className="font-medium text-slate-700">
            £{(summary.total_contributed_pence / 100).toFixed(2)}
          </span>
        </div>

        {/* Total awarded */}
        {summary.total_awarded_pence > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Total received</span>
            <span className="font-semibold text-green-700">
              £{(summary.total_awarded_pence / 100).toFixed(2)}
            </span>
          </div>
        )}

        {/* Recent awards */}
        {recentAwards.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Recent awards
            </p>
            {recentAwards.map(award => (
              <div key={award.id} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-green-700">
                    £{(award.amount_pence / 100).toFixed(2)}
                  </span>
                  {award.reason && (
                    <span className="text-xs text-slate-500 ml-2">{award.reason}</span>
                  )}
                </div>
                {award.published_at && (
                  <span className="text-xs text-slate-400">
                    {new Date(award.published_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short',
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Link to full history */}
        <Link
          href="/dashboard/boost"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline pt-1"
        >
          View full boost history <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  )
}

export function WeeklyBoostWidget({ clubId }: Props) {
  return (
    <Suspense fallback={null}>
      <BoostWidgetContent clubId={clubId} />
    </Suspense>
  )
}
