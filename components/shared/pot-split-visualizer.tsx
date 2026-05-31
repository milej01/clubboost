import { formatPence } from '@/lib/utils'
import type { PotSplit } from '@/types/app'

interface PotSplitVisualizerProps {
  split:       PotSplit
  entryCount?: number
}

export function PotSplitVisualizer({ split, entryCount }: PotSplitVisualizerProps) {
  const segments = [
    { label: 'Prize', pct: split.prize_pct, pence: split.prize_pence, color: 'bg-amber-400' },
    { label: 'Club fundraise', pct: split.club_pct, pence: split.club_pence, color: 'bg-primary-500' },
    { label: 'Platform fee', pct: split.platform_pct, pence: split.platform_pence, color: 'bg-slate-300' },
    ...(split.boost_pct > 0
      ? [{ label: 'Weekly Boost', pct: split.boost_pct, pence: split.boost_pence, color: 'bg-purple-400' }]
      : []),
  ].filter(s => s.pct > 0)

  const totalPotPence = entryCount ? entryCount * split.entry_fee_pence : split.entry_fee_pence

  return (
    <div className="space-y-4">
      {/* Visual bar */}
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map(s => (
          <div
            key={s.label}
            className={`${s.color} transition-all`}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${s.pct.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <dl className="space-y-2">
        {segments.map(s => (
          <div key={s.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${s.color} flex-shrink-0`} />
              <dt className="text-slate-600">{s.label}</dt>
            </div>
            <dd className="font-medium text-slate-900">
              {formatPence(s.pence)}
              <span className="ml-1 text-xs text-slate-400">({s.pct.toFixed(0)}%)</span>
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-2 mt-2">
          <dt className="font-medium text-slate-700">Entry fee</dt>
          <dd className="font-semibold text-slate-900">{formatPence(split.entry_fee_pence)}</dd>
        </div>
        {entryCount && entryCount > 1 && (
          <div className="flex items-center justify-between text-sm">
            <dt className="text-slate-500">Total pot ({entryCount} entries)</dt>
            <dd className="font-semibold text-primary-700">{formatPence(totalPotPence)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
