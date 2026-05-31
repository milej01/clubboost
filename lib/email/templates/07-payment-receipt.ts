import { layout, h1, p, kvTable, infoBox, divider, plainText, url, esc } from './layout'
import type { PaymentReceiptData } from './types'

export function renderPaymentReceipt(d: PaymentReceiptData) {
  const subject   = `Payment receipt — ${d.fundraiserTitle}`
  const preheader = `Receipt for your £${d.amount} payment to ${d.clubName} via ClubBoost.`

  const content = [
    h1('Payment receipt'),
    p(`Hi ${esc(d.participantName)},`),
    p(`Here's your receipt for your entry to <strong>${esc(d.fundraiserTitle)}</strong>. Keep this for your records.`),
    kvTable([
      ['Amount',       d.amount],
      ['To',           d.clubName],
      ['Fundraiser',   d.fundraiserTitle],
      ['Date',         d.paymentDate],
      ['Payment',      d.paymentMethod],
      ['Reference',    d.transactionRef],
    ]),
    infoBox(`
      <strong>Where does your money go?</strong><br>
      Your entry fee goes directly to <strong>${esc(d.clubName)}</strong> (minus a small prize pot and platform fee). Every penny supports grassroots sport in your community.
    `, 'success'),
    divider(),
    p(`Questions about this payment? Reply to this email or visit your <a href="${esc(d.dashboardUrl)}" style="color:#7c3aed;">ClubBoost dashboard</a>.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `Payment receipt — ${d.fundraiserTitle}`,
    `Hi ${d.participantName},`,
    `Here's your receipt for your entry to ${d.fundraiserTitle}.`,
    `Amount: ${d.amount}`,
    `To: ${d.clubName}`,
    `Date: ${d.paymentDate}`,
    `Payment: ${d.paymentMethod}`,
    `Reference: ${d.transactionRef}`,
    `View your entries: ${d.dashboardUrl}`,
  ])

  return { subject, html, text }
}

export const paymentReceiptFixture: PaymentReceiptData = {
  participantName: 'James Wilson',
  fundraiserTitle: 'Northgate FC Score Predictor — Matchday 12',
  clubName:        'Northgate FC',
  amount:          '£5.00',
  paymentDate:     '21 May 2026',
  paymentMethod:   'Visa ending 4242',
  transactionRef:  'pi_3Qx...4a7b',
  dashboardUrl:    url('/my/dashboard'),
}
