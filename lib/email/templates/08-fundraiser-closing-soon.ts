import { layout, h1, p, button, infoBox, kvTable, divider, plainText, url, esc } from './layout'
import type { FundraiserClosingSoonData } from './types'

export function renderFundraiserClosingSoon(d: FundraiserClosingSoonData) {
  const subject   = `⏰ "${d.fundraiserTitle}" closes in ${d.daysLeft} day${d.daysLeft !== 1 ? 's' : ''}!`
  const preheader = `${d.entryCount} entries so far, ${d.raisedSoFar} raised. Push for more before it closes.`

  const urgencyColour = d.daysLeft <= 1 ? 'danger' : d.daysLeft <= 3 ? 'warning' : 'default'

  const content = [
    h1(`Closing soon — push for more entries!`),
    p(`Hi ${esc(d.contactName)},`),
    p(`<strong>${esc(d.fundraiserTitle)}</strong> closes on ${esc(d.closingDate)} — that's in just <strong>${d.daysLeft} day${d.daysLeft !== 1 ? 's' : ''}</strong>. Now's the time to give it one last share!`),
    infoBox(`
      <strong>⚽ ${d.entryCount} entries so far · ${esc(d.raisedSoFar)} raised for ${esc(d.clubName)}</strong>
    `, urgencyColour),
    kvTable([
      ['Entries',    String(d.entryCount)],
      ['Raised',     d.raisedSoFar],
      ['Closes',     d.closingDate],
    ]),
    button('View your fundraiser', d.fundraiserUrl),
    infoBox(`
      <strong>💬 One last push — try sharing this:</strong><br><br>
      <em>"Only ${d.daysLeft} day${d.daysLeft !== 1 ? 's' : ''} left to enter ${esc(d.fundraiserTitle)}! Jump in and support ${esc(d.clubName)} — entries from just a few pounds. ${esc(d.fundraiserUrl)}"</em>
    `),
    divider(),
    p(`Once it closes, you can view the final results and settle the competition from your <a href="${esc(d.dashboardUrl)}" style="color:#7c3aed;">dashboard</a>.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content, unsubscribeUrl: '#unsubscribe' })

  const text = plainText([
    `"${d.fundraiserTitle}" closes in ${d.daysLeft} day${d.daysLeft !== 1 ? 's' : ''}!`,
    `Hi ${d.contactName},`,
    `${d.fundraiserTitle} closes on ${d.closingDate}.`,
    `Entries so far: ${d.entryCount}`,
    `Raised so far: ${d.raisedSoFar}`,
    `View your fundraiser: ${d.fundraiserUrl}`,
    `Dashboard: ${d.dashboardUrl}`,
  ])

  return { subject, html, text }
}

export const fundraiserClosingSoonFixture: FundraiserClosingSoonData = {
  contactName:     'Sarah Johnson',
  clubName:        'Northgate FC',
  fundraiserTitle: 'Northgate FC Score Predictor — Matchday 12',
  entryCount:      47,
  raisedSoFar:     '£183.40',
  closingDate:     'Saturday 25 May at 3:00 PM',
  daysLeft:        2,
  fundraiserUrl:   'https://clubboost.co.uk/c/northgate-fc/comp123',
  dashboardUrl:    url('/dashboard'),
}
