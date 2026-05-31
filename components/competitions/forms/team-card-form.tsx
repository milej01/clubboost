'use client'

import { useState, useTransition } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { enterCompetitionAction } from '@/actions/entries'
import { useRouter } from 'next/navigation'
import { formatPence } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Shuffle } from 'lucide-react'
import type { Competition } from '@/types/app'
import type { EnrichedTeamCardSlot } from '@/types/app'

interface TeamCardFormProps {
  competition: Competition
  slots:       EnrichedTeamCardSlot[]
  clubName:    string
  clubSlug:    string
}

/**
 * A slot is:
 * - Available   → entry_id is null
 * - Reserved    → entry_id is set and entryStatus === 'pending_payment'
 * - Taken       → entry_id is set and entryStatus is active / eliminated / winner / refunded
 */
function slotState(slot: EnrichedTeamCardSlot): 'available' | 'reserved' | 'taken' {
  if (!slot.entry_id) return 'available'
  if (slot.entryStatus === 'pending_payment') return 'reserved'
  return 'taken'
}

export function TeamCardForm({ competition, slots, clubName }: TeamCardFormProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [termsOk, setTermsOk]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [pending, start]        = useTransition()
  const router = useRouter()

  const availableSlots = slots.filter(s => slotState(s) === 'available')
  const canSubmit = selected !== null && termsOk

  function pickRandom() {
    if (availableSlots.length === 0) return
    const pick = availableSlots[Math.floor(Math.random() * availableSlots.length)]
    setSelected(pick.slot_number)
  }

  function handleSubmit() {
    if (selected === null) { setError('Please select a team slot to continue'); return }
    if (!termsOk)          { setError('Please accept the terms to continue');   return }
    setError(null)

    start(async () => {
      const result = await enterCompetitionAction(competition.id, { slot_number: selected })
      if (!result.success) { setError(result.error); return }
      router.push(result.data.checkoutUrl)
    })
  }

  const selectedSlot = selected !== null ? slots.find(s => s.slot_number === selected) : null

  return (
    <div className="space-y-5">

      {/* Slot availability */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          {availableSlots.length} of {slots.length} slots available
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-white border border-slate-300" />
            Available
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-100 border border-amber-200" />
            Reserved
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-100 border border-slate-200" />
            Taken
          </span>
        </div>
      </div>

      {/* Random pick button */}
      {availableSlots.length > 0 && (
        <button
          type="button"
          onClick={pickRandom}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary-300 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
        >
          <Shuffle className="h-4 w-4" />
          Pick a random slot
        </button>
      )}

      {/* Slot grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {slots.map(slot => {
          const state      = slotState(slot)
          const isSelected = selected === slot.slot_number

          return (
            <button
              key={slot.id}
              type="button"
              disabled={state !== 'available'}
              onClick={() => state === 'available' && setSelected(slot.slot_number)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all',
                state === 'taken'
                  ? 'cursor-not-allowed border-slate-100 bg-slate-50'
                  : state === 'reserved'
                    ? 'cursor-not-allowed border-amber-200 bg-amber-50'
                    : isSelected
                      ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-primary-300 hover:bg-primary-50 cursor-pointer'
              )}
            >
              <p className="text-xs text-slate-400 mb-1">#{slot.slot_number}</p>
              <p className={cn(
                'font-semibold text-sm leading-tight',
                state === 'taken'    ? 'text-slate-300' :
                state === 'reserved' ? 'text-amber-700' :
                isSelected           ? 'text-primary-800' :
                'text-slate-900'
              )}>
                {slot.team_name}
              </p>
              {state === 'taken' && (
                <p className="text-xs text-slate-300 mt-1 font-normal">Taken</p>
              )}
              {state === 'reserved' && (
                <p className="text-xs text-amber-500 mt-1 font-normal">Reserved</p>
              )}
              {state === 'available' && isSelected && (
                <p className="text-xs text-primary-600 mt-1 font-medium">Selected ✓</p>
              )}
            </button>
          )
        })}
      </div>

      {/* Selection summary */}
      {selectedSlot && (
        <div className="rounded-xl bg-primary-50 border border-primary-200 px-4 py-3">
          <p className="text-sm font-semibold text-primary-900">
            Slot #{selectedSlot.slot_number} — {selectedSlot.team_name}
          </p>
          <p className="text-xs text-primary-600 mt-0.5">
            If {selectedSlot.team_name} is drawn as the winning team, you win the prize!
          </p>
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
          ? 'Reserving your slot…'
          : selectedSlot
            ? `Select ${selectedSlot.team_name} & pay ${formatPence(competition.entry_fee_pence)}`
            : 'Choose a slot to continue'}
      </Button>

      <p className="text-xs text-center text-slate-400">
        Your slot is confirmed once payment is complete. You'll be taken to Stripe to pay securely.
      </p>
    </div>
  )
}
