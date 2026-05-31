'use client'

import { SOURCE_LABELS } from '@/lib/services/boost-calculator'
import type { BoostFundItem } from '@/types/app'

interface Props {
  items: BoostFundItem[]
}

function sourceChip(source: BoostFundItem['source_type']) {
  const map: Record<string, string> = {
    competition_payment: 'bg-blue-100 text-blue-700',
    sponsor:             'bg-purple-100 text-purple-700',
    platform_marketing:  'bg-indigo-100 text-indigo-700',
    admin_topup:         'bg-slate-100 text-slate-600',
  }
  const label = SOURCE_LABELS[source] ?? source
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[source] ?? 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  )
}

export function ContributionsTable({ items }: Props) {
  const total = items.reduce((sum, i) => sum + i.amount_pence, 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <th className="px-6 py-3 text-left">Source</th>
            <th className="px-6 py-3 text-left">Club / Competition</th>
            <th className="px-6 py-3 text-left">Description</th>
            <th className="px-6 py-3 text-left">Date</th>
            <th className="px-6 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-6 py-3">
                {sourceChip(item.source_type)}
              </td>
              <td className="px-6 py-3 text-slate-700">
                {item.club?.name ?? (item.club_id ? item.club_id : '—')}
                {item.competition_id && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    comp: {item.competition_id}
                  </div>
                )}
              </td>
              <td className="px-6 py-3 text-slate-500 text-xs max-w-xs truncate">
                {item.description ?? '—'}
              </td>
              <td className="px-6 py-3 text-slate-500 text-xs">
                {item.created_at
                  ? new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })
                  : '—'}
              </td>
              <td className="px-6 py-3 text-right font-mono">
                £{(item.amount_pence / 100).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
            <td colSpan={4} className="px-6 py-3 text-slate-700">Total</td>
            <td className="px-6 py-3 text-right font-mono text-slate-900">
              £{(total / 100).toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
