'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { settleCompetitionAction } from '@/actions/settlements'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { use } from 'react'

// This page is intentionally simple — the admin enters results manually.
// For a full implementation, prefetch competition type and render type-specific UI.

export default function SettleCompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [error, setError]          = useState<string | null>(null)
  const [success, setSuccess]      = useState(false)
  const [pending, startTransition] = useTransition()

  // Predictor result state
  const [fixtureResults, setFixtureResults] = useState<Array<{ fixture_id: string; result: 'H' | 'D' | 'A' }>>([])
  const [winningSlot, setWinningSlot]       = useState('')
  const [manualWinnerId, setManualWinnerId] = useState('')

  function handleSettle() {
    setError(null)
    startTransition(async () => {
      // Build result data — in production, this would be type-aware
      const resultData = {
        fixture_results:     fixtureResults.length ? fixtureResults : undefined,
        winning_slot_number: winningSlot ? parseInt(winningSlot) : undefined,
        winner_entry_id:     manualWinnerId || undefined,
      }

      const result = await settleCompetitionAction(id, resultData)
      if (!result.success) { setError(result.error); return }
      setSuccess(true)
      setTimeout(() => router.push(`/dashboard/competitions/${id}`), 2000)
    })
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <p className="text-3xl mb-3">🎉</p>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Competition settled!</h2>
          <p className="text-slate-500">Redirecting to competition page…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/competitions/${id}`} className="text-slate-500 hover:text-slate-900">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Settle competition</h1>
      </div>

      <Alert variant="warning" title="Manual settlement">
        Review all entries before settling. This action cannot be undone. Payout records will be created for the winner and the club fundraise share.
      </Alert>

      <Card>
        <CardHeader><CardTitle>Enter results</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Enter the result data for this competition type. For predictor competitions, you&apos;ll need to enter each fixture result.
          </p>

          {/* Predictor: fixture result inputs */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Fixture results (Predictor)</p>
            <p className="text-xs text-slate-400">Enter fixture ID and result — H (home win), D (draw), A (away win)</p>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-3">
                <input
                  type="text"
                  placeholder={`Fixture ${i + 1} ID`}
                  className="input-base flex-1"
                  onChange={e => {
                    const updated = [...fixtureResults]
                    if (!updated[i]) updated[i] = { fixture_id: '', result: 'H' }
                    updated[i].fixture_id = e.target.value
                    setFixtureResults(updated)
                  }}
                />
                <select
                  className="input-base w-24"
                  onChange={e => {
                    const updated = [...fixtureResults]
                    if (!updated[i]) updated[i] = { fixture_id: '', result: 'H' }
                    updated[i].result = e.target.value as 'H' | 'D' | 'A'
                    setFixtureResults(updated)
                  }}
                >
                  <option value="H">H</option>
                  <option value="D">D</option>
                  <option value="A">A</option>
                </select>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Team Card — winning slot number</p>
            <input
              type="number"
              placeholder="Winning slot number"
              className="input-base"
              value={winningSlot}
              onChange={e => setWinningSlot(e.target.value)}
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Manual winner (LMS / override)</p>
            <input
              type="text"
              placeholder="Entry ID of winner"
              className="input-base"
              value={manualWinnerId}
              onChange={e => setManualWinnerId(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Button onClick={handleSettle} loading={pending} size="lg" className="w-full">
        Confirm settlement
      </Button>
    </div>
  )
}
