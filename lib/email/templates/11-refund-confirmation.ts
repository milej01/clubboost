import { layout, h1, p, kvTable, infoBox, divider, plainText, url, esc } from './layout'
import type { RefundConfirmationData } from './types'

export function renderRefundConfirmation(d: RefundConfirmationData) {
  const subject   = `Refund confirmed — ${d.fundraiserTitle}`
  const preheader = `Your refund of ${d.refundAmount} is on its way back to your original payment method.`

  const content = [
    h1('Refund confirmed ↩️'),
    p(`Hi ${esc(d.participantName)},`),
    p(`We've processed a refund for your entry to <strong>${esc(d.fundraiserTitle)}</strong>.`),
    kvTable([
      ['Refund amount',    d.refundAmount],
      ['Reason',           d.reason],
      ['Original payment', d.originalPaymentDate],
      ['Expected',         `${d.estimatedDays} working days`],
    ]),
    infoBox(`
      Your refund will appear on your original payment method within <strong>${d.estimatedDays} working days</strong>. Processing times vary by bank — if it hasn't arrived after ${d.estimatedDays + 2} days, please get in touch.
    `, 'default'),
    divider(),
    p(`Sorry your experience wasn't what you hoped for. If you have questions, just reply to this email.`,
      { colour: '#94a3b8', size: '14px' }),
    p(`<a href="${esc(d.dashboardUrl)}" style="color:#7c3aed;">View your entries</a>`,
      { colour: '#94a3b8', size: '14px', mb: '0' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `Refund confirmed — ${d.fundraiserTitle}`,
    `Hi ${d.participantName},`,
    `We've processed your refund.`,
    `Amount: ${d.refundAmount}`,
    `Reason: ${d.reason}`,
    `Original payment: ${d.originalPaymentDate}`,
    `Expected in: ${d.estimatedDays} working days`,
    `Questions? Just reply to this email.`,
    `Your dashboard: ${d.dashboardUrl}`,
  ])

  return { subject, html, text }
}

export const refundConfirmationFixture: RefundConfirmationData = {
  participantName:     'James Wilson',
  fundraiserTitle:     'Northgate FC Score Predictor — Matchday 12',
  refundAmount:        '£5.00',
  reason:              'Competition cancelled by the club',
  estimatedDays:       5,
  originalPaymentDate: '21 May 2026',
  dashboardUrl:        url('/my/dashboard'),
}
