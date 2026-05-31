import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CreditCard,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { formatPence } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin Overview' }

export default async function AdminOverviewPage() {
  const db = createAdminClient()

  const [
    { count: clubCount },
    { count: pendingClubCount },
    { count: competitionCount },
    { count: activeCount },
    { data: payments },
    { data: recentClubs },
  ] = await Promise.all([
    db.from('clubs').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('clubs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('competitions').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('competitions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('payments').select('amount_pence, platform_fee_pence, created_at').eq('status', 'succeeded'),
    db.from('clubs').select('id, name, status, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  const totalRevenuePence = (payments ?? []).reduce((s, p) => s + (p.platform_fee_pence ?? 0), 0)
  const totalVolumePence  = (payments ?? []).reduce((s, p) => s + (p.amount_pence ?? 0), 0)

  // Calculate 30-day volume
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const recentPaymentVolume = (payments ?? [])
    .filter(p => p.created_at && p.created_at > thirtyDaysAgo)
    .reduce((s, p) => s + p.amount_pence, 0)

  const hasPending = (pendingClubCount ?? 0) > 0

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform overview</h1>
        <p className="text-sm text-slate-400 mt-1">ClubBoost admin · real-time data</p>
      </div>

      {/* Pending clubs alert */}
      {hasPending && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {pendingClubCount} club{pendingClubCount !== 1 ? 's' : ''} awaiting approval
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Review and approve to allow them to start fundraising</p>
          </div>
          <Link
            href="/admin/clubs?status=pending"
            className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline"
          >
            Review <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          {
            label:     'Total volume',
            value:     formatPence(totalVolumePence),
            sub:       `${formatPence(recentPaymentVolume)} last 30 days`,
            icon:      TrendingUp,
            highlight: 'money',
          },
          {
            label:     'Platform revenue',
            value:     formatPence(totalRevenuePence),
            sub:       '3% platform fee',
            icon:      CreditCard,
            highlight: 'money',
          },
          {
            label:     'Active competitions',
            value:     activeCount ?? 0,
            sub:       `${competitionCount ?? 0} total`,
            icon:      Trophy,
            highlight: 'active',
          },
          {
            label:     'Registered clubs',
            value:     clubCount ?? 0,
            sub:       hasPending ? `${pendingClubCount} pending` : 'All approved',
            icon:      Building2,
            highlight: hasPending ? 'warning' : undefined,
          },
          {
            label: 'Payment count',
            value: (payments ?? []).length,
            sub:   'Total succeeded',
            icon:  Zap,
          },
          {
            label: 'Avg payment',
            value: (payments ?? []).length > 0
              ? formatPence(Math.round(totalVolumePence / (payments ?? []).length))
              : '—',
            sub:  'Per transaction',
            icon: CreditCard,
          },
        ].map(({ label, value, sub, icon: Icon, highlight }) => (
          <div
            key={label}
            className={`rounded-2xl border p-5 ${
              highlight === 'money'   ? 'border-primary-200 bg-primary-50' :
              highlight === 'active' ? 'border-green-200 bg-green-50' :
              highlight === 'warning'? 'border-amber-200 bg-amber-50' :
              'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                highlight === 'money'   ? 'bg-primary-600' :
                highlight === 'active' ? 'bg-green-600' :
                highlight === 'warning'? 'bg-amber-500' :
                'bg-slate-100'
              }`}>
                <Icon className={`h-3.5 w-3.5 ${highlight ? 'text-white' : 'text-slate-400'}`} />
              </div>
            </div>
            <p className={`text-2xl font-extrabold tabular-nums ${
              highlight === 'money'   ? 'text-primary-700' :
              highlight === 'active' ? 'text-green-700' :
              highlight === 'warning'? 'text-amber-700' :
              'text-slate-900'
            }`}>
              {value}
            </p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-semibold text-slate-900 mb-4">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Review clubs',      href: '/admin/clubs',          icon: Building2, desc: 'Approve pending applications' },
            { label: 'All competitions',  href: '/admin/competitions',   icon: Trophy,    desc: 'Monitor active fundraisers' },
            { label: 'Payments',          href: '/admin/payments',       icon: CreditCard, desc: 'View transactions and splits' },
          ].map(({ label, href, icon: Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 hover:border-primary-300 hover:shadow-card transition-all group"
            >
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                <Icon className="h-5 w-5 text-slate-400 group-hover:text-primary-600 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-200 group-hover:text-primary-400 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Recent clubs */}
      {(recentClubs ?? []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Recently registered clubs</h2>
            <Link href="/admin/clubs" className="text-sm text-primary-600 hover:underline flex items-center gap-1 font-medium">
              All clubs <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {(recentClubs ?? []).map((club, i, arr) => (
              <Link
                key={club.id}
                href={`/admin/clubs/${club.id}`}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${
                  i < arr.length - 1 ? 'border-b border-slate-50' : ''
                }`}
              >
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{club.name}</p>
                  <p className="text-xs text-slate-400">
                    {club.created_at ? new Date(club.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold flex-shrink-0 ${
                  club.status === 'approved' ? 'bg-green-100 text-green-700' :
                  club.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {club.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
