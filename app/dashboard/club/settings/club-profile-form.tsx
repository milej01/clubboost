'use client'

import { useState, useTransition } from 'react'
import { createClubAction, updateClubAction } from '@/actions/clubs'
import { CheckCircle2 } from 'lucide-react'
import type { Club } from '@/types/app'

const SPORTS = [
  'Football', 'Rugby', 'Cricket', 'Hockey', 'Netball', 'Basketball',
  'Tennis', 'Swimming', 'Athletics', 'Cycling', 'Rowing', 'Boxing',
  'Martial arts', 'Gymnastics', 'Volleyball', 'Baseball', 'Other',
]

interface Props {
  club?: Club | null  // null = new club creation mode
}

export function ClubProfileForm({ club }: Props) {
  const isNew = !club

  const [error,   setError]          = useState<string | null>(null)
  const [saved,   setSaved]          = useState(false)
  const [pending, startTransition]   = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = isNew
        ? await createClubAction(formData)
        : await updateClubAction(club!.id, formData)

      if (!result.success) {
        setError(result.error ?? 'Something went wrong')
      } else {
        setSaved(true)
        if (isNew) {
          // Redirect to dashboard after creating
          window.location.href = '/dashboard'
        }
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Club identity */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Club identity</h2>
          <p className="text-sm text-slate-400 mt-0.5">How your club appears on your public fundraiser page</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
              Club name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              required
              defaultValue={club?.name}
              placeholder="Riverside FC"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sport" className="block text-sm font-medium text-slate-700 mb-1.5">
                Sport <span className="text-red-500">*</span>
              </label>
              <select
                id="sport"
                name="sport"
                defaultValue={club?.sport ?? 'Football'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {SPORTS.map(s => (
                  <option key={s} value={s.toLowerCase()}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="team_age_group" className="block text-sm font-medium text-slate-700 mb-1.5">
                Age group <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="team_age_group"
                name="team_age_group"
                defaultValue={club?.team_age_group ?? ''}
                placeholder="e.g. Under 14s, Senior, All ages"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1.5">
              About your club <span className="text-slate-400 font-normal">(optional, up to 500 characters)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={club?.description ?? ''}
              maxLength={500}
              placeholder="A friendly community football club based in Riverside, Surrey…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
        </div>
      </section>

      {/* Contact details */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Contact details</h2>
          <p className="text-sm text-slate-400 mt-0.5">Used for payout coordination — not shown publicly</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-1.5">
              Club location <span className="text-red-500">*</span>
            </label>
            <input
              id="location"
              name="location"
              required
              defaultValue={club?.location}
              placeholder="Riverside, Surrey"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-400 mt-1">Town, county, or region — shown on your public page</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact_name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Contact name <span className="text-red-500">*</span>
              </label>
              <input
                id="contact_name"
                name="contact_name"
                required
                defaultValue={club?.contact_name}
                placeholder="Jane Smith"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="contact_phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                defaultValue={club?.contact_phone ?? ''}
                placeholder="+44 7700 900000"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact_email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Contact email <span className="text-red-500">*</span>
            </label>
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              required
              defaultValue={club?.contact_email}
              placeholder="secretary@riversidefc.co.uk"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-400 mt-1">Used for platform communications and payout queries</p>
          </div>
        </div>
      </section>

      {/* Status banner (read-only) */}
      {club && (
        <div className={`rounded-2xl border px-5 py-4 flex items-start gap-3 ${
          club.status === 'approved'
            ? 'border-green-200 bg-green-50'
            : club.status === 'pending'
              ? 'border-blue-200 bg-blue-50'
              : 'border-amber-200 bg-amber-50'
        }`}>
          <CheckCircle2 className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
            club.status === 'approved' ? 'text-green-500' : 'text-amber-500'
          }`} />
          <div>
            <p className={`text-sm font-semibold ${
              club.status === 'approved' ? 'text-green-800' : 'text-amber-800'
            }`}>
              {club.status === 'approved' && 'Club approved — you can run fundraisers'}
              {club.status === 'pending'  && 'Application under review'}
              {club.status === 'rejected' && `Application rejected${club.rejection_reason ? `: ${club.rejection_reason}` : ''}`}
              {club.status === 'suspended' && `Account suspended${club.suspension_reason ? `: ${club.suspension_reason}` : ''}`}
            </p>
            {club.status === 'pending' && (
              <p className="text-xs text-blue-700 mt-0.5">
                We&apos;ll review your application and notify you within 1–2 working days.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : isNew ? 'Create club' : 'Save changes'}
        </button>
        {saved && (
          <p className="text-sm font-medium text-green-600 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Saved!
          </p>
        )}
        {error && (
          <p className="text-sm font-medium text-red-600">{error}</p>
        )}
      </div>
    </form>
  )
}
