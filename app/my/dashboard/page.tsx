import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Heart,
  Receipt,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import type { Metadata } from 'next'

import { formatPence, formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { isFeatureEnabled } from '@/lib/feature-flags'

export const metadata: Metadata = { title: 'My entries' }

// ── Data fetchers ───────────────────────────────────────────

async function getParticipantSummary(userId: string) {
  const db = await createClient()

  // Entries with competition + club data
  const { data: entries } = await db
    .from('entries')
    .select(`
      id, status, created_at, entry_data,
      competition:competitions (
        id, title, type, status, closes_at, entry_fee_pence,
        club:clubs ( id, name, slug )
      )
    `)
    .eq('participant_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Payments summary
  const { data: payments } = await db
    .from('payments')
    .select('id, amount_pence, status, created_at, competition_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    entries:  entries ?? [],
    payments: payments ?? [],
  }
}

// ── Status helpers ──────────────────────────────────────────

const ENTRY_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:          { label: 'Active',          color: 'bg-green-100 text-green-700' },
  winner:          { label: 'Winner! 🏆',      color: 'bg-amber-100 text-amber-700' },
  eliminated:      { label: 'Eliminated',      color: 'bg-slate-100 text-slate-500' },
  pending_payment: { label: 'Payment pending', color: 'bg-blue-100 text-blue-700' },
  cancelled:       { label: 'Cancelled',       color: 'bg-red-100 text-red-500' },
}

const TYPE_EMOJI: Record<string, string> = {
  predictor:         '⚽',
  last_man_standing: '🏆',
  team_card:         '🃏',
  donation:          '💚',
}

// ── Page ───────────────────────────────────────────────────

export default async function ParticipantDashboardPage() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  const [{ entries, payments }, weeklyBoostEnabled] = await Promise.all([
    getParticipantSummary(user.id),
    isFeatureEnabled('weekly_boost'),
  ])

  const activeEntries   = entries.filter(e => e.status === 'active')
  const winnerEntries   = entries.filter(e => e.status === 'winner')
  const totalSpentPence = payments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount_pence, 0)

  const firstName = user.user_metadata?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-primary-600" aria-label="ClubBoost home">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-bold">ClubBoost</span>
          </Link>
          <Link href="/login" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            Sign out
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Hello, {firstName}!</h1>
          <p className="text-slate-500 text-sm">Here&apos;s everything you&apos;ve entered across ClubBoost fundraisers.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active entries', value: activeEntries.length,  icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
            { label: 'Prizes won',     value: winnerEntries.length,  icon: Trophy,       color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
            { label: 'Total entered',  value: entries.length,         icon: Users,        color: 'text-primary-600', bg: 'bg-primary-50 border-primary-100' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 text-center ${bg}`}>
              <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Weekly Boost notice */}
        {weeklyBoostEnabled && activeEntries.length > 0 && (
          <div className="rounded-2xl border border-boost-200 bg-boost-50 p-4 flex items-start gap-3">
            <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-boost-100 flex items-center justify-center">
              <Zap className="h-4 w-4 text-boost-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm mb-1">You&apos;re in the Weekly Boost draw!</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                You have {activeEntries.length} active {activeEntries.length === 1 ? 'entry' : 'entries'} this week.
                The draw is every Friday at 5pm.{' '}
                <Link href="/weekly-boost" className="text-boost-700 hover:underline font-medium">
                  Learn more
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Active entries */}
        <section>
          <h2 className="font-semibold text-slate-900 mb-3">Active entries</h2>
          {activeEntries.length === 0 ? (
            <EmptyState
              emoji="⚽"
              title="No active entries"
              description="Find a club fundraiser to enter and support grassroots sport."
              size="sm"
              action={
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                >
                  Browse fundraisers
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {activeEntries.map(entry => {
                const comp = entry.competition as any
                const club = comp?.club as any
                const status = ENTRY_STATUS_CONFIG[entry.status] ?? { label: entry.status, color: 'bg-slate-100 text-slate-500' }
                return (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0 mt-0.5" role="img" aria-label={comp?.type}>
                        {TYPE_EMOJI[comp?.type] ?? '🎯'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm leading-tight">{comp?.title ?? 'Competition'}</p>
                            {club && (
                              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {club.name}
                              </p>
                            )}
                          </div>
                          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-400">
                          {comp?.entry_fee_pence > 0 && (
                            <span className="flex items-center gap-1">
                              <Receipt className="h-3 w-3" />
                              {formatPence(comp.entry_fee_pence)}
                            </span>
                          )}
                          {comp?.closes_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Closes {formatDate(comp.closes_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {comp?.id && club?.slug && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <Link
                          href={`/c/${club.slug}/${comp.id}`}
                          className="flex items-center justify-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                        >
                          View competition <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Past entries */}
        {entries.filter(e => !['active', 'pending_payment'].includes(e.status)).length > 0 && (
          <section>
            <h2 className="font-semibold text-slate-900 mb-3">Past entries</h2>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {entries
                .filter(e => !['active', 'pending_payment'].includes(e.status))
                .slice(0, 8)
                .map((entry, i, arr) => {
                  const comp   = entry.competition as any
                  const club   = comp?.club as any
                  const status = ENTRY_STATUS_CONFIG[entry.status] ?? { label: entry.status, color: 'bg-slate-100 text-slate-500' }
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-3 px-5 py-4 ${i < arr.length - 1 ? 'border-b border-slate-50' : ''}`}
                    >
                      <span className="text-lg flex-shrink-0" role="img" aria-label={comp?.type}>
                        {TYPE_EMOJI[comp?.type] ?? '🎯'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{comp?.title ?? 'Competition'}</p>
                        <p className="text-xs text-slate-400">{club?.name} · {formatDate(entry.created_at)}</p>
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {/* Payment summary */}
        {totalSpentPence > 0 && (
          <section>
            <div className="rounded-2xl border border-slate-100 bg-white p-5 flex items-center gap-4 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Receipt className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Total entered across all clubs</p>
                <p className="text-xl font-extrabold text-slate-900 tabular-nums">{formatPence(totalSpentPence)}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-400 mb-0.5">All going to grassroots sport</p>
                <Heart className="h-5 w-5 text-red-400 ml-auto" />
              </div>
            </div>
          </section>
        )}

        {/* Find more fundraisers */}
        <div className="rounded-2xl bg-primary-600 p-6 text-center">
          <p className="font-bold text-white mb-2">Find more fundraisers to support</p>
          <p className="text-primary-100 text-sm mb-5">Every entry supports a local grassroots club</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
          >
            Browse all fundraisers
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </main>
    </div>
  )
}
