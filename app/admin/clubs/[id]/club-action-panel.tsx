'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle, PauseCircle, Zap } from 'lucide-react'
import { approveClubAction, setClubBoostEligibilityAction } from '@/actions/admin'

interface Props {
  clubId:        string
  currentStatus: string
  boostEligible: boolean
}

export function ClubActionPanel({ clubId, currentStatus, boostEligible }: Props) {
  const [reason,  setReason]         = useState('')
  const [eligible, setEligible]      = useState(boostEligible)
  const [message, setMessage]        = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition]   = useTransition()

  function act(
    action:      () => Promise<{ success: boolean; error?: string }>,
    successText: string,
  ) {
    setMessage(null)
    startTransition(async () => {
      const res = await action()
      if (res.success) {
        setMessage({ type: 'ok', text: successText })
      } else {
        setMessage({ type: 'err', text: res.error ?? 'Action failed' })
      }
    })
  }

  function handleBoostToggle() {
    const next = !eligible
    act(
      () => setClubBoostEligibilityAction(clubId, next),
      `Weekly Boost eligibility ${next ? 'granted' : 'removed'}`,
    )
    setEligible(next) // optimistic
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4 w-full lg:w-72 flex-shrink-0">
      <h2 className="text-sm font-semibold text-slate-700">Admin actions</h2>

      {/* Reason field */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Reason <span className="text-slate-400">(required for reject / suspend)</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          placeholder="Add a reason or note…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>

      {/* Status actions */}
      <div className="flex flex-col gap-2">
        {currentStatus !== 'approved' && (
          <button
            onClick={() => act(() => approveClubAction(clubId, 'approved'), 'Club approved')}
            disabled={pending}
            className="flex items-center gap-2 justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" /> Approve
          </button>
        )}
        {currentStatus === 'suspended' && (
          <button
            onClick={() => act(() => approveClubAction(clubId, 'approved', reason), 'Suspension lifted')}
            disabled={pending}
            className="flex items-center gap-2 justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Lift suspension
          </button>
        )}
        {currentStatus !== 'rejected' && (
          <button
            onClick={() => act(() => approveClubAction(clubId, 'rejected', reason), 'Club rejected')}
            disabled={pending}
            className="flex items-center gap-2 justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            <XCircle className="h-4 w-4" /> Reject
          </button>
        )}
        {currentStatus !== 'suspended' && (
          <button
            onClick={() => act(() => approveClubAction(clubId, 'suspended', reason), 'Club suspended')}
            disabled={pending}
            className="flex items-center gap-2 justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            <PauseCircle className="h-4 w-4" /> Suspend
          </button>
        )}
      </div>

      <hr className="border-slate-100" />

      {/* Weekly Boost eligibility toggle */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" /> Weekly Boost
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {eligible ? 'Eligible for boost' : 'Not eligible'}
          </p>
        </div>
        <button
          onClick={handleBoostToggle}
          disabled={pending}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
            eligible ? 'bg-amber-500' : 'bg-slate-200'
          }`}
          role="switch"
          aria-checked={eligible}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
              eligible ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Feedback message */}
      {message && (
        <p className={`text-xs rounded-lg px-3 py-2 font-medium ${
          message.type === 'ok'
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
