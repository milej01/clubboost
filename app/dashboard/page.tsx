import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CreditCard,
  ExternalLink,
  Plus,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import type { Metadata } from 'next'

import { getClubsForUser, getClubStats } from '@/lib/services/clubs'
import { getCompetitionsForClub } from '@/lib/services/competitions'
import { CompetitionCard } from '@/components/competitions/competition-card'
import { StripeOnboardingBanner } from '@/components/clubs/stripe-onboarding-banner'
import { EmptyState } from '@/components/ui/empty-state'
import { formatPence } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clubs = await getClubsForUser(user.id)

  // ── No club yet ────────────────────────────────────────────
  if (!clubs.length) {
    return (
      <EmptyState
        icon={Building2}
        title="Welcome to ClubBoost"
        description="Get started by creating your club profile. Once approved, you can launch competitions and start fundraising."
        size="lg"
        action={
          <Link
            href="/dashboard/club/settings?new=true"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-7 py-3.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create your club
          </Link>
        }
      />
    )
  }

  const club = clubs[0]
  const [stats, competitions] = await Promise.all([
    getClubStats(club.id),
    getCompetitionsForClub(club.id),
  ])

  const activeCompetitions = competitions.filter(c => c.status === 'open')
  const recentCompetitions = competitions.slice(0, 6)

  // ── Main dashboard ─────────────────────────────────────────
  return (
    <div className="space-y-7">

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Club dashboard</p>
          <h1 className="text-2xl font-bold text-slate-900">{club.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              club.status === 'approved'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {club.status === 'approved' ? 'Active' : 'Pending review'}
            </span>
            {club.slug && (
              <Link
                href={`/c/${club.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                View public page <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
        {club.status === 'approved' && (
          <Link
            href="/dashboard/competitions/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm flex-shrink-0 self-start"
          >
            <Plus className="h-4 w-4" />
            New competition
          </Link>
        )}
      </div>

      {/* Stripe onboarding banner */}
      <StripeOnboardingBanner club={club} />

      {/* Pending banner */}
      {club.status === 'pending' && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800 flex items-start gap-3">
          <div className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-200 flex items-center justify-center mt-0.5">
            <span className="text-blue-700 text-xs font-bold">i</span>
          </div>
          <div>
            <p className="font-semibold mb-0.5">Your club application is being reviewed</p>
            <p className="text-blue-600">We&apos;ll notify you by email as soon as it&apos;s been approved. This usually takes 1–2 working days.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label:     'Total raised',
            value:     formatPence(stats.total_raised_pence),
            icon:      TrendingUp,
            highlight: true,
          },
          {
            label: 'Competitions',
            value: stats.competition_count,
            icon:  Trophy,
          },
          {
            label: 'Active now',
            value: stats.active_count,
            icon:  Zap,
          },
          {
            label: 'Total entries',
            value: stats.entry_count,
            icon:  Users,
          },
        ].map(({ label, value, icon: Icon, highlight }) => (
          <div
            key={label}
            className={`rounded-2xl border p-5 ${
              highlight
                ? 'border-primary-200 bg-primary-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                highlight ? 'bg-primary-600' : 'bg-slate-100'
              }`}>
                <Icon className={`h-3.5 w-3.5 ${highlight ? 'text-white' : 'text-slate-400'}`} />
              </div>
            </div>
            <p className={`text-2xl font-extrabold tabular-nums ${
              highlight ? 'text-primary-700' : 'text-slate-900'
            }`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Active competitions */}
      {activeCompetitions.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Live now</h2>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              {activeCompetitions.length} active
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeCompetitions.map(c => (
              <CompetitionCard key={c.id} competition={c} clubSlug={club.slug} showActions />
            ))}
          </div>
        </section>
      )}

      {/* All competitions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Recent competitions</h2>
          <Link
            href="/dashboard/competitions"
            className="flex items-center gap-1 text-sm text-primary-600 hover:underline font-medium"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {competitions.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Trophy className="h-6 w-6 text-slate-300" />
            </div>
            <p className="font-medium text-slate-700 mb-1">No competitions yet</p>
            <p className="text-sm text-slate-400 mb-5">Create your first competition to start fundraising.</p>
            {club.status === 'approved' && (
              <Link
                href="/dashboard/competitions/new"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create competition
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {recentCompetitions.map(c => (
              <CompetitionCard key={c.id} competition={c} clubSlug={club.slug} showActions />
            ))}
          </div>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 className="font-semibold text-slate-900 mb-4">Quick links</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: CreditCard, label: 'Payments & payouts', href: '/dashboard/payments', desc: 'View your financial history' },
            { icon: Users,       label: 'Club settings',      href: '/dashboard/club/settings', desc: 'Profile, team & Stripe setup' },
            { icon: Zap,         label: 'Weekly Boost',       href: '/weekly-boost', desc: 'About the weekly prize pool' },
          ].map(({ icon: Icon, label, href, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 hover:border-primary-300 hover:shadow-card transition-all group"
            >
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                <Icon className="h-5 w-5 text-slate-400 group-hover:text-primary-600 transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-primary-700 transition-colors">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-200 group-hover:text-primary-400 transition-colors ml-auto flex-shrink-0" />
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
