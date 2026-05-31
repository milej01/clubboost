import type { Metadata } from 'next'
import { Settings } from 'lucide-react'

import { getPlatformSettings } from '@/lib/services/admin'
import { SettingsForm } from './settings-form'

export const metadata: Metadata = { title: 'Platform Settings — Admin' }

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettings()

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-slate-400" />
          Platform settings
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Global configuration for the ClubBoost platform. All changes are audit-logged.
        </p>
      </div>

      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          Failed to load platform settings. Check your database connection.
        </div>
      )}
    </div>
  )
}
