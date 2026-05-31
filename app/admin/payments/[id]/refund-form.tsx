'use client'

import { useState, useTransition } from 'react'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Alert }     from '@/components/ui/alert'
import { FormField } from '@/components/ui/label'
import { formatPence } from '@/lib/utils'
import { initiateRefundAction } from '@/actions/payments'

interface Props {
  paymentId:   string
  amountPence: number
}

export function RefundForm({ paymentId, amountPence }: Props) {
  const [pending, start]      = useTransition()
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [reason, setReason]   = useState('')
  const [confirm, setConfirm] = useState(false)

  if (success) {
    return <Alert variant="success">Refund issued successfully. The participant will receive {formatPence(amountPence)} within 5–10 business days.</Alert>
  }

  function handleRefund() {
    setError(null)
    start(async () => {
      const res = await initiateRefundAction(paymentId, reason)
      if (!res.success) { setError(res.error); return }
      setSuccess(true)
    })
  }

  return (
    <div className="space-y-4">
      <FormField label="Reason for refund" htmlFor="refund-reason">
        <Input
          id="refund-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Participant withdrew, competition cancelled"
        />
      </FormField>

      {error && <Alert variant="error">{error}</Alert>}

      {!confirm ? (
        <Button
          variant="ghost"
          className="text-red-600 hover:text-red-700"
          onClick={() => setConfirm(true)}
          disabled={!reason.trim()}
        >
          Refund {formatPence(amountPence)}…
        </Button>
      ) : (
        <div className="flex gap-3">
          <Button
            onClick={handleRefund}
            loading={pending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Yes, refund {formatPence(amountPence)}
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
