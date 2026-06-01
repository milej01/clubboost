import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, Trophy, Users, CreditCard, ExternalLink, Clock } from 'lucide-react'
import type { Metadata } from 'next'

import { getAdminCompetitionDetail } from '@/lib/services/admin'
import { formatPence, formatDate, formatDateTime } from '@/lib/utils'
import { CompetitionControls } from './competition-controls'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-slate-100 text-slate-500' },
  open:      { label: 'Open',      cls: 'bg-green-100 text-green-700' },
  closed:    { label: 'Closed',    cls: 'bg-slate-100 text-slate-600' },
  settled:   { label: 'Settled',   cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
}

const ENTRY_STATUS: Record<string, { label: string; cls: string }> = {
  active:     { label: 'Active',     cls: 'bg-green-100 text-green-700' },
  winner:     { label: 'Winner',     cls: 'bg-primary-100 text-primary-700' },
  eliminated: { label: 'Eliminated', cls: 'bg-red-100 text-red-600' },
  pending:    { label: 'Pending',    cls: 'bg-amber-100 text-amber-700' },
}

const TYPE_LABELS: Record<string, string> = {
  predictor:         'Predictor',
  last_man_standing: 'Last Man Standing',
  team_card:         'Team Card',
  donation:          'Donation',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const detail  = await getAdminCompetitionDetail(id)
  return { title: detail ? `${detail.competition.title} — Admin` : 'Competition — Admin' }
}

export default async function AdminCompetitionDetailPage({ params }: PageProps) {
  const { id } = await params
  const detail  = await getAdminCompetitionDetail(id)
  if (!detail) notFound()

  const { competition: comp, entries, auditLogs } = detail
  const sc  = STATUS_CONFIG[comp.status] ?? { label: comp.status, cls: 'bg-slate-100 text-slate-500' }
  const club = comp.club as { name: string; slug: string; id: string } | null

  const entryCount      = entries.length
  const totalPot        = entryCount * (comp.entry_fee_pence ?? 0)
  const activeCount     = entries.filter((e: { status: string }) => e.status === 'active').length
  const eliminatedCount = entries.filter((e: { status: string }) => e.status === 'eliminated').length
  const winnerCount     = entries.filter((e: { status: string }) => e.status === 'winner').length

  type Entry = {
    id:           string
    status:       string
    created_at:   string
    entry_data:   Record<string, unknown> | null
    participant_id: string
    profiles:     { display_name?: string | null; email?: string | null } | null
  }

  type AuditLog = {
    id:          string
    action:      string
    created_at:  string
    after_state: Record<string, unknown> | null
    actor_id:    string | null
    profiles:    { display_name?: string | null } | null
  }

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/admin/competitions" className="hover:text-slate-600 transition-colors">
          Competitions
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-700 font-medium truncate max-w-xs">{comp.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{comp.title}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sc.cls}`}>
              {sc.label}
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500">
            {club && (
              <Link href={`/admin/clubs/${club.id}`} className="text-primary-600 hover:underline">
                {club.name}
              </Link>
            )}
            <span className="capitalize">{TYPE_LABELS[comp.type] ?? comp.type}</span>
            <span>{formatPence(comp.entry_fee_pence ?? 0)} entry</span>
            {comp.closes_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Closes {formatDate(comp.closes_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2.5">
            {club && (
              <a
                href={`/c/${club.slug}/${comp.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary-600 transition-colors"
              >
                Public page <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <span className="text-xs text-slate-400">Created {formatDate(comp.created_at)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full lg:w-80">
          <CompetitionControls competitionId={comp.id} currentStatus={comp.status} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total entries',  value: entryCount.toString(),      icon: Users,     accent: '' },
          { label: 'Active',         value: activeCount.toString(),      icon: Users,     accent: activeCount > 0 ? 'text-green-600' : '' },
          { label: 'Prize pot',      value: formatPence(totalPot),       icon: Trophy,    accent: 'text-primary-700' },
          { label: 'Winners',        value: winnerCount.toString(),      icon: Trophy,    accent: winnerCount > 0 ? 'text-primary-600' : '' },
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

      {/* Entries table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Users className="h-4 w-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Entries</h2>
          <span className="ml-auto text-xs text-slate-400">
            {entryCount} total · {activeCount} active · {eliminatedCount} eliminated
          </span>
        </div>
        {entries.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="h-6 w-6 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No entries yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Participant', 'Email', 'Status', 'Entered', 'Selection'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(entries as unknown as Entry[]).map(entry => {
                  const es = ENTRY_STATUS[entry.status] ?? { label: entry.status, cls: 'bg-slate-100 text-slate-500' }
                  const selection = entry.entry_data
                    ? Object.values(entry.entry_data).slice(0, 2).join(', ')
                    : '—'
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {entry.profiles?.display_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {entry.profiles?.email ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${es.cls}`}>
                          {es.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[180px]">
                        {selection}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit log */}
      {auditLogs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <CreditCard className="h-4 w-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Audit trail</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {(auditLogs as unknown as AuditLog[]).map(log => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{log.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    by {log.profiles?.display_name ?? 'System'} · {formatDateTime(log.created_at)}
                  </p>
                  {log.after_state && (
                    <p className="text-xs font-mono text-slate-400 mt-1 truncate">
                      {JSON.stringify(log.after_state)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
