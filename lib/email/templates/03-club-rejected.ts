import { layout, h1, p, infoBox, divider, plainText, esc } from './layout'
import type { ClubRejectedData } from './types'

export function renderClubRejected(d: ClubRejectedData) {
  const subject   = `Update on your ClubBoost application — ${d.clubName}`
  const preheader = `We've reviewed your application for ${d.clubName}.`

  const reasonBox = d.reason
    ? infoBox(`<strong>Reason:</strong><br>${esc(d.reason)}`, 'warning')
    : ''

  const content = [
    h1('Application update'),
    p(`Hi ${esc(d.contactName)},`),
    p(`Thank you for applying to join ClubBoost with <strong>${esc(d.clubName)}</strong>. After reviewing your application, we're unable to approve it at this time.`),
    reasonBox,
    divider(),
    p(`If you think this decision was made in error, or if you'd like more information, please get in touch with our team at <a href="mailto:${esc(d.supportEmail)}" style="color:#7c3aed;">${esc(d.supportEmail)}</a>. We're happy to chat.`),
    p(`We know how much work goes into running a grassroots club, and we hope we can work together in the future.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `Update on your ClubBoost application — ${d.clubName}`,
    `Hi ${d.contactName},`,
    `Thank you for applying to ClubBoost with ${d.clubName}. Unfortunately, we're unable to approve your application at this time.`,
    ...(d.reason ? [`Reason: ${d.reason}`] : []),
    `If you have questions, please contact us at ${d.supportEmail}.`,
    `We hope to work with you in the future.`,
  ])

  return { subject, html, text }
}

export const clubRejectedFixture: ClubRejectedData = {
  contactName:  'Sarah Johnson',
  clubName:     'Northgate FC',
  reason:       'We were unable to verify the club\'s registration details. Please reapply with your official FA registration number.',
  supportEmail: 'hello@clubboost.co.uk',
}
