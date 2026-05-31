'use client'

import { useState, useTransition } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { enterCompetitionAction } from '@/actions/entries'
import { useRouter } from 'next/navigation'
import { formatPence } from '@/lib/utils'
import { Heart } from 'lucide-react'
import type { Competition, DonationConfig } from '@/types/app'
import { cn } from '@/lib/utils'

interface DonationFormProps {
  competition: Competition
  clubName:    string
  clubSlug:    string
}

// Quick-select amounts shown as shortcuts (in pence).
// The entry_fee_pence is the actual charge; these are just reference points
// that help the supporter understand the impact of their donation.
const SUGGESTED_IMPACTS = [
  { pence: 500,  label: '£5',  impact: 'covers a ball pump'     },
  { pence: 1000, label: '£10', impact: 'buys a set of bibs'     },
  { pence: 2000, label: '£20', impact: 'covers referee fees'    },
  { pence: 5000, label: '£50', impact: 'helps kit a young player' },
]

export function DonationForm({ competition, clubName }: DonationFormProps) {
  const config  = competition.config as DonationConfig
  const feePence = competition.entry_fee_pence

  const [message, setMessage]   = useState('')
  const [termsOk, setTermsOk]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [pending, start]        = useTransition()
  const router = useRouter()

  // Show progress toward target if configured
  const targetPence   = config?.target_amount_pence
  const showProgress  = config?.show_progress && targetPence

  function handleSubmit() {
    if (!termsOk) { setError('Please accept the terms to continue'); return }
    setError(null)

    start(async () => {
      const result = await enterCompetitionAction(competition.id, {
        message: message.trim() || undefined,
      })
      if (!result.success) { setError(result.error); return }
      router.push(result.data.checkoutUrl)
    })
  }

  // Find the closest suggested impact description for the entry fee
  const closestImpact = [...SUGGESTED_IMPACTS]
    .sort((a, b) => Math.abs(a.pence - feePence) - Math.abs(b.pence - feePence))[0]

  return (
    <div className="space-y-5">

      {/* Donation amount */}
      <div className="rounded-2xl border border-primary-100 bg-primary-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
          <Heart className="h-6 w-6 text-primary-600" />
        </div>
        <p className="text-3xl font-extrabold text-primary-800 tabular-nums">
          {formatPence(feePence)}
        </p>
        <p className="text-sm text-primary-600 mt-1">
          Your donation goes directly to {clubName}
        </p>
        {closestImpact && feePence >= 500 && (
          <p className="mt-2 text-xs text-primary-500 italic">
            {formatPence(feePence)} {closestImpact.impact === 'covers a ball pump' ? 'covers a ball pump' : `${closestImpact.impact}`}
          </p>
        )}
      </div>

      {/* Impact examples */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
          What your money does
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SUGGESTED_IMPACTS.map(item => (
            <div
              key={item.pence}
              className={cn(
                'rounded-xl border px-3 py-2.5',
                Math.abs(item.pence - feePence) < 200
                  ? 'border-primary-200 bg-primary-50'
                  : 'border-slate-100 bg-slate-50'
              )}
            >
              <p className="text-sm font-bold text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Optional message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
          Leave a message <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder={`Good luck this season, ${clubName}!`}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none"
        />
        <p className="text-xs text-slate-400 mt-1 text-right">{message.length}/200</p>
      </div>

      {/* Progress toward target */}
      {showProgress && targetPence && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-600">Fundraising target</p>
            <p className="text-xs font-semibold text-slate-900">{formatPence(targetPence)}</p>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary-500 transition-all"
              style={{ width: '12%' }} // placeholder — real % needs server-side total
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Every donation gets us closer!</p>
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
          I understand my {formatPence(feePence)} donation goes directly to {clubName} and I agree to the{' '}
          <a href="/terms" target="_blank" className="text-primary-600 hover:underline">
            ClubBoost terms of service
          </a>
          .
        </span>
      </label>

      {error && <Alert variant="error">{error}</Alert>}

      <Button
        onClick={handleSubmit}
        loading={pending}
        disabled={!termsOk}
        className="w-full"
        size="lg"
      >
        {pending ? 'Setting up payment…' : `Donate ${formatPence(feePence)} →`}
      </Button>

      <p className="text-xs text-center text-slate-400">
        100% of your donation goes to {clubName}. Payment processed securely by Stripe.
      </p>
    </div>
  )
}
