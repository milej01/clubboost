import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Link href="/" className="text-sm text-primary-600 hover:underline mb-8 inline-block">← Back to ClubBoost</Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Privacy Policy</h1>
        <p className="text-slate-500 mb-8">Last updated: May 2026</p>
        <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
          <p>ClubBoost takes your privacy seriously. Our full privacy policy is being finalised. In the meantime, here is what you need to know:</p>
          <h2 className="text-xl font-semibold text-slate-900">What we collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Your name and email address when you register</li>
            <li>Payment details — processed and stored by Stripe, never by ClubBoost</li>
            <li>Competition entries and results</li>
          </ul>
          <h2 className="text-xl font-semibold text-slate-900">How we use it</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To run competitions and process payments</li>
            <li>To send you entry confirmations and results</li>
            <li>We never sell your data to third parties</li>
          </ul>
          <p>Questions? Email <a href="mailto:hello@clubboost.co.uk" className="text-primary-600 hover:underline">hello@clubboost.co.uk</a></p>
        </div>
      </div>
    </div>
  )
}
