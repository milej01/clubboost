import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import type { Club } from '@/types/app'

export function StripeOnboardingBanner({ club }: { club: Club }) {
  if (club.stripe_onboarded) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-amber-800">Connect your Stripe account</p>
        <p className="text-sm text-amber-700 mt-1">
          You need to connect a Stripe account before participants can pay entry fees.
          Your club&apos;s fundraising goes directly to your connected account.
        </p>
        <Link
          href="/dashboard/stripe"
          className="mt-2 inline-flex items-center text-sm font-medium text-amber-800 underline underline-offset-2"
        >
          Set up payments →
        </Link>
      </div>
    </div>
  )
}
