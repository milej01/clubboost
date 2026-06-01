'use client'

import { useState, useTransition } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { enterCompetitionAction } from '@/actions/entries'
import { useRouter } from 'next/navigation'
import { formatPence, formatDate } from '@/lib/utils'
import type { Competition, Fixture } from '@/types/app'

type ResultPick = '1' | 'X' | '2'

interface PredictorFormProps {
  competition: Competition
  fixtures:    Fixture[]
  clubName:    string
  clubSlug:    string
}

const RESULT_OPTS: Array<{ value: ResultPick; label: string }> = [
  { value: '1', label: '1' },
  { value: 'X', label: 'X' },
  { value: '2', label: '2' },
]

export function PredictorForm({ competition, fixtures, clubName }: PredictorFormProps) {
  const [picks,     setPicks]     = useState<Record<string, ResultPick>>({})
  const [tiebreaker, setTiebreaker] = useState('')
  const [termsOk,   setTermsOk]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [pending,   start]        = useTransition()
  const router = useRouter()

  const allPicked = fixtures.every(f => picks[f.id])
  const canSubmit = allPicked && termsOk

  function setPick(fixtureId: string, result: ResultPick) {
    setPicks(prev => ({ ...prev, [fixtureId]: result }))
  }

  function handleSubmit() {
    if (!allPicked) { setError('Please predict the result of every fixture'); return }
    if (!termsOk)   { setError('Please accept the terms to continue');         return }
    setError(null)

    start(async () => {
      const predictions = fixtures.map(f => ({
        fixture_id:       f.id,
        predicted_result: picks[f.id],
      }))

      const entryData: Record<string, unknown> = { predictions }
      if (tiebreaker.trim()) entryData.tiebreaker_total_goals = Number(tiebreaker)

      const result = await enterCompetitionAction(competition.id, entryData as any)
      if (!result.success) { setError(result.error); return }
      router.push(result.data.checkoutUrl)
    })
  }

  return (
    <div className="space-y-5">

      {/* Fixtures */}
      <div className="space-y-3">
        {fixtures.map((fixture, i) => {
          const picked = picks[fixture.id]

          return (
            <div
              key={fixture.id}
              className={`rounded-xl border transition-colors ${
                picked ? 'border-primary-200 bg-primary-50/40' : 'border-slate-200 bg-white'
              }`}
            >
              {/* Match header */}
              <div className="px-4 pt-3 pb-2">
                <p className="text-xs font-medium text-slate-400 mb-1.5">Match {i + 1}</p>
                {fixture.kickoff_at && (
                  <p className="text-xs text-slate-400 mb-1">{formatDate(fixture.kickoff_at)}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-semibold text-slate-900 text-sm text-left">
                    {fixture.home_team}
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0">vs</span>
                  <span className="flex-1 font-semibold text-slate-900 text-sm text-right">
                    {fixture.away_team}
                  </span>
                </div>
              </div>

              {/* 1 / X / 2 buttons */}
              <div className="px-4 pb-3">
                <div className="grid grid-cols-3 gap-2">
                  {RESULT_OPTS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPick(fixture.id, opt.value)}
                      title={opt.value === '1' ? 'Home win' : opt.value === 'X' ? 'Draw' : 'Away win'}
                      className={`rounded-lg border py-2 text-lg font-bold tracking-wide transition-colors ${
                        picked === opt.value
                          ? 'border-primary-500 bg-primary-600 text-white shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tiebreaker */}
      {fixtures.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label htmlFor="tiebreaker" className="text-sm font-medium text-slate-700 block mb-1">
            Tiebreaker <span className="font-normal text-slate-400 text-xs">(optional)</span>
          </label>
          <p className="text-xs text-slate-400 mb-2">
            How many total goals will be scored across all matches?
          </p>
          <input
            id="tiebreaker"
            type="number"
            min="0"
            max="99"
            placeholder="e.g. 7"
            value={tiebreaker}
            onChange={e => setTiebreaker(e.target.value)}
            className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${fixtures.length > 0 ? (Object.keys(picks).length / fixtures.length) * 100 : 0}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 flex-shrink-0">
          {Object.keys(picks).length} / {fixtures.length} predicted
        </p>
      </div>

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
          : `Confirm predictions & pay ${formatPence(competition.entry_fee_pence)}`}
      </Button>

      <p className="text-xs text-center text-slate-400">
        You'll be taken to Stripe to complete payment securely.
      </p>
    </div>
  )
}
