import { layout, h1, p, button, infoBox, divider, plainText, url, esc } from './layout'
import type { ClubApprovedData } from './types'

export function renderClubApproved(d: ClubApprovedData) {
  const subject   = `You're in! ${d.clubName} has been approved on ClubBoost`
  const preheader = `Welcome to ClubBoost — your club is approved and ready to start fundraising.`

  const content = [
    h1(`Welcome to ClubBoost! 🎉`),
    p(`Hi ${esc(d.contactName)},`),
    p(`Great news — <strong>${esc(d.clubName)}</strong> has been approved on ClubBoost. You're all set to start fundraising for your club!`),
    infoBox(`
      <strong>What happens next?</strong><br>
      <ol style="margin:8px 0 0;padding-left:20px;">
        <li style="margin-bottom:6px;">Connect your Stripe account to receive payments from supporters</li>
        <li style="margin-bottom:6px;">Create your first fundraiser — a Predictor, Last Man Standing, or Team Card</li>
        <li style="margin-bottom:0;">Share your fundraiser link and watch the entries roll in!</li>
      </ol>
    `),
    button('Go to your dashboard', d.dashboardUrl),
    divider(),
    p(`Once you've set up your Stripe account you can start accepting entry fees straight away.`,
      { colour: '#475569', size: '14px' }),
    button('Connect Stripe account', d.stripeSetupUrl, '#0f172a'),
    divider(),
    p(`Questions? Reply to this email — we're a small team and we reply to every message.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `Welcome to ClubBoost! ${d.clubName} has been approved.`,
    `Hi ${d.contactName},`,
    `Great news — ${d.clubName} has been approved on ClubBoost. You're all set to start fundraising!`,
    `Next steps:`,
    `1. Connect Stripe: ${d.stripeSetupUrl}`,
    `2. Create your first fundraiser from your dashboard`,
    `3. Share with your supporters`,
    `Go to your dashboard: ${d.dashboardUrl}`,
    `Questions? Just reply to this email.`,
  ])

  return { subject, html, text }
}

export const clubApprovedFixture: ClubApprovedData = {
  contactName:    'Sarah Johnson',
  clubName:       'Northgate FC',
  dashboardUrl:   url('/dashboard'),
  stripeSetupUrl: url('/dashboard/stripe'),
}
