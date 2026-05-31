'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Select }    from '@/components/ui/select'
import { Alert }     from '@/components/ui/alert'
import { FormField } from '@/components/ui/label'
import { addFundItemAction } from '@/actions/weekly-boost'
import type { BoostContributionSource } from '@/types/app'
import { SOURCE_LABELS } from '@/lib/services/boost-calculator'

interface Props {
  periodId:       string
  remainingPence: number
}

const sourceOptions = (
  Object.entries(SOURCE_LABELS) as [BoostContributionSource, string][]
)
  .filter(([key]) => key !== 'competition_payment')  // auto-added from payments
  .map(([value, label]) => ({ value, label }))

export function AddContributionForm({ periodId }: Props) {
  const [pending, start]    = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [open, setOpen]     = useState(false)

  const [sourceType,   setSourceType]   = useState<BoostContributionSource>('sponsor')
  const [amountPence,  setAmountPence]  = useState('')
  const [description,  setDescription]  = useState('')
  const [sponsorId,    setSponsorId]    = useState('')

  function handleAdd() {
    setError(null); setSuccess(null)
    const pence = parseInt(amountPence)
    if (!pence || pence <= 0) { setError('Enter a valid amount in pence (e.g. 5000 = £50)'); return }

    start(async () => {
      const res = await addFundItemAction({
        periodId,
        sourceType,
        amountPence: pence,
        description: description || undefined,
        sponsorId:   sponsorId   || undefined,
      })
      if (!res.success) { setError(res.error); return }
      setSuccess(`Contribution of £${(pence / 100).toFixed(2)} added`)
      setAmountPence(''); setDescription(''); setSponsorId('')
    })
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        + Add contribution
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>Add contribution to fund</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="info" title="Competition contributions">
          Contributions from participant payments are recorded automatically when payments are
          processed. Use this form to add sponsor, platform marketing, or admin top-up contributions.
        </Alert>

        <FormField label="Source" htmlFor="source">
          <Select
            id="source"
            options={sourceOptions}
            value={sourceType}
            onChange={e => setSourceType(e.target.value as BoostContributionSource)}
          />
        </FormField>

        <FormField label="Amount (pence)" htmlFor="amount" hint="e.g. 5000 = £50.00">
          <Input
            id="amount"
            type="number"
            min="1"
            value={amountPence}
            onChange={e => setAmountPence(e.target.value)}
            placeholder="5000"
          />
        </FormField>

        {sourceType === 'sponsor' && (
          <FormField label="Sponsor ID (optional)" htmlFor="sponsor" hint="UUID from the sponsors list">
            <Input
              id="sponsor"
              value={sponsorId}
              onChange={e => setSponsorId(e.target.value)}
              placeholder="uuid"
            />
          </FormField>
        )}

        <FormField label="Description (optional)" htmlFor="desc">
          <Input
            id="desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Acme Ltd sponsorship cheque"
          />
        </FormField>

        {error   && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <div className="flex gap-3">
          <Button onClick={handleAdd} loading={pending}>Add contribution</Button>
          <Button variant="secondary" onClick={() => { setOpen(false); setError(null); setSuccess(null) }}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
