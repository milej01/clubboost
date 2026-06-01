import { redirect }   from 'next/navigation'
import Link            from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getClubsForUser } from '@/lib/services/clubs'
import { getPaymentsForClub } from '@/lib/services/payments'
import { getPayoutsForClub }  from '@/lib/services/payouts'
import { getLedgerSummaryForClub } from '@/lib/services/ledger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge }   from '@/components/ui/badge'
import { Alert }   from '@/components/ui/alert'
import { formatPence, formatDateTime } from '@/lib/utils'
import { Banknote, TrendingUp, Clock } from 'lucide-react'
import type { PayoutStatus, PayoutWithRelations } from '@/types/app'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Payments — Dashboard' }

const payoutStatusVariant: Record<PayoutStatus, 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'purple'> = {
  pending_review: 'amber',
  processing:     'blue',
  paid:           'green',
  failed:         'red',
  cancelled:      'slate',
}

export default async function ClubPaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clubs = await getClubsForUser(user.id)
  const club  = clubs[0]
  if (!club) redirect('/dashboard')

  const [payments, payouts, ledgerSummary] = await Promise.all([
    getPaymentsForClub(club.id, 100),
    getPayoutsForClub(club.id),
    getLedgerSummaryForClub(club.id),
  ])

  const totalRaisedPence  = (ledgerSummary['club_fundraising_amount']?.debit  ?? 0)
  const pendingPayoutPence = (payouts as unknown as PayoutWithRelations[])
    .filter(p => ['pending_review', 'processing'].includes(p.status))
    .reduce((s, p) => s + p.amount_pence, 0)
  const paidOutPence = (payouts as unknown as PayoutWithRelations[])
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + p.amount_pence, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments &amp; payouts</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your club&apos;s fundraising receipts and pending payouts from ClubBoost.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-slate-500">Total fundraising allocated</p>
                <p className="text-xl font-bold text-green-700">{formatPence(totalRaisedPence)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-slate-500">Pending payout</p>
                <p className="text-xl font-bold text-slate-900">{formatPence(pendingPayoutPence)}</p>
                <p className="text-xs text-slate-400">Awaiting admin approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-slate-500">Total paid out</p>
                <p className="text-xl font-bold text-slate-900">{formatPence(paidOutPence)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stripe onboarding prompt */}
      {!club.stripe_onboarded && (
        <Alert variant="warning" title="Stripe Connect not set up">
          Entry fees cannot be paid out until you connect a Stripe account.{' '}
          <Link href="/dashboard/stripe" className="underline font-medium">Set up Stripe Connect →</Link>
        </Alert>
      )}

      {/* Payouts */}
      {payouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payouts</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Competition</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(payouts as unknown as PayoutWithRelations[]).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {p.competition?.title ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.payout_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatPence(p.amount_pence)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={payoutStatusVariant[p.status]}>
                        {p.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                      {p.payment_reference ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {p.paid_at ? formatDateTime(p.paid_at) : formatDateTime(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Recent payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent entry payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {payments.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              No payments yet. Share your competition links to start receiving entries.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Participant</th>
                  <th className="px-4 py-3 text-left">Competition</th>
                  <th className="px-4 py-3 text-right">Entry fee</th>
                  <th className="px-4 py-3 text-right">Your share</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(payments as Array<{
                  id: string
                  participant: { display_name: string } | null
                  competition: { title: string } | null
                  amount_pence: number
                  club_fundraising_amount_pence: number
                  created_at: string
                }>).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {p.participant?.display_name ?? 'Anonymous'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">
                      {p.competition?.title ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatPence(p.amount_pence)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-green-700">
                      {formatPence(p.club_fundraising_amount_pence)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDateTime(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Ledger breakdown */}
      {Object.keys(ledgerSummary).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Ledger summary (all time)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {Object.entries(ledgerSummary).map(([type, summary]) => (
                <div key={type} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-slate-600 capitalize">{type.replace(/_/g, ' ')}</span>
                  <div className="flex gap-4 text-xs font-mono text-slate-500">
                    {summary.credit > 0 && <span className="text-green-700">+{formatPence(summary.credit)}</span>}
                    {summary.debit  > 0 && <span className="text-red-600">−{formatPence(summary.debit)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
