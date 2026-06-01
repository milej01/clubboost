import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Link href="/" className="text-sm text-primary-600 hover:underline mb-8 inline-block">← Back to ClubBoost</Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Terms of Service</h1>
        <p className="text-slate-500 mb-8">Last updated: May 2026</p>
        <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
          <p>By using ClubBoost you agree to these terms. Full terms are being finalised and will be published here shortly. In the meantime, please contact us at <a href="mailto:hello@clubboost.co.uk" className="text-primary-600 hover:underline">hello@clubboost.co.uk</a> with any questions.</p>
          <h2 className="text-xl font-semibold text-slate-900">Key points</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>ClubBoost is a fundraising platform, not a gambling operator.</li>
            <li>Predictor and Last Man Standing competitions are skill-based.</li>
            <li>Payments are processed securely by Stripe.</li>
            <li>Club admins are responsible for the accuracy of their competition details.</li>
            <li>ClubBoost takes a small platform fee on each entry to keep the service running.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
