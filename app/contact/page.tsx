import Link from 'next/link'
import type { Metadata } from 'next'
import { Mail } from 'lucide-react'

export const metadata: Metadata = { title: 'Contact us' }

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <Link href="/" className="text-sm text-primary-600 hover:underline mb-8 inline-block">← Back to ClubBoost</Link>
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 mb-6">
          <Mail className="h-7 w-7 text-primary-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Get in touch</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          We&apos;re a small team and read every message. Whether you have a question about setting up your club, need help with a competition, or just want to say hello — drop us a line.
        </p>
        <a
          href="mailto:hello@clubboost.co.uk"
          className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-8 py-4 text-base font-semibold text-white hover:bg-primary-700 transition-colors"
        >
          <Mail className="h-4 w-4" />
          hello@clubboost.co.uk
        </a>
        <p className="mt-6 text-sm text-slate-400">We aim to reply within one working day.</p>
      </div>
    </div>
  )
}
