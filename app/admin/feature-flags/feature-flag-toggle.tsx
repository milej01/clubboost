'use client'

import { useState, useTransition } from 'react'
import { toggleFeatureFlagAction } from '@/actions/admin'

interface Props {
  flagKey: string
  enabled: boolean
}

export function FeatureFlagToggle({ flagKey, enabled: initialEnabled }: Props) {
  const [enabled, setEnabled]    = useState(initialEnabled)
  const [error,   setError]      = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle() {
    setError(null)
    const next = !enabled
    setEnabled(next) // optimistic
    startTransition(async () => {
      const res = await toggleFeatureFlagAction(flagKey, next)
      if (!res.success) {
        setEnabled(!next) // revert
        setError(res.error ?? 'Failed to update flag')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1 flex-shrink-0">
      <button
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 ${
          enabled ? 'bg-primary-600' : 'bg-slate-200'
        }`}
        role="switch"
        aria-checked={enabled}
        aria-label={`Toggle ${flagKey}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      {error && (
        <p className="text-xs text-red-600 max-w-[160px] text-right">{error}</p>
      )}
    </div>
  )
}
