import { layout, h1, p, button, infoBox, kvTable, divider, plainText, url, esc } from './layout'
import type { BoostAwardNotificationData } from './types'

export function renderBoostAwardNotification(d: BoostAwardNotificationData) {
  const subject   = `⚡ You've won a Weekly Boost award! — ${d.awardAmount} for ${d.clubName}`
  const preheader = `${d.clubName} has been awarded ${d.awardAmount} from the ClubBoost Weekly Boost prize pool!`

  const content = [
    h1(`Weekly Boost award! ⚡`),
    p(`Hi ${esc(d.contactName)},`),
    p(`Fantastic news — <strong>${esc(d.clubName)}</strong> has been awarded <strong>${esc(d.awardAmount)}</strong> from the <strong>${esc(d.periodName)}</strong> Weekly Boost prize pool!`),
    infoBox(`
      <strong>⚡ ${esc(d.clubName)}: ${esc(d.awardAmount)} awarded</strong><br>
      ${d.notes ? `<p style="margin:8px 0 0;color:#475569;">${esc(d.notes)}</p>` : ''}
    `, 'success'),
    kvTable([
      ['Award amount', d.awardAmount],
      ['Period',       d.periodName],
    ]),
    p(`This is <em>on top of</em> your regular fundraising share — it's a bonus from the platform to support your club's efforts.`),
    button('View your Weekly Boost dashboard', d.dashboardUrl, '#d97706'),
    divider(),
    p(`The payout will be processed shortly and transferred to your Stripe account. You'll receive another email once it's on its way.`,
      { colour: '#94a3b8', size: '14px' }),
    p(`Keep running fundraisers — the more you raise, the stronger your case for future boost awards. 💪`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `Weekly Boost award — ${d.awardAmount} for ${d.clubName}!`,
    `Hi ${d.contactName},`,
    `${d.clubName} has been awarded ${d.awardAmount} from the ${d.periodName} Weekly Boost prize pool!`,
    ...(d.notes ? [`Note from ClubBoost: ${d.notes}`] : []),
    `The payout will be processed shortly.`,
    `Dashboard: ${d.dashboardUrl}`,
  ])

  return { subject, html, text }
}

export const boostAwardNotificationFixture: BoostAwardNotificationData = {
  contactName:  'Sarah Johnson',
  clubName:     'Northgate FC',
  periodName:   'Week 21 — 19 May 2026',
  awardAmount:  '£84.00',
  notes:        'Northgate FC had the highest contribution ratio this week — well done to the team!',
  dashboardUrl: url('/dashboard/weekly-boost'),
}
