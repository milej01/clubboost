'use client'

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { upsertFeatureFlagAction } from '@/actions/admin'

export function NewFlagForm() {
  const [open,    setOpen]    = useState(false)
  const [key,     setKey]     = useState('')
  const [desc,    setDesc]    = useState('')
  const [enabled, setEnabled] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [pending, start]      = useTransition()

  function reset() {
    setOpen(false); setKey(''); setDesc(''); setEnabled(false); setError(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!key.trim()) { setError('Key is required'); return }
    setError(null)
    start(async () => {
      const res = await upsertFeatureFlagAction(key.trim(), enabled, desc.trim() || undefined)
      if (res.success) reset()
      else setError(res.error ?? 'Failed to create flag')
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <Plus className="h-4 w-4" /> New flag
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 w-72 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">New feature flag</p>
        <button type="button" onClick={reset} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Key</label>
        <input
          value={key}
          onChange={e => setKey(e.target.value.toLowerCase().replace(/\s/g, '_'))}
          placeholder="my_feature_flag"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-mono text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="What does this flag control?"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-slate-500">Enable immediately</label>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${enabled ? 'bg-primary-600' : 'bg-slate-200'}`}
          role="switch"
          aria-checked={enabled}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Creating…' : 'Create flag'}
      </button>
    </form>
  )
}
