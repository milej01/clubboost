import Link from 'next/link'
import { ArrowRight, BookOpen, CreditCard, Mail, MessageCircle, Settings, Trophy, Users, Zap } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Help Centre',
  description: 'Find answers about ClubBoost fundraising competitions, payments, and club management.',
}

const categories = [
  {
    icon: BookOpen,
    title: 'Getting started',
    desc: 'Register your club, create your first fundraiser and share it with supporters.',
    href: '/help/getting-started',
    articles: ['How to register your club', 'Creating your first competition', 'Setting your entry fee and split', 'Sharing your fundraiser link'],
  },
  {
    icon: Trophy,
    title: 'Competitions & fundraisers',
    desc: 'Learn how each competition type works and how to manage your fundraisers.',
    href: '/help/competitions',
    articles: ['Predictor competitions', 'Last Man Standing', 'Football Team Card', 'Donation fundraisers'],
  },
  {
    icon: CreditCard,
    title: 'Payments & payouts',
    desc: 'How entry fees work, when your club gets paid, and how to handle refunds.',
    href: '/help/payments',
    articles: ['How payments work', 'Connecting your Stripe account', 'When does my club get paid?', 'Requesting a refund'],
  },
  {
    icon: Zap,
    title: 'Weekly Boost',
    desc: 'Everything about the shared weekly prize pool for supporters.',
    href: '/weekly-boost',
    articles: ['What is the Weekly Boost?', 'How are winners chosen?', 'Claiming your prize', 'Is it extra cost to enter?'],
  },
  {
    icon: Users,
    title: 'For supporters',
    desc: 'How to enter competitions, track results and manage your entries.',
    href: '/help/supporters',
    articles: ['How to enter a competition', 'Tracking competition results', 'Managing your entries', 'Checking your payment history'],
  },
  {
    icon: Settings,
    title: 'Club admin',
    desc: 'Managing your club profile, team members and Stripe Connect settings.',
    href: '/help/admin',
    articles: ['Club profile and settings', 'Inviting team members', 'Stripe Connect setup', 'Viewing your audit log'],
  },
]

const popularArticles = [
  { title: 'How to create your first competition',       href: '/help/getting-started#first-competition' },
  { title: 'How much does ClubBoost cost?',              href: '/help/payments#fees' },
  { title: 'When does my club receive the money?',       href: '/help/payments#payouts' },
  { title: 'Do supporters need an account?',             href: '/help/supporters#account' },
  { title: 'How do I connect my Stripe account?',        href: '/help/payments#stripe' },
  { title: 'What is the Weekly Boost?',                  href: '/weekly-boost' },
]

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">

        {/* Hero */}
        <section className="bg-gradient-to-b from-primary-50 to-white px-4 py-16 sm:py-20 text-center">
          <div className="mx-auto max-w-content">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-5 tracking-tight">
              How can we help?
            </h1>
            <p className="text-lg text-slate-500 max-w-lg mx-auto mb-8">
              Find answers to common questions about ClubBoost competitions, payments and club management.
            </p>

            {/* Search placeholder */}
            <div className="mx-auto max-w-lg">
              <div className="relative">
                <input
                  type="search"
                  placeholder="Search for help..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 pr-12 text-slate-900 placeholder:text-slate-400 shadow-card focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors"
                  aria-label="Search help articles"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Popular articles */}
        <section className="section bg-white">
          <div className="section-inner">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Popular articles</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {popularArticles.map(({ title, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700 transition-colors group"
                >
                  <span>{title}</span>
                  <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 ml-2 text-slate-300 group-hover:text-primary-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="section bg-slate-50">
          <div className="section-inner">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Browse by topic</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(({ icon: Icon, title, desc, href, articles }) => (
                <Link key={title} href={href} className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-primary-300 hover:shadow-card transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-600 transition-colors">
                      <Icon className="h-5 w-5 text-primary-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-bold text-slate-900 group-hover:text-primary-700 transition-colors">{title}</h3>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">{desc}</p>
                  <ul className="space-y-1.5">
                    {articles.map(a => (
                      <li key={a} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <div className="h-1 w-1 rounded-full bg-slate-300 flex-shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary-600 group-hover:gap-2 transition-all">
                    Browse articles <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="section bg-white">
          <div className="section-inner">
            <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Still need help?</h2>
              <p className="text-slate-500 mb-8">
                Can&apos;t find what you&apos;re looking for? Our team is here to help grassroots clubs get the most out of ClubBoost.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="mailto:hello@clubboost.co.uk"
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
                >
                  <Mail className="h-4 w-4" />
                  Email us
                </a>
                <a
                  href="https://twitter.com/clubboost"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Message us on Twitter
                </a>
              </div>
              <p className="mt-6 text-xs text-slate-400">
                We typically respond within one business day.
              </p>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  )
}
