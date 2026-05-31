import Link from 'next/link'
import { Trophy, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'

import { getAdminCompetitions, ADMIN_PAGE_SIZE } from '@/lib/services/admin'
import { FilterBar } from '@/components/admin/filter-bar'
import { Paginator }  from '@/components/admin/paginator'
import { formatPence, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Competitions — Admin' }

const STATUS_TABS = [
  { label: 'All',       value: '' },
  { label: 'Open',      value: 'open' },
  { label: 'Draft',     value: 'draft' },
  { label: 'Closed',    value: 'closed' },
  { label: 'Settled',   value: 'settled' },
]

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-slate-100 text-slate-500' },
  open:      { label: 'Open',      cls: 'bg-green-100 text-green-700' },
  closed:    { label: 'Closed',    cls: 'bg-slate-100 text-slate-600' },
  settled:   { label: 'Settled',   cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
}

const TYPE_LABELS: Record<string, string> = {
  predictor:        'Predictor',
  last_man_standing:'Last Man Standing',
  team_card:        'Team Card',
  donation:         'Donation',
}

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string; club_id?: string }>
}

export default async function AdminCompetitionsPage({ searchParams }: PageProps) {
  const sp      = await searchParams
  const status  = sp.status  ?? ''
  const q       = sp.q       ?? ''
  const page    = Math.max(1, parseInt(sp.page ?? '1'))
  const club_id = sp.club_id ?? ''

  const { competitions, total, totalPages } = await getAdminCompetitions({
    status: status || undefined,
    q:      q      || undefined,
    page,
    club_id: club_id || undefined,
  })

  // Tab counts
  const [
    { total: allTotal },
    { total: openTotal },
    { total: draftTotal },
    { total: closedTotal },
    { total: settledTotal },
  ] = await Promise.all([
    getAdminCompetitions({ q, club_id: club_id || undefined }),
    getAdminCompetitions({ status: 'open',    q, club_id: club_id || undefined }),
    getAdminCompetitions({ status: 'draft',   q, club_id: club_id || undefined }),
    getAdminCompetitions({ status: 'closed',  q, club_id: club_id || undefined }),
    getAdminCompetitions({ status: 'settled', q, club_id: club_id || undefined }),
  ])

  const tabs = [
    { label: 'All',     value: '',        count: allTotal },
    { label: 'Open',    value: 'open',    count: openTotal },
    { label: 'Draft',   value: 'draft',   count: draftTotal },
    { label: 'Closed',  value: 'closed',  count: closedTotal },
    { label: 'Settled', value: 'settled', count: settledTotal },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Competitions
            {club_id && <span className="text-lg font-normal text-slate-400 ml-2">filtered by club</span>}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">{allTotal.toLocaleString()} total</p>
        </div>
        {club_id && (
          <Link
            href="/admin/competitions"
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            ← Clear club filter
          </Link>
        )}
      </div>

      {/* Filter bar */}
      <FilterBar
        tabs={tabs}
        placeholder="Search by title…"
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
        {competitions.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Trophy className="h-8 w-8 mx-auto mb-3 text-slate-200" />
            <p className="text-sm">No competitions match your search</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Competition', 'Club', 'Type', 'Status', 'Entry fee', 'Entries', 'Pot', 'Closes', ''].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {competitions.map(comp => {
                    const sc = STATUS_CONFIG[comp.status] ?? { label: comp.status, cls: 'bg-slate-100 text-slate-500' }
                    return (
                      <tr key={comp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 truncate max-w-[180px]">{comp.title}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/clubs/${comp.club_id}`}
                            className="text-sm text-primary-600 hover:underline"
                          >
                            {comp.club_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {TYPE_LABELS[comp.type] ?? comp.type}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sc.cls}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-700">
                          {formatPence(comp.entry_fee_pence)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-center text-slate-700">
                          {comp.entry_count}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium text-slate-700">
                          {formatPence(comp.total_pot_pence)}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {comp.closes_at ? formatDate(comp.closes_at) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/competitions/${comp.id}`}
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

            <div className="px-4 py-3">
              <Paginator
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={ADMIN_PAGE_SIZE}
                basePath="/admin/competitions"
                searchParams={sp}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
