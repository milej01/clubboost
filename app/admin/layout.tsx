import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/nav/admin-nav'
import { logoutAction } from '@/actions/auth'
import Link from 'next/link'
import { ExternalLink, LogOut, Shield } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-900 px-4 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 group">
            <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white">ClubBoost</span>
            <span className="text-slate-400 text-sm font-medium">Admin</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Club dashboard</span>
            </Link>
            <div className="h-4 w-px bg-slate-700" />
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
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
            <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <AdminNav />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  )
}
