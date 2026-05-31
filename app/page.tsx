import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Heart,
  Share2,
  ShieldCheck,
  Smartphone,
  Star,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { SegmentedProgress } from '@/components/ui/progress'

// ─── Data ──────────────────────────────────────────────────────────────────

const howItWorksSteps = [
  {
    number: '01',
    icon: ClipboardList,
    title: 'Create your fundraiser',
    desc: 'Choose a competition format, set your entry fee and dates, then hit publish. Takes about five minutes.',
  },
  {
    number: '02',
    icon: Share2,
    title: 'Share one link',
    desc: 'Send your link to supporters via WhatsApp, social media or your club newsletter. No app download needed.',
  },
  {
    number: '03',
    icon: Smartphone,
    title: 'Supporters enter in seconds',
    desc: 'They pick their numbers, pay by card and get a confirmation. Simple and safe, powered by Stripe.',
  },
  {
    number: '04',
    icon: CircleDollarSign,
    title: 'Funds go straight to your club',
    desc: 'When the competition closes, prize winners are paid and your club fundraising share is transferred to you.',
  },
]

const fundraiserTypes = [
  {
    emoji: '⚽',
    name: 'Predictor',
    tag: 'Most popular',
    desc: 'Supporters predict the outcome of upcoming fixtures. Pick correctly and you win a share of the prize pot.',
    examples: ['Weekend results', 'Cup draws', 'Season predictions'],
    color: 'bg-white border-primary-200',
    tagColor: 'bg-primary-100 text-primary-700',
  },
  {
    emoji: '🏆',
    name: 'Last Man Standing',
    tag: 'Season-long',
    desc: "Pick one team to win each week. Pick wrong and you're out. Last supporter standing wins the pot.",
    examples: ['Season-long contests', 'Mini-league rounds', 'Cup competitions'],
    color: 'bg-white border-boost-200',
    tagColor: 'bg-boost-100 text-boost-700',
  },
  {
    emoji: '🃏',
    name: 'Team Card',
    tag: 'Classic format',
    desc: 'Traditional football card where supporters pick a score and every correct guess wins a prize.',
    examples: ['Monthly cards', 'Match day cards', 'Seasonal draws'],
    color: 'bg-white border-club-200',
    tagColor: 'bg-club-100 text-club-700',
  },
  {
    emoji: '💚',
    name: 'Donation',
    tag: 'Simple giving',
    desc: 'No competition needed — just a direct way for supporters to donate to a cause or fund.',
    examples: ['Kit fund', 'Ground improvements', 'Travel appeal'],
    color: 'bg-white border-green-200',
    tagColor: 'bg-green-100 text-green-700',
  },
]

const reasons = [
  {
    icon: ShieldCheck,
    title: 'No subscriptions',
    desc: "ClubBoost is free to set up. We only take a small platform fee when you raise money — never upfront.",
  },
  {
    icon: Smartphone,
    title: 'Works on any phone',
    desc: "Supporters don't need to download anything. Your fundraiser link works in any browser, on any device.",
  },
  {
    icon: CheckCircle2,
    title: 'Transparent fees',
    desc: "See exactly what goes to your club, what goes into the prize pot, and what we charge — before you launch.",
  },
  {
    icon: Users,
    title: 'Built for grassroots',
    desc: 'Designed for clubs running these fundraisers themselves — not for agencies or professional outfits.',
  },
  {
    icon: Star,
    title: 'Supporter-friendly',
    desc: 'Supporters get a clear confirmation, can see live standings, and never feel pressured to spend more.',
  },
  {
    icon: Heart,
    title: 'Community first',
    desc: 'Every feature is designed to strengthen the relationship between your club and its supporters.',
  },
]

const feeSegments = [
  { label: 'Club fundraising',    pct: 60, color: 'bg-primary-500' },
  { label: 'Prize pot',           pct: 25, color: 'bg-boost-400' },
  { label: 'Platform fee (3%)',   pct: 8,  color: 'bg-slate-300' },
  { label: 'Card processing fee', pct: 5,  color: 'bg-slate-200' },
  { label: 'Weekly Boost',        pct: 2,  color: 'bg-club-400' },
]

const faqs = [
  {
    q: 'How much does ClubBoost cost?',
    a: "Free to set up and free to run. We charge a 3% platform fee on money collected, plus Stripe's standard card processing fee (1.5% + 25p per transaction). You see the full breakdown before you publish.",
  },
  {
    q: 'When does my club receive the money?',
    a: 'After the competition closes and winners are confirmed, your club fundraising share is transferred to your connected Stripe account — typically within 2–5 working days.',
  },
  {
    q: 'Do supporters need to create an account?',
    a: "No. Supporters can enter a competition using just their name, email and card details. There's no app to download and no account to create.",
  },
  {
    q: 'What is the Weekly Boost?',
    a: 'A small portion of every entry (around 2%) goes into a shared weekly prize pool across all ClubBoost clubs. Each week, one randomly selected active supporter wins the pot. It\'s a bonus for supporters at no extra cost to your club.',
  },
  {
    q: 'Can I run multiple fundraisers at once?',
    a: 'Yes. You can have multiple live competitions at the same time — useful if you have different teams or events running in parallel.',
  },
  {
    q: 'Is ClubBoost only for football clubs?',
    a: "We're built for grassroots football right now, but the platform works for any local sports club. Get in touch and we'll help you get set up.",
  },
]

