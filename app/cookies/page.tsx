import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Cookie Policy' }

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Link href="/" className="text-sm text-primary-600 hover:underline mb-8 inline-block">← Back to ClubBoost</Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Cookie Policy</h1>
        <p className="text-slate-500 mb-8">Last updated: May 2026</p>
        <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
          <p>ClubBoost uses cookies to keep you logged in and to make the site work correctly. We do not use advertising or tracking cookies.</p>
          <h2 className="text-xl font-semibold text-slate-900">Cookies we use</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Session cookie</strong> — keeps you logged in while you browse</li>
            <li><strong>Auth cookie</strong> — set by Supabase to manage your session securely</li>
          </ul>
          <p>No third-party advertising or analytics cookies are set. Questions? Email <a href="mailto:hello@clubboost.co.uk" className="text-primary-600 hover:underline">hello@clubboost.co.uk</a></p>
        </div>
      </div>
    </div>
  )
}
