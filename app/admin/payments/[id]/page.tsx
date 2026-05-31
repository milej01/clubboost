import { notFound }   from 'next/navigation'
import Link            from 'next/link'
import { ArrowLeft }   from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge }       from '@/components/ui/badge'
import { Alert }       from '@/components/ui/alert'
import { formatPence, formatDateTime } from '@/lib/utils'
import { getPaymentById, getRefundsForPayment } from '@/lib/services/payments'
import { getLedgerForPayment }                  from '@/lib/services/ledger'
import { RefundForm }   from './refund-form'
import type { PaymentStatus, LedgerType, LedgerDirection, RefundStatus } from '@/types/app'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Payment detail — Admin' }

const statusVariant: Record<PaymentStatus, 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'purple'> = {
  pending:            'amber',
  succeeded:          'green',
  failed:             'red',
  refunded:           'slate',
  partially_refunded: 'blue',
}

const refundStatusVariant: Record<RefundStatus, 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'purple'> = {
  pending:   'amber',
  succeeded: 'green',
  failed:    'red',
}

const ledgerTypeLabel: Record<string, string> = {
  entry_gross:                   'Entry gross',
  donation_gross:                'Donation gross',
  platform_service_fee:          'Platform service fee',
  payment_processing_fee:        'Stripe processing fee',
  club_fundraising_amount:       'Club fundraising',
  prize_pool_allocation:         'Prize pool',
  clubboost_weekly_contribution: 'Weekly Boost contribution',
  refund:                        'Refund',
  payout:                        'Payout',
  adjustment:                    'Adjustment',
}

function SplitRow({ label, pence, note }: { label: string; pence: number; note?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-600">
        {label}
        {note && <span className="text-xs text-slate-400 ml-1">({note})</span>}
      </span>
      <span className="font-mono text-sm font-medium">{formatPence(pence)}</span>
    </div>
  )
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [payment, ledger, refunds] = await Promise.all([
    getPaymentById(id),
    getLedgerForPayment(id),
    getRefundsForPayment(id),
  ])

  if (!payment) notFound()

  const canRefund = payment.status === 'succeeded'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back link */}
      <Link
        href="/admin/payments"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Payments
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">{payment.id}</p>
        </div>
        <Badge variant={statusVariant[payment.status]}>
          {payment.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Payment breakdown */}
      <Card>
        <CardHeader><CardTitle>Payment split</CardTitle></CardHeader>
        <CardContent className="space-y-0 divide-y divide-slate-100">
          <SplitRow label="Gross amount (participant paid)" pence={payment.gross_amount_pence || payment.amount_pence} />
          <SplitRow label="Platform service fee" pence={payment.platform_service_fee_pence} />
          <SplitRow label="Stripe processing fee" pence={payment.stripe_fee_pence} note="estimated at checkout; refined from charge" />
          <SplitRow label="Weekly Boost contribution" pence={payment.weekly_boost_contribution_pence} />
          <SplitRow label="Prize pool allocation" pence={payment.prize_pool_contribution_pence} />
          <SplitRow label="Club fundraising amount" pence={payment.club_fundraising_amount_pence} />
        </CardContent>
      </Card>

      {/* Stripe details */}
      <Card>
        <CardHeader><CardTitle>Stripe references</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              { label: 'Payment Intent',    value: payment.stripe_payment_intent_id },
              { label: 'Checkout Session',  value: payment.stripe_checkout_session_id },
              { label: 'Charge ID',         value: payment.stripe_charge_id },
              { label: 'Application Fee',   value: payment.stripe_application_fee_id },
              { label: 'Idempotency Key',   value: payment.idempotency_key },
              { label: 'Card',              value: payment.payment_method_brand && payment.payment_method_last4
                                                   ? `${payment.payment_method_brand} ····${payment.payment_method_last4}`
                                                   : null },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <dt className="text-xs text-slate-500 font-medium">{label}</dt>
                <dd className="font-mono text-xs text-slate-700 break-all">{value}</dd>
              </div>
            ) : null)}
            <div>
              <dt className="text-xs text-slate-500 font-medium">Created</dt>
              <dd className="text-slate-700">{formatDateTime(payment.created_at)}</dd>
            </div>
            {payment.paid_at && (
              <div>
                <dt className="text-xs text-slate-500 font-medium">Paid at</dt>
                <dd className="text-slate-700">{formatDateTime(payment.paid_at)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Ledger entries */}
      {ledger.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Ledger entries</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Direction</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(ledger as Array<{
                  id: string
                  ledger_type: LedgerType
                  direction: LedgerDirection
                  amount_pence: number
                  description: string | null
                }>).map(row => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-700">
                      {ledgerTypeLabel[row.ledger_type] ?? row.ledger_type}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`font-medium ${row.direction === 'credit' ? 'text-green-700' : 'text-red-600'}`}>
                        {row.direction === 'credit' ? '+ credit' : '− debit'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{formatPence(row.amount_pence)}</td>
                    <td className="px-4 py-2 text-slate-400 max-w-xs truncate">{row.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Refunds */}
      {refunds.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Refunds</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(refunds as Array<{
              id: string
              amount_pence: number
              reason: string
              status: RefundStatus
              stripe_refund_id: string | null
              refunded_at: string | null
              created_at: string
            }>).map(r => (
              <div key={r.id} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-900">{formatPence(r.amount_pence)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.reason}</p>
                  {r.stripe_refund_id && (
                    <p className="text-xs text-slate-400 font-mono mt-1">{r.stripe_refund_id}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={refundStatusVariant[r.status]}>{r.status}</Badge>
                  <span className="text-xs text-slate-400">{formatDateTime(r.created_at)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Refund action */}
      {canRefund && (
        <Card>
          <CardHeader><CardTitle>Issue refund</CardTitle></CardHeader>
          <CardContent>
            <Alert variant="warning" title="Irreversible action">
              This will issue a full refund via Stripe and mark the participant&apos;s entry as refunded.
            </Alert>
            <div className="mt-4">
              <RefundForm paymentId={payment.id} amountPence={payment.gross_amount_pence || payment.amount_pence} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
