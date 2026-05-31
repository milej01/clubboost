import { layout, h1, p, button, infoBox, kvTable, divider, plainText, url } from './layout'
import type { ClubApplicationReceivedData } from './types'

export function renderClubApplicationReceived(d: ClubApplicationReceivedData) {
  const subject  = `New club application: ${d.clubName}`
  const preheader = `${d.clubName} (${d.sport}) has applied to join ClubBoost — review it now.`

  const content = [
    h1('New club application'),
    p(`A new club has applied to join ClubBoost and is waiting for your review.`),
    kvTable([
      ['Club name',    d.clubName],
      ['Sport',        d.sport],
      ['Location',     d.location],
      ['Contact name', d.contactName],
      ['Contact email', d.contactEmail],
    ]),
    button('Review application', d.adminReviewUrl),
    divider(),
    p(`Log in to the admin dashboard to approve, reject, or request more information from the club.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `New club application: ${d.clubName}`,
    `A new club has applied to join ClubBoost.`,
    `Club: ${d.clubName}`,
    `Sport: ${d.sport}`,
    `Location: ${d.location}`,
    `Contact: ${d.contactName} <${d.contactEmail}>`,
    `Review here: ${d.adminReviewUrl}`,
  ])

  return { subject, html, text }
}

/** Test / preview data */
export const clubApplicationReceivedFixture: ClubApplicationReceivedData = {
  clubName:       'Northgate FC',
  sport:          'Football',
  contactName:    'Sarah Johnson',
  contactEmail:   'sarah@northgatefc.co.uk',
  location:       'Norwich, Norfolk',
  adminReviewUrl: url('/admin/clubs/abc123'),
}
