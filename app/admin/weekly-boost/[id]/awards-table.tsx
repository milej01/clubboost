'use client'

import { useState, useTransition } from 'react'
import { Button }  from '@/components/ui/button'
import { Alert }   from '@/components/ui/alert'
import { confirmAwardAction, cancelAwardAction } from '@/actions/weekly-boost'
import type { BoostAward } from '@/types/app'

interface Props {
  awards:   BoostAward[]
  periodId: string
}

function statusChip(status: BoostAward['status']) {
  const map = {
    pending:   'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100  text-blue-700',
    paid:      'bg-green-100 text-green-700',
    cancelled: 'bg-red-100   text-red-600  line-through',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? ''}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function AwardsTable({ awards, periodId }: Props) {
  const [pending, start]      = useTransition()
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleConfirm(awardId: string) {
    setError(null)
    start(async () => {
      const res = await confirmAwardAction(awardId)
      if (!res.success) setError(res.error)
      else setSuccess('Award confirmed')
    })
  }

  function handleCancel(awardId: string) {
    setError(null)
    start(async () => {
      const res = await cancelAwardAction(awardId, 'Cancelled by admin')
      if (!res.success) setError(res.error)
      else setSuccess('Award cancelled')
    })
  }

  return (
    <div>
      {error   && <div className="px-6 py-2"><Alert variant="error">{error}</Alert></div>}
      {success && <div className="px-6 py-2"><Alert variant="success">{success}</Alert></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-6 py-3 text-left">Club</th>
              <th className="px-6 py-3 text-right">Amount</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Public</th>
              <th className="px-6 py-3 text-left">Reason</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {awards.map(award => (
              <tr key={award.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-900">
                  {award.club?.name ?? award.club_id}
                </td>
                <td className="px-6 py-3 text-right font-mono">
                  £{(award.amount_pence / 100).toFixed(2)}
                </td>
                <td className="px-6 py-3">{statusChip(award.status)}</td>
                <td className="px-6 py-3">
                  {award.is_public
                    ? <span className="text-green-700 text-xs">✓ Published</span>
                    : <span className="text-slate-400 text-xs">Not published</span>
                  }
                </td>
                <td className="px-6 py-3 text-slate-500 text-xs max-w-xs truncate">
                  {award.reason ?? '—'}
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    {award.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleConfirm(award.id)}
                        loading={pending}
                      >
                        Confirm
                      </Button>
                    )}
                    {(award.status === 'pending' || award.status === 'confirmed') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleCancel(award.id)}
                        loading={pending}
                      >
                        Cancel
                      </Button>
                    )}
                    {award.status === 'paid' && <span className="text-xs text-green-600">Paid</span>}
                    {award.status === 'cancelled' && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
