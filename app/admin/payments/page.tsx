import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge }        from '@/components/ui/badge'
import { Alert }        from '@/components/ui/alert'
import { formatPence, formatDateTime } from '@/lib/utils'
import { getAllPaymentsAdmin, getPaymentStatsAdmin } from '@/lib/services/payments'
import { TrendingUp, CreditCard, AlertCircle, RefreshCw, Clock } from 'lucide-react'
import type { PaymentStatus } from '@/types/app'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Payments — Admin' }

const statusVariant: Record<PaymentStatus, 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'purple'> = {
  pending:             'amber',
  succeeded:           'green',
  failed:              'red',
  refunded:            'slate',
  partially_refunded:  'blue',
}

function StatCard({ title, value, sub, icon: Icon, accent }: {
  title:   string
  value:   string
  sub?:    string
  icon:    React.ElementType
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${accent ?? 'text-slate-900'}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <Icon className="h-5 w-5 text-slate-300" />
      </div>
    </div>
  )
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: filterStatus } = await searchParams

  const [payments, stats] = await Promise.all([
    getAllPaymentsAdmin(500),
    getPaymentStatsAdmin(),
  ])

  const filtered = filterStatus
    ? (payments as Array<{ status: string }>).filter(p => p.status === filterStatus)
    : payments

  const statuses: PaymentStatus[] = ['pending', 'succeeded', 'failed', 'refunded', 'partially_refunded']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <Link href="/admin/payouts" className="text-sm text-blue-600 hover:underline">
          View payouts →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          title="Total volume"
          value={formatPence(stats.totalVolumePence)}
          sub={`${stats.succeededCount} payments`}
          icon={TrendingUp}
          accent="text-green-700"
        />
        <StatCard
          title="Platform fees"
          value={formatPence(stats.totalPlatformFeePence)}
          sub="Revenue captured"
          icon={CreditCard}
        />
        <StatCard
          title="Pending"
          value={String(stats.pendingCount)}
          sub="Awaiting checkout"
          icon={Clock}
          accent={stats.pendingCount > 0 ? 'text-amber-700' : 'text-slate-900'}
        />
        <StatCard
          title="Failed"
          value={String(stats.failedCount)}
          icon={AlertCircle}
          accent={stats.failedCount > 0 ? 'text-red-700' : 'text-slate-900'}
        />
        <StatCard
          title="Refunded"
          value={String(stats.refundedCount)}
          icon={RefreshCw}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/payments"
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !filterStatus
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
          }`}
        >
          All ({payments.length})
        </Link>
        {statuses.map(s => {
          const count = (payments as Array<{ status: string }>).filter(p => p.status === s).length
          if (count === 0 && s !== 'succeeded') return null
          return (
            <Link
              key={s}
              href={`/admin/payments?status=${s}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filterStatus === s
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')} ({count})
            </Link>
          )
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No payments found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Participant</th>
                  <th className="px-4 py-3 text-left">Competition / Club</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Platform fee</th>
                  <th className="px-4 py-3 text-right">Club share</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(filtered as Array<{
                  id: string
                  participant: { display_name: string } | null
                  competition: { title: string; club: { name: string } } | null
                  amount_pence: number
                  platform_service_fee_pence: number
                  club_fundraising_amount_pence: number
                  status: PaymentStatus
                  created_at: string
                }>).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {p.participant?.display_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="font-medium truncate max-w-[180px]">{p.competition?.title}</div>
                      <div className="text-xs text-slate-400">{p.competition?.club?.name}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatPence(p.amount_pence)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 font-mono">
                      {formatPence(p.platform_service_fee_pence)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 font-mono">
                      {formatPence(p.club_fundraising_amount_pence)}
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
                      <Link
                        href={`/admin/payments/${p.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {payments.length >= 500 && (
        <Alert variant="info">
          Showing the 500 most recent payments. Export or filter by status to see more.
        </Alert>
      )}
    </div>
  )
}
