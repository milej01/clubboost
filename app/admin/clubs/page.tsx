import Link from 'next/link'
import { Building2, CheckCircle2, CreditCard, ExternalLink, XCircle } from 'lucide-react'
import type { Metadata } from 'next'

import { getAdminClubs, ADMIN_PAGE_SIZE } from '@/lib/services/admin'
import { FilterBar } from '@/components/admin/filter-bar'
import { Paginator } from '@/components/admin/paginator'
import { CsvExportButton } from '@/components/admin/csv-export-button'
import { formatPence, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Clubs — Admin' }

const STATUS_TABS = [
  { label: 'All',       value: '' },
  { label: 'Pending',   value: 'pending' },
  { label: 'Approved',  value: 'approved' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Rejected',  value: 'rejected' },
]

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
  approved:  { label: 'Approved',  cls: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-600' },
  suspended: { label: 'Suspended', cls: 'bg-red-100 text-red-600' },
}

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}

export default async function AdminClubsPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const status = sp.status ?? ''
  const q      = sp.q ?? ''
  const page   = Math.max(1, parseInt(sp.page ?? '1'))

  const { clubs, total, totalPages } = await getAdminClubs({ status, q, page })

  // Tab counts — fetch totals for each status
  const [
    { clubs: _all,  total: allTotal },
    { total: pendingTotal },
    { total: approvedTotal },
    { total: suspendedTotal },
  ] = await Promise.all([
    getAdminClubs({ q }),
    getAdminClubs({ status: 'pending', q }),
    getAdminClubs({ status: 'approved', q }),
    getAdminClubs({ status: 'suspended', q }),
  ])

  const tabs = [
    { label: 'All',       value: '',          count: allTotal },
    { label: 'Pending',   value: 'pending',   count: pendingTotal },
    { label: 'Approved',  value: 'approved',  count: approvedTotal },
    { label: 'Suspended', value: 'suspended', count: suspendedTotal },
    { label: 'Rejected',  value: 'rejected' },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clubs</h1>
          <p className="text-sm text-slate-400 mt-0.5">{allTotal.toLocaleString()} total</p>
        </div>
        <CsvExportButton
          href="/api/admin/export/clubs"
          params={{ status, q }}
          label="Export CSV"
        />
      </div>

      {/* Pending alert */}
      {pendingTotal > 0 && !status && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-sm text-amber-800">
            <strong>{pendingTotal} club{pendingTotal !== 1 ? 's' : ''}</strong> awaiting approval
          </p>
          <Link
            href="/admin/clubs?status=pending"
            className="ml-auto text-xs font-semibold text-amber-700 hover:underline flex-shrink-0"
          >
            Review →
          </Link>
        </div>
      )}

      {/* Filter bar */}
      <FilterBar
        tabs={tabs}
        placeholder="Search clubs by name…"
        filterKey="status"
        searchKey="q"
        extras={
          <p className="text-sm text-slate-400 ml-auto">
            {total.toLocaleString()} result{total !== 1 ? 's' : ''}
          </p>
        }
      />

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {clubs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Building2 className="h-8 w-8 mx-auto mb-3 text-slate-200" />
            <p className="text-sm">No clubs match your search</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Club', 'Sport / Location', 'Status', 'Stripe', 'Competitions', 'Total raised', 'Joined', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {clubs.map(club => {
                    const sc = STATUS_CONFIG[club.status] ?? { label: club.status, cls: 'bg-slate-100 text-slate-500' }
                    return (
                      <tr key={club.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-900">{club.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{club.slug}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <p>{club.sport ?? '—'}</p>
                          <p className="text-xs text-slate-400">{club.location ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sc.cls}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {club.stripe_onboarded
                            ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Connected</span>
                            : <span className="flex items-center gap-1 text-slate-400 text-xs"><XCircle className="h-3.5 w-3.5" /> Not set up</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-slate-700 tabular-nums text-center">
                          {club.competition_count}
                        </td>
                        <td className="px-4 py-3 text-slate-700 tabular-nums font-medium">
                          {formatPence(club.total_raised_pence)}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {formatDate(club.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/clubs/${club.id}`}
                            className="text-xs font-medium text-primary-600 hover:underline flex items-center gap-1 whitespace-nowrap"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3">
              <Paginator
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={ADMIN_PAGE_SIZE}
                basePath="/admin/clubs"
                searchParams={sp}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
