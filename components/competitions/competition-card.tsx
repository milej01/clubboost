import Link from 'next/link'
import { Calendar, Users, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CompetitionStatusBadge } from './competition-status-badge'
import { formatPence, formatDate } from '@/lib/utils'
import type { Competition } from '@/types/app'

const typeLabels: Record<Competition['type'], string> = {
  predictor:         'Six-Result Predictor',
  last_man_standing: 'Last Man Standing',
  team_card:         'Team Card',
  donation:          'Donation Fundraiser',
}

interface CompetitionCardProps {
  competition: Competition
  clubSlug:    string
  entryCount?: number
  showActions?: boolean
}

export function CompetitionCard({ competition, clubSlug, entryCount, showActions }: CompetitionCardProps) {
  const href = showActions
    ? `/dashboard/competitions/${competition.id}`
    : `/c/${clubSlug}/${competition.id}`

  const totalPotPence = (entryCount ?? 0) * competition.entry_fee_pence

  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 mb-1">{typeLabels[competition.type]}</p>
              <h3 className="font-semibold text-slate-900 truncate">{competition.title}</h3>
            </div>
            <CompetitionStatusBadge status={competition.status} />
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span>Entry {formatPence(competition.entry_fee_pence)}</span>
              {totalPotPence > 0 && (
                <span className="ml-auto font-medium text-primary-700">
                  Pot: {formatPence(totalPotPence)}
                </span>
              )}
            </div>

            {entryCount !== undefined && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>{entryCount} {entryCount === 1 ? 'entry' : 'entries'}</span>
              </div>
            )}

            {competition.closes_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>Closes {formatDate(competition.closes_at)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
