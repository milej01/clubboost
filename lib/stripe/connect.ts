import { stripe } from './client'
import { createAdminClient } from '@/lib/supabase/admin'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function createConnectAccount(clubId: string, email: string) {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'GB',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'non_profit',
    settings: {
      payouts: {
        schedule: { interval: 'manual' },
      },
    },
  })

  const db = createAdminClient()
  await db
    .from('clubs')
    .update({ stripe_account_id: account.id })
    .eq('id', clubId)

  return account.id
}

export async function createOnboardingLink(stripeAccountId: string) {
  return stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${BASE_URL}/dashboard/stripe?refresh=true`,
    return_url:  `${BASE_URL}/dashboard/stripe?success=true`,
    type: 'account_onboarding',
  })
}

export async function createLoginLink(stripeAccountId: string) {
  return stripe.accounts.createLoginLink(stripeAccountId)
}

export async function getAccountStatus(stripeAccountId: string) {
  const account = await stripe.accounts.retrieve(stripeAccountId)
  return {
    chargesEnabled:   account.charges_enabled,
    payoutsEnabled:   account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements:     account.requirements,
  }
}
