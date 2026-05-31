import { Suspense } from 'react'
import { Zap } from 'lucide-react'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { participantBoostNotice } from '@/lib/services/boost-calculator'

interface Props {
  /** Basis points (100 bps = 1%). Pass 0 or omit if the competition doesn't contribute. */
  contributionBps?: number
  /** Compact inline variant for tight spaces (e.g. payment summary). */
  compact?: boolean
}

async function BoostNoticeContent({ contributionBps = 0, compact = false }: Props) {
  const enabled = await isFeatureEnabled('weekly_boost')
  if (!enabled || contributionBps <= 0) return null

  const notice = participantBoostNotice(contributionBps)

  if (compact) {
    return (
      <p className="text-xs text-slate-500 flex items-start gap-1">
        <Zap className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
        {notice}
      </p>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
      <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-800 leading-relaxed">{notice}</p>
    </div>
  )
}

/**
 * Participant-facing notice that a competition contributes to the Weekly Boost.
 *
 * Wording is deliberately simple — this is NOT described as a jackpot or prize draw.
 * Only shows when the weekly_boost feature flag is enabled and contributionBps > 0.
 *
 * Renders nothing (null) if the feature is disabled or the competition doesn't contribute.
 */
export function BoostNotice({ contributionBps, compact }: Props) {
  return (
    <Suspense fallback={null}>
      <BoostNoticeContent contributionBps={contributionBps} compact={compact} />
    </Suspense>
  )
}
