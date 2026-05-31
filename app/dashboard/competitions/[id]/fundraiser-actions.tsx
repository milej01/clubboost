'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Lock, XCircle, AlertTriangle } from 'lucide-react'
import {
  publishCompetitionAction,
  closeCompetitionAction,
  cancelCompetitionAction,
} from '@/actions/competitions'

interface Props {
  competitionId: string
  status:        string
  clubSlug?:     string
}

export function FundraiserActions({ competitionId, status, clubSlug }: Props) {
  const router                       = useRouter()
  const [error,   setError]          = useState<string | null>(null)
  const [success, setSuccess]        = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [pending, startTransition]   = useTransition()

  function act(
    action:      () => Promise<{ success: boolean; error?: string }>,
    successMsg:  string,
  ) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const res = await action()
      if (!res.success) {
        setError(res.error ?? 'Action failed')
      } else {
        setSuccess(successMsg)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === 'draft' && (
          <button
            onClick={() => act(() => publishCompetitionAction(competitionId), 'Fundraiser is now live!')}
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Go live
          </button>
        )}

        {status === 'open' && (
          <>
            <button
              onClick={() => act(() => closeCompetitionAction(competitionId), 'Entries closed')}
              disabled={pending}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Lock className="h-4 w-4" />
              Close entries
            </button>
            {clubSlug && (
              <a
                href={`/c/${clubSlug}/${competitionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View public page ↗
              </a>
            )}
          </>
        )}

        {status === 'closed' && (
          <a
            href={`/dashboard/competitions/${competitionId}/settle`}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            Settle fundraiser →
          </a>
        )}

        {(status === 'draft' || status === 'open') && !confirmCancel && (
          <button
            onClick={() => setConfirmCancel(true)}
            className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
          >
            <XCircle className="h-4 w-4" />
            Cancel
          </button>
        )}

        {confirmCancel && (
          <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Cancel this fundraiser?
            </p>
            <p className="text-xs text-amber-700">
              Any existing entries will be refunded. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => act(() => cancelCompetitionAction(competitionId), 'Fundraiser cancelled')}
                disabled={pending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Yes, cancel it
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>

      {error   && <p className="text-sm font-medium text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-sm font-medium text-green-600 bg-green-50 rounded-lg px-3 py-2">{success}</p>}
    </div>
  )
}