// ─── Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-white to-white px-4 py-20 sm:py-28">
          {/* Decorative blobs */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-primary-100/60 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute top-40 -left-24 h-[320px] w-[320px] rounded-full bg-boost-100/40 blur-3xl" />

          <div className="relative mx-auto max-w-content text-center">
            {/* Pill badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-4 py-1.5 text-sm font-medium text-primary-700 shadow-sm">
              <Zap className="h-3.5 w-3.5" />
              Fundraising for grassroots football
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 mb-6 leading-tight tracking-tight">
              Help your club raise money{' '}
              <span className="text-primary-600">the easy way</span>
            </h1>

            <p className="mx-auto max-w-xl text-lg text-slate-500 leading-relaxed mb-10">
              Replace paper sheets and WhatsApp groups with simple online fundraisers.
              Supporters enter, you raise money — it really is that straightforward.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/clubs/signup"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-8 py-4 text-base font-semibold text-white hover:bg-primary-700 transition-colors shadow-cta"
              >
                Register your club — it&apos;s free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                See how it works
              </Link>
            </div>

            {/* Social proof strip */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> No setup fee</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> No monthly subscription</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> Payments by Stripe</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> Works on any phone</span>
            </div>
          </div>

          {/* Scroll cue */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce text-slate-300" aria-hidden="true">
            <ChevronDown className="h-6 w-6" />
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────── */}
        <section className="section bg-white" id="how-it-works">
          <div className="section-inner">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Up and running in minutes
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto">
                No training needed. No complicated setup. Just four simple steps to your first fundraiser.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {howItWorksSteps.map(({ number, icon: Icon, title, desc }) => (
                <div key={number} className="relative">
                  <div className="flex flex-col">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-md flex-shrink-0">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <span className="text-4xl font-black text-slate-100 tabular-nums select-none">{number}</span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link
                href="/clubs/signup"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-7 py-3.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
              >
                Get started for free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Fundraiser types ──────────────────────────────── */}
        <section className="section bg-slate-50" id="competitions">
          <div className="section-inner">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Four ways to fundraise
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto">
                From season-long competitions to simple one-off donations — choose the format that suits your club and supporters.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {fundraiserTypes.map(({ emoji, name, tag, desc, examples, color, tagColor }) => (
                <div
                  key={name}
                  className={`rounded-2xl border p-6 card-hover ${color}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl" role="img" aria-label={name}>{emoji}</span>
                      <h3 className="text-lg font-bold text-slate-900">{name}</h3>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold flex-shrink-0 ml-2 ${tagColor}`}>
                      {tag}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">{desc}</p>
                  <ul className="space-y-1.5">
                    {examples.map(ex => (
                      <li key={ex} className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="h-1 w-1 rounded-full bg-slate-300 flex-shrink-0" />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why clubs use ClubBoost ───────────────────────── */}
        <section className="section bg-white" id="why">
          <div className="section-inner">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Why clubs choose ClubBoost
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto">
                Designed around the way grassroots clubs actually work — not how enterprise software thinks they should.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reasons.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 card-hover">
                  <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-primary-100 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Weekly Boost ──────────────────────────────────── */}
        <section className="section bg-gradient-to-br from-amber-50 via-boost-50 to-white" id="weekly-boost">
          <div className="section-inner">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">

              {/* Text */}
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-boost-100 px-3 py-1 text-sm font-semibold text-boost-700">
                  <Zap className="h-3.5 w-3.5" />
                  Weekly Boost
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-5">
                  A bonus prize pool — every single week
                </h2>
                <p className="text-slate-600 leading-relaxed mb-6">
                  When supporters enter any ClubBoost fundraiser, a small share of their entry goes into a shared Weekly Boost pot. Each Friday, one lucky active supporter wins the lot.
                </p>
                <p className="text-slate-500 text-sm leading-relaxed mb-8">
                  It costs your club nothing extra. Supporters get an extra reason to take part. And the more clubs that use ClubBoost, the bigger the weekly prize grows.
                </p>

                <ul className="space-y-3 mb-8">
                  {[
                    'Drawn every Friday — fully automated',
                    "Open to any supporter who's entered that week",
                    'No additional cost to your club or your supporters',
                    'Winner announced publicly on the ClubBoost site',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-boost-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/weekly-boost"
                  className="inline-flex items-center gap-2 rounded-2xl bg-boost-500 px-6 py-3 text-sm font-semibold text-white hover:bg-boost-600 transition-colors shadow-boost"
                >
                  Learn about Weekly Boost
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Visual card */}
              <div className="rounded-3xl border border-boost-200 bg-white p-8 shadow-card-md">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-boost-100 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-boost-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">This week&apos;s pot</p>
                    <p className="text-3xl font-extrabold text-slate-900">£412</p>
                  </div>
                </div>

                <div className="rounded-xl bg-boost-50 px-4 py-3 mb-6 text-sm text-boost-700 font-medium">
                  🏆 Last week&apos;s winner: <strong>Sarah M.</strong> from Riverside FC won <strong>£387</strong>
                </div>

                <div className="space-y-3 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span>Entries contributing this week</span>
                    <span className="font-semibold text-slate-900 tabular-nums">1,284</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Clubs participating</span>
                    <span className="font-semibold text-slate-900 tabular-nums">38</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Draw date</span>
                    <span className="font-semibold text-slate-900">Friday 5pm</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
                  Weekly Boost is a free bonus — it doesn&apos;t replace your club fundraising
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Fees transparency ─────────────────────────────── */}
        <section className="section bg-white" id="pricing">
          <div className="section-inner">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Completely transparent fees
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto">
                No hidden costs. No surprises. Here&apos;s exactly where a typical entry fee goes — you set the percentages, so your club stays in control.
              </p>
            </div>

            <div className="mx-auto max-w-2xl">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-card">

                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-sm font-medium text-slate-500">Example: £5 entry fee</p>
                  <p className="text-sm text-slate-400">Typical split</p>
                </div>

                <SegmentedProgress segments={feeSegments} className="mb-6" />

                <div className="space-y-3">
                  {[
                    { label: 'Club fundraising',    amount: '£3.00',  pct: '60%', color: 'bg-primary-500', note: 'Goes straight to your club' },
                    { label: 'Prize pot',            amount: '£1.25',  pct: '25%', color: 'bg-boost-400',   note: 'Paid out to competition winner(s)' },
                    { label: 'Platform fee',         amount: '£0.15',  pct:  '3%', color: 'bg-slate-300',   note: 'ClubBoost platform fee' },
                    { label: 'Card processing',      amount: '~£0.32', pct: '~6%', color: 'bg-slate-200',   note: 'Stripe fee (1.5% + 25p)' },
                    { label: 'Weekly Boost',         amount: '£0.10',  pct:  '2%', color: 'bg-club-400',    note: 'Shared weekly supporter prize' },
                  ].map(({ label, amount, pct, color, note }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full flex-shrink-0 ${color}`} />
                      <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-800">{label}</span>
                          <span className="ml-2 text-xs text-slate-400 hidden sm:inline">{note}</span>
                        </div>
                        <div className="flex items-baseline gap-2 flex-shrink-0">
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">{amount}</span>
                          <span className="text-xs text-slate-400 tabular-nums w-8 text-right">{pct}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-xl bg-primary-50 border border-primary-100 px-4 py-3 text-sm text-primary-700">
                  <strong>You control the split.</strong> Set your own prize percentage and club share when you create each fundraiser.
                </div>
              </div>

              <div className="mt-6 text-center">
                <Link href="/pricing" className="text-sm font-medium text-primary-600 hover:underline">
                  See full pricing details →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Club signup CTA ───────────────────────────────── */}
        <section className="section bg-primary-600">
          <div className="section-inner text-center">
            <div className="mx-auto max-w-2xl">
              <div className="mb-6 inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-white/10">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5">
                Ready to boost your club?
              </h2>
              <p className="text-primary-100 text-lg leading-relaxed mb-10 max-w-lg mx-auto">
                Join hundreds of grassroots clubs already raising money through ClubBoost. Free to start — no card required.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/clubs/signup"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-semibold text-primary-700 hover:bg-primary-50 transition-colors shadow-lg"
                >
                  Register your club
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/help"
                  className="text-sm font-medium text-primary-200 hover:text-white transition-colors"
                >
                  Got questions? Visit our help centre
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-primary-200">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary-300" /> Free to set up</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary-300" /> No monthly fees</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary-300" /> Cancel any time</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQs ──────────────────────────────────────────── */}
        <section className="section bg-slate-50" id="faq">
          <div className="section-inner">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Common questions
              </h2>
              <p className="text-lg text-slate-500">
                Can&apos;t find what you&apos;re looking for?{' '}
                <Link href="/help" className="text-primary-600 hover:underline font-medium">
                  Visit our help centre
                </Link>
              </p>
            </div>

            <div className="mx-auto max-w-2xl space-y-3">
              {faqs.map(({ q, a }) => (
                <details
                  key={q}
                  className="group rounded-2xl border border-slate-200 bg-white open:shadow-card"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 font-medium text-slate-900 hover:text-primary-700 transition-colors select-none">
                    {q}
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 ml-3" />
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
