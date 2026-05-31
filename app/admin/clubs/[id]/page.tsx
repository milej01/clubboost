import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ChevronRight, CheckCircle2, XCircle,
  Trophy, CreditCard, Users, ExternalLink, ScrollText, Zap,
} from 'lucide-react'
import type { Metadata } from 'next'

import { getAdminClubDetail } from '@/lib/services/admin'
import { formatPence, formatDate } from '@/lib/utils'
import { ClubActionPanel } from './club-action-panel'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
  approved:  { label: 'Approved',  cls: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-600' },
  suspended: { label: 'Suspended', cls: 'bg-red-100 text-red-600' },
}

const COMP_STATUS: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-slate-100 text-slate-500' },
  open:      { label: 'Open',      cls: 'bg-green-100 text-green-700' },
  closed:    { label: 'Closed',    cls: 'bg-slate-100 text-slate-600' },
  settled:   { label: 'Settled',   cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const detail  = await getAdminClubDetail(id)
  return { title: detail ? `${detail.club.name} — Admin` : 'Club — Admin' }
}

export default async function AdminClubDetailPage({ params }: PageProps) {
  const { id } = await params
  const detail  = await getAdminClubDetail(id)
  if (!detail) notFound()

  const { club, competitions, recentPayments, members, stats } = detail
  const sc = STATUS_CONFIG[club.status] ?? { label: club.status, cls: 'bg-slate-100 text-slate-500' }

  type Member = {
    user_id: string
    role:    string
    profiles: { display_name?: string | null; email?: string | null } | null
  }

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/admin/clubs" className="hover:text-slate-600 transition-colors">Clubs</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-700 font-medium truncate max-w-xs">{club.name}</span>
      </nav>

      {/* Header + action panel */}
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{club.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sc.cls}`}>
              {sc.label}
            </span>
            {club.weekly_boost_eligible && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Boost eligible
              </span>
            )}
          </div>
          <p className="font-mono text-sm text-slate-400">{club.slug}</p>
          <p className="text-sm text-slate-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {club.sport    && <span>{club.sport}</span>}
            {club.location && <span>{club.location}</span>}
            {club.contact_email && (
              <a href={`mailto:${club.contact_email}`} className="text-primary-600 hover:underline">
                {club.contact_email}
              </a>
            )}
          </p>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {club.stripe_onboarded
              ? <span className="flex items-center gap-1.5 text-xs text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Stripe connected</span>
              : <span className="flex items-center gap-1.5 text-xs text-slate-400"><XCircle className="h-3.5 w-3.5" /> Stripe not set up</span>
            }
            <a
              href={`/c/${club.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary-600 transition-colors"
            >
              Public page <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-xs text-slate-400">Joined {formatDate(club.created_at)}</span>
          </div>
        </div>

        <ClubActionPanel
          clubId={club.id}
          currentStatus={club.status}
          boostEligible={club.weekly_boost_eligible ?? false}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Competitions',  value: stats.competition_count.toString(),       icon: Trophy,     accent: '' },
          { label: 'Active now',    value: stats.active_count.toString(),             icon: Trophy,     accent: stats.active_count > 0 ? 'text-green-600' : '' },
          { label: 'Total raised',  value: formatPence(stats.total_raised_pence),    icon: CreditCard, accent: 'text-primary-700' },
          { label: 'Platform fees', value: formatPence(stats.total_fees_pence),      icon: CreditCard, accent: '' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${accent || 'text-slate-900'}`}>{value}</p>
              </div>
              <Icon className="h-4 w-4 text-slate-300" />
            </div>
          </div>
        ))}
      </div>

      {/* Competitions + Payments grid */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Competitions table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-slate-400" /> Competitions
            </h2>
            <Link
              href={`/admin/competitions?club_id=${club.id}`}
              className="text-xs text-primary-600 hover:underline"
            >
              View all →
            </Link>
          </div>
          {competitions.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Trophy className="h-6 w-6 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No competitions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {competitions.map(comp => {
                const cs = COMP_STATUS[comp.status] ?? { label: comp.status, cls: 'bg-slate-100 text-slate-500' }
                return (
                  <div key={comp.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{comp.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 capitalize">
                        {comp.type.replace(/_/g, ' ')} · {comp.entry_count} {comp.entry_count === 1 ? 'entry' : 'entries'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold flex-shrink-0 ${cs.cls}`}>
                      {cs.label}
                    </span>
                    <Link
                      href={`/admin/competitions/${comp.id}`}
                      className="text-xs text-primary-600 hover:underline flex-shrink-0"
                    >
                      View
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent payments */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" /> Recent payments
            </h2>
            <Link href="/admin/payments" className="text-xs text-primary-600 hover:underline">
              All payments →
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CreditCard className="h-6 w-6 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No payments yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Date', 'Amount', 'Fee', 'Status'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentPayments.slice(0, 10).map(pmt => (
                    <tr key={pmt.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(pmt.created_at)}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-medium text-slate-800">
                        {formatPence(pmt.amount_pence)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-500 text-xs">
                        {formatPence(pmt.platform_fee_pence ?? 0)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          pmt.status === 'succeeded' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {pmt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Users className="h-4 w-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Team members</h2>
          <span className="ml-auto text-xs text-slate-400">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
        </div>
        {members.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Users className="h-6 w-6 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No members yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Name', 'Email', 'Role'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(members as Member[]).map(m => (
                  <tr key={m.user_id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {m.profiles?.display_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {m.profiles?.email ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 capitalize">
                        {m.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit log link */}
      <div className="flex justify-center pb-2">
        <Link
          href={`/admin/audit-log?q=${club.id}`}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-primary-600 transition-colors"
        >
          <ScrollText className="h-4 w-4" />
          View audit log for this club
        </Link>
      </div>
    </div>
  )
}
