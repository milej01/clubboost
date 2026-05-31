'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert }  from '@/components/ui/alert'
import {
  updatePeriodStatusAction,
  exportPeriodReportAction,
} from '@/actions/weekly-boost'
import type { BoostPeriodDetail } from '@/types/app'

interface Props {
  detail:          BoostPeriodDetail
  remainingPence:  number
}

export function PeriodStatusPanel({ detail, remainingPence }: Props) {
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)
  const [pending,  start]       = useTransition()

  function changeStatus(status: 'active' | 'closed' | 'awarded') {
    setError(null); setSuccess(null)
    start(async () => {
      const res = await updatePeriodStatusAction(detail.id, status)
      if (!res.success) setError(res.error)
      else setSuccess(`Period status changed to "${status}"`)
    })
  }

  function downloadReport() {
    start(async () => {
      const res = await exportPeriodReportAction(detail.id)
      if (!res.success) { setError(res.error); return }
      const blob = new Blob([res.data.csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = res.data.filename; a.click()
      URL.revokeObjectURL(url)
    })
  }

  const { status } = detail

  return (
    <Card>
      <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {status === 'draft' && (
          <Button className="w-full" onClick={() => changeStatus('active')} loading={pending}>
            Set Active
          </Button>
        )}
        {status === 'active' && (
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => changeStatus('closed')}
            loading={pending}
          >
            Close period
          </Button>
        )}
        {status === 'closed' && remainingPence === 0 && (
          <Button className="w-full" onClick={() => changeStatus('awarded')} loading={pending}>
            Mark as Awarded
          </Button>
        )}
        {status === 'closed' && remainingPence > 0 && (
          <Alert variant="warning" title="Unawarded fund">
            £{(remainingPence / 100).toFixed(2)} has not been awarded yet. Award all clubs before
            closing.
          </Alert>
        )}

        <Button
          className="w-full"
          variant="secondary"
          onClick={downloadReport}
          loading={pending}
        >
          Export CSV report
        </Button>

        {error   && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* Status legend */}
        <div className="pt-2 space-y-1 text-xs text-slate-500 border-t border-slate-100">
          <p><span className="font-medium">Draft</span> — not yet accepting contributions</p>
          <p><span className="font-medium">Active</span> — open for contributions; clubs becoming eligible</p>
          <p><span className="font-medium">Closed</span> — no new contributions; ready to award</p>
          <p><span className="font-medium">Awarded</span> — all awards made and published</p>
        </div>
      </CardContent>
    </Card>
  )
}
