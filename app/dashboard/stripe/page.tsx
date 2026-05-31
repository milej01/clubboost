import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getClubsForUser } from '@/lib/services/clubs'
import { getAccountStatus, createOnboardingLink, createConnectAccount } from '@/lib/stripe/connect'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { CheckCircle, AlertTriangle, CreditCard } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Payment Setup' }

export default async function StripePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; refresh?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clubs = await getClubsForUser(user.id)
  const club = clubs[0]
  if (!club) redirect('/dashboard')

  let stripeStatus = null
  if (club.stripe_account_id) {
    try {
      stripeStatus = await getAccountStatus(club.stripe_account_id)
    } catch { /* account may not exist yet */ }
  }

  const onboardingUrl = async () => {
    if (!club.stripe_account_id) {
      const accountId = await createConnectAccount(club.id, club.contact_email)
      const link = await createOnboardingLink(accountId)
      return link.url
    }
    const link = await createOnboardingLink(club.stripe_account_id)
    return link.url
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payment setup</h1>
        <p className="text-slate-500 text-sm mt-1">
          Connect a Stripe account to receive fundraising payments from participants.
        </p>
      </div>

      {params.success === 'true' && (
        <Alert variant="success" title="Stripe connected!">
          Your Stripe account has been connected. Entry fees will now flow to your account minus the platform fee.
        </Alert>
      )}

      {params.refresh === 'true' && (
        <Alert variant="warning">
          Your Stripe onboarding session expired. Please restart below.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-slate-400" />
            <CardTitle>Stripe Connect</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!club.stripe_account_id ? (
            <>
              <p className="text-sm text-slate-600">
                ClubBoost uses Stripe to process payments. When you connect your account,
                participant entry fees flow directly to you (minus the platform fee).
                No ClubBoost team member ever touches your funds.
              </p>
              <form action={async () => {
                'use server'
                const url = await onboardingUrl()
                redirect(url)
              }}>
                <Button type="submit" size="lg">Connect with Stripe</Button>
              </form>
            </>
          ) : stripeStatus?.chargesEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-slate-900">Stripe account connected</p>
                  <p className="text-sm text-slate-500">Charges and payouts are enabled</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500">Charges</dt>
                  <dd className="font-medium">{stripeStatus.chargesEnabled ? '✅ Enabled' : '❌ Disabled'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Payouts</dt>
                  <dd className="font-medium">{stripeStatus.payoutsEnabled ? '✅ Enabled' : '❌ Disabled'}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium text-slate-900">Onboarding incomplete</p>
                  <p className="text-sm text-slate-500">Complete Stripe setup to receive payments</p>
                </div>
              </div>
              <form action={async () => {
                'use server'
                const url = await onboardingUrl()
                redirect(url)
              }}>
                <Button type="submit">Continue Stripe setup</Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <h3 className="text-sm font-medium text-slate-700 mb-2">How payments work</h3>
          <ul className="text-sm text-slate-600 space-y-1.5 list-disc list-inside">
            <li>Participants pay through a secure Stripe Checkout page</li>
            <li>Entry fees transfer directly to your Stripe account</li>
            <li>ClubBoost retains the platform service fee automatically</li>
            <li>Prize payouts are managed manually — you pay winners directly</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
