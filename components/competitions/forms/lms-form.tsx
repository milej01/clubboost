'use client'

import { useState, useTransition } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { enterCompetitionAction } from '@/actions/entries'
import { useRouter } from 'next/navigation'
import { formatPence } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Competition, LMSConfig } from '@/types/app'

interface LMSFormProps {
  competition: Competition
  /** Teams already picked in previous rounds (empty for first-time entry). */
  usedTeams:   string[]
  clubName:    string
  clubSlug:    string
}

export function LMSForm({ competition, usedTeams, clubName }: LMSFormProps) {
  const config  = competition.config as LMSConfig
  const teams   = config.available_teams ?? []

  const [selected, setSelected] = useState<string | null>(null)
  const [termsOk, setTermsOk]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [pending, start]          = useTransition()
  const router = useRouter()

  const canSubmit = !!selected && termsOk

  function pickTeam(team: string) {
    if (usedTeams.includes(team)) return
    setSelected(team)
  }

  function handleSubmit() {
    if (!selected) { setError('Please pick a team to continue');   return }
    if (!termsOk)  { setError('Please accept the terms to continue'); return }
    setError(null)

    start(async () => {
      const result = await enterCompetitionAction(competition.id, {
        picks: [{ round_id: 'round-1', team_picked: selected }],
      })
      if (!result.success) { setError(result.error); return }
      router.push(result.data.checkoutUrl)
    })
  }

  const availableCount = teams.filter(t => !usedTeams.includes(t)).length

  return (
    <div className="space-y-5">

      {/* Round context */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Round 1 pick</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Pick one team for round 1. If they win, you survive to round 2 — where you must pick a
          different team. The last surviving player wins.
        </p>
        {config.max_rounds > 0 && (
          <p className="text-xs text-primary-600 font-medium mt-1.5">
            Up to {config.max_rounds} rounds · {availableCount} team{availableCount !== 1 ? 's' : ''} available
          </p>
        )}
      </div>

      {/* Team grid */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
          Choose your team
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {teams.map(team => {
            const used       = usedTeams.includes(team)
            const isSelected = selected === team

            return (
              <button
                key={team}
                type="button"
                disabled={used}
                onClick={() => pickTeam(team)}
                className={cn(
                  'rounded-xl border px-3 py-3 text-sm font-medium transition-all text-left relative',
                  used
                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                    : isSelected
                      ? 'border-primary-500 bg-primary-600 text-white shadow-md ring-2 ring-primary-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-primary-300 hover:bg-primary-50'
                )}
              >
                {used && (
                  <span className="absolute top-1.5 right-1.5 text-xs text-slate-300" aria-label="Already used">✗</span>
                )}
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 text-xs text-white" aria-label="Selected">✓</span>
                )}
                {team}
                {used && <p className="text-xs text-slate-300 mt-0.5 font-normal">Already picked</p>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selection summary */}
      {selected && (
        <div className="rounded-xl bg-primary-50 border border-primary-200 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 font-bold text-sm">✓</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-primary-900">
              {selected} selected for round 1
            </p>
            <p className="text-xs text-primary-600">
              {config.allow_team_reuse ? 'Teams can be reused in later rounds.' : 'You cannot pick this team again in later rounds.'}
            </p>
          </div>
        </div>
      )}

      {/* Terms */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={termsOk}
          onChange={e => setTermsOk(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary-600 flex-shrink-0"
        />
        <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors leading-snug">
          I have read the competition rules and agree to the{' '}
          <a href="/terms" target="_blank" className="text-primary-600 hover:underline">
            ClubBoost terms of service
          </a>
          . My entry fee of {formatPence(competition.entry_fee_pence)} goes to support {clubName}.
        </span>
      </label>

      {error && <Alert variant="error">{error}</Alert>}

      <Button
        onClick={handleSubmit}
        loading={pending}
        disabled={!canSubmit}
        className="w-full"
        size="lg"
      >
        {pending
          ? 'Setting up payment…'
          : selected
            ? `Pick ${selected} & pay ${formatPence(competition.entry_fee_pence)}`
            : 'Select a team to continue'}
      </Button>

      <p className="text-xs text-center text-slate-400">
        You'll be taken to Stripe to complete payment securely.
      </p>
    </div>
  )
}
