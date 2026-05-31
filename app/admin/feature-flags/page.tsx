import type { Metadata } from 'next'
import { Flag } from 'lucide-react'

import { getAllFeatureFlags } from '@/lib/services/admin'
import { formatDateTime } from '@/lib/utils'
import { FeatureFlagToggle } from './feature-flag-toggle'
import { NewFlagForm } from './new-flag-form'

export const metadata: Metadata = { title: 'Feature Flags — Admin' }

export default async function FeatureFlagsPage() {
  const flags = await getAllFeatureFlags()

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feature flags</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Toggle platform features without deploying. Changes take effect immediately.
          </p>
        </div>
        <NewFlagForm />
      </div>

      {/* Flags list */}
      {flags.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <Flag className="h-8 w-8 mx-auto mb-3 text-slate-200" />
          <p className="text-sm text-slate-400">No feature flags found. Create one above.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
          {flags.map(flag => (
            <div key={flag.key} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-semibold text-slate-900">{flag.key}</p>
                <p className="text-sm text-slate-500 mt-0.5 truncate">{flag.description}</p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Updated {formatDateTime(flag.updated_at)}
                </p>
              </div>
              <FeatureFlagToggle flagKey={flag.key} enabled={flag.enabled} />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Flags are cached per request. Allow a few seconds for changes to propagate.
      </p>
    </div>
  )
}
