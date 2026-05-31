'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Zap } from 'lucide-react'

const SPORTS = [
  'Football (11-a-side)',
  'Football (5/6/7-a-side)',
  'Rugby Union',
  'Rugby League',
  'Cricket',
  'Hockey',
  'Netball',
  'Basketball',
  'Other',
]

const benefits = [
  'Free to set up — no card required',
  'Create your first fundraiser in minutes',
  'Transparent fees — see exactly what you earn',
  'Supporters pay by card, no app needed',
]

export default function ClubSignupPage() {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    clubName:  '',
    sport:     '',
    location:  '',
    firstName: '',
    lastName:  '',
    email:     '',
    phone:     '',
    message:   '',
  })

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // In production: POST to /api/clubs/register
    // For now, simulate success after a short delay
    await new Promise(r => setTimeout(r, 1200))
    setLoading(false)
    setStep('success')
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-100">
            <CheckCircle2 className="h-10 w-10 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-3">Application received!</h1>
            <p className="text-slate-500 leading-relaxed">
              Thanks for registering <strong className="text-slate-700">{form.clubName}</strong>. We&apos;ll review your application and get back to you at <strong className="text-slate-700">{form.email}</strong> within 1–2 working days.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 text-left space-y-3">
            <p className="text-sm font-semibold text-slate-700">What happens next?</p>
            {[
              "We'll review your club details and approve your account",
              "You'll get an email to set up your password and connect Stripe",
              "Once approved, you can create your first fundraiser immediately",
            ].map(item => (
              <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircle2 className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline">
            ← Back to homepage
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">Club<span className="text-primary-600">Boost</span></span>
          </Link>
          <div className="text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">

          {/* Left — pitch */}
          <div className="lg:sticky lg:top-24">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-sm font-semibold text-primary-700">
              <Zap className="h-3.5 w-3.5" />
              Free to get started
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-5 leading-tight">
              Register your club and start fundraising today
            </h1>
            <p className="text-slate-500 leading-relaxed mb-8">
              Tell us about your club and we&apos;ll have you up and running within 1–2 working days.
              No commitment, no monthly fees — just simple fundraising for grassroots sport.
            </p>
            <ul className="space-y-3 mb-8">
              {benefits.map(b => (
                <li key={b} className="flex items-center gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-primary-500 flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="rounded-2xl bg-primary-50 border border-primary-100 p-5">
              <p className="text-sm font-semibold text-primary-800 mb-1">Trusted by clubs across England</p>
              <p className="text-sm text-primary-600 leading-relaxed">
                "ClubBoost replaced our paper sheets overnight. Our first competition raised £800 in a weekend — and the committee didn&apos;t have to chase a single payment."
              </p>
              <p className="text-xs text-primary-500 mt-2 font-medium">— Club Secretary, Sunday League FC</p>
            </div>
          </div>

          {/* Right — form */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-card-md">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Club registration</h2>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Club details */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                  About your club
                </legend>

                <div>
                  <label htmlFor="clubName" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Club name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="clubName"
                    type="text"
                    required
                    value={form.clubName}
                    onChange={e => update('clubName', e.target.value)}
                    placeholder="e.g. Riverside FC"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="sport" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Sport <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="sport"
                    required
                    value={form.sport}
                    onChange={e => update('sport', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors bg-white"
                  >
                    <option value="">Select your sport</option>
                    {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Town / city <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="location"
                    type="text"
                    required
                    value={form.location}
                    onChange={e => update('location', e.target.value)}
                    placeholder="e.g. Manchester"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors"
                  />
                </div>
              </fieldset>

              <div className="border-t border-slate-100 pt-2" />

              {/* Contact details */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                  Your contact details
                </legend>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1.5">
                      First name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      required
                      value={form.firstName}
                      onChange={e => update('firstName', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Last name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      required
                      value={form.lastName}
                      onChange={e => update('lastName', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="you@yourclub.co.uk"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Phone number <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={e => update('phone', e.target.value)}
                    placeholder="07700 900000"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Anything else? <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="message"
                    rows={3}
                    value={form.message}
                    onChange={e => update('message', e.target.value)}
                    placeholder="Tell us a bit about your club and what you hope to raise money for"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors resize-none"
                  />
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 py-4 text-base font-semibold text-white hover:bg-primary-700 transition-colors shadow-cta disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Register your club
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-400">
                By registering you agree to our{' '}
                <Link href="/terms" className="hover:underline">Terms of service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="hover:underline">Privacy policy</Link>.
              </p>
            </form>
          </div>

        </div>
      </main>
    </div>
  )
}
