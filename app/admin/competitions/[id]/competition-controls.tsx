'use client'

import { useState, useTransition } from 'react'
import { XCircle, CheckCircle2, Lock, AlertTriangle } from 'lucide-react'
import {
  adminSetCompetitionStatusAction,
  adminForceSettleCompetitionAction,
} from '@/actions/admin'

interface Props {
  competitionId: string
  currentStatus: string
}

export function CompetitionControls({ competitionId, currentStatus }: Props) {
  const [reason,  setReason]   = useState('')
  const [notes,   setNotes]    = useState('')
  const [message, setMessage]  = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [confirmSettle, setConfirmSettle] = useState(false)
  const [pending, start]       = useTransition()

  function act(
    action:      () => Promise<{ success: boolean; error?: string }>,
    successText: string,
  ) {
    setMessage(null)
    start(async () => {
      const res = await action()
      setMessage(res.success ? { type: 'ok', text: successText } : { type: 'err', text: res.error ?? 'Action failed' })
      if (res.success) {
        setConfirmSettle(false)
        setReason('')
        setNotes('')
      }
    })
  }

  const isTerminal = currentStatus === 'settled' || currentStatus === 'cancelled'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Competition controls</h2>

      {isTerminal ? (
        <p className="text-sm text-slate-400">
          This competition is {currentStatus} — no further actions available.
        </p>
      ) : (
        <>
          {/* Reason / notes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Reason <span className="text-slate-400">(optional for close, required for cancel)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="Add a note…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {currentStatus === 'draft' && (
              <button
                onClick={() => act(
                  () => adminSetCompetitionStatusAction(competitionId, 'open', reason),
                  'Competition opened',
                )}
                disabled={pending}
                className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" /> Open now
              </button>
            )}
            {currentStatus === 'open' && (
              <button
                onClick={() => act(
                  () => adminSetCompetitionStatusAction(competitionId, 'closed', reason),
                  'Competition closed',
                )}
                disabled={pending}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <Lock className="h-4 w-4" /> Close entries
              </button>
            )}
            {currentStatus !== 'cancelled' && (
              <button
                onClick={() => act(
                  () => adminSetCompetitionStatusAction(competitionId, 'cancelled', reason),
                  'Competition cancelled',
                )}
                disabled={pending || !reason}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-4 w-4" /> Cancel
              </button>
            )}
          </div>

          {/* Force settle */}
          {currentStatus === 'closed' && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Force settle (irreversible)
              </p>
              {!confirmSettle ? (
                <button
                  onClick={() => setConfirmSettle(true)}
                  className="text-sm text-amber-700 underline hover:no-underline"
                >
                  Force settle this competition…
                </button>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Settlement notes (required)…"
                    className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => act(
                        () => adminForceSettleCompetitionAction(competitionId, notes),
                        'Competition force-settled',
                      )}
                      disabled={pending || !notes}
                      className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                      Confirm force settle
                    </button>
                    <button
                      onClick={() => setConfirmSettle(false)}
                      className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {message && (
        <p className={`text-xs rounded-lg px-3 py-2 font-medium ${
          message.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
