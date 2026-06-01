import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPence, formatDateTime } from '@/lib/utils'
import { getAllPayoutsAdmin }   from '@/lib/services/payouts'
import { PayoutActions }        from './payout-actions'
import type { PayoutStatus, PayoutWithRelations } from '@/types/app'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Payouts — Admin' }

const statusVariant: Record<PayoutStatus, 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'purple'> = {
  pending_review: 'amber',
  processing:     'blue',
  paid:           'green',
  failed:         'red',
  cancelled:      'slate',
}

const typeLabel: Record<string, string> = {
  club_fundraising: 'Club fundraising',
  prize_winner:     'Prize — winner',
  platform_fee:     'Platform fee',
  weekly_boost:     'Weekly Boost',
  refund:           'Refund',
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: filterStatus } = await searchParams

  const payouts = await getAllPayoutsAdmin(filterStatus)
  const pending = payouts.filter(p => p.status === 'pending_review')

  const statuses: PayoutStatus[] = ['pending_review', 'processing', 'paid', 'failed', 'cancelled']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payouts</h1>
          <p className="text-sm text-slate-500 mt-1">
            All payouts require manual approval. No automated transfers in MVP.
          </p>
        </div>
        <Link href="/admin/payments" className="text-sm text-blue-600 hover:underline">
          ← Payments
        </Link>
      </div>

      {/* Pending alert */}
      {!filterStatus && pending.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>{pending.length} payout{pending.length !== 1 ? 's' : ''} pending review.</strong>{' '}
          Review each payout below, then approve and mark as paid once funds are transferred.
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/payouts"
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !filterStatus
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
          }`}
        >
          All ({payouts.length})
        </Link>
        {statuses.map(s => {
          const count = payouts.filter(p => p.status === s).length
          if (count === 0) return null
          return (
            <Link
              key={s}
              href={`/admin/payouts?status=${s}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filterStatus === s
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {s.replace('_', ' ')} ({count})
            </Link>
          )
        })}
      </div>

      {/* Payouts table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {payouts.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No payouts found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Recipient</th>
                  <th className="px-4 py-3 text-left">Competition</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(payouts as unknown as PayoutWithRelations[]).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {p.club?.name ?? p.recipient?.display_name ?? '—'}
                      </div>
                      {p.notes && (
                        <div className="text-xs text-slate-400 truncate max-w-[180px]">{p.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {p.competition?.title ?? p.competition_id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-slate-600">
                        {typeLabel[p.payout_type] ?? p.payout_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatPence(p.amount_pence)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[p.status]}>
                        {p.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDateTime(p.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PayoutActions payout={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="py-4 text-sm text-slate-600 space-y-2">
          <h3 className="font-medium text-slate-800">Payout workflow</h3>
          <ol className="list-decimal list-inside space-y-1 text-slate-500">
            <li><strong>Pending review</strong> — created automatically on competition settlement. Verify the amount and recipient.</li>
            <li><strong>Approve</strong> — click Approve to move to &ldquo;processing&rdquo; status. This signals intent to pay.</li>
            <li><strong>Transfer funds manually</strong> — transfer via bank transfer or Stripe dashboard.</li>
            <li><strong>Mark paid</strong> — enter the bank transfer reference and click Mark paid. This writes a ledger debit row.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
