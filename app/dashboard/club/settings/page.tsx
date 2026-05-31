import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, ExternalLink, CreditCard, CheckCircle2, AlertTriangle,
  Users, Shield,
} from 'lucide-react'
import type { Metadata } from 'next'

import { getClubsForUser } from '@/lib/services/clubs'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils'
import { ClubProfileForm } from './club-profile-form'

export const metadata: Metadata = { title: 'Club Settings — Dashboard' }

export default async function ClubSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clubs = await getClubsForUser(user.id)
  const club  = clubs[0] ?? null

  // Fetch team members if club exists
  const db = createAdminClient()
  const { data: members } = club
    ? await db
        .from('club_members')
        .select('user_id, role, joined_at, profiles(display_name, email)')
        .eq('club_id', club.id)
        .order('joined_at')
    : { data: [] }

  type Member = {
    user_id:  string
    role:     string
    joined_at: string | null
    profiles: { display_name?: string | null; email?: string | null } | null
  }

  const ROLE_LABELS: Record<string, string> = {
    owner:  'Owner',
    admin:  'Admin',
    member: 'Member',
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Club settings</h1>
          {club && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-slate-400">{club.name}</p>
              {club.slug && (
                <Link
                  href={`/c/${club.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary-600 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> Public page
                </Link>
              )}
            </div>
          )}
        </div>
        {club && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Building2 className="h-3.5 w-3.5" />
            Joined {formatDate(club.created_at)}
          </div>
        )}
      </div>

      {/* Profile form */}
      <ClubProfileForm club={club} />

      {/* Payment setup */}
      {club && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" /> Payment setup
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Required to receive fundraising payouts from participants
            </p>
          </div>
          <div className="px-6 py-5">
            {club.stripe_onboarded ? (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Stripe account connected</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Entry fee payments will flow directly to your account.
                  </p>
                  <Link
                    href="/dashboard/stripe"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                  >
                    Manage Stripe settings →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Stripe not set up</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Connect a Stripe account to receive participant entry fees.
                    Without this, fundraisers can&apos;t accept payments.
                  </p>
                  <Link
                    href="/dashboard/stripe"
                    className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                  >
                    Set up Stripe Connect →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Team members */}
      {club && members && members.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <Users className="h-4 w-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Team members</h2>
            <span className="ml-auto text-xs text-slate-400">{members.length} {members.length === 1 ? 'member' : 'members'}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {(members as Member[]).map(m => (
              <div key={m.user_id} className="flex items-center gap-3 px-6 py-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-slate-500">
                    {(m.profiles?.display_name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {m.profiles?.display_name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{m.profiles?.email ?? '—'}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                  m.role === 'owner'
                    ? 'bg-primary-100 text-primary-700'
                    : m.role === 'admin'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t border-slate-50 bg-slate-50">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              To add team members, contact ClubBoost support.
            </p>
          </div>
        </section>
      )}

    </div>
  )
}
