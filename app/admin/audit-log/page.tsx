import { ScrollText } from 'lucide-react'
import type { Metadata } from 'next'

import { getAdminAuditLog, ADMIN_PAGE_SIZE } from '@/lib/services/admin'
import { FilterBar }  from '@/components/admin/filter-bar'
import { Paginator }  from '@/components/admin/paginator'
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Audit Log — Admin' }

const ENTITY_TABS = [
  { label: 'All',           value: '' },
  { label: 'Clubs',         value: 'club' },
  { label: 'Competitions',  value: 'competition' },
  { label: 'Payments',      value: 'payment' },
  { label: 'Flags',         value: 'feature_flag' },
]

const ACTION_COLOURS: Record<string, string> = {
  club_approved:             'bg-green-100 text-green-700',
  club_rejected:             'bg-red-100 text-red-600',
  club_suspended:            'bg-amber-100 text-amber-700',
  competition_cancelled:     'bg-red-100 text-red-600',
  competition_settled:       'bg-blue-100 text-blue-700',
  competition_status_changed:'bg-slate-100 text-slate-600',
  admin_override:            'bg-purple-100 text-purple-700',
  payment_refunded:          'bg-orange-100 text-orange-700',
}

interface PageProps {
  searchParams: Promise<{ entity_type?: string; q?: string; page?: string }>
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const sp          = await searchParams
  const entity_type = sp.entity_type ?? ''
  const q           = sp.q           ?? ''
  const page        = Math.max(1, parseInt(sp.page ?? '1'))

  const { logs, total, totalPages } = await getAdminAuditLog({
    entity_type: entity_type || undefined,
    q:           q           || undefined,
    page,
  })

  const tabs = ENTITY_TABS

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total.toLocaleString()} entries</p>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        tabs={tabs}
        placeholder="Search by action or entity ID…"
        filterKey="entity_type"
        searchKey="q"
        extras={
          <p className="text-sm text-slate-400 ml-auto">
            {total.toLocaleString()} result{total !== 1 ? 's' : ''}
          </p>
        }
      />

      {/* Log table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <ScrollText className="h-8 w-8 mx-auto mb-3 text-slate-200" />
            <p className="text-sm">No log entries match your search</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['When', 'Actor', 'Entity', 'Action', 'Details'].map(h => (
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
                  {logs.map(log => {
                    const actionCls = ACTION_COLOURS[log.action] ?? 'bg-slate-100 text-slate-600'
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {log.actor_name ?? <span className="text-slate-400 italic">System</span>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-slate-600 capitalize">
                            {log.entity_type.replace(/_/g, ' ')}
                          </p>
                          {log.entity_id && (
                            <p className="text-xs font-mono text-slate-300 mt-0.5">
                              {log.entity_id.slice(0, 8)}…
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${actionCls}`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 max-w-xs">
                          {log.after_state ? (
                            <code className="block truncate font-mono">
                              {JSON.stringify(log.after_state)}
                            </code>
                          ) : '—'}
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
                basePath="/admin/audit-log"
                searchParams={sp}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
