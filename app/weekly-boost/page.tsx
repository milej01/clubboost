import Link from 'next/link'
import { ArrowRight, Calendar, CheckCircle2, Heart, Trophy, Users, Zap } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Weekly Boost',
  description: 'Every week, one lucky supporter wins a shared prize pool — just for entering a ClubBoost fundraiser.',
}

const howItWorks = [
  {
    icon: Heart,
    title: 'Support your club',
    desc: 'Enter any ClubBoost fundraiser competition in the normal way. A small share of your entry fee (around 2%) automatically goes into the Weekly Boost pot.',
  },
  {
    icon: Users,
    title: 'The pot builds all week',
    desc: 'Every supporter who enters any ClubBoost fundraiser that week contributes. The more clubs and supporters, the bigger the pot.',
  },
  {
    icon: Trophy,
    title: 'One winner, every Friday',
    desc: 'At 5pm every Friday, one randomly selected active supporter wins the entire pot. Winners are announced publicly here.',
  },
  {
    icon: Calendar,
    title: 'Resets every week',
    desc: 'The pot clears after each draw and starts building again. Enter a competition any week to be eligible.',
  },
]

const faqs = [
  {
    q: 'Does it cost anything extra?',
    a: 'No. The Weekly Boost contribution comes from within your existing entry fee — it is not an additional charge. Your club fundraising and prize pot are unaffected.',
  },
  {
    q: 'How are winners chosen?',
    a: 'One entry is selected at random from all eligible entries made during that week across all ClubBoost fundraisers. Every entry has an equal chance.',
  },
  {
    q: 'When is the draw?',
    a: 'Every Friday at 5pm. The winner is notified by email and announced on this page.',
  },
  {
    q: 'How do I collect my prize?',
    a: "If you win, we'll contact you by email to arrange payment. The prize is transferred directly to your bank account or via bank transfer.",
  },
  {
    q: "What if I've entered multiple competitions in one week?",
    a: 'Each entry gives you one chance in the draw. Entering multiple competitions means multiple chances.',
  },
  {
    q: 'Is this gambling?',
    a: "No. Weekly Boost is a free bonus that comes with your fundraising entry — you're already entering a competition to support your club. The small contribution to the shared pot is part of your entry fee, not a separate stake. Weekly Boost is a community benefit, not a gambling product.",
  },
]

// Simulated recent winners — replace with real DB query when live
const recentWinners = [
  { name: 'Sarah M.',   club: 'Riverside FC',       amount: 387,  week: '16 May 2025' },
  { name: 'Tom H.',     club: 'Northgate Athletic',  amount: 312,  week: '9 May 2025' },
  { name: 'Karen L.',   club: 'Village Wanderers',   amount: 441,  week: '2 May 2025' },
  { name: 'David P.',   club: 'Hillside United',     amount: 298,  week: '25 Apr 2025' },
]

export default function WeeklyBoostPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">

        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-boost-50 to-white px-4 py-20 sm:py-28">
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 h-[400px] w-[400px] rounded-full bg-boost-100/50 blur-3xl" />
          <div className="relative mx-auto max-w-content text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-boost-100 border border-boost-200 px-4 py-1.5 text-sm font-semibold text-boost-700">
              <Zap className="h-3.5 w-3.5" />
              Weekly Boost
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
              A shared prize pool — just for{' '}
              <span className="text-boost-600">supporting your club</span>
            </h1>
            <p className="mx-auto max-w-xl text-lg text-slate-500 leading-relaxed mb-10">
              Every week, one lucky supporter wins the collective Weekly Boost prize pot.
              All you have to do is enter any ClubBoost fundraiser — the rest is automatic.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl bg-boost-500 px-8 py-4 text-base font-semibold text-white hover:bg-boost-600 transition-colors shadow-boost"
              >
                Find a fundraiser to enter
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* This week's pot */}
        <section className="section bg-white">
          <div className="section-inner">
            <div className="mx-auto max-w-2xl">
              <div className="rounded-3xl border-2 border-boost-200 bg-gradient-to-br from-boost-50 to-white p-8 text-center shadow-boost">
                <p className="text-sm font-medium text-boost-600 uppercase tracking-wider mb-3">This week&apos;s prize pot</p>
                <p className="text-6xl font-black text-slate-900 mb-2 tabular-nums">£412</p>
                <p className="text-slate-500 text-sm mb-6">Drawn this Friday at 5pm</p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-2xl bg-white border border-slate-100 p-4">
                    <p className="text-xs text-slate-400 mb-1">Entries this week</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">1,284</p>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-100 p-4">
                    <p className="text-xs text-slate-400 mb-1">Clubs participating</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">38</p>
                  </div>
                </div>

                <div className="rounded-xl bg-boost-100 px-4 py-3 text-sm text-boost-700">
                  🏆 Last week&apos;s winner: <strong>Sarah M.</strong> from Riverside FC won <strong>£387</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="section bg-slate-50">
          <div className="section-inner">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">How Weekly Boost works</h2>
              <p className="text-lg text-slate-500 max-w-lg mx-auto">
                No extra steps. No extra cost. Just a free bonus for being a brilliant club supporter.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {howItWorks.map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-boost-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-boost-600" />
                    </div>
                    <span className="text-3xl font-black text-slate-100 tabular-nums select-none">0{i + 1}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recent winners */}
        <section className="section bg-white">
          <div className="section-inner">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Recent winners</h2>
              <p className="text-slate-500">Real supporters. Real clubs. Real prizes.</p>
            </div>
            <div className="mx-auto max-w-2xl space-y-3">
              {recentWinners.map(({ name, club, amount, week }) => (
                <div
                  key={week}
                  className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-boost-100 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-boost-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{name}</p>
                    <p className="text-xs text-slate-400">{club} · {week}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-extrabold text-boost-700 tabular-nums">£{amount}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Key facts */}
        <section className="section bg-boost-600">
          <div className="section-inner text-center">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold text-white mb-8">The simple facts</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { value: '~2%',     label: 'of each entry goes into the pot', note: 'Included in your entry fee' },
                  { value: 'Every Friday', label: 'one winner is selected', note: 'Draw at 5pm' },
                  { value: '£0',      label: 'extra cost to you', note: 'It\'s already in your entry' },
                ].map(({ value, label, note }) => (
                  <div key={label} className="rounded-2xl bg-white/10 p-5">
                    <p className="text-3xl font-extrabold text-white mb-1">{value}</p>
                    <p className="text-boost-100 text-sm font-medium mb-1">{label}</p>
                    <p className="text-boost-200 text-xs">{note}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-sm font-semibold text-boost-700 hover:bg-boost-50 transition-colors"
                >
                  Find a fundraiser to enter
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/clubs/signup"
                  className="text-sm font-medium text-boost-200 hover:text-white transition-colors"
                >
                  Register your club →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="section bg-slate-50">
          <div className="section-inner">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Questions about Weekly Boost</h2>
            </div>
            <div className="mx-auto max-w-2xl space-y-3">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group rounded-2xl border border-slate-200 bg-white open:shadow-card">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 font-medium text-slate-900 hover:text-boost-700 transition-colors select-none">
                    {q}
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-slate-300 group-open:text-boost-500 transition-colors ml-3" />
                  </summary>
                  <div className="px-6 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                    {a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  )
}
