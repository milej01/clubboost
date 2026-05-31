import { layout, h1, p, infoBox, kvTable, divider, plainText, url, esc } from './layout'
import type { PayoutPendingData } from './types'

export function renderPayoutPending(d: PayoutPendingData) {
  const subject   = `Payout on its way — ${d.payoutAmount} for ${d.clubName}`
  const preheader = `A payout of ${d.payoutAmount} has been initiated and is on its way to your Stripe account.`

  const content = [
    h1(`Payout initiated 💰`),
    p(`Hi ${esc(d.contactName)},`),
    p(`Great news — a payout of <strong>${esc(d.payoutAmount)}</strong> is on its way to <strong>${esc(d.clubName)}</strong>'s connected Stripe account.`),
    kvTable([
      ['Payout amount', d.payoutAmount],
      ['Type',          d.payoutType],
      ['Expected',      `${d.estimatedDays} working days`],
    ]),
    infoBox(`
      Your payout will appear in your Stripe balance within <strong>${d.estimatedDays} working days</strong>, then transfer to your bank account according to your Stripe payout schedule (typically 2–7 days after that).
    `, 'success'),
    divider(),
    p(`You can track the status from your <a href="${esc(d.dashboardUrl)}" style="color:#7c3aed;">ClubBoost dashboard</a>.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `Payout initiated — ${d.payoutAmount} for ${d.clubName}`,
    `Hi ${d.contactName},`,
    `A payout of ${d.payoutAmount} (${d.payoutType}) has been initiated.`,
    `Expected in: ${d.estimatedDays} working days`,
    `Track it: ${d.dashboardUrl}`,
  ])

  return { subject, html, text }
}

export const payoutPendingFixture: PayoutPendingData = {
  contactName:   'Sarah Johnson',
  clubName:      'Northgate FC',
  payoutAmount:  '£220.50',
  payoutType:    'Fundraising share',
  estimatedDays: 3,
  dashboardUrl:  url('/dashboard/payments'),
}
