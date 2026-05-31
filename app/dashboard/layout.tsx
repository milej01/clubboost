import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getClubsForUser } from '@/lib/services/clubs'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { DashboardNav } from '@/components/nav/dashboard-nav'
import { logoutAction } from '@/actions/auth'
import Link from 'next/link'
import { Building2, ExternalLink, LogOut, Zap } from 'lucide-react'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check role — participants belong at /my/dashboard, not the club dashboard
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'participant') redirect('/my/dashboard')

  const [clubs, weeklyBoostEnabled] = await Promise.all([
    getClubsForUser(user.id),
    isFeatureEnabled('weekly_boost'),
  ])

  const primaryClub = clubs[0] ?? null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur px-4 py-3 shadow-sm">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 group" aria-label="ClubBoost dashboard">
            <div className="h-7 w-7 rounded-lg bg-primary-600 flex items-center justify-center group-hover:bg-primary-700 transition-colors">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">
              Club<span className="text-primary-600">Boost</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Club name + public page link */}
            {primaryClub && (
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium">{primaryClub.name}</span>
                {primaryClub.slug && (
                  <Link
                    href={`/c/${primaryClub.slug}`}
                    target="_blank"
                    className="text-slate-300 hover:text-primary-500 transition-colors ml-1"
                    aria-label="View public page"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}

            {/* Sign out */}
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors rounded-lg px-2 py-1.5 hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <div className="sticky top-20 space-y-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <DashboardNav weeklyBoostEnabled={weeklyBoostEnabled} />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
