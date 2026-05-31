import { layout, h1, p, button, infoBox, kvTable, divider, plainText, url, esc } from './layout'
import type { PayoutCompletedData } from './types'

export function renderPayoutCompleted(d: PayoutCompletedData) {
  const subject   = `💸 Payout complete — ${d.payoutAmount} sent to ${d.clubName}`
  const preheader = `Your ${d.payoutAmount} payout has landed in your Stripe account. Ka-ching!`

  const content = [
    h1(`Payout complete! 💸`),
    p(`Hi ${esc(d.contactName)},`),
    p(`Your payout of <strong>${esc(d.payoutAmount)}</strong> has been transferred to <strong>${esc(d.clubName)}</strong>'s Stripe account. It will reach your bank account according to your Stripe payout schedule.`),
    kvTable([
      ['Payout amount', d.payoutAmount],
      ['Type',          d.payoutType],
      ['Reference',     d.reference],
      ['Date',          d.paidAt],
    ]),
    infoBox(`Money's in! 🎉 Check your Stripe dashboard to see the transfer and schedule your bank payout.`, 'success'),
    button('View dashboard', d.dashboardUrl),
    divider(),
    p(`Thank you for fundraising with ClubBoost — we love seeing money go straight to grassroots clubs like ${esc(d.clubName)}.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `Payout complete — ${d.payoutAmount} sent to ${d.clubName}`,
    `Hi ${d.contactName},`,
    `Your payout of ${d.payoutAmount} (${d.payoutType}) has been transferred to your Stripe account.`,
    `Reference: ${d.reference}`,
    `Date: ${d.paidAt}`,
    `Dashboard: ${d.dashboardUrl}`,
  ])

  return { subject, html, text }
}

export const payoutCompletedFixture: PayoutCompletedData = {
  contactName:  'Sarah Johnson',
  clubName:     'Northgate FC',
  payoutAmount: '£220.50',
  payoutType:   'Fundraising share',
  reference:    'tr_3Qx...4a7b',
  paidAt:       '26 May 2026',
  dashboardUrl: url('/dashboard/payments'),
}
