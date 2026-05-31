'use client'

import { useState, useTransition } from 'react'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Alert }     from '@/components/ui/alert'
import { approvePayoutAction, markPayoutPaidAction, cancelPayoutAction } from '@/actions/payments'
import type { PayoutWithRelations } from '@/types/app'

interface Props {
  payout: PayoutWithRelations
}

export function PayoutActions({ payout }: Props) {
  const [pending, start]    = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [ref, setRef]       = useState('')
  const [showPay, setShowPay] = useState(false)

  function handle(fn: () => Promise<{ success: boolean; error?: string }>) {
    setError(null)
    start(async () => {
      const res = await fn()
      if (!res.success) setError(res.error ?? 'Action failed')
    })
  }

  if (payout.status === 'paid') {
    return (
      <span className="text-xs text-green-600 font-medium">
        Paid{payout.payment_reference ? ` · ${payout.payment_reference}` : ''}
      </span>
    )
  }
  if (payout.status === 'cancelled' || payout.status === 'failed') {
    return <span className="text-xs text-slate-400">—</span>
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <Alert variant="error" className="text-xs max-w-xs">{error}</Alert>
      )}

      {payout.status === 'pending_review' && (
        <Button
          size="sm"
          onClick={() => handle(() => approvePayoutAction(payout.id))}
          loading={pending}
        >
          Approve
        </Button>
      )}

      {(payout.status === 'processing' || payout.status === 'pending_review') && (
        <>
          {!showPay ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowPay(true)}
            >
              Mark paid
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                className="w-32 text-xs h-8"
                placeholder="Bank ref…"
                value={ref}
                onChange={e => setRef(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handle(() => markPayoutPaidAction({ payoutId: payout.id, paymentReference: ref || undefined }))}
                loading={pending}
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowPay(false)}>✕</Button>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-700 text-xs"
            onClick={() => handle(() => cancelPayoutAction(payout.id))}
            loading={pending}
          >
            Cancel
          </Button>
        </>
      )}
    </div>
  )
}
