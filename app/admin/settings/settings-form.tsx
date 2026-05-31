'use client'

import { useState, useTransition } from 'react'
import { updatePlatformSettingsAction } from '@/actions/admin'
import type { PlatformSettings } from '@/lib/services/admin'

interface Props {
  settings: PlatformSettings
}

function bpsToDisplay(bps: number) {
  return (bps / 100).toFixed(2)
}

function penceToPounds(p: number) {
  return (p / 100).toFixed(2)
}

export function SettingsForm({ settings }: Props) {
  const [platformFee,   setPlatformFee]   = useState(bpsToDisplay(settings.platform_fee_bps))
  const [boostRate,     setBoostRate]     = useState(bpsToDisplay(settings.weekly_boost_default_bps))
  const [minFee,        setMinFee]        = useState(penceToPounds(settings.min_entry_fee_pence))
  const [maxFee,        setMaxFee]        = useState(penceToPounds(settings.max_entry_fee_pence))
  const [termsVersion,  setTermsVersion]  = useState(settings.terms_version)
  const [message,       setMessage]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition]        = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const platformFeeBps = Math.round(parseFloat(platformFee) * 100)
    const boostBps       = Math.round(parseFloat(boostRate) * 100)
    const minPence       = Math.round(parseFloat(minFee) * 100)
    const maxPence       = Math.round(parseFloat(maxFee) * 100)

    if (isNaN(platformFeeBps) || isNaN(boostBps) || isNaN(minPence) || isNaN(maxPence)) {
      setMessage({ type: 'err', text: 'Please enter valid numbers in all fields.' })
      return
    }

    startTransition(async () => {
      const res = await updatePlatformSettingsAction({
        platform_fee_bps:         platformFeeBps,
        weekly_boost_default_bps: boostBps,
        min_entry_fee_pence:      minPence,
        max_entry_fee_pence:      maxPence,
        terms_version:            termsVersion.trim(),
      })
      setMessage(
        res.success
          ? { type: 'ok', text: 'Settings saved.' }
          : { type: 'err', text: res.error ?? 'Failed to save settings.' },
      )
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* Fee section */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Fee configuration</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Set the platform's revenue and boost contribution rates.
          </p>
        </div>
        <div className="px-6 py-5 grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Platform fee (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="20"
                value={platformFee}
                onChange={e => setPlatformFee(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {Math.round(parseFloat(platformFee || '0') * 100)} bps · capped at 20%
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Weekly Boost contribution (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={boostRate}
                onChange={e => setBoostRate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {Math.round(parseFloat(boostRate || '0') * 100)} bps · capped at 10%
            </p>
          </div>
        </div>
      </section>

      {/* Entry fee limits */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Entry fee limits</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Clubs must set entry fees within these bounds.
          </p>
        </div>
        <div className="px-6 py-5 grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Minimum entry fee (£)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">£</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={minFee}
                onChange={e => setMinFee(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Maximum entry fee (£)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">£</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={maxFee}
                onChange={e => setMaxFee(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Terms version */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Terms &amp; conditions</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Bump the version number to require all users to re-accept terms.
          </p>
        </div>
        <div className="px-6 py-5 max-w-xs">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Current terms version
          </label>
          <input
            value={termsVersion}
            onChange={e => setTermsVersion(e.target.value)}
            placeholder="e.g. 1.1"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        {message && (
          <p className={`text-sm font-medium ${message.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  )
}
