'use client'

import { useState, useTransition } from 'react'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Select }    from '@/components/ui/select'
import { Alert }     from '@/components/ui/alert'
import { FormField } from '@/components/ui/label'
import { awardClubAction } from '@/actions/weekly-boost'
import type { BoostEligibleClub } from '@/types/app'

interface Props {
  periodId:       string
  totalFundPence: number
  remainingPence: number
  eligibleClubs:  BoostEligibleClub[]
}

export function AwardClubForm({ periodId, totalFundPence, remainingPence, eligibleClubs }: Props) {
  const [pending, start]      = useTransition()
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [clubId,      setClubId]      = useState('')
  const [amountPence, setAmountPence] = useState('')
  const [reason,      setReason]      = useState('')

  const clubOptions = [
    { value: '', label: '— select a club —' },
    ...eligibleClubs.map(ec => ({
      value: ec.club_id,
      label: ec.club?.name ?? ec.club_id,
    })),
  ]

  function handleAward() {
    setError(null); setSuccess(null)
    if (!clubId)       { setError('Select a club'); return }
    const pence = parseInt(amountPence)
    if (!pence || pence <= 0) { setError('Enter a valid amount in pence'); return }
    if (pence > remainingPence) {
      setError(`Amount £${(pence/100).toFixed(2)} exceeds remaining fund £${(remainingPence/100).toFixed(2)}`)
      return
    }

    start(async () => {
      const res = await awardClubAction({
        periodId,
        clubId,
        amountPence: pence,
        reason: reason || undefined,
      })
      if (!res.success) { setError(res.error); return }
      setSuccess(`Award of £${(pence/100).toFixed(2)} created for club`)
      setClubId(''); setAmountPence(''); setReason('')
    })
  }

  if (eligibleClubs.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-2">
        No eligible clubs to award. Add contributions and confirm eligibility first.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 text-sm">
        <div>
          <span className="text-slate-500">Total fund:</span>{' '}
          <span className="font-semibold">£{(totalFundPence/100).toFixed(2)}</span>
        </div>
        <div>
          <span className="text-slate-500">Remaining:</span>{' '}
          <span className={`font-semibold ${remainingPence > 0 ? 'text-green-700' : 'text-slate-400'}`}>
            £{(remainingPence/100).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Club" htmlFor="club">
          <Select
            id="club"
            options={clubOptions}
            value={clubId}
            onChange={e => setClubId(e.target.value)}
          />
        </FormField>
        <FormField label="Amount (pence)" htmlFor="award-amount" hint="Max: remaining fund">
          <Input
            id="award-amount"
            type="number"
            min="1"
            max={remainingPence}
            value={amountPence}
            onChange={e => setAmountPence(e.target.value)}
            placeholder={`up to ${remainingPence}`}
          />
        </FormField>
      </div>

      <FormField label="Reason (optional)" htmlFor="reason">
        <Input
          id="reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Highest competition contributions this week"
        />
      </FormField>

      {error   && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Button onClick={handleAward} loading={pending} disabled={remainingPence === 0}>
        Award boost
      </Button>

      <p className="text-xs text-slate-500">
        You can award multiple clubs. Each award will be in <em>pending</em> status until you publish.
      </p>
    </div>
  )
}
