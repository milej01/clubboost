'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Alert }     from '@/components/ui/alert'
import { setEligibilityOverrideAction } from '@/actions/weekly-boost'
import type { BoostEligibleClub, BoostPeriodStatus } from '@/types/app'

interface Props {
  periodId:     string
  clubs:        BoostEligibleClub[]
  periodStatus: BoostPeriodStatus
}

function fmt(pence: number) {
  return pence > 0 ? `£${(pence / 100).toFixed(2)}` : '—'
}

export function EligibleClubsTable({ periodId, clubs, periodStatus }: Props) {
  const [overriding, setOverriding] = useState<string | null>(null)
  const [reason, setReason]         = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [pending, start]            = useTransition()

  const canEdit = periodStatus !== 'awarded'

  function handleOverride(clubId: string, isEligible: boolean) {
    setError(null)
    if (!reason.trim()) { setError('Override reason is required'); return }
    start(async () => {
      const res = await setEligibilityOverrideAction({ periodId, clubId, isEligible, overrideReason: reason })
      if (!res.success) { setError(res.error); return }
      setOverriding(null); setReason('')
    })
  }

  if (clubs.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-sm text-slate-500">
        No clubs found. Eligibility is calculated from clubs that are approved, enrolled, and have
        active competitions in this period.
      </div>
    )
  }

  return (
    <div>
      {error && <div className="px-6 py-3"><Alert variant="error">{error}</Alert></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-6 py-3 text-left">Club</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-right">Contributions</th>
              <th className="px-6 py-3 text-left">Reason</th>
              {canEdit && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {clubs.map(ec => (
              <tr key={ec.club_id} className="hover:bg-slate-50">
                <td className="px-6 py-3">
                  <div className="font-medium text-slate-900">{ec.club?.name ?? ec.club_id}</div>
                  {ec.is_manually_overridden && (
                    <div className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="h-3 w-3" />
                      Manually overridden
                    </div>
                  )}
                </td>
                <td className="px-6 py-3">
                  {ec.is_eligible ? (
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      Eligible
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-4 w-4" />
                      Ineligible
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-right font-mono">
                  {fmt(ec.contribution_total_pence ?? 0)}
                </td>
                <td className="px-6 py-3 text-slate-500 text-xs max-w-xs">
                  {ec.is_manually_overridden
                    ? ec.override_reason
                    : (ec.is_eligible ? ec.eligibility_reason : ec.ineligibility_reason)
                  }
                </td>
                {canEdit && (
                  <td className="px-6 py-3 text-right">
                    {overriding === ec.club_id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <Input
                          className="w-48 text-xs"
                          placeholder="Override reason…"
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleOverride(ec.club_id, !ec.is_eligible)}
                          loading={pending}
                        >
                          {ec.is_eligible ? 'Exclude' : 'Include'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setOverriding(null); setReason('') }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setOverriding(ec.club_id); setReason('') }}
                      >
                        Override
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
